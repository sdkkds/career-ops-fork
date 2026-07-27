/**
 * Regression: merge-tracker's needs-attention log must follow the RESOLVED
 * TRACKER, not the project root.
 *
 * Upstream's own suites (tracker-columns-tests.mjs, test-all.mjs sections)
 * redirect CAREER_OPS_TRACKER at a sandbox but know nothing about this fork's
 * CAREER_OPS_NEEDS_ATTENTION variable. While the default was pinned to the
 * project root, every one of those runs appended rows to the user's real
 * data/needs-attention.md — 9 rows per tracker-columns-tests run, ~1400
 * accumulated before a live trial run surfaced it. A caller that sandboxes the
 * tracker must get a sandboxed queue for free, without opting in.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LIVE_QUEUE = join(ROOT, 'data/needs-attention.md');

function countRows(file) {
  if (!existsSync(file)) return 0;
  return readFileSync(file, 'utf-8').split('\n').filter(l => /^\|\s*20\d\d/.test(l)).length;
}

test('a sandboxed tracker gets a sandboxed needs-attention queue, without opting in', () => {
  const sandbox = mkdtempSync(join(tmpdir(), 'na-sandbox-'));
  const trackerDir = join(sandbox, 'data');
  const additions = join(sandbox, 'additions');
  mkdirSync(trackerDir, { recursive: true });
  mkdirSync(additions, { recursive: true });

  writeFileSync(join(trackerDir, 'applications.md'),
    '# Applications Tracker\n\n' +
    '| # | Date | Company | Role | Score | Status | PDF | Report | URL | Notes |\n' +
    '|---|------|---------|------|-------|--------|-----|--------|-----|-------|\n', 'utf-8');

  // A URL-less addition is what triggers the needs-attention write. Column 1
  // must be a real report number: merge-tracker rejects 0 as an invalid entry
  // number before it ever reaches the URL check.
  writeFileSync(join(additions, '1-acme.tsv'),
    '1\t2026-07-27\tAcme\tSenior Product Manager\tEvaluated\t4.0/5\t✅\t[001](reports/001-acme.md)\tnote\n', 'utf-8');

  const liveBefore = countRows(LIVE_QUEUE);

  execFileSync('node', [join(ROOT, 'merge-tracker.mjs')], {
    cwd: ROOT,
    env: {
      ...process.env,
      CAREER_OPS_TRACKER: join(trackerDir, 'applications.md'),
      CAREER_OPS_ADDITIONS: additions,
      CAREER_OPS_NEEDS_ATTENTION: '', // explicitly NOT set — the point of the test
    },
    stdio: 'pipe',
  });

  assert.equal(countRows(LIVE_QUEUE), liveBefore,
    'merge-tracker wrote to the real data/needs-attention.md despite a sandboxed tracker');
  assert.ok(existsSync(join(trackerDir, 'needs-attention.md')),
    'no needs-attention.md was created beside the sandboxed tracker');
  assert.ok(countRows(join(trackerDir, 'needs-attention.md')) >= 1,
    'the sandboxed queue recorded no row for the URL-less addition');
});
