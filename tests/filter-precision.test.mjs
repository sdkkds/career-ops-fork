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

// 2026-07-27 review round: three substring/coverage defects reproduced by the
// reviewer directly. `intern`/`associate` were matching (or, for `associate`,
// correctly matching but too bluntly) in ways that rejected real senior
// titles; `cso`/"Chief Security Officer" were missing from the
// security-leadership branch entirely.
test('word-boundary and coverage fixes recover real senior titles', () => {
  const cases = [
    ['Senior International Program Manager', 'pm-family'],   // 'intern' inside "International"
    ['VP, International Security Programs', 'security-leadership'], // 'intern' inside "International" + role-word/security composition
    ['Associate Director of Product', 'pm-family'],          // 'associate' modifying an already-senior title
    ['Associate CISO', 'security-leadership'],                // ditto — this user's own named target archetype
    ['Chief Security Officer', 'security-leadership'],        // missing self-term, now added
  ];
  for (const [t, archetype] of cases) {
    const result = classifyTitle(t);
    assert.equal(result.admit, true, `expected admit: ${t}`);
    assert.equal(result.archetype, archetype, `expected archetype ${archetype} for: ${t}`);
  }
});

test('the associate fix does not blanket-admit genuinely junior titles', () => {
  // "Associate Product Manager" (IC-level, no senior-title modifier) must
  // still reject — only "associate <senior title>" compounds are exempted.
  const rejected = classifyTitle('Associate Product Manager');
  assert.equal(rejected.admit, false);
  assert.equal(rejected.negative, 'associate');
});

test('Deputy CISO is unaffected by the associate/intern fixes', () => {
  const result = classifyTitle('Deputy CISO');
  assert.equal(result.admit, true);
  assert.equal(result.archetype, 'security-leadership');
});

// 2026-07-27 gate-followup: 'solutions architect' added to ROLE_TERMS so this
// user's named target archetype (AI Solutions Architect, see
// modes/_profile.md) stops being rejected by omission. 'solutions engineer'
// deliberately stays out of ROLE_TERMS (sales-engineering title, out of
// scope) — the ruling that kept it off NEGATIVE_TERMS did not put it on the
// accept list either.
//
// 2026-07-28 tightening (superseded the un-qualified version of this test):
// the bare 'solutions architect' role term alone turned out too broad in
// live scan data (33 of 41 newly-admitted postings were AWS vendor
// pre-sales), so a solutions-architect title now additionally requires a
// security or AI/ML qualifier — see 'Solutions Architect admits only with an
// AI/ML or security qualifier' below for the full qualifier matrix. The
// "Specialist"/"Associate"/"Solutions Engineer" cases here are unaffected by
// that tightening (they reject for other reasons) and stay as regression
// coverage.
test('Solutions Architect admits when senior, rejects when not, engineer stays out', () => {
  const specialist = classifyTitle('Worldwide Specialist Solutions Architect - Agentic Development, Data & AI GTM');
  assert.equal(specialist.admit, false, '"Specialist" is not a seniority term');

  const principal = classifyTitle('Principal Solutions Architect, Security');
  assert.equal(principal.admit, true, 'Principal Solutions Architect should admit (security qualifier)');
  assert.equal(principal.archetype, 'pm-family');

  const associate = classifyTitle('Associate Solutions Architect');
  assert.equal(associate.admit, false, 'Associate Solutions Architect should still reject (negative)');
  assert.equal(associate.negative, 'associate');

  const engineer = classifyTitle('Solutions Engineer');
  assert.equal(engineer.admit, false, 'Solutions Engineer stays out of scope — no role term');
  assert.equal(engineer.roleTerm, null);
});

// 2026-07-28 tightening: live scan data showed the bare 'solutions
// architect' role term admitting a standing inflow of AWS/Amazon vendor
// cloud pre-sales titles (33 of 41 newly-admitted postings in one scan),
// which does not match this user's named archetype (AI Solutions
// Architect). Approved rule: 'solutions architect'/'solution architect'
// only counts as a role term when the title also carries a security or
// AI/ML qualifier. This is deliberately narrower than the general
// "security is a signal, never a gate" rule (see lib/filter.mjs module
// comment) — that rule protects PM-family titles, which don't need the
// narrowing because the role term itself already disambiguates the
// archetype; 'solutions architect' does not.
test('Solutions Architect admits only with an AI/ML or security qualifier', () => {
  const admitCases = [
    'Principal Solutions Architect, Security',
    'Senior Solutions Architect, AI Solutions',
    'Sr Solutions Architect, Annapurna ML',
    'Senior AI/ML Solutions Architect',
  ];
  for (const t of admitCases) {
    const result = classifyTitle(t);
    assert.equal(result.admit, true, `expected admit: ${t}`);
    assert.equal(result.archetype, 'pm-family', `expected pm-family archetype: ${t}`);
  }

  const rejectCases = [
    'Senior Solutions Architect, Enterprise (Retail, Restaurant & CPG)',
    'Sr. Solutions Architect, AWS Aerospace & Satellite',
    'Senior Partner Solutions Architect - GSI',
    'Sr. TAM, Solutions Architect',
  ];
  for (const t of rejectCases) {
    const result = classifyTitle(t);
    assert.equal(result.admit, false, `expected reject (no AI/ML/security qualifier): ${t}`);
    assert.equal(result.roleTerm, null, `expected roleTerm nulled by the qualifier gate: ${t}`);
  }

  // The substring trap: 'ai' must NOT match inside "Email" — bare AI/ML
  // abbreviations are word-boundary matched (AMBIGUOUS_SHORT), same as
  // 'pm'/'ciso'/'cso'.
  const emailTrap = classifyTitle('Senior Solutions Architect, Email Infrastructure');
  assert.equal(emailTrap.admit, false, '"ai" inside "Email" must not count as an AI/ML qualifier');
  assert.equal(emailTrap.roleTerm, null);

  // Associate Solutions Architect: still rejects, but on the negative gate
  // (unaffected by the qualifier tightening — negative takes precedence).
  const associate = classifyTitle('Associate Solutions Architect');
  assert.equal(associate.admit, false);
  assert.equal(associate.negative, 'associate');

  // No seniority AND no AI/ML/security qualifier: the qualifier gate wins
  // (roleTerm nulled), so the rejection reason is "no role term", not "no
  // seniority" — status selection (gateStatusFor in scan.mjs) reports
  // skipped_role here, not skipped_seniority.
  const noQualifierNoSeniority = classifyTitle('Worldwide Specialist Solutions Architect - Agentic Development');
  assert.equal(noQualifierNoSeniority.admit, false);
  assert.equal(noQualifierNoSeniority.roleTerm, null, 'qualifier gate nulls roleTerm even though seniority is also missing');
});

// Unaffected by the Solutions Architect qualifier tightening — other role
// terms and the security-leadership branch don't go through
// SOLUTIONS_ARCHITECT_TERMS at all.
test('the Solutions Architect qualifier tightening does not affect other role terms', () => {
  assert.equal(classifyTitle('Senior Product Manager').admit, true);
  assert.equal(classifyTitle('Field CISO').admit, true);
  const tpm = classifyTitle('Senior Technical Program Manager, Security');
  assert.equal(tpm.admit, true);
  assert.equal(tpm.archetype, 'pm-family');
});

// 2026-07-27 gate-followup Fix 1: status selection must distinguish "no role
// term at all" (skipped_role) from "role term present, no seniority"
// (skipped_seniority). Both were previously collapsed into
// 'skipped_seniority' by scan.mjs, mislabeling the audit trail. This
// mirrors scan.mjs's gateStatusFor() logic directly against classifyTitle's
// return shape so the status-selection contract has direct test coverage.
function gateStatusFor(gate) {
  if (gate.negative) return 'skipped_negative';
  if (!gate.roleTerm) return 'skipped_role';
  return 'skipped_seniority';
}

test('status selection distinguishes skipped_role vs skipped_seniority vs skipped_negative', () => {
  const noRoleTerm = classifyTitle('Principal AI Security Specialist');
  assert.equal(noRoleTerm.admit, false);
  assert.equal(gateStatusFor(noRoleTerm), 'skipped_role');

  const bareNoRole = classifyTitle('Sr. Data Platform Lead');
  assert.equal(bareNoRole.roleTerm, null);
  assert.equal(gateStatusFor(bareNoRole), 'skipped_role');

  const roleNoSeniority = classifyTitle('Product Manager SSD');
  assert.equal(roleNoSeniority.admit, false);
  assert.equal(roleNoSeniority.roleTerm, 'product manager');
  assert.equal(roleNoSeniority.seniorityTerm, null);
  assert.equal(gateStatusFor(roleNoSeniority), 'skipped_seniority');

  const negative = classifyTitle('Junior Product Manager');
  assert.equal(gateStatusFor(negative), 'skipped_negative');

  // Solutions Architect qualifier gate (2026-07-28): when the qualifier is
  // missing, the reason is "no role term" even if seniority is ALSO
  // missing — the qualifier gate wins over the seniority miss.
  const unqualifiedNoSeniority = classifyTitle('Worldwide Specialist Solutions Architect - Agentic Development');
  assert.equal(gateStatusFor(unqualifiedNoSeniority), 'skipped_role');
});

test('the security signal does not fire on "soc" hiding inside "associate"', () => {
  // 'soc' is a substring of "asSOCiate". Before word-boundary matching, an
  // "Associate Director of Product" — which admits via the senior-compound
  // exception — carried securitySignal=true into scoring as a general PM role.
  assert.equal(classifyTitle('Associate Director of Product').securitySignal, false);
  assert.equal(classifyTitle('Associate VP, Product Management').securitySignal, false);
  // The real SOC sense must survive.
  assert.equal(classifyTitle('Director, Security Operations Center (SOC)').securitySignal, true);
  assert.equal(classifyTitle('Senior Program Manager, SOC Automation').securitySignal, true);
});