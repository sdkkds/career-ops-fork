// Fetch ONE Oracle HCM "Candidate Experience" job description by requisition id.
// Written during the 2026-08-11 nightly (report 050); kept because dead-JD
// recovery on Oracle tenants has no other path.
//
// Complements providers/oraclecloud.mjs, it does not duplicate it: that provider
// LISTS postings for the scanner via recruitingCEJobRequisitions + the findReqs
// finder. This fetches ONE requisition's full body via
// recruitingCEJobRequisitionDetails + the ById finder — the eval-side need, for
// when a worker emits no JSON because the JD body was unreachable.
//
// Oracle HCM "Candidate Experience" job pages (jpmc.fa.oraclecloud.com and every
// other *.fa.oraclecloud.com tenant) are client-rendered: a plain HTTP fetch of the
// job URL returns 19KB of shell HTML with the title in an og:title meta tag and no
// job description at all. The description lives behind the candidate-facing REST
// finder below.
//
// The finder parameter name is `Id`, NOT `jobId` — `jobId` returns HTTP 400. The
// quotes around the values are required. That was the whole discovery here; it is
// recorded so the next dead-JD Oracle posting is a two-minute job.
//
//   GET /hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails
//       ?expand=all&onlyData=true&finder=ById;Id="<jobId>",siteNumber="<siteNumber>"
//
// Useful fields: Title, ExternalDescriptionStr (HTML), PrimaryLocation,
// secondaryLocations[], ExternalPostedStartDate, and requisitionFlexFields[] —
// which is where the per-location published pay bands live.
//
// Tracked and classified under USER_PATHS in update-system.mjs (2026-08-15), so
// an update never overwrites it and validate-system-paths-coverage.mjs stays green.
//
// Usage: node batch/fetch-oracle-ce-jd.mjs <jobId> [siteNumber]
//        ORACLE_CE_HOST=<tenant>.fa.oraclecloud.com  (default: jpmc)

const jobId = process.argv[2];
const siteNumber = process.argv[3] ?? 'CX_1001';
const host = process.env.ORACLE_CE_HOST ?? 'jpmc.fa.oraclecloud.com';

if (!jobId) {
  console.error('usage: node batch/fetch-oracle-ce-jd.mjs <jobId> [siteNumber]');
  process.exit(2);
}

const finder = `ById;Id=%22${jobId}%22,siteNumber=%22${siteNumber}%22`;
const url = `https://${host}/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails?expand=all&onlyData=true&finder=${finder}`;

const res = await fetch(url, {
  headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' },
});

if (!res.ok) {
  // Fail loud: a non-OK response must never take the success path.
  throw new Error(`Oracle CE finder returned HTTP ${res.status}: ${await res.text()}`);
}

const { items } = await res.json();
if (!items?.length) {
  throw new Error(`No requisition returned for jobId=${jobId} siteNumber=${siteNumber} — pulled or unposted.`);
}

const stripHtml = (s) =>
  String(s ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|li|div|h\d)>/gi, '\n')
    .replace(/<li>/gi, '- ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&rsquo;/g, "'")
    .replace(/&quot;|&ldquo;|&rdquo;/g, '"')
    .replace(/&mdash;/g, '—')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const job = items[0];
const locations = [job.PrimaryLocation, ...(job.secondaryLocations ?? []).map((l) => l.Name)]
  .filter(Boolean)
  .join(' | ');
const payBands = (job.requisitionFlexFields ?? [])
  .map((f) => `${f.Prompt}: ${f.Value}`)
  .join('\n');

console.log(`# ${job.Title}\n`);
console.log(`**Requisition:** ${job.Id} (${job.RequisitionId})`);
console.log(`**Posted:** ${job.ExternalPostedStartDate}`);
console.log(`**Schedule:** ${job.JobSchedule}`);
console.log(`**Locations:** ${locations}`);
if (payBands) console.log(`**${payBands}**`);
console.log(`\n---\n\n${stripHtml(job.ExternalDescriptionStr)}`);
