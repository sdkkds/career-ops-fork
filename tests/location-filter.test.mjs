// tests/location-filter.test.mjs — location pre-screen gate (classifyLocation).
//
// Owner lives in Seattle, wants remote roles. Non-US companies are fine only
// if the role is actually workable remotely from Seattle. Region-scoped
// remote (e.g. "remote within Canada") is NOT workable from Seattle and must
// reject even though it says "remote". See lib/filter.mjs classifyLocation
// and CLAUDE.md task spec for the full rule.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyLocation } from '../lib/filter.mjs';

const ADMIT = [
  'Bellevue, Washington',
  'Bellevue, Washington; Chicago, Illinois; San Francisco, California; Washington, DC',
  'San Francisco, California',
  'United States',
  'Remote',
  'Remote - Anywhere',
  '', // empty — no usable location data, fail open
  'posted: 2026-07-15', // labeled segment in the location slot — treat as absent
];

const REJECT = [
  'Mohali, IND',
  'Toronto, Ontario, Canada',
  'Toronto, Ontario, Canada, Remote', // region-scoped remote — not workable from Seattle
  'Alberta, CANADA, Canada, Remote',
  'Bengaluru, India',
  'London, , United Kingdom',
  'Munich, Bavaria, DEU',
  'Sydney, New South Wales, AUS',
  'Prague, Czech Republic',
  'Costa Rica',
  'Remote - UK',
  'Remote, EMEA',
];

test('admits US locations, unscoped remote, and missing/labeled data', () => {
  for (const loc of ADMIT) {
    assert.equal(classifyLocation(loc).admit, true, `expected admit: "${loc}"`);
  }
});

test('rejects non-US region-scoped locations, including region-scoped remote', () => {
  for (const loc of REJECT) {
    assert.equal(classifyLocation(loc).admit, false, `expected reject: "${loc}"`);
  }
});

test('order matters: US check wins before region-scoping, so state names are not confused', () => {
  // "Washington" is a US state, not a mistaken partial match against anything else.
  assert.equal(classifyLocation('Washington, DC').admit, true);
  assert.equal(classifyLocation('Bellevue, Washington').admit, true);
});

test('order matters: region-scoping is checked before the unscoped-remote check', () => {
  // Both say "Remote" but are region-locked — must reject, not admit on the remote word.
  assert.equal(classifyLocation('Toronto, Ontario, Canada, Remote').admit, false);
  assert.equal(classifyLocation('Remote - UK').admit, false);
});

test('fail-open: absent/malformed location data never fail-closed', () => {
  assert.equal(classifyLocation('').admit, true);
  assert.equal(classifyLocation('   ').admit, true);
  assert.equal(classifyLocation(null).admit, true);
  assert.equal(classifyLocation(undefined).admit, true);
  assert.equal(classifyLocation(42).admit, true);
  assert.equal(classifyLocation('posted: 2026-07-15').admit, true);
  assert.equal(classifyLocation('trust: 60 missing_apply_url').admit, true);
  assert.equal(classifyLocation('note: some note').admit, true);
});

test('unscoped remote from a non-US company admits (rule 4)', () => {
  assert.equal(classifyLocation('Remote').admit, true);
  assert.equal(classifyLocation('Work from home').admit, true);
  assert.equal(classifyLocation('Anywhere').admit, true);
  assert.equal(classifyLocation('Distributed').admit, true);
});

test('config-driven extra vocabulary augments (not replaces) built-in defaults', () => {
  // An absent/empty config must behave exactly like the built-in rule.
  assert.equal(classifyLocation('Paris, France').admit, false);
  assert.equal(classifyLocation('Paris, France', {}).admit, false);
  assert.equal(classifyLocation('Paris, France', null).admit, false);

  // Extra region-block vocabulary can be added without disturbing defaults.
  assert.equal(classifyLocation('Remote - Ruritania', { region_block_extra: ['ruritania'] }).admit, false);
  // And extra vocab doesn't break existing defaults.
  assert.equal(classifyLocation('Mohali, IND', { region_block_extra: ['ruritania'] }).admit, false);
});

// ── Whole-queue outcome drift guard ─────────────────────────────────
// A small fixture representative of the real data/pipeline.md 4th-column
// shapes, asserting the admit/reject split doesn't silently drift.
const FIXTURE_QUEUE = [
  'Bellevue, Washington',
  'San Francisco, California',
  'United States',
  'Remote',
  '',
  'posted: 2026-07-20',
  'Mohali, IND',
  'Toronto, Ontario, Canada, Remote',
  'Bengaluru, India',
  'Remote - UK',
  'Prague, Czech Republic',
];

test('representative fixture queue produces the expected admit/reject split', () => {
  const results = FIXTURE_QUEUE.map(loc => classifyLocation(loc).admit);
  const admitCount = results.filter(Boolean).length;
  const rejectCount = results.length - admitCount;
  assert.equal(admitCount, 6, `expected 6 admits, got ${admitCount}`);
  assert.equal(rejectCount, 5, `expected 5 rejects, got ${rejectCount}`);
});
