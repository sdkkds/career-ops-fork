// Rank an actionable pipeline selection so the evaluator spends its nightly
// budget on the rows most likely to clear the apply threshold.
//
// WHY THIS EXISTS (2026-08-03): the queue is drained a few rows per night, in
// file order, which is scan order — so a single employer's bulk posting run
// decides what gets evaluated for a fortnight. On 2026-08-03 the first five
// actionable rows were all Amazon program-manager roles; the ones already
// evaluated from that inflow scored 1.5-3.4/5 against a 4.0 apply threshold.
// The company qualifier gate in lib/filter.mjs stops NEW rows like that from
// entering, but it cannot reorder the ~248 already queued.
//
// This changes ORDER ONLY. Nothing is dropped, nothing is marked, no row is
// mutated: a row that ranks last still evaluates eventually. Ordering is a
// cheaper lever than filtering precisely because it cannot lose anything.
//
// The ranking vocabulary is NOT redefined here. It comes from classifyTitle()
// so security/AI terms have exactly one definition in the codebase — the
// hand-copied gateStatusFor mirror in tests/filter-precision.test.mjs drifted
// the moment a status was added, and re-typing keyword lists in PowerShell
// would be the same mistake with worse odds.
//
// Usage: reads a selection JSON ({rows:[...]}) on stdin, writes the same shape
// on stdout with `rows` reordered and each row tagged with its tier.
import { pathToFileURL } from 'url';
import { classifyTitle } from './filter.mjs';

export const TIER_SECURITY = 2;
export const TIER_AI_ML = 1;
export const TIER_NEITHER = 0;

/**
 * @param {{title?: string, company?: string}} row
 * @returns {number} TIER_SECURITY | TIER_AI_ML | TIER_NEITHER
 */
export function tierFor(row) {
  const gate = classifyTitle(row?.title ?? '');
  if (gate.securitySignal) return TIER_SECURITY;
  if (gate.aiMlSignal) return TIER_AI_ML;
  return TIER_NEITHER;
}

/**
 * Stable descending sort by tier.
 *
 * Stability is the point, not an implementation detail: within a tier the
 * existing order is queue order, which is roughly first-seen order. Perturbing
 * it would silently starve older rows, turning an ordering change into a
 * de-facto filter. The index tiebreak makes that guarantee explicit rather
 * than relying on the engine's sort happening to be stable.
 *
 * @param {Array<object>} rows
 * @returns {Array<object>} new array; inputs are not mutated
 */
export function prioritise(rows) {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row, index) => ({ row, index, tier: tierFor(row) }))
    .sort((a, b) => (b.tier - a.tier) || (a.index - b.index))
    .map(({ row, tier }) => ({ ...row, tier }));
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf-8');
}

// Only run as a CLI when invoked directly, so importing this module in a test
// never blocks on stdin.
//
// pathToFileURL, not string concatenation: on Windows a hand-built
// `file://${argv[1]}` yields file://D:/... while import.meta.url is
// file:///D:/... (three slashes, empty authority). They never match, the CLI
// block silently never runs, and the caller gets empty stdout — which is how
// the first version of this shipped ranking nothing at all.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const raw = await readStdin();
  // Fail loud. A prioritiser that silently emits an empty queue on malformed
  // input would look exactly like "nothing to do tonight".
  if (!raw.trim()) {
    console.error('prioritise-queue: no input on stdin');
    process.exit(1);
  }
  let selection;
  try {
    selection = JSON.parse(raw);
  } catch (err) {
    console.error(`prioritise-queue: input is not valid JSON — ${err.message}`);
    process.exit(1);
  }
  if (!selection || !Array.isArray(selection.rows)) {
    console.error('prioritise-queue: input has no `rows` array');
    process.exit(1);
  }
  process.stdout.write(JSON.stringify({ ...selection, rows: prioritise(selection.rows) }));
}
