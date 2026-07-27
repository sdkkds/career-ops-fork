import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractResultJson } from '../lib/json-extract.mjs';

const BLOCK = `CAREEROPS_RESULT_JSON_BEGIN
{
  "status": "completed",
  "score": 4.2,
  "url": "https://x.test/j/1"
}
CAREEROPS_RESULT_JSON_END`;

test('extracts a pretty-printed sentinel block surrounded by prose', () => {
  const r = extractResultJson(`chatter\n${BLOCK}\ntrailing prose }`);
  assert.equal(r.ok, true);
  assert.equal(r.value.score, 4.2);
});

test('falls back to a ```json fence', () => {
  const r = extractResultJson('blah\n```json\n{"status":"completed","score":3}\n```\ndone');
  assert.equal(r.ok, true);
  assert.equal(r.value.score, 3);
});

test('prose-only output fails instead of yielding an empty success', () => {
  const r = extractResultJson('Evaluated the role, looks great! {not json}');
  assert.equal(r.ok, false);
  assert.match(r.reason, /no result block/i);
});

test('malformed JSON inside the sentinels fails loudly', () => {
  const r = extractResultJson('CAREEROPS_RESULT_JSON_BEGIN\n{oops\nCAREEROPS_RESULT_JSON_END');
  assert.equal(r.ok, false);
  assert.match(r.reason, /parse/i);
});

test('uses the last block when more than one is emitted', () => {
  const r = extractResultJson(
    'CAREEROPS_RESULT_JSON_BEGIN\n{"status":"failed"}\nCAREEROPS_RESULT_JSON_END\n' +
    'CAREEROPS_RESULT_JSON_BEGIN\n{"status":"completed"}\nCAREEROPS_RESULT_JSON_END');
  assert.equal(r.value.status, 'completed');
});

test('strips a UTF-8 BOM before parsing', () => {
  const r = extractResultJson('﻿CAREEROPS_RESULT_JSON_BEGIN\n{"status":"completed"}\nCAREEROPS_RESULT_JSON_END');
  assert.equal(r.ok, true);
});

test('empty or non-string input fails', () => {
  assert.equal(extractResultJson('').ok, false);
  assert.equal(extractResultJson(null).ok, false);
});

test('well-formed JSON in prose without a sentinel or fence is still a failure', () => {
  const r = extractResultJson('Evaluated the role. {"status":"completed","score":5} nice job');
  assert.equal(r.ok, false);
  assert.match(r.reason, /no result block/i);
});
