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
 *
 * Return contract note (branch-dependent field reuse): `roleTerm` and
 * `seniorityTerm` are repurposed by the security-leadership branch to carry
 * whichever term admitted the title (e.g. both hold 'ciso' for a CISO title,
 * or 'vp' for a role-word+security-term composed match) — they are NOT
 * ROLE_TERMS/SENIORITY_TERMS hits in that case. `archetype` is the
 * authoritative field for which branch matched; a consumer that cares which
 * vocabulary a match came from must check `archetype` first.
 */

const ROLE_TERMS = [
  'product manager', 'product management', 'product owner',
  'program manager', 'program management', 'project manager', 'project management',
  'technical program manager', 'tpm', 'technical product manager',
  'director of product', 'head of product', 'group product manager',
  'pm', // bare abbreviation (e.g. "Staff PM, SIEM"); boundary-matched, see `matches()`
  // 'solutions architect' / 'solution architect' (2026-07-27 ruling): this
  // user's own named target archetype (see modes/_profile.md: "AI Solutions
  // Architect"). Deliberately NOT added to NEGATIVE_TERMS (that ruling
  // stands), but omitted from ROLE_TERMS it was rejected by omission — a
  // senior one (e.g. "Sr. Solutions Architect", "Principal Solutions
  // Architect, Security") now admits through the normal role+seniority gate
  // like any other role; a non-senior one still rejects on seniority.
  // 'solutions engineer' is deliberately NOT added here — it's a
  // sales-engineering title, out of scope; the ruling that kept it off
  // NEGATIVE_TERMS did not put it on the accept list either.
  'solutions architect', 'solution architect',
];

const SENIORITY_TERMS = [
  'senior', 'sr.', 'sr ', 'staff', 'principal', 'lead', 'group',
  'director', 'head of', 'chief', 'vp', 'vice president',
];

// 'associate' is handled specially below (see ASSOCIATE_SENIOR_EXCEPTIONS) —
// it is excluded from this flat list so a compound like "Associate CISO" /
// "Associate Director" (this user's own named target archetype,
// "Associate/Deputy CISO" — see modes/_profile.md) isn't blanket-rejected.
const NEGATIVE_TERMS = [
  'junior', 'jr.', 'intern', 'internship',
  'security analyst', 'soc analyst', 'sales engineer',
  'software engineer', 'backend engineer', 'frontend engineer', 'full stack',
  'data engineer', 'ml engineer', 'devops engineer',
];

// Compound titles where "associate" modifies an already-senior title rather
// than meaning "junior" — these must NOT trigger the associate negative.
// Every other bare "associate" (e.g. "Associate Product Manager") still does.
const ASSOCIATE_SENIOR_EXCEPTIONS = [
  'associate director', 'associate vp', 'associate vice president',
  'associate ciso', 'associate cso', 'associate chief',
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
//
// Two ways in:
//  - SECURITY_LEADERSHIP_SELF_TERMS: the title alone (CISO, vCISO, CSO,
//    "Chief Security/Information Security Officer") already IS the role AND
//    the seniority — no separate security word needed (matches
//    "Field CISO", which doesn't contain "security" at all).
//  - SECURITY_LEADERSHIP_ROLE_WORDS composed with a SECURITY_TERMS hit
//    anywhere in the title (not necessarily adjacent): a generic leadership
//    title (Director/VP/Head of/Chief) PLUS a security-domain word, e.g.
//    "VP, International Security Programs" — an exact-phrase list like
//    "vp security" would miss this (the modifier "International" breaks
//    adjacency), so this is co-occurrence, the same way pm-family's role
//    term and seniority term don't have to be adjacent either.
const SECURITY_LEADERSHIP_SELF_TERMS = [
  'ciso', 'vciso', 'v-ciso', 'cso',
  'chief information security officer', 'chief security officer',
];
const SECURITY_LEADERSHIP_ROLE_WORDS = ['head of', 'director', 'vp', 'vice president', 'chief'];

// "pm", "ciso"/"vciso"/"cso", and "intern"/"associate" need word-boundary
// matching so they don't false-positive inside unrelated words (e.g.
// "intern" inside "International"/"Internal", bare "associate" inside a
// larger word) — unlike the pre-existing short terms ('tpm', 'vp'), they
// were never substring-safe to begin with. Leave the other (already-working)
// terms on plain substring matching so this doesn't narrow behavior ('vp'
// still matches inside "SVP", as before).
const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const AMBIGUOUS_SHORT = new Set(['pm', 'ciso', 'vciso', 'cso', 'intern', 'associate']);
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

  // "associate" is excluded from NEGATIVE_TERMS and checked separately: a
  // compound like "Associate Director"/"Associate CISO" modifies an
  // already-senior title rather than meaning "junior" (this user's own
  // profile names "Associate/Deputy CISO" as a target), while bare
  // "Associate Product Manager" is still correctly junior.
  const hasBareAssociate = matches(t, 'associate')
    && !ASSOCIATE_SENIOR_EXCEPTIONS.some(x => t.includes(x));
  const negative = found(t, NEGATIVE_TERMS) ?? (hasBareAssociate ? 'associate' : null);

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
  // of a negative term. Self-sufficient titles (CISO, CSO, ...) win first;
  // otherwise a generic leadership word (Director/VP/Head of/Chief) combined
  // with any SECURITY_TERMS hit anywhere in the title also admits — this
  // catches modifier-in-the-middle titles like "VP, International Security
  // Programs" that an exact adjacent-phrase list would miss.
  const securityLeadershipSelfTerm = found(t, SECURITY_LEADERSHIP_SELF_TERMS);
  const securityLeadershipRoleWord = found(t, SECURITY_LEADERSHIP_ROLE_WORDS);
  const securityLeadershipComposedTerm = (!securityLeadershipSelfTerm && securityLeadershipRoleWord && securitySignal)
    ? securityLeadershipRoleWord
    : null;
  const securityLeadershipTerm = securityLeadershipSelfTerm ?? securityLeadershipComposedTerm;
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
