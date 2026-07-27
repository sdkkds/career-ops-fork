import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePipeline, setState, listActionable, RETRY_BUDGET } from '../lib/pipeline-state.mjs';

const TEXT = [
  '# Pipeline — Pending Evaluations',
  '',
  '## Pendientes',
  '',
  '- [ ] https://x.test/j/1 | Acme | PM',
  '- [~] https://x.test/j/2 | Beta | TPM',
  '- [x] https://x.test/j/3 | Gamma | PO',
  '- [!] https://x.test/j/4 | Delta | PM <!-- attempts:1 -->',
  '- [-] https://x.test/j/5 | Eps | PM',
  '',
].join('\n');

// Real pipeline.md shapes from scan.mjs and modes/pipeline.md
const TEXT_REAL_SHAPES = [
  '# Pipeline — Pending Evaluations',
  '',
  '## Pendientes',
  '',
  '- [ ] https://jobs.ashbyhq.com/acme/791 | Acme Corp | Staff PM | note: curated shortlist',
  '- [ ] https://boards.greenhouse.io/acme/jobs/792 | Acme Corp | Backend Engineer | Remote (US) | posted: 2026-06-18',
  '- [ ] https://lever.co/companies/foo/jobs/bar | Foo Inc | PM | San Francisco | $250k-300k',
  '- [!] https://x.test/j/999 | Beta | TPM | trust: 85 stale <!-- attempts:1 -->',
  '',
].join('\n');

// Irregular spacing: multiple spaces, tabs
const TEXT_IRREGULAR_SPACING = [
  '# Pipeline',
  '',
  '## Pendientes',
  '',
  '-  [ ] https://x.test/j/1 | Acme | PM',
  '-\t[~] https://x.test/j/2 | Beta | TPM',
  '- [ ]  https://x.test/j/3 | Gamma | PO',
  '',
].join('\n');

// --- Original tests (must continue passing) ---

test('parses every marker into a state', () => {
  const states = parsePipeline(TEXT).map(e => e.state);
  assert.deepEqual(states, ['pending', 'in-progress', 'done', 'failed', 'expired']);
});

test('parses attempts off the failed marker', () => {
  const failed = parsePipeline(TEXT).find(e => e.state === 'failed');
  assert.equal(failed.attempts, 1);
});

test('setState rewrites only the matching line', () => {
  const next = setState(TEXT, 'https://x.test/j/1', 'in-progress');
  assert.match(next, /- \[~\] https:\/\/x\.test\/j\/1/);
  assert.equal(next.split('\n').length, TEXT.split('\n').length);
  assert.match(next, /- \[x\] https:\/\/x\.test\/j\/3/, 'other rows untouched');
});

test('setState matches on normalized URL', () => {
  const next = setState(TEXT, 'https://WWW.x.test/j/1/?utm_source=li', 'done');
  assert.match(next, /- \[x\] https:\/\/x\.test\/j\/1/);
});

test('setState throws on an unknown URL rather than silently doing nothing', () => {
  assert.throws(() => setState(TEXT, 'https://x.test/j/999', 'done'), /not found/i);
});

test('failed state records the incremented attempt count', () => {
  const next = setState(TEXT, 'https://x.test/j/4', 'failed', { attempts: 2 });
  assert.match(next, /- \[!\] https:\/\/x\.test\/j\/4 \| Delta \| PM <!-- attempts:2 -->/);
});

test('listActionable returns pending first, then retryable failures', () => {
  const got = listActionable(TEXT, { limit: 10, maxAttempts: RETRY_BUDGET }).map(e => e.url);
  assert.deepEqual(got, ['https://x.test/j/1', 'https://x.test/j/4']);
});

test('listActionable skips failures past the retry budget — no head-of-queue starvation', () => {
  const exhausted = TEXT.replace('attempts:1', `attempts:${RETRY_BUDGET}`);
  const got = listActionable(exhausted, { limit: 10, maxAttempts: RETRY_BUDGET }).map(e => e.url);
  assert.deepEqual(got, ['https://x.test/j/1']);
});

test('listActionable never returns done, expired, or in-progress rows', () => {
  const got = listActionable(TEXT, { limit: 10, maxAttempts: RETRY_BUDGET });
  assert.equal(got.some(e => ['done', 'expired', 'in-progress'].includes(e.state)), false);
});

test('limit caps the batch', () => {
  assert.equal(listActionable(TEXT, { limit: 1, maxAttempts: RETRY_BUDGET }).length, 1);
});

// --- New tests for real shapes and fix verification ---

test('parses real pipeline shapes: 4 columns with note label', () => {
  const entries = parsePipeline(TEXT_REAL_SHAPES);
  const ashby = entries.find(e => e.url.includes('ashbyhq'));
  assert.ok(ashby, 'finds ashby entry');
  assert.equal(ashby.company, 'Acme Corp');
  assert.equal(ashby.title, 'Staff PM');
  assert.match(ashby.remainder, /note: curated shortlist/);
});

test('parses real pipeline shapes: 5 columns with posted date', () => {
  const entries = parsePipeline(TEXT_REAL_SHAPES);
  const greenhouse = entries.find(e => e.url.includes('greenhouse'));
  assert.ok(greenhouse, 'finds greenhouse entry');
  assert.equal(greenhouse.company, 'Acme Corp');
  assert.equal(greenhouse.title, 'Backend Engineer');
  assert.match(greenhouse.remainder, /Remote \(US\)/);
  assert.match(greenhouse.remainder, /posted: 2026-06-18/);
});

test('parses real pipeline shapes: 5 columns with compensation', () => {
  const entries = parsePipeline(TEXT_REAL_SHAPES);
  const lever = entries.find(e => e.url.includes('lever'));
  assert.ok(lever, 'finds lever entry');
  assert.equal(lever.company, 'Foo Inc');
  assert.equal(lever.title, 'PM');
  assert.match(lever.remainder, /San Francisco/);
  assert.match(lever.remainder, /\$250k-300k/);
});

test('parses real shapes with trust: label and attempts', () => {
  const entries = parsePipeline(TEXT_REAL_SHAPES);
  const failed = entries.find(e => e.state === 'failed');
  assert.ok(failed, 'finds failed entry');
  assert.match(failed.remainder, /trust: 85 stale/);
  assert.equal(failed.attempts, 1);
});

test('setState on 4-column row preserves labeled segments byte-for-byte', () => {
  const next = setState(TEXT_REAL_SHAPES, 'https://jobs.ashbyhq.com/acme/791', 'in-progress');
  const lines = next.split('\n');
  const updated = lines.find(l => l.includes('ashbyhq'));
  assert.match(updated, /- \[~\]/);
  assert.match(updated, /note: curated shortlist/);
  // Verify byte-for-byte: the note segment should still be there
  assert.equal(updated, '- [~] https://jobs.ashbyhq.com/acme/791 | Acme Corp | Staff PM | note: curated shortlist');
});

test('setState on 5-column row preserves all columns byte-for-byte', () => {
  const next = setState(TEXT_REAL_SHAPES, 'https://boards.greenhouse.io/acme/jobs/792', 'done');
  const lines = next.split('\n');
  const updated = lines.find(l => l.includes('greenhouse'));
  assert.match(updated, /- \[x\]/);
  assert.match(updated, /Remote \(US\)/);
  assert.match(updated, /posted: 2026-06-18/);
  // Should preserve all columns in order
  assert.equal(updated, '- [x] https://boards.greenhouse.io/acme/jobs/792 | Acme Corp | Backend Engineer | Remote (US) | posted: 2026-06-18');
});

test('attempts counter survives in-progress transition (failed → in-progress → failed)', () => {
  // Start with failed at attempt 1
  let current = TEXT_REAL_SHAPES;

  // Mark as in-progress; attempts should be preserved
  current = setState(current, 'https://x.test/j/999', 'in-progress');
  let entries = parsePipeline(current);
  let entry = entries.find(e => e.url === 'https://x.test/j/999');
  assert.equal(entry.attempts, 1, 'attempts preserved after in-progress transition');
  assert.equal(entry.state, 'in-progress');

  // Mark as failed again with incremented attempts
  current = setState(current, 'https://x.test/j/999', 'failed', { attempts: 2 });
  entries = parsePipeline(current);
  entry = entries.find(e => e.url === 'https://x.test/j/999');
  assert.equal(entry.attempts, 2, 'attempts incremented on second failure');
  assert.equal(entry.state, 'failed');
  assert.match(entry.remainder, /<!-- attempts:2 -->/);
});

test('round-trip: setState preserves non-marker characters exactly', () => {
  const url = 'https://lever.co/companies/foo/jobs/bar';
  const original = TEXT_REAL_SHAPES;

  // Get the original line
  const originalLines = original.split('\n');
  const originalLine = originalLines.find(l => l.includes('lever'));

  // Rewrite marker from [ ] to [~]
  const step1 = setState(original, url, 'in-progress');
  const lines1 = step1.split('\n');
  const line1 = lines1.find(l => l.includes('lever'));

  // The only change should be the marker: [ ] → [~]
  // Everything after the URL should be identical
  assert.match(line1, /- \[~\]/);
  assert.match(line1, /https:\/\/lever\.co\/companies\/foo\/jobs\/bar \| Foo Inc \| PM \| San Francisco \| \$250k-300k/);
});

test('irregular spacing: multiple spaces after dash is tolerated', () => {
  const entries = parsePipeline(TEXT_IRREGULAR_SPACING);
  assert.equal(entries.length, 3);
  assert.equal(entries[0].url, 'https://x.test/j/1');
  assert.equal(entries[0].state, 'pending');
});

test('irregular spacing: tabs are tolerated', () => {
  const entries = parsePipeline(TEXT_IRREGULAR_SPACING);
  const inProgress = entries.find(e => e.state === 'in-progress');
  assert.ok(inProgress, 'finds entry with tab spacing');
  assert.equal(inProgress.url, 'https://x.test/j/2');
});

test('irregular spacing: extra spaces after bracket are tolerated', () => {
  const entries = parsePipeline(TEXT_IRREGULAR_SPACING);
  const gamma = entries.find(e => e.url.includes('j/3'));
  assert.ok(gamma, 'finds entry with extra space after bracket');
  assert.equal(gamma.company, 'Gamma');
});

test('listActionable returns real-shape entries that parse correctly', () => {
  const actionable = listActionable(TEXT_REAL_SHAPES, { limit: 10, maxAttempts: RETRY_BUDGET });
  const urls = actionable.map(e => e.url);
  // Should return the 3 pending entries, then the 1 failed entry under budget
  assert.equal(actionable.length, 4);
  assert(urls.includes('https://jobs.ashbyhq.com/acme/791'));
  assert(urls.includes('https://boards.greenhouse.io/acme/jobs/792'));
  assert(urls.includes('https://lever.co/companies/foo/jobs/bar'));
  assert(urls.includes('https://x.test/j/999')); // failed, attempts:1 < budget:2
});
