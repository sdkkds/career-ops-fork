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
  //
  // 2026-07-28 tightening: the bare term alone turned out too broad in
  // live scan data — AWS/Amazon posts vendor cloud pre-sales "Solutions
  // Architect" titles continuously (33 of 41 newly-admitted postings in one
  // scan were AWS pre-sales, e.g. "Sr. Solutions Architect, AWS Aerospace &
  // Satellite"), which is a standing inflow, not a one-off. See
  // SOLUTIONS_ARCHITECT_TERMS / AI_ML_TERMS below — a solutions-architect
  // title now additionally requires an AI/ML or security qualifier to admit.
  'solutions architect', 'solution architect',
];

// Deliberately narrower rule than "security is a signal, never a gate"
// (see module comment / SECURITY_TERMS below) — that rule protects
// *PM-family* titles (Product/Program/Project Manager etc.) from being
// required to mention security, because the role term itself already
// distinguishes the archetype. "Solutions Architect" does NOT distinguish
// this user's target archetype (AI Solutions Architect, modes/_profile.md)
// from vendor cloud pre-sales — AWS/GCP/Azure post "Solutions Architect"
// continuously for pre-sales roles with no AI/ML or security scope at all.
// So for this one role term specifically, a security or AI/ML qualifier
// IS required to admit. Do not "fix" this back to match the general rule —
// it's intentionally different, for this term only.
const SOLUTIONS_ARCHITECT_TERMS = ['solutions architect', 'solution architect'];

// AI/ML qualifier vocabulary for the Solutions Architect narrowing above.
// 'ai' and 'ml' are bare abbreviations and need word-boundary matching (see
// AMBIGUOUS_SHORT below) — 'ai' is a substring of "email", "domain",
// "detail", "chain", "Ukraine"; 'ml' of "html".
const AI_ML_TERMS = [
  'artificial intelligence', 'machine learning', 'genai', 'generative ai',
  'llm', 'mlops', 'ai', 'ml',
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
// 'soc' is here for the same reason: it is a substring of "asSOCiate", so a
// plain match set securitySignal=true on "Associate Director of Product" — a
// general PM title that admits via the senior-compound exception, then carried a
// spurious security flag into scoring. Word-boundary matching keeps the real SOC
// (security operations centre) sense without the collision.
const AMBIGUOUS_SHORT = new Set(['pm', 'ciso', 'vciso', 'cso', 'soc', 'intern', 'associate', 'ai', 'ml']);
const matches = (haystack, term) => AMBIGUOUS_SHORT.has(term)
  ? new RegExp(`\\b${escapeRe(term)}\\b`).test(haystack)
  : haystack.includes(term);

const found = (haystack, terms) => terms.find(t => matches(haystack, t)) ?? null;

// ── Location pre-screen gate (classifyLocation) ─────────────────────
// Admission gate for the job's LOCATION, parallel to classifyTitle above but
// judged on the provider-supplied `location` string instead of the title.
//
// Owner lives in Seattle and wants remote roles. Non-US companies are fine
// only when the role is actually workable remotely from Seattle. Evaluated
// in strict order (see CLAUDE.md task spec for the full rationale):
//
//  1. No usable location data → ADMIT (fail open — never drop on absent
//     data). A pipeline.md 4th cell holding a labeled segment instead of a
//     location (`posted:`, `trust:`, `note:` — written when the posting had
//     no location) counts as absent too.
//  2. US-located → ADMIT. Matches USA/U.S./United States, full state names,
//     and `, XX` two-letter state codes (checked BEFORE region-scoping, so
//     "Washington" the state is never confused with anything else).
//  3. Region-scoped → REJECT, even when it says remote — a Canada-remote or
//     UK-remote role still needs local work authorization the owner doesn't
//     have. Checked BEFORE the unscoped-remote rule below, so a region-locked
//     "Remote - UK" rejects instead of admitting on the word "remote".
//  4. Unscoped remote (no region qualifier) → ADMIT.
//  5. Otherwise → REJECT.
//
// All vocabulary below is hardcoded sensible defaults so classifyLocation
// works out of the box with zero config. scan.mjs may pass a small `extra`
// object (sourced from portals.yml `location_filter.*_extra` keys) to
// ADD to — never replace — this vocabulary, so an absent/empty config
// behaves byte-identical to the built-in rule (fail-open, never fail-closed).

const US_TERMS = ['usa', 'u.s.', 'united states'];

const US_STATE_NAMES = [
  'alabama', 'alaska', 'arizona', 'arkansas', 'california', 'colorado',
  'connecticut', 'delaware', 'florida', 'georgia', 'hawaii', 'idaho',
  'illinois', 'indiana', 'iowa', 'kansas', 'kentucky', 'louisiana', 'maine',
  'maryland', 'massachusetts', 'michigan', 'minnesota', 'mississippi',
  'missouri', 'montana', 'nebraska', 'nevada', 'new hampshire', 'new jersey',
  'new mexico', 'new york', 'north carolina', 'north dakota', 'ohio',
  'oklahoma', 'oregon', 'pennsylvania', 'rhode island', 'south carolina',
  'south dakota', 'tennessee', 'texas', 'utah', 'vermont', 'virginia',
  'washington', 'west virginia', 'wisconsin', 'wyoming',
];

// Two-letter USPS state/territory codes, matched only as `, XX` (comma then
// the code) to avoid colliding with ordinary words ("OK", "IN", "OR", ...).
const US_STATE_CODES = [
  'al', 'ak', 'az', 'ar', 'ca', 'co', 'ct', 'de', 'fl', 'ga', 'hi', 'id',
  'il', 'in', 'ia', 'ks', 'ky', 'la', 'me', 'md', 'ma', 'mi', 'mn', 'ms',
  'mo', 'mt', 'ne', 'nv', 'nh', 'nj', 'nm', 'ny', 'nc', 'nd', 'oh', 'ok',
  'or', 'pa', 'ri', 'sc', 'sd', 'tn', 'tx', 'ut', 'vt', 'va', 'wa', 'wv',
  'wi', 'wy', 'dc',
];

// Region/country/city/province tokens seen in real scan data (portals.yml
// live queue), plus generic region groups. Word-boundary matched (see
// `anyMatch` below), so short 3-letter country codes ("IND", "AUS", ...)
// don't false-positive inside unrelated words ("Austin" does not contain a
// boundary-matched "aus").
const REGION_BLOCK_TERMS = [
  'canada', 'india', 'united kingdom', 'uk', 'ireland', 'germany', 'france',
  'japan', 'singapore', 'australia', 'israel', 'mexico', 'brazil', 'poland',
  'spain', 'czech', 'costa rica', 'netherlands', 'sweden', 'italy',
  'toronto', 'ontario', 'alberta', 'vancouver', 'british columbia',
  'bengaluru', 'bangalore', 'mohali', 'prague', 'munich', 'milan', 'sydney',
  'staines', 'london', 'tel aviv',
  'ind', 'can', 'deu', 'ita', 'aus',
  'emea', 'apac', 'latam',
];

// Unscoped remote/anywhere phrasing — admitted only once region-scoping has
// already been ruled out above.
const REMOTE_TERMS = ['remote', 'work from home', 'anywhere', 'distributed'];

const LABELED_SEGMENT_RE = /^(posted|trust|note):/i;

function anyMatch(text, terms) {
  return terms.some(t => new RegExp(`\\b${escapeRe(t)}\\b`, 'i').test(text));
}

function normalizeExtraList(value) {
  return Array.isArray(value) ? value.filter(v => typeof v === 'string' && v.trim()) : [];
}

export function classifyLocation(location, extra = {}) {
  const safeExtra = extra && typeof extra === 'object' ? extra : {};
  const usExtra = normalizeExtraList(safeExtra.us_admit_extra);
  const regionExtra = normalizeExtraList(safeExtra.region_block_extra);
  const remoteExtra = normalizeExtraList(safeExtra.remote_allow_extra);

  const raw = typeof location === 'string' ? location : '';
  const trimmed = raw.trim();

  // 1. No usable location data → ADMIT (fail open).
  if (!trimmed || LABELED_SEGMENT_RE.test(trimmed)) {
    return { admit: true, reason: 'no_data' };
  }

  const stateCodeRe = new RegExp(`,\\s*(${US_STATE_CODES.join('|')})\\b`, 'i');

  // 2. US-located → ADMIT.
  if (
    anyMatch(trimmed, US_TERMS)
    || anyMatch(trimmed, US_STATE_NAMES)
    || stateCodeRe.test(trimmed)
    || anyMatch(trimmed, usExtra)
  ) {
    return { admit: true, reason: 'us' };
  }

  // 3. Region-scoped → REJECT, even when it also says remote.
  if (anyMatch(trimmed, REGION_BLOCK_TERMS) || anyMatch(trimmed, regionExtra)) {
    return { admit: false, reason: 'region_scoped' };
  }

  // 4. Unscoped remote → ADMIT.
  if (anyMatch(trimmed, REMOTE_TERMS) || anyMatch(trimmed, remoteExtra)) {
    return { admit: true, reason: 'unscoped_remote' };
  }

  // 5. Otherwise → REJECT.
  return { admit: false, reason: 'unrecognized' };
}

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

  const roleTermRaw = found(t, ROLE_TERMS);
  const seniorityTerm = found(t, SENIORITY_TERMS);
  const securitySignal = Boolean(found(t, SECURITY_TERMS));

  // Solutions Architect narrowing (see SOLUTIONS_ARCHITECT_TERMS comment
  // above): if the matched role term is a solutions-architect one, it only
  // counts as a role term when the title also carries a security or AI/ML
  // qualifier. Unqualified, it's treated exactly as "no role term found" —
  // both for admission (pmFamilyAdmit below) and for the reported roleTerm
  // field, so a caller choosing a rejection status off `roleTerm === null`
  // (see scan.mjs's gateStatusFor) correctly reports skipped_role rather
  // than skipped_seniority, even when the title also lacks seniority.
  const isSolutionsArchitectTerm = roleTermRaw != null && SOLUTIONS_ARCHITECT_TERMS.includes(roleTermRaw);
  const solutionsArchitectQualified = !isSolutionsArchitectTerm
    || securitySignal
    || Boolean(found(t, AI_ML_TERMS));
  const roleTerm = solutionsArchitectQualified ? roleTermRaw : null;

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
