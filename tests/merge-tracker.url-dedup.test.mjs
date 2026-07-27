// tests/merge-tracker.url-dedup.test.mjs — Task 3: URL-first dedup tier.
//
// findDuplicateByUrl is a plain exported function, safe to import directly:
// merge-tracker.mjs guards its entire CLI body (lock acquisition, tracker
// read/write, process.exit calls) behind an IS_CLI check (see top of that
// file) so importing it here for its exports never touches the real tracker
// or a real filesystem lock.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'path';
import { execFileSync } from 'child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { findDuplicateByUrl } from '../merge-tracker.mjs';
import { NODE, ROOT } from './helpers.mjs';

const rows = [
  { num: 7, company: 'Acme', role: 'Senior Security PM', url: 'https://job-boards.greenhouse.io/acme/jobs/1' },
  { num: 8, company: 'Acme', role: 'Senior Security PM', url: 'https://job-boards.greenhouse.io/acme/jobs/2' },
];

test('matches on normalized URL despite tracking params and case', () => {
  const hit = findDuplicateByUrl(rows, 'https://WWW.job-boards.greenhouse.io/acme/jobs/1/?utm_source=li');
  assert.equal(hit?.num, 7);
});

test('same company and role at a different URL is not a duplicate', () => {
  const hit = findDuplicateByUrl(rows, 'https://job-boards.greenhouse.io/acme/jobs/999');
  assert.equal(hit, null);
});

test('a missing or unparseable URL never matches anything', () => {
  assert.equal(findDuplicateByUrl(rows, null), null);
  assert.equal(findDuplicateByUrl(rows, 'not a url'), null);
});

test('rows without a URL are skipped, not treated as wildcards', () => {
  const withBlank = [{ num: 1, company: 'Acme', role: 'PM', url: '' }, ...rows];
  assert.equal(findDuplicateByUrl(withBlank, 'https://job-boards.greenhouse.io/acme/jobs/1')?.num, 7);
});

// Integration test: exercises the real merge path end to end (parseTsvContent
// classifying the URL out of the TSV extras zone, the tier-0 call site at
// merge-tracker.mjs's `if (!duplicate && reportNum)`, and buildRow/parseAppLine
// round-tripping the URL cell) — not just the standalone helper. Review
// finding #4 on this task: the four unit tests above pin findDuplicateByUrl in
// isolation but would stay green even if the tier-0 call site were deleted
// from the real merge loop. This pins the actual invariant: a same report
// number + same company + same role would normally match the report-number
// and fuzzy tiers, but a confirmed different URL on both sides must block
// every one of them, so the incoming addition is added as a NEW row instead
// of silently overwriting the existing one.
test('URL identity: a confirmed URL mismatch blocks the report-number/company heuristic (new row added, not an update)', () => {
  const work = mkdtempSync(join(tmpdir(), 'cops-merge-url-'));
  try {
    const tracker = join(work, 'applications.md');
    const addsDir = join(work, 'adds');
    mkdirSync(addsDir, { recursive: true });
    const header = [
      '# Applications Tracker',
      '',
      '| # | Date | Company | Role | Score | Status | PDF | Report | URL | Notes |',
      '|---|------|---------|------|-------|--------|-----|--------|-----|-------|',
      '| 7 | 2026-01-01 | Acme | Senior Security PM | 4.2/5 | Evaluated | ✅ | [7](reports/7-acme-2026-01-01.md) | https://job-boards.greenhouse.io/acme/jobs/1 | first posting |',
      '',
    ].join('\n');
    writeFileSync(tracker, header);
    // Same report number [7] and same company + role as the existing row —
    // report-number drift and a fuzzy role match would both normally treat
    // this as the same posting — but the URL is a DIFFERENT job (/jobs/2).
    writeFileSync(
      join(addsDir, '8-acme.tsv'),
      '8\t2026-02-01\tAcme\tSenior Security PM\tEvaluated\t4.3/5\t✅\t[7](reports/7-acme-2026-01-01.md)\tsecond posting\thttps://job-boards.greenhouse.io/acme/jobs/2\n',
    );
    execFileSync(NODE, [join(ROOT, 'merge-tracker.mjs')], {
      encoding: 'utf-8',
      timeout: 30000,
      env: { ...process.env, CAREER_OPS_TRACKER: tracker, CAREER_OPS_ADDITIONS: addsDir },
    });
    const merged = readFileSync(tracker, 'utf-8');
    const acmeRows = merged.split('\n').filter(l => l.startsWith('|') && /\bAcme\b/.test(l));
    assert.equal(acmeRows.length, 2, `expected two separate Acme rows, got:\n${acmeRows.join('\n')}`);
    assert.ok(acmeRows.some(l => l.includes('jobs/1')), 'original row (jobs/1) must survive untouched');
    assert.ok(acmeRows.some(l => l.includes('jobs/2')), 'new row (jobs/2) must be added, not merged into the existing one');
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});
