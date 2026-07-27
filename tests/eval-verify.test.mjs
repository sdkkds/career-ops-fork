import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verifyEval } from '../lib/eval-verify.mjs';

const URL = 'https://x.test/j/1';

function fixture({ report = true, tsv = true, pdf = null } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'ev-'));
  mkdirSync(join(root, 'reports'), { recursive: true });
  mkdirSync(join(root, 'batch/tracker-additions'), { recursive: true });
  if (report) writeFileSync(join(root, 'reports/044-acme-2026-07-26.md'), '# eval');
  if (tsv) writeFileSync(join(root, 'batch/tracker-additions/044-nightly-1.tsv'), 'x');
  if (pdf) { mkdirSync(join(root, 'output'), { recursive: true }); writeFileSync(join(root, pdf), '%PDF'); }
  return root;
}

const EXPECT = {
  reportPath: 'reports/044-acme-2026-07-26.md',
  tsvPath: 'batch/tracker-additions/044-nightly-1.tsv',
  url: URL,
};

function stdout(obj) {
  return `noise\nCAREEROPS_RESULT_JSON_BEGIN\n${JSON.stringify(obj, null, 2)}\nCAREEROPS_RESULT_JSON_END\n`;
}

test('completed only when JSON, report, TSV and score all check out', () => {
  const root = fixture();
  const r = verifyEval({ stdout: stdout({ status: 'completed', score: 4.2, url: URL, pdf: null }), root, expect: EXPECT });
  assert.equal(r.status, 'completed', r.reasons.join('; '));
});

test('worker prose with exit 0 is failed, not completed', () => {
  const root = fixture();
  const r = verifyEval({ stdout: 'All done, looks like a great fit!', root, expect: EXPECT });
  assert.equal(r.status, 'failed');
  assert.match(r.reasons.join(' '), /no result block/i);
});

test('missing report file forces failed even when JSON says completed', () => {
  const root = fixture({ report: false });
  const r = verifyEval({ stdout: stdout({ status: 'completed', score: 4.2, url: URL }), root, expect: EXPECT });
  assert.equal(r.status, 'failed');
  assert.match(r.reasons.join(' '), /report/i);
});

test('missing TSV forces failed', () => {
  const root = fixture({ tsv: false });
  const r = verifyEval({ stdout: stdout({ status: 'completed', score: 4.2, url: URL }), root, expect: EXPECT });
  assert.equal(r.status, 'failed');
  assert.match(r.reasons.join(' '), /tsv/i);
});

test('a claimed PDF that does not exist forces failed', () => {
  const root = fixture();
  const r = verifyEval({ stdout: stdout({ status: 'completed', score: 4.2, url: URL, pdf: 'output/cv-acme.pdf' }), root, expect: EXPECT });
  assert.equal(r.status, 'failed');
  assert.match(r.reasons.join(' '), /pdf/i);
});

test('null score is failed unless the status is an explicit SKIP', () => {
  const root = fixture();
  const noScore = verifyEval({ stdout: stdout({ status: 'completed', score: null, url: URL }), root, expect: EXPECT });
  assert.equal(noScore.status, 'failed');

  const skip = verifyEval({ stdout: stdout({ status: 'completed', score: null, tracker_status: 'SKIP', url: URL }), root, expect: EXPECT });
  assert.equal(skip.status, 'completed', skip.reasons.join('; '));
});

test('a URL mismatch between orchestrator and worker is failed', () => {
  const root = fixture();
  const r = verifyEval({ stdout: stdout({ status: 'completed', score: 4.2, url: 'https://other.test/j/9' }), root, expect: EXPECT });
  assert.equal(r.status, 'failed');
  assert.match(r.reasons.join(' '), /url/i);
});
