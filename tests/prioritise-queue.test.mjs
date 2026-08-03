import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { prioritise, tierFor, TIER_SECURITY, TIER_AI_ML, TIER_NEITHER } from '../lib/prioritise-queue.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CLI = join(ROOT, 'lib', 'prioritise-queue.mjs');

function runCli(input) {
  return execFileSync(process.execPath, [CLI], { input, encoding: 'utf-8' });
}

test('tiers by security, then AI/ML, then neither', () => {
  assert.equal(tierFor({ title: 'Senior Program Manager, Cybersecurity Risk' }), TIER_SECURITY);
  assert.equal(tierFor({ title: 'Principal Product Manager, Machine Learning Platform' }), TIER_AI_ML);
  assert.equal(tierFor({ title: 'Sr. Accounting Program Manager, Global Entity Expansion' }), TIER_NEITHER);
  // Security outranks AI/ML when a title carries both.
  assert.equal(tierFor({ title: 'Director, AI Security Platform' }), TIER_SECURITY);
});

test('junk rows tier as neither instead of throwing', () => {
  for (const row of [null, undefined, {}, { title: null }, { title: '' }, { title: 42 }]) {
    assert.equal(tierFor(row), TIER_NEITHER, `unexpected throw/tier for ${JSON.stringify(row)}`);
  }
});

test('ordering is stable within a tier', () => {
  // Same tier, so the original queue order must survive exactly. An unstable
  // sort would silently starve older rows -- turning ordering into a filter.
  const rows = Array.from({ length: 8 }, (_, i) => ({ title: 'Senior Program Manager', url: `u${i}` }));
  assert.deepEqual(prioritise(rows).map(r => r.url), rows.map(r => r.url));
});

test('ranking drops nothing and mutates nothing', () => {
  const rows = [
    { title: 'Sr. Accounting Program Manager', url: 'a' },
    { title: 'Senior Program Manager, Cybersecurity Risk', url: 'b' },
    { title: 'Principal Product Manager, Machine Learning', url: 'c' },
    { title: 'Sr. Product Manager', url: 'd' },
  ];
  const frozen = JSON.stringify(rows);
  const out = prioritise(rows);
  assert.equal(out.length, rows.length, 'ranking must not drop rows');
  assert.deepEqual(out.map(r => r.url).sort(), ['a', 'b', 'c', 'd']);
  assert.deepEqual(out.map(r => r.url), ['b', 'c', 'a', 'd']);
  assert.equal(JSON.stringify(rows), frozen, 'input array must not be mutated');
});

test('CLI reorders a selection and preserves its other fields', () => {
  // Regression guard for the Windows CLI-guard bug: `file://${argv[1]}` never
  // equals import.meta.url (file:///D:/...), so the CLI block silently did not
  // run and stdout was empty. The caller then fell back to queue order having
  // ranked nothing. Asserting real stdout is the only way that shows up.
  const input = JSON.stringify({
    unusable: [],
    rows: [
      { title: 'Sr. Accounting Program Manager', url: 'a' },
      { title: 'Senior Program Manager, Cybersecurity Risk', url: 'b' },
    ],
  });
  const parsed = JSON.parse(runCli(input));
  assert.deepEqual(parsed.rows.map(r => r.url), ['b', 'a']);
  assert.equal(parsed.rows[0].tier, TIER_SECURITY);
  assert.deepEqual(parsed.unusable, [], 'sibling fields must survive the round trip');
});

test('CLI fails loud on unusable input', () => {
  // An empty queue and a broken prioritiser must never look the same.
  for (const bad of ['', '   ', 'not json', '{"nope":1}']) {
    assert.throws(() => runCli(bad), (err) => err.status === 1, `expected exit 1 for ${JSON.stringify(bad)}`);
  }
});

test('an empty row list is valid, not an error', () => {
  const parsed = JSON.parse(runCli(JSON.stringify({ rows: [] })));
  assert.deepEqual(parsed.rows, []);
});
