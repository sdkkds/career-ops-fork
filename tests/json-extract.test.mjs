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

// Regression (2026-08-19): a worker that emitted BOTH the sentinels and a
// ```json fence inside them failed to parse, while a worker that ignored the
// sentinels and emitted only a fence succeeded — the fence-stripping branch
// ran only when the sentinels were absent. That inversion punished the more
// compliant worker and silently lost a live evaluation (Zscaler, Principal AI
// Product Manager): "Unexpected token '`', "```json {"... is not valid JSON".
const F = '```';

test('sentinel block wrapping a ```json fence parses', () => {
  const r = extractResultJson(
    `CAREEROPS_RESULT_JSON_BEGIN\n${F}json\n{"status":"completed","score":3.2}\n${F}\nCAREEROPS_RESULT_JSON_END`);
  assert.equal(r.ok, true);
  assert.equal(r.value.score, 3.2);
});

test('sentinel block wrapping a bare ``` fence parses', () => {
  const r = extractResultJson(
    `CAREEROPS_RESULT_JSON_BEGIN\n${F}\n{"status":"completed","score":1.5}\n${F}\nCAREEROPS_RESULT_JSON_END`);
  assert.equal(r.ok, true);
  assert.equal(r.value.score, 1.5);
});

test('a fence with a non-json language tag inside the sentinels still parses', () => {
  const r = extractResultJson(
    `CAREEROPS_RESULT_JSON_BEGIN\n${F}JSON\n{"status":"completed"}\n${F}\nCAREEROPS_RESULT_JSON_END`);
  assert.equal(r.ok, true);
  assert.equal(r.value.status, 'completed');
});

test('unwrapping a fence does NOT rescue malformed JSON inside it', () => {
  const r = extractResultJson(
    `CAREEROPS_RESULT_JSON_BEGIN\n${F}json\n{oops\n${F}\nCAREEROPS_RESULT_JSON_END`);
  assert.equal(r.ok, false);
  assert.match(r.reason, /parse/i);
});

test('a stray backtick that is not a fence is left alone and fails loudly', () => {
  const r = extractResultJson(
    'CAREEROPS_RESULT_JSON_BEGIN\n`{"status":"completed"}`\nCAREEROPS_RESULT_JSON_END');
  assert.equal(r.ok, false);
  assert.match(r.reason, /parse/i);
});
