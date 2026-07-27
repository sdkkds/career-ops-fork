// tests/merge-tracker.needs-attention.test.mjs — Task 5b: a tracker addition
// with no parseable URL must produce a needs-attention row naming the source
// file, WITHOUT changing the merge outcome (still added via the existing
// heuristic tiers, exactly as before this task). Drives the real script as a
// subprocess (matching tests/merge-tracker.url-dedup.test.mjs's integration
// test) so this pins the actual call site, not just a stub.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'path';
import { execFileSync } from 'child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { NODE, ROOT } from './helpers.mjs';

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
