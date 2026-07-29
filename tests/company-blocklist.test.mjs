// tests/company-blocklist.test.mjs — corporate-HQ company blocklist gate.
//
// Owner does not work for companies headquartered in Israel. This is a
// company-level, HQ-only rule — deliberately distinct from "Israeli-founded"
// or "has Israeli R&D". See portals.yml `company_blocklist` and scan.mjs
// wiring (buildCompanyBlocklist, status `skipped_company`).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'url';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const { buildCompanyBlocklist } = await import(pathToFileURL(join(ROOT, 'scan.mjs')).href);

const SEED = ['Check Point Software Technologies'];

test('matches common name variants of a blocklisted company', () => {
  const isBlocked = buildCompanyBlocklist(SEED);
  assert.equal(isBlocked('Check Point'), true);
  assert.equal(isBlocked('Check Point Software'), true);
  assert.equal(isBlocked('Check Point Software Technologies Ltd.'), true);
  assert.equal(isBlocked('CheckPoint'), true);
});

test('case-insensitive', () => {
  const isBlocked = buildCompanyBlocklist(SEED);
  assert.equal(isBlocked('CHECK POINT'), true);
  assert.equal(isBlocked('check point software'), true);
});

test('absent or empty config blocks nothing (fail open, never fail closed)', () => {
  assert.equal(buildCompanyBlocklist(undefined)('Check Point'), false);
  assert.equal(buildCompanyBlocklist(null)('Check Point'), false);
  assert.equal(buildCompanyBlocklist([])('Check Point'), false);
  assert.equal(buildCompanyBlocklist(undefined)('Any Company At All'), false);
});

test('a company not on the list admits', () => {
  const isBlocked = buildCompanyBlocklist(SEED);
  assert.equal(isBlocked('Okta'), false);
  assert.equal(isBlocked('ServiceNow'), false);
  assert.equal(isBlocked('Zscaler'), false);
});

// The HQ-only criterion is deliberate: Orca Security, Axonius, Wiz, and
// SentinelOne are all Israeli-founded with primary R&D in Tel Aviv, but all
// four are US-headquartered (Portland, New York, New York, Mountain View) —
// none of them is blocked. Palo Alto Networks is US-founded and US-HQ'd.
// This test pins that distinction against a future well-meaning edit that
// tries to "complete" the list with them.
test('Israeli-founded/Israeli-R&D but non-Israeli-HQ companies are NOT blocked', () => {
  const isBlocked = buildCompanyBlocklist(SEED);
  assert.equal(isBlocked('Orca Security'), false);
  assert.equal(isBlocked('Axonius'), false);
  assert.equal(isBlocked('Wiz'), false);
  assert.equal(isBlocked('SentinelOne'), false);
  assert.equal(isBlocked('Palo Alto Networks'), false);
});

test('non-string / malformed config entries do not crash and do not cause false matches', () => {
  const isBlocked = buildCompanyBlocklist([null, 42, undefined, '', '   ', 'Check Point']);
  assert.equal(isBlocked('Check Point'), true);
  assert.equal(isBlocked('Okta'), false);
});

test('non-string company name input does not crash', () => {
  const isBlocked = buildCompanyBlocklist(SEED);
  assert.equal(isBlocked(null), false);
  assert.equal(isBlocked(undefined), false);
  assert.equal(isBlocked(42), false);
  assert.equal(isBlocked({}), false);
});

test('a bare string (not array) config entry is wrapped to a single-item list', () => {
  const isBlocked = buildCompanyBlocklist('Check Point Software Technologies');
  assert.equal(isBlocked('Check Point'), true);
});
