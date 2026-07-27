import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectDigest, renderDigest } from '../digest.mjs';

const LINES = [
  JSON.stringify({ status: 'completed', score: 4.2, company: 'Acme', role: 'Senior PM', url: 'https://x.test/1', evaluated_at: '2026-07-26 06:10' }),
  JSON.stringify({ status: 'completed', score: 2.1, company: 'Low', role: 'PM', url: 'https://x.test/2', evaluated_at: '2026-07-26 06:11' }),
  JSON.stringify({ status: 'failed', score: null, company: 'Dead', role: 'PM', url: 'https://x.test/3', evaluated_at: '2026-07-26 06:12' }),
];

test('selects only completed results at or above the threshold', () => {
  const { items } = selectDigest(LINES, { minScore: 3.0 });
  assert.equal(items.length, 1);
  assert.equal(items[0].company, 'Acme');
});

test('an empty night still produces a heartbeat', () => {
  const { items, heartbeat } = selectDigest([], { minScore: 3.0 });
  assert.equal(items.length, 0);
  assert.equal(heartbeat.evaluated, 0);
  assert.equal(heartbeat.sendRequired, false);
});

test('heartbeat counts failures separately from low scores', () => {
  const { heartbeat } = selectDigest(LINES, { minScore: 3.0 });
  assert.equal(heartbeat.evaluated, 3);
  assert.equal(heartbeat.failed, 1);
  assert.equal(heartbeat.belowThreshold, 1);
  assert.equal(heartbeat.sendRequired, true);
});

test('malformed lines are counted, not silently dropped', () => {
  const { heartbeat } = selectDigest([...LINES, 'not json'], { minScore: 3.0 });
  assert.equal(heartbeat.unparseable, 1);
});

test('render includes score, company, role and URL for each item', () => {
  const { items } = selectDigest(LINES, { minScore: 3.0 });
  const body = renderDigest(items);
  assert.match(body, /Acme/);
  assert.match(body, /4\.2/);
  assert.match(body, /https:\/\/x\.test\/1/);
});
