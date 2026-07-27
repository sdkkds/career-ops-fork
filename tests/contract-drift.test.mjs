/**
 * tests/contract-drift.test.mjs — guards the worker/orchestrator contract.
 *
 * WHY THIS EXISTS
 *
 * The nightly pipeline has two literals that MUST be identical in files that
 * cannot import from each other: a markdown prompt read by an LLM worker
 * (`batch/batch-prompt.md`), a PowerShell orchestrator (`run-nightly.ps1`), and
 * a PowerShell stub worker (`tests/nightly-smoke.ps1`). Nothing in the build
 * connects them, so they can drift silently — and twice on this branch they did:
 *
 *   1. The TSV path. Step 5 told the worker to write
 *      `batch/tracker-additions/{{ID}}.tsv` while the orchestrator verified
 *      `batch/tracker-additions/{{REPORT_NUM}}-{{ID}}.tsv`. Because
 *      lib/eval-verify.mjs checks the ORCHESTRATOR's expected path (the
 *      worker-reported `tsv` field is never read), EVERY eval would have failed
 *      verification: `completed == 0` -> exit 1 "nothing completed", each job
 *      retried for two more nights at full worker cost, while merge-tracker.mjs
 *      globbed `*.tsv` and merged the rows anyway. Tracker fills, orchestrator
 *      reports total failure. The smoke suite could not catch it because the
 *      stub implements the orchestrator's convention, so stub and orchestrator
 *      can never disagree — only the PROMPT was wrong, and no test read it.
 *
 *   2. The sentinel strings. `CAREEROPS_RESULT_JSON_BEGIN`/`_END` are the
 *      authority in lib/json-extract.mjs but are hardcoded again in the prompt
 *      and in the smoke stub. A rename in one place makes every worker result
 *      unparseable, which reads as "the worker produced no output".
 *
 * These assertions are cheap and they fail loudly at the seam rather than at
 * 6am in production.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => readFileSync(join(ROOT, rel), 'utf-8');

const PROMPT = read('batch/batch-prompt.md');
const ORCHESTRATOR = read('run-nightly.ps1');
const SMOKE = read('tests/nightly-smoke.ps1');
const JSON_EXTRACT = read('lib/json-extract.mjs');

/**
 * Collapse the three dialects of the same path template into one comparable
 * string: `{{REPORT_NUM}}` / `$reportNum` / `$num` all mean the reserved report
 * number, `{{ID}}` / `$id` mean the batch id, and PowerShell writes Windows
 * separators against an absolute $root.
 */
function canonicalPath(raw) {
  return String(raw)
    .trim()
    .replace(/\$\{?reportNum\}?/g, '<NUM>')
    .replace(/\$\{?num\}?/g, '<NUM>')
    .replace(/\{\{REPORT_NUM\}\}/g, '<NUM>')
    .replace(/\$\{?id\}?/g, '<ID>')
    .replace(/\{\{ID\}\}/g, '<ID>')
    .replace(/\\/g, '/')
    .replace(/^\$root\//, '')
    .replace(/^["']|["']$/g, '');
}

function extract(text, rx, label) {
  const m = text.match(rx);
  assert.ok(m, `contract-drift: could not locate ${label}. The guard is now blind — ` +
    `update the extraction regex in tests/contract-drift.test.mjs, do not delete the assertion.`);
  return m[1];
}

// --- the four independent hardcodings of the TSV path ---

// batch/batch-prompt.md, Step 5: the fenced path block the worker follows.
const promptStep5 = canonicalPath(extract(
  PROMPT,
  /### Step 5 — Tracker TSV Line[\s\S]*?```text\s*\n(batch\/tracker-additions\/[^\n]+)\n```/,
  "Step 5's fenced TSV path in batch/batch-prompt.md"));

// batch/batch-prompt.md, Step 6: the decorative `tsv` field in the result JSON.
// Decorative because lib/eval-verify.mjs never reads v.tsv — but a worker that
// believes it is describing the file it wrote must be describing the same file.
const promptStep6 = canonicalPath(extract(
  PROMPT,
  /"tsv":\s*"([^"]+)"/,
  'the "tsv" field in the Step 6 sentinel block'));

// run-nightly.ps1: the path lib/eval-verify.mjs is actually pointed at.
const orchestratorPath = canonicalPath(extract(
  ORCHESTRATOR,
  /\$tsvRel\s*=\s*"([^"]+)"/,
  '$tsvRel in run-nightly.ps1'));

// tests/nightly-smoke.ps1: the honest stub worker's write target.
const smokePath = canonicalPath(extract(
  SMOKE,
  /Set-Content\s+"(\$root\\batch\\tracker-additions\\[^"]+)"/,
  "the good-worker stub's TSV write in tests/nightly-smoke.ps1"));

test('TSV path contract: prompt Step 5 matches the orchestrator', () => {
  assert.equal(promptStep5, orchestratorPath,
    'batch/batch-prompt.md Step 5 tells the worker where to write the TSV; ' +
    'run-nightly.ps1 $tsvRel is where lib/eval-verify.mjs looks for it. ' +
    'If they disagree, EVERY eval fails verification while merge-tracker.mjs ' +
    'still merges the row — the tracker fills and the run reports total failure.');
});

test('TSV path contract: prompt Step 6 JSON matches prompt Step 5', () => {
  assert.equal(promptStep6, promptStep5,
    'the Step 6 result JSON describes a different file than Step 5 tells the worker to write');
});

test('TSV path contract: the smoke stub writes where the orchestrator looks', () => {
  assert.equal(smokePath, orchestratorPath,
    'the smoke stub must implement the SAME contract the prompt states, ' +
    'otherwise the suite proves only that the orchestrator agrees with itself');
});

test('TSV path contract: the shared template is the expected shape', () => {
  // Pinned literally so a change to the convention is a deliberate, reviewed
  // edit here rather than three files quietly agreeing on something new.
  assert.equal(orchestratorPath, 'batch/tracker-additions/<NUM>-<ID>.tsv');
});

// --- sentinels ---

const BEGIN = extract(JSON_EXTRACT, /const BEGIN\s*=\s*'([^']+)'/, 'BEGIN in lib/json-extract.mjs');
const END = extract(JSON_EXTRACT, /const END\s*=\s*'([^']+)'/, 'END in lib/json-extract.mjs');

test('sentinel contract: the prompt tells the worker to print the strings the parser looks for', () => {
  assert.ok(PROMPT.includes(BEGIN), `batch/batch-prompt.md does not contain the BEGIN sentinel "${BEGIN}"`);
  assert.ok(PROMPT.includes(END), `batch/batch-prompt.md does not contain the END sentinel "${END}"`);
});

test('sentinel contract: the smoke stub emits the strings the parser looks for', () => {
  assert.ok(SMOKE.includes(BEGIN), `tests/nightly-smoke.ps1 does not contain the BEGIN sentinel "${BEGIN}"`);
  assert.ok(SMOKE.includes(END), `tests/nightly-smoke.ps1 does not contain the END sentinel "${END}"`);
});

test('sentinel contract: run-nightly.ps1 does NOT hardcode the sentinels', () => {
  // The orchestrator delegates sentinel parsing to lib/eval-verify.mjs on
  // purpose. A copy here would be a fourth place to keep in sync.
  assert.ok(!ORCHESTRATOR.includes(BEGIN),
    'run-nightly.ps1 must not look for the sentinel itself — lib/eval-verify.mjs owns that');
});
