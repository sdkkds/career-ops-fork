import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  selectDigest, renderDigest, readDecisionsFile, readCursor, writeCursor,
} from '../digest.mjs';

const DIGEST_MJS = join(dirname(fileURLToPath(import.meta.url)), '..', 'digest.mjs');

const LINES = [
  JSON.stringify({ status: 'completed', score: 4.2, company: 'Acme', role: 'Senior PM', url: 'https://x.test/1', evaluated_at: '2026-07-26 06:10' }),
  JSON.stringify({ status: 'completed', score: 2.1, company: 'Low', role: 'PM', url: 'https://x.test/2', evaluated_at: '2026-07-26 06:11' }),
  JSON.stringify({ status: 'failed', score: null, company: 'Dead', role: 'PM', url: 'https://x.test/3', evaluated_at: '2026-07-26 06:12' }),
];

test('selects only completed results at or above the threshold', () => {
  const { items } = selectDigest(LINES, { minScore: 3.0 });
  assert.equal(items.length, 1);
  assert.equal(items[0].company, 'Acme');
});

test('an empty night still produces a heartbeat', () => {
  const { items, heartbeat } = selectDigest([], { minScore: 3.0 });
  assert.equal(items.length, 0);
  assert.equal(heartbeat.evaluated, 0);
  assert.equal(heartbeat.sendRequired, false);
});

test('heartbeat counts failures separately from low scores', () => {
  const { heartbeat } = selectDigest(LINES, { minScore: 3.0 });
  assert.equal(heartbeat.evaluated, 3);
  assert.equal(heartbeat.failed, 1);
  assert.equal(heartbeat.belowThreshold, 1);
  assert.equal(heartbeat.sendRequired, true);
});

test('malformed lines are counted, not silently dropped', () => {
  const { heartbeat } = selectDigest([...LINES, 'not json'], { minScore: 3.0 });
  assert.equal(heartbeat.unparseable, 1);
});

test('render includes score, company, role and URL for each item', () => {
  const { items } = selectDigest(LINES, { minScore: 3.0 });
  const body = renderDigest(items);
  assert.match(body, /Acme/);
  assert.match(body, /4\.2/);
  assert.match(body, /https:\/\/x\.test\/1/);
});

// --- Finding 3: a record missing evaluated_at must never bypass --since ---

test('a record with no evaluated_at does not bypass --since, but is counted', () => {
  const linesWithMissingTimestamp = [
    ...LINES,
    JSON.stringify({ status: 'completed', score: 4.9, company: 'NoTime', role: 'PM', url: 'https://x.test/4' }),
  ];
  const { items, heartbeat } = selectDigest(linesWithMissingTimestamp, { minScore: 3.0, since: '2026-07-26 00:00' });
  assert.equal(items.some(i => i.company === 'NoTime'), false, 'a timestamp-less record must not be freshly emailed');
  assert.equal(heartbeat.noTimestamp, 1, 'it must still be visible in the heartbeat, not silently dropped either way');
});

test('without --since, a missing evaluated_at behaves as before (counted as evaluated)', () => {
  const linesWithMissingTimestamp = [
    JSON.stringify({ status: 'completed', score: 4.9, company: 'NoTime', role: 'PM', url: 'https://x.test/4' }),
  ];
  const { heartbeat } = selectDigest(linesWithMissingTimestamp, { minScore: 3.0 });
  assert.equal(heartbeat.noTimestamp, 0);
  assert.equal(heartbeat.evaluated, 1);
});

test('newestEvaluatedAt tracks the newest in-window timestamp, for cursor advancement', () => {
  const { heartbeat } = selectDigest(LINES, { minScore: 3.0 });
  assert.equal(heartbeat.newestEvaluatedAt, '2026-07-26 06:12');
});

// --- Finding 1: an unreadable (not just missing) decisions file must fail loud ---

test('readDecisionsFile returns [] when the file does not exist', () => {
  assert.deepEqual(readDecisionsFile(join(tmpdir(), 'career-ops-digest-does-not-exist.jsonl')), []);
});

test('readDecisionsFile throws (does not silently swallow) when the path is unreadable', () => {
  // A directory is never readable as a file — this reliably reproduces the
  // "exists but can't be read" class of failure (locked file, mid-write,
  // permissions) without depending on OS-specific file locking.
  const dir = mkdtempSync(join(tmpdir(), 'career-ops-digest-'));
  try {
    assert.throws(() => readDecisionsFile(dir));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// --- Finding 2: durable cursor, so a crashed/failed digest doesn't drop results ---

test('cursor round-trips: unset reads as null, then persists and reads back what was written', () => {
  const dir = mkdtempSync(join(tmpdir(), 'career-ops-digest-cursor-'));
  const cursorFile = join(dir, 'digest-cursor.json');
  try {
    assert.equal(readCursor(cursorFile), null);
    writeCursor(cursorFile, '2026-07-26 06:12');
    assert.equal(readCursor(cursorFile), '2026-07-26 06:12');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a corrupt cursor file reads as null (safe fallback) rather than throwing', () => {
  const dir = mkdtempSync(join(tmpdir(), 'career-ops-digest-cursor-'));
  const cursorFile = join(dir, 'digest-cursor.json');
  try {
    writeFileSync(cursorFile, '{ not valid json', 'utf-8');
    assert.equal(readCursor(cursorFile), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// --- Finding 1 (CLI integration): a read failure must still print HEARTBEAT,
// record needs-attention, and exit non-zero — never a bare uncaught throw ---

test('CLI: an unreadable decisions file prints a heartbeat, records needs-attention, and exits 1', () => {
  const dir = mkdtempSync(join(tmpdir(), 'career-ops-digest-cli-'));
  const needsAttentionFile = join(dir, 'needs-attention.md');
  try {
    // Pass a directory as --file: guaranteed unreadable-as-a-file, without
    // depending on OS-specific file locking.
    const result = spawnSync(process.execPath, [
      DIGEST_MJS,
      '--file', dir,
      '--needs-attention', needsAttentionFile,
      '--cursor', join(dir, 'cursor.json'),
    ], { encoding: 'utf-8' });

    assert.equal(result.status, 1, 'a read failure must exit non-zero, not look like a quiet night');
    assert.match(result.stdout, /HEARTBEAT/, 'the heartbeat line must still print even when the read throws');
    assert.match(result.stdout, /"readError":true/, 'the heartbeat must name the failure as a read error');
    assert.ok(existsSync(needsAttentionFile), 'a needs-attention row must be recorded on a read failure');
    assert.match(readFileSync(needsAttentionFile, 'utf-8'), /digest-read/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
