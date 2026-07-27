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
