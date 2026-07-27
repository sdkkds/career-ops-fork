import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyTitle } from '../lib/filter.mjs';

const ADMIT = [
  'Senior Product Manager',
  'Senior Technical Program Manager, Security',
  'Staff Product Owner',
  'Principal Product Manager, SASE',
  'Lead Project Manager',
  'Group Product Manager',
  'Director of Product',
  'Head of Product Management',
  'Director, Program Management',
  'Senior Program Manager — Cloud Infrastructure',
  'TPM — Identity',
];

const REJECT = [
  'Product Manager',              // no seniority
  'Junior Product Manager',       // negative
  'Senior Software Engineer',     // no role term
  'Security Analyst',             // negative
  'SOC Analyst',
  'Sales Engineer',
  'Staff Backend Engineer',
  'Intern, Product',
];

test('admits senior IC and people-manager PM/PO/TPM titles', () => {
  for (const t of ADMIT) {
    assert.equal(classifyTitle(t).admit, true, `expected admit: ${t}`);
  }
});

test('rejects non-senior, non-role, and negative titles', () => {
  for (const t of REJECT) {
    assert.equal(classifyTitle(t).admit, false, `expected reject: ${t}`);
  }
});

test('security is a signal, never a gate', () => {
  const general = classifyTitle('Senior Product Manager');
  const secure = classifyTitle('Senior Product Manager, Security');
  assert.equal(general.admit, true);
  assert.equal(general.securitySignal, false);
  assert.equal(secure.admit, true);
  assert.equal(secure.securitySignal, true);
});

test('security-native titles without the word "security" survive', () => {
  assert.equal(classifyTitle('Principal Product Manager, SASE').admit, true);
  assert.equal(classifyTitle('Senior TPM — Identity and Access').admit, true);
});

test('GRC and Solutions Engineer are not bare negatives', () => {
  assert.equal(classifyTitle('Senior Program Manager, GRC').admit, true);
  assert.equal(classifyTitle('Director of Product, Solutions').admit, true);
});

test('junk input is rejected without throwing', () => {
  for (const t of ['', null, undefined, 42]) {
    assert.equal(classifyTitle(t).admit, false);
  }
});

// Second accept branch (2026-07-27 ruling): security-leadership titles carry
// their own seniority, exactly like "Director of Product" does in the
// pm-family branch — parallel to, not layered on top of, the pm-family gate.
const SECURITY_LEADERSHIP_ADMIT = [
  'Field CISO',
  'Head of Security',
  'Director of Cybersecurity',
  'Director, Security',
  'CISO',
  'vCISO',
  'VP Security',
];

test('admits security-leadership titles with no separate seniority word', () => {
  for (const t of SECURITY_LEADERSHIP_ADMIT) {
    const result = classifyTitle(t);
    assert.equal(result.admit, true, `expected admit: ${t}`);
    assert.equal(result.archetype, 'security-leadership', `expected security-leadership archetype: ${t}`);
  }
});

test('archetype tags pm-family vs security-leadership distinctly', () => {
  const pm = classifyTitle('Senior Product Manager, Security');
  assert.equal(pm.admit, true);
  assert.equal(pm.archetype, 'pm-family');
  assert.equal(pm.securitySignal, true);

  const leadership = classifyTitle('Director of Cybersecurity');
  assert.equal(leadership.admit, true);
  assert.equal(leadership.archetype, 'security-leadership');

  const rejected = classifyTitle('Junior Product Manager');
  assert.equal(rejected.admit, false);
  assert.equal(rejected.archetype, null);
});

test('negative terms still block the security-leadership branch', () => {
  assert.equal(classifyTitle('Junior CISO').admit, false);
});
