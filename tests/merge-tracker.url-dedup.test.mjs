// tests/merge-tracker.url-dedup.test.mjs — Task 3: URL-first dedup tier.
//
// findDuplicateByUrl is a plain exported function, safe to import directly:
// merge-tracker.mjs guards its entire CLI body (lock acquisition, tracker
// read/write, process.exit calls) behind an IS_CLI check (see top of that
// file) so importing it here for its exports never touches the real tracker
// or a real filesystem lock.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findDuplicateByUrl } from '../merge-tracker.mjs';

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
