/**
 * lib/url-identity.mjs — the single identity function for a job posting.
 *
 * Identity is the normalized URL. Not the report number (proven non-unique —
 * recycled on failed evals), not a fuzzy title match.
 */

const TRACKING_PARAMS = [
  /^utm_/i, /^gclid$/i, /^fbclid$/i, /^msclkid$/i,
  /^mc_cid$/i, /^mc_eid$/i, /^gh_src$/i,
  /^lever-origin$/i, /^lever-source/i, /^trackingtag$/i,
  /^source$/i, /^src$/i, /^ref$/i, /^referrer$/i,
];

const PATH_HAS_JOB_ID = /\/(jobs?|postings?|openings?)\/[A-Za-z0-9][A-Za-z0-9._-]{2,}/i;

export function normalizeUrl(raw) {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let u;
  try { u = new URL(trimmed); } catch { return null; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;

  u.protocol = 'https:';
  u.hash = '';
  u.hostname = u.hostname.toLowerCase().replace(/^www\./, '');
  u.pathname = u.pathname.replace(/\/+$/, '') || '/';

  const pathHasId = PATH_HAS_JOB_ID.test(u.pathname);
  const kept = [];
  for (const [k, v] of u.searchParams) {
    if (TRACKING_PARAMS.some(rx => rx.test(k))) continue;
    if (/^gh_jid$/i.test(k) && pathHasId) continue;
    kept.push([k, v]);
  }
  kept.sort((a, b) => (a[0] === b[0] ? a[1].localeCompare(b[1]) : a[0].localeCompare(b[0])));

  const search = new URLSearchParams(kept).toString();
  u.search = search ? `?${search}` : '';
  return u.toString();
}
