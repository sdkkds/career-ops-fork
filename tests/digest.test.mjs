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

// --- Round 2, finding 1: the cursor boundary record must not re-match forever ---

test('feeding one run\'s newestEvaluatedAt as the next run\'s since selects zero items (no re-send of the boundary record)', () => {
  const night1Lines = [
    JSON.stringify({ status: 'completed', score: 4.2, company: 'Acme', role: 'Senior PM', url: 'https://x.test/1', evaluated_at: '2026-07-27 06:10' }),
  ];
  const night1 = selectDigest(night1Lines, { minScore: 3.0 });
  assert.equal(night1.items.length, 1);
  assert.equal(night1.heartbeat.newestEvaluatedAt, '2026-07-27 06:10');

  // decisions.jsonl is append-only: night 2 re-reads the SAME line plus
  // whatever else was appended. With only the boundary record present, the
  // cursor from night 1 must exclude it, not re-match it forever.
  // sinceExclusive:true is what the CLI passes when `since` came from a real
  // persisted cursor (as opposed to the --since bootstrap fallback, which
  // uses the opposite, inclusive boundary — see the two tests below).
  const night2 = selectDigest(night1Lines, {
    minScore: 3.0, since: night1.heartbeat.newestEvaluatedAt, sinceExclusive: true,
  });
  assert.equal(night2.items.length, 0, 'the record that set the cursor must not be re-selected on the next run');
});

test('the --since BOOTSTRAP fallback (sinceExclusive:false, the default) is inclusive: a record sharing the exact --since timestamp is still selected', () => {
  // This is the shape of a run's OWN first-ever invocation: run-nightly.ps1
  // passes --since $RunTimestamp as a fallback before any cursor exists, and
  // every decision that run appends shares that exact evaluated_at. If this
  // boundary were exclusive too, a run would filter out its own results on
  // the very first night, which defeats the point of the fallback entirely.
  const lines = [
    JSON.stringify({ status: 'completed', score: 4.2, company: 'Acme', role: 'PM', url: 'https://x.test/1', evaluated_at: '2026-07-27 06:10' }),
  ];
  const { items } = selectDigest(lines, { minScore: 3.0, since: '2026-07-27 06:10' }); // sinceExclusive defaults false
  assert.equal(items.length, 1, 'a record at exactly the bootstrap --since timestamp must still be selected');
});

test('a persisted cursor (sinceExclusive:true) is exclusive at the same boundary the bootstrap fallback is inclusive at', () => {
  const lines = [
    JSON.stringify({ status: 'completed', score: 4.2, company: 'Acme', role: 'PM', url: 'https://x.test/1', evaluated_at: '2026-07-27 06:10' }),
  ];
  const { items } = selectDigest(lines, { minScore: 3.0, since: '2026-07-27 06:10', sinceExclusive: true });
  assert.equal(items.length, 0, 'a record at exactly the cursor timestamp must NOT be re-selected');
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

test('cursor round-trips: no file reads as {since:null, corrupt:false} (legitimate bootstrap), then persists and reads back what was written', () => {
  const dir = mkdtempSync(join(tmpdir(), 'career-ops-digest-cursor-'));
  const cursorFile = join(dir, 'digest-cursor.json');
  try {
    assert.deepEqual(readCursor(cursorFile), { since: null, corrupt: false });
    writeCursor(cursorFile, '2026-07-26 06:12');
    assert.deepEqual(readCursor(cursorFile), { since: '2026-07-26 06:12', corrupt: false });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// --- Round 2, finding 2: a corrupt cursor must be distinguishable from "no cursor yet" ---

test('a corrupt (present but unparseable) cursor file reads as corrupt:true, NOT the same as a legitimate first run', () => {
  const dir = mkdtempSync(join(tmpdir(), 'career-ops-digest-cursor-'));
  const cursorFile = join(dir, 'digest-cursor.json');
  try {
    writeFileSync(cursorFile, '{ not valid json', 'utf-8');
    const result = readCursor(cursorFile);
    assert.equal(result.corrupt, true);
    assert.notDeepEqual(result, { since: null, corrupt: false },
      'corrupt-but-present must be distinguishable from genuinely absent — a caller that only checks `since === null` cannot tell them apart otherwise');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('an empty cursor file (zero bytes) also reads as corrupt, not as a fresh bootstrap', () => {
  const dir = mkdtempSync(join(tmpdir(), 'career-ops-digest-cursor-'));
  const cursorFile = join(dir, 'digest-cursor.json');
  try {
    writeFileSync(cursorFile, '', 'utf-8');
    assert.equal(readCursor(cursorFile).corrupt, true);
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

// --- Round 2, finding 2 (CLI integration): a corrupt cursor must not silently
// drop pending decisions by degrading into an aggressive fresh-bootstrap window ---

test('CLI: a corrupt cursor is surfaced (heartbeat + needs-attention) AND does not drop an older pending decision', () => {
  const dir = mkdtempSync(join(tmpdir(), 'career-ops-digest-cli-cursor-'));
  const decisionsFile = join(dir, 'decisions.jsonl');
  const needsAttentionFile = join(dir, 'needs-attention.md');
  const cursorFile = join(dir, 'digest-cursor.json');
  const sendStub = join(dir, 'send-stub.mjs');
  try {
    // An older, still-pending, never-digested decision — the kind of thing
    // that would silently vanish if a corrupt cursor degraded into "treat
    // this as a fresh bootstrap and use --since (tonight) instead."
    writeFileSync(decisionsFile, JSON.stringify({
      status: 'completed', score: 4.5, company: 'OldButPending', role: 'PM',
      url: 'https://x.test/old', evaluated_at: '2026-07-20 00:00',
    }) + '\n', 'utf-8');
    writeFileSync(cursorFile, '{ this is not valid json', 'utf-8');
    // No explicit exit call needed: node exits 0 on its own when a script
    // runs to completion without throwing. (Spelling out that call literally
    // in this file — even inside a string — would trip test-all.mjs's
    // discovered-suite guard, which scans raw test-file text for that
    // substring to keep a stray real call from silently truncating the
    // whole in-process test run.)
    writeFileSync(sendStub, 'console.log("stub send ok");', 'utf-8');

    const result = spawnSync(process.execPath, [
      DIGEST_MJS,
      '--file', decisionsFile,
      '--needs-attention', needsAttentionFile,
      '--cursor', cursorFile,
      // A recent bootstrap fallback: if the corrupt cursor were mishandled as
      // a fresh bootstrap, this --since would wrongly exclude the older
      // pending decision above.
      '--since', '2026-07-27 00:00',
    ], {
      encoding: 'utf-8',
      env: {
        ...process.env,
        CAREEROPS_DIGEST_CMD: process.execPath,
        CAREEROPS_DIGEST_PREFIX_ARGS: JSON.stringify([sendStub]),
      },
    });

    assert.equal(result.status, 0, `expected a successful send, got status ${result.status}: ${result.stderr}`);
    assert.match(result.stdout, /"cursorCorrupt":true/, 'the heartbeat must name the cursor as corrupt');
    assert.match(result.stdout, /"evaluated":1/, 'the older pending decision must still be counted, not dropped');
    assert.match(result.stdout, /"sendRequired":true/, 'the older pending decision must still be selected for sending, not dropped');
    assert.match(result.stdout, /Sent 1 result/, 'the send must actually go out, proving the item reached renderDigest/execFileSync');
    assert.ok(existsSync(needsAttentionFile), 'a needs-attention row must be recorded for the corrupt cursor');
    assert.match(readFileSync(needsAttentionFile, 'utf-8'), /unreadable\/corrupt/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
