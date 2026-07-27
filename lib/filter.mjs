/**
 * lib/filter.mjs — admission gate for full evaluation.
 *
 * Admit only when the title has BOTH a role term AND a seniority term, and no
 * negative term. Domain fit is judged at eval time, not here: over-evaluating a
 * borderline PM role is cheap, false-negativing a real one is not.
 *
 * Security presence is returned as a scoring SIGNAL and never gates admission —
 * gating on it would drop both the general PM roles in scope and the
 * security-native postings whose titles omit the word (e.g. "Principal PM, SASE").
 */

const ROLE_TERMS = [
  'product manager', 'product management', 'product owner',
  'program manager', 'program management', 'project manager', 'project management',
  'technical program manager', 'tpm', 'technical product manager',
  'director of product', 'head of product', 'group product manager',
  'pm', // bare abbreviation (e.g. "Staff PM, SIEM"); boundary-matched, see `matches()`
];

const SENIORITY_TERMS = [
  'senior', 'sr.', 'sr ', 'staff', 'principal', 'lead', 'group',
  'director', 'head of', 'chief', 'vp', 'vice president',
];

const NEGATIVE_TERMS = [
  'junior', 'jr.', 'intern', 'internship', 'associate',
  'security analyst', 'soc analyst', 'sales engineer',
  'software engineer', 'backend engineer', 'frontend engineer', 'full stack',
  'data engineer', 'ml engineer', 'devops engineer',
];

// Security-native vocabulary — a scoring boost, never an admission gate.
const SECURITY_TERMS = [
  'security', 'cybersecurity', 'infosec', 'cyber', 'vulnerability',
  'sase', 'zero trust', 'identity', 'iam', 'grc', 'compliance',
  'penetration', 'red team', 'appsec', 'siem', 'soc',
];

// "pm" needs word-boundary matching so it doesn't false-positive inside
// unrelated words — it is new and, unlike the pre-existing short terms
// ('tpm', 'vp'), was never substring-safe to begin with. Leave the other
// (already-working) terms on plain substring matching so this fix doesn't
// narrow behavior ('vp' still matches inside "SVP", as before).
const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const AMBIGUOUS_SHORT = new Set(['pm']);
const matches = (haystack, term) => AMBIGUOUS_SHORT.has(term)
  ? new RegExp(`\\b${escapeRe(term)}\\b`).test(haystack)
  : haystack.includes(term);

const found = (haystack, terms) => terms.find(t => matches(haystack, t)) ?? null;

export function classifyTitle(title) {
  if (typeof title !== 'string' || !title.trim()) {
    return { admit: false, roleTerm: null, seniorityTerm: null, negative: null, securitySignal: false };
  }
  const t = ` ${title.toLowerCase().replace(/[—–]/g, '-')} `;

  const negative = found(t, NEGATIVE_TERMS);
  const roleTerm = found(t, ROLE_TERMS);
  const seniorityTerm = found(t, SENIORITY_TERMS);
  const securitySignal = Boolean(found(t, SECURITY_TERMS));

  // A people-manager title like "Director of Product" carries its own seniority.
  // "TPM" / "Technical Program Manager" are included because that title is
  // itself a senior-track role in this person's target market (e.g.
  // "TPM — Identity", "Technical Program Manager - Security" from their own
  // application history) — it does not appear bare on entry-level postings the
  // way "Product Manager" or "Project Manager" can.
  const selfSenior = [
    'director of product', 'head of product', 'group product manager',
    'tpm', 'technical program manager',
  ].some(x => t.includes(x));

  return {
    admit: Boolean(roleTerm) && Boolean(seniorityTerm || selfSenior) && !negative,
    roleTerm,
    seniorityTerm: seniorityTerm ?? (selfSenior ? roleTerm : null),
    negative,
    securitySignal,
  };
}
