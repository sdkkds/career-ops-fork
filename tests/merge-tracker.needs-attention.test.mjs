// tests/merge-tracker.needs-attention.test.mjs — Task 5b: a tracker addition
// with no parseable URL must produce a needs-attention row naming the source
// file, WITHOUT changing the merge outcome (still added via the existing
// heuristic tiers, exactly as before this task). Drives the real script as a
// subprocess (matching tests/merge-tracker.url-dedup.test.mjs's integration
// test) so this pins the actual call site, not just a stub.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'path';
import { execFileSync, spawnSync } from 'child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { NODE, ROOT } from './helpers.mjs';
import { needsAttentionForUnusableUrl } from '../merge-tracker.mjs';

function runMerge(env) {
  return execFileSync(NODE, [join(ROOT, 'merge-tracker.mjs')], {
    encoding: 'utf-8',
    timeout: 30000,
    env: { ...process.env, ...env },
  });
}

test('a URL-less addition logs a needs-attention row but merges exactly as before', () => {
  const work = mkdtempSync(join(tmpdir(), 'cops-merge-na-'));
  try {
    const tracker = join(work, 'applications.md');
    const addsDir = join(work, 'adds');
    const naFile = join(work, 'needs-attention.md');
    mkdirSync(addsDir, { recursive: true });
    const header = [
      '# Applications Tracker',
      '',
      '| # | Date | Company | Role | Score | Status | PDF | Report | URL | Notes |',
      '|---|------|---------|------|-------|--------|-----|--------|-----|-------|',
      '',
    ].join('\n');
    writeFileSync(tracker, header);
    // 9-column TSV: no URL field at all (pre-Task-3 shape, still legal input).
    writeFileSync(
      join(addsDir, '10-noco.tsv'),
      '10\t2026-02-01\tNoUrlCo\tSecurity PM\tEvaluated\t4.1/5\t✅\t[10](reports/10-nourlco-2026-02-01.md)\tno url on this one\n',
    );

    assert.equal(existsSync(naFile), false, 'precondition: needs-attention file must not pre-exist');

    runMerge({ CAREER_OPS_TRACKER: tracker, CAREER_OPS_ADDITIONS: addsDir, CAREER_OPS_NEEDS_ATTENTION: naFile });

    // Merge outcome unchanged: the row is still added via the heuristic tiers,
    // same as current behavior — no early continue/return, no rejection.
    const merged = readFileSync(tracker, 'utf-8');
    const rows = merged.split('\n').filter(l => l.startsWith('|') && /\bNoUrlCo\b/.test(l));
    assert.equal(rows.length, 1, `expected the addition to merge into exactly one row, got:\n${rows.join('\n')}`);
    assert.match(rows[0], /Security PM/);

    // Needs-attention row was appended, naming the source file.
    assert.ok(existsSync(naFile), 'needs-attention.md must be created');
    const na = readFileSync(naFile, 'utf-8');
    assert.match(na, /^# Needs Attention/);
    assert.match(na, /10-noco\.tsv/, `expected the source filename in the needs-attention row:\n${na}`);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});

// Review finding #2 (fix): needsAttentionForUnusableUrl must never fire
// alongside the pre-existing "tracker has no URL column" warning
// (`addition.url && COLMAP.url == null` at merge-tracker.mjs). A garbage,
// non-empty URL cell is truthy, so — without this guard — both would log the
// same underlying fact (the row's URL cell is unusable) for one input. This
// is a direct unit test on the exported predicate rather than a subprocess/
// TSV-file integration test because parseTsvContent's own URL extraction
// (parseTsvExtras) only ever assigns addition.url a value that already
// passed normalizeUrl — a real TSV file can never produce a truthy-but-
// unparseable addition.url, so the exclusivity branch is unreachable via an
// actual merge run today. It is still real logic (defensive if that parsing
// invariant ever changes), so it is pinned here directly.
test('needsAttentionForUnusableUrl: exclusivity with the missing-URL-column warning', () => {
  // Missing URL entirely, tracker HAS a URL column -> only needs-attention.
  assert.equal(needsAttentionForUnusableUrl('', true), true);
  // Missing URL entirely, tracker has NO URL column -> still only needs-attention
  // (there was never a URL to lose to the column, so no column-drop warning).
  assert.equal(needsAttentionForUnusableUrl('', false), true);
  // Garbage (non-empty, unparseable) URL, tracker HAS a URL column -> the
  // garbage is the row's own fault, not a tracker-schema limitation ->
  // needs-attention fires (no column-drop warning is possible: COLMAP.url != null).
  assert.equal(needsAttentionForUnusableUrl('not-a-url', true), true);
  // Garbage (non-empty, unparseable) URL, tracker has NO URL column -> the
  // pre-existing "tracker has no URL column" warning is about to fire for
  // this exact row -> needs-attention must stay silent (exclusivity).
  assert.equal(needsAttentionForUnusableUrl('not-a-url', false), false);
  // A genuinely valid URL never needs an attention row, regardless of column.
  assert.equal(needsAttentionForUnusableUrl('https://job-boards.greenhouse.io/acme/jobs/1', true), false);
  assert.equal(needsAttentionForUnusableUrl('https://job-boards.greenhouse.io/acme/jobs/1', false), false);
});

// Review finding #1 (fix): an appendNeedsAttention failure must not crash the
// batch. Point CAREER_OPS_NEEDS_ATTENTION at a path that is itself a
// directory (writeFileSync/appendFileSync both throw EISDIR against it) so
// the try/catch around the real call site is exercised, and confirm the
// well-formed, URL-less addition still merges (the whole point: a
// side-channel logging failure must never reject the batch it was only
// meant to annotate).
test('a needs-attention write failure is caught and logged, not fatal to the merge', () => {
  const work = mkdtempSync(join(tmpdir(), 'cops-merge-na-fail-'));
  try {
    const tracker = join(work, 'applications.md');
    const addsDir = join(work, 'adds');
    const naPathIsADir = join(work, 'needs-attention.md'); // created as a directory below
    mkdirSync(addsDir, { recursive: true });
    mkdirSync(naPathIsADir, { recursive: true }); // same path appendNeedsAttention will try to write to
    const header = [
      '# Applications Tracker',
      '',
      '| # | Date | Company | Role | Score | Status | PDF | Report | URL | Notes |',
      '|---|------|---------|------|-------|--------|-----|--------|-----|-------|',
      '',
    ].join('\n');
    writeFileSync(tracker, header);
    writeFileSync(
      join(addsDir, '12-noco.tsv'),
      '12\t2026-02-01\tNoUrlCoTwo\tSecurity PM\tEvaluated\t4.1/5\t✅\t[12](reports/12-nourlcotwo-2026-02-01.md)\tno url on this one\n',
    );

    const result = spawnSync(NODE, [join(ROOT, 'merge-tracker.mjs')], {
      encoding: 'utf-8',
      timeout: 30000,
      env: { ...process.env, CAREER_OPS_TRACKER: tracker, CAREER_OPS_ADDITIONS: addsDir, CAREER_OPS_NEEDS_ATTENTION: naPathIsADir },
    });

    assert.equal(result.status, 0, `merge-tracker.mjs must still exit 0 when the needs-attention write fails:\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
    assert.match(result.stderr, /failed to write needs-attention row/, `expected the caught failure to be logged loudly:\n${result.stderr}`);

    const merged = readFileSync(tracker, 'utf-8');
    const rows = merged.split('\n').filter(l => l.startsWith('|') && /\bNoUrlCoTwo\b/.test(l));
    assert.equal(rows.length, 1, `the addition must still merge despite the logging failure, got:\n${rows.join('\n')}`);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});

test('an addition WITH a valid URL does not log a needs-attention row', () => {
  const work = mkdtempSync(join(tmpdir(), 'cops-merge-na-ok-'));
  try {
    const tracker = join(work, 'applications.md');
    const addsDir = join(work, 'adds');
    const naFile = join(work, 'needs-attention.md');
    mkdirSync(addsDir, { recursive: true });
    const header = [
      '# Applications Tracker',
      '',
      '| # | Date | Company | Role | Score | Status | PDF | Report | URL | Notes |',
      '|---|------|---------|------|-------|--------|-----|--------|-----|-------|',
      '',
    ].join('\n');
    writeFileSync(tracker, header);
    writeFileSync(
      join(addsDir, '11-hasurl.tsv'),
      '11\t2026-02-01\tHasUrlCo\tSecurity PM\tEvaluated\t4.1/5\t✅\t[11](reports/11-hasurlco-2026-02-01.md)\thas a url\thttps://job-boards.greenhouse.io/hasurlco/jobs/1\n',
    );

    runMerge({ CAREER_OPS_TRACKER: tracker, CAREER_OPS_ADDITIONS: addsDir, CAREER_OPS_NEEDS_ATTENTION: naFile });

    assert.equal(existsSync(naFile), false, 'a URL-bearing addition must not create a needs-attention row');
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});
