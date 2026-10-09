#!/usr/bin/env node

import { readFileSync, existsSync, readdirSync } from 'fs';
import { resolve, join } from 'path';
import { flagValue, hasFlag, validateFlags } from './lib/cli-flags.mjs';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
// CAREER_OPS_BATCH_STATE overrides the batch-state.tsv path — the same override
// merge-tracker.mjs already honours, so tests can drive this script against a
// sandbox instead of the developer's real batch run.
const batchStateFile = process.env.CAREER_OPS_BATCH_STATE
  ? resolve(process.env.CAREER_OPS_BATCH_STATE)
  : join(__dirname, 'batch', 'batch-state.tsv');
const reportsDir = join(__dirname, 'reports');

// WebFetch is scoped to the posting's registrable domain plus its subdomains
// (boards.x.io -> job-boards.x.io redirects keep working). Two-letter ccTLDs
// with a generic second level (co.uk, com.au) keep three labels, or the rule
// would open the whole country. Same rule as run-nightly.ps1 and
// batch/batch-runner.sh. Returns null for a URL with no http(s) host.
function postingDomain(url) {
  let host;
  try { host = new URL(url).hostname.toLowerCase(); } catch { return null; }
  if (!host || !/^https?:/.test(url)) return null;
  const labels = host.split('.');
  const keep = labels.length >= 3 && labels.at(-1).length === 2 &&
    ['co', 'com', 'org', 'net', 'gov', 'ac', 'edu'].includes(labels.at(-2)) ? 3 : 2;
  return labels.length > keep ? labels.slice(-keep).join('.') : host;
}

const USAGE = `career-ops batch tailor — bulk generate tailored CVs for high-scoring batch jobs

Usage:
  node batch-tailor.mjs [--min-score N]

Options:
  --min-score N   Minimum score to tailor (default: 4.0). The --min-score=N form works too.
  --help, -h      Show this help
`;

const args = process.argv.slice(2);

// Route through the shared parser instead of hand-rolling it: this script used
// to read only the `--min-score=N` form, so `--min-score 4.5` was dropped and a
// typo fell through — both silently ran at the 4.0 default and spawned worker
// runs the caller never asked for. That is the #2459 class lib/cli-flags.mjs
// exists to end.
// requireOperand: `--min-score --help` would otherwise print usage and exit 0,
// so the malformed flag is never reported and the numeric check below never
// runs. This script has nothing more specific to say about a missing operand
// than the shared message, which is exactly when opting in is right.
validateFlags(args, ['--min-score', '--help', '-h'], USAGE, { valueFlags: ['--min-score'], requireOperand: true });

let minScore = 4.0;
if (hasFlag(args, '--min-score')) {
  const raw = flagValue(args, '--min-score');
  // Number(), not parseFloat(): parseFloat stops at the first invalid character,
  // so "4.5abc" silently became 4.5 and the run proceeded on a threshold the
  // caller never wrote. The empty/whitespace guard must come FIRST — Number('')
  // is 0, which is finite, and a 0 threshold tailors every completed job.
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  minScore = trimmed === '' ? NaN : Number(trimmed);
  // A NaN threshold compares false against every score, so the old code printed
  // "no roles found with score >= NaN" and exited 0 — indistinguishable from a
  // genuinely empty batch. Fail loudly instead.
  if (!Number.isFinite(minScore)) {
    console.error(`ERROR: --min-score expects a number, got ${raw === undefined ? '(no value)' : `"${raw}"`}`);
    process.exit(1);
  }
}

if (!existsSync(batchStateFile)) {
  console.error(`ERROR: Batch state file not found at ${batchStateFile}`);
  process.exit(1);
}

// existsSync() is true for a directory and says nothing about permissions, so
// reading can still throw (EISDIR, EACCES) — an uncaught stack trace where a
// usage error belongs. Name the RESOLVED path: with CAREER_OPS_BATCH_STATE set,
// the value that failed is not the one written in the source.
let stateContent;
try {
  stateContent = readFileSync(batchStateFile, 'utf-8');
} catch (err) {
  console.error(`ERROR: cannot read batch state file at ${batchStateFile}: ${err.message}`);
  process.exit(1);
}

const lines = stateContent.split('\n');
const toProcess = [];

for (const line of lines) {
  if (!line || line.startsWith('id\t')) continue;
  const parts = line.split('\t');
  if (parts.length < 7) continue;
  
  const id = parts[0];
  const url = parts[1];
  const status = parts[2];
  const reportNum = parts[5];
  const scoreStr = parts[6];
  
  if (status === 'completed') {
    const score = parseFloat(scoreStr);
    if (!isNaN(score) && score >= minScore) {
      toProcess.push({ id, url, reportNum, score });
    }
  }
}

if (toProcess.length === 0) {
  console.log(`No completed roles found with score >= ${minScore}.`);
  process.exit(0);
}

console.log(`Found ${toProcess.length} roles scoring >= ${minScore}. Beginning bulk tailoring...`);

const reports = existsSync(reportsDir) ? readdirSync(reportsDir) : [];

for (let i = 0; i < toProcess.length; i++) {
  const job = toProcess[i];
  console.log(`\n[${i + 1}/${toProcess.length}] Tailoring CV for Report ${job.reportNum} (Score: ${job.score}) — ${job.url}`);
  
  // Try to find the local report file to pass to the agent
  const matchingReport = reports.find(f => f.startsWith(`${job.reportNum}-`) && f.endsWith('.md'));
  const reportContext = matchingReport ? `\nThe evaluation report is available at: reports/${matchingReport}` : '';
  
  // Batch-mode notes. The worker runs isolated (see claudeArgs below): it can
  // write only under jds/ and output/, so modes/pdf.md's /tmp render payload and
  // its direct tracker edit are redirected here rather than left to be denied.
  const batchNotes = [
    'Batch-mode notes (non-interactive, written by batch-tailor.mjs):',
    '- Write the render payload JSON to `output/.payload/cv-{candidate}-{company}.json`, not /tmp, and pass that path to build-cv-html.mjs.',
    '- Do not edit data/applications.md. The PDF flag is synced from data/pdf-index.tsv by merge-tracker.mjs.',
    '- Nobody can answer questions in this run: skip steps that ask the user, the cover letter, and saving house rules to modes/_custom.md. Report skill gaps in your final summary instead.',
    '- WebFetch is limited to the posting\'s own domain; use WebSearch for research.',
  ].join('\n');
  const prompt = `Tailor the CV for this role and generate the HTML and PDF CVs. \nURL: ${job.url}\nReport number: ${job.reportNum}${reportContext}\n\n${batchNotes}`;
  
  // LOCAL HARDENING (fork-only; upstream ships --dangerously-skip-permissions
  // here and maintains that line, so check-fork-invariants.mjs CHECK 3 guards
  // this). The worker's prompt embeds a job URL and an evaluation report derived
  // from an untrusted job posting, so it gets an explicit allowlist instead of
  // full tool access — the same reasoning as batch/batch-runner.sh.
  //
  // This allowlist is NOT batch-runner.sh's. Those workers only evaluate offers
  // and need one shell command; this one runs modes/pdf.md, and every entry below
  // is a command that file actually instructs. Copying the narrow list would
  // silently drop `node verify-cv-facts.mjs` — the CV fact gate at step 19, which
  // is exactly the anti-fabrication check the comment further down warns about
  // losing. Re-derive this list from modes/pdf.md if that file gains a step.
  //
  // Deliberately absent: `curl` and `file`, used only by the Canva sub-flow
  // (modes/pdf.md "Canva CV Generation (optional)"). That branch is gated on
  // config/profile.yml having cv.canva_resume_design_id, which is unset, and it
  // asks the user to choose between two flows — impossible under `claude -p`.
  // Also absent: build-cv-latex.mjs (modes/latex.md), since this prompt asks for
  // HTML and PDF.
  //
  // A missing entry fails VISIBLY: under --permission-mode dontAsk a non-allowed
  // tool is denied and reported, and spawnSync runs with stdio: 'inherit', so it
  // lands on screen mid-run rather than silently degrading the output.
  //
  // Since 2026-10-09 (fix matrix career-ops #17-#19) there is no bare Write and
  // no bare WebFetch: writes are scoped through Edit(path) rules (Claude Code
  // never consults path rules written on Write) to jds/ (pdf.md step 4's JD
  // scratch file) and output/ (bundles, payload JSON); WebFetch to the posting's
  // domain. Commands like build-cv-html/generate-pdf write their own files and
  // need no Edit rule.
  const domain = postingDomain(job.url);
  const fetchRules = domain ? [`WebFetch(domain:${domain})`, `WebFetch(domain:*.${domain})`] : [];
  const allowedTools = [
    'Read', 'Glob', 'Grep', 'WebSearch',
    'Edit(/jds/*.md)',
    'Edit(/output/**)',
    ...fetchRules,
    'Bash(node find.mjs *)',
    'Bash(node jd-skill-gap.mjs *)',
    'Bash(node cv-templates.mjs *)',
    'Bash(node build-cv-html.mjs *)',
    'Bash(node verify-cv-facts.mjs *)',
    'Bash(node generate-pdf.mjs *)',
    'Bash(node generate-cover-letter.mjs *)',
    'Bash(npm run application:init *)',
    'Bash(npm run jd:similarity *)',
  ].join(',');

  // The worker inherits ~/.claude/settings.json, whose allow list grants
  // context-mode's code-execution tools, and --allowedTools only ADDS
  // permissions. Without this deny, a dontAsk worker reading an untrusted
  // posting can run arbitrary code (proven 2026-10-02). Keep in sync with
  // run-nightly.ps1; check-fork-invariants.mjs CHECK 3 guards this line.
  const deniedTools = [
    'mcp__plugin_context-mode_context-mode__ctx_execute',
    'mcp__plugin_context-mode_context-mode__ctx_execute_file',
    'mcp__plugin_context-mode_context-mode__ctx_batch_execute',
  ].join(',');

  // --restricted: inherit no user/project/local settings (their allow rules and
  // hooks) and confine file tools to the repo. --strict-mcp-config: no MCP
  // servers. --tools: the built-in tools that exist at all. The deny list below
  // stays as a second layer.
  const claudeArgs = [
    '-p',
    '--restricted',
    '--strict-mcp-config',
    '--tools', 'Read,Write,Edit,Glob,Grep,WebFetch,WebSearch,Bash',
    '--permission-mode', 'dontAsk',
    '--allowedTools', allowedTools,
    '--disallowedTools', deniedTools,
    '--append-system-prompt-file',
    // Absolute: the state file already resolves through __dirname, so passing
    // this one bare handed the worker a cwd-relative path that only exists when
    // the script happens to run from the project root. modes/pdf.md is where
    // the CV fact gate (verify-cv-facts.mjs, step 19) is instructed, so losing
    // it silently drops the anti-fabrication check from a bulk CV run.
    join(__dirname, 'modes', 'pdf.md'),
    prompt
  ];
  
  // cwd = the project root: the Edit(/jds/...) and Edit(/output/...) rules and
  // pdf.md's relative paths resolve against the worker's working directory.
  const res = spawnSync('claude', claudeArgs, { stdio: 'inherit', cwd: __dirname });
  if (res.error) {
    console.error(`Error running claude: ${res.error.message}`);
  } else if (res.status !== 0) {
    console.error(`Worker exited with status ${res.status}`);
  } else {
    console.log(`✅ Finished tailoring for Report ${job.reportNum}`);
  }
}

console.log('\nBulk tailoring complete.');
