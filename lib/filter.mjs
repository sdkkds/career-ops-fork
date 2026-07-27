/**
 * lib/filter.mjs — admission gate for full evaluation.
 *
 * Two parallel accept branches, each independently sufficient to admit:
 *
 *  1. pm-family — the title has BOTH a role term (Product/Program/Project
 *     Manager/Owner family, including people-manager variants) AND a
 *     seniority term, and no negative term.
 *  2. security-leadership — the title is a security-leadership role (CISO,
 *     Head of Security, Director of Cybersecurity, VP Security, etc.),
 *     which carries its own seniority the same way "Director of Product"
 *     does — no separate seniority word required.
 *
 * `archetype` reports which branch admitted a title ('pm-family' |
 * 'security-leadership' | null), so downstream evaluation can score a CISO
 * role against security-leadership competencies rather than PM competencies.
 *
 * Domain fit beyond archetype selection is judged at eval time, not here:
 * over-evaluating a borderline role is cheap, false-negativing a real one is
 * not.
 *
 * `securitySignal` is a separate scoring signal and never gates admission on
 * its own for the pm-family branch — gating pm-family titles on it would drop
 * both the general PM roles in scope and the security-native postings whose
 * titles omit the word (e.g. "Principal PM, SASE"). A security-flavoured PM
 * title (e.g. "Senior Product Manager, Security") is archetype 'pm-family'
 * with securitySignal true — the two are independent.
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

// Security-native vocabulary — a scoring boost, never an admission gate for
// the pm-family branch. (It IS how the security-leadership branch below
// recognizes its own role terms — that's a different, explicit role family,
// not "security" alone gating a PM title.)
const SECURITY_TERMS = [
  'security', 'cybersecurity', 'infosec', 'cyber', 'vulnerability',
  'sase', 'zero trust', 'identity', 'iam', 'grc', 'compliance',
  'penetration', 'red team', 'appsec', 'siem', 'soc',
];

// Second accept branch, parallel to (not layered on top of) the pm-family
// branch: security-leadership titles carry their own seniority, the same way
// "Director of Product" does in the pm-family branch — no separate seniority
// word required. This is a deliberate, explicitly-named role family, not
// "security" itself becoming a pm-family gate input.
const SECURITY_LEADERSHIP_TERMS = [
  'ciso', 'vciso', 'v-ciso',
  'head of security', 'head of cybersecurity', 'head of information security',
  'director of security', 'director, security',
  'director of cybersecurity', 'director, cybersecurity',
  'director of information security', 'director, information security',
  'vp security', 'vp, security', 'vp of security',
  'vp cybersecurity', 'vp of cybersecurity',
  'vice president of security', 'vice president, security',
  'vice president of cybersecurity',
  'chief information security officer',
];

// "pm" and "ciso"/"vciso" need word-boundary matching so they don't
// false-positive inside unrelated words — unlike the pre-existing short
// terms ('tpm', 'vp'), they were never substring-safe to begin with. Leave
// the other (already-working) terms on plain substring matching so this
// doesn't narrow behavior ('vp' still matches inside "SVP", as before).
const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const AMBIGUOUS_SHORT = new Set(['pm', 'ciso', 'vciso']);
const matches = (haystack, term) => AMBIGUOUS_SHORT.has(term)
  ? new RegExp(`\\b${escapeRe(term)}\\b`).test(haystack)
  : haystack.includes(term);

const found = (haystack, terms) => terms.find(t => matches(haystack, t)) ?? null;

export function classifyTitle(title) {
  if (typeof title !== 'string' || !title.trim()) {
    return {
      admit: false, roleTerm: null, seniorityTerm: null, negative: null,
      securitySignal: false, archetype: null,
    };
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

  const pmFamilyAdmit = Boolean(roleTerm) && Boolean(seniorityTerm || selfSenior) && !negative;

  // Second branch: security-leadership titles carry their own seniority (see
  // module comment) — no separate seniority term required, only the absence
  // of a negative term.
  const securityLeadershipTerm = found(t, SECURITY_LEADERSHIP_TERMS);
  const securityLeadershipAdmit = Boolean(securityLeadershipTerm) && !negative;

  const admit = pmFamilyAdmit || securityLeadershipAdmit;
  const archetype = pmFamilyAdmit ? 'pm-family' : (securityLeadershipAdmit ? 'security-leadership' : null);

  return {
    admit,
    roleTerm: pmFamilyAdmit ? roleTerm : (securityLeadershipAdmit ? securityLeadershipTerm : roleTerm),
    seniorityTerm: seniorityTerm ?? (selfSenior ? roleTerm : (securityLeadershipAdmit ? securityLeadershipTerm : null)),
    negative,
    securitySignal,
    archetype,
  };
}
