#!/usr/bin/env node
/**
 * Fork invariant guard (sdkkds fork). Run after every `git merge upstream/main`.
 *
 *   node check-fork-invariants.mjs
 *
 * TWO checks, both guarding divergences that can disappear without a symptom.
 *
 * Not covered, deliberately: run-nightly.ps1 and the other fork-local files have
 * no upstream counterpart, so a merge cannot touch them (and they are declared in
 * config/local-paths.txt). tests/helpers.mjs's Scoop Git Bash discovery landed
 * upstream as #2366, so there is nothing left to protect there.
 *
 * CHECK 2 -- .gitattributes -- was added 2026-08-18 because the assumption above
 * stopped being true. This file used to say ".gitattributes has no upstream
 * counterpart, so a merge cannot touch it". Upstream then shipped its own in
 * 80d104f and classified it in SYSTEM_PATHS, which removed both protections the
 * fork had: a path cannot sit in SYSTEM_PATHS and USER_PATHS at once, and a
 * SYSTEM_PATHS entry cannot be declared in config/local-paths.txt either. So the
 * two local rules are now guarded by nothing but this check.
 *
 * The real failure mode is not git dropping the lines -- additions survive a
 * clean three-way merge. It is a human or agent resolving a conflict by taking
 * upstream's side wholesale, which is exactly what happened during the
 * 2026-08-17 merge (caught only because the resolution was done by hand). Note
 * that a post-merge hook would NOT catch this: post-merge does not fire when a
 * merge stops on conflicts, and every real upstream sync here conflicts.
 *
 * What IS worth failing a build over is batch/batch-runner.sh. Upstream ships
 * `--dangerously-skip-permissions` on the worker invocation and actively
 * maintains that line, so a merge can quietly restore it. Batch workers read
 * untrusted job postings, so regaining skip-permissions is a real security
 * regression that produces no visible symptom -- the batch just runs, as it
 * always does.
 *
 * The check is intentionally narrow: presence/absence of two flags on the
 * worker argv line. It is not a spelling test over the whole file, because a
 * guard that fires on unrelated upstream refactors is a guard you learn to
 * ignore.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const RUNNER = join(ROOT, 'batch', 'batch-runner.sh');
const GITATTRIBUTES = join(ROOT, '.gitattributes');

const failures = [];

if (!existsSync(RUNNER)) {
  failures.push(`batch/batch-runner.sh is missing (expected at ${RUNNER})`);
} else {
  const lines = readFileSync(RUNNER, 'utf-8').split(/\r?\n/);

  // The worker argv line: the one that builds claude_args, not the comments
  // above it that mention the flag by name while explaining why it is absent.
  const argvLines = lines
    .map((line, i) => ({ line, n: i + 1 }))
    .filter(({ line }) => /claude_args=\(/.test(line));

  if (argvLines.length === 0) {
    failures.push(
      'could not find the worker argv line (`claude_args=(`) in batch/batch-runner.sh -- ' +
      'upstream may have restructured the invocation; re-check the permission scoping by hand'
    );
  }

  for (const { line, n } of argvLines) {
    if (line.includes('--dangerously-skip-permissions')) {
      failures.push(
        `batch/batch-runner.sh:${n} passes --dangerously-skip-permissions to the worker. ` +
        'The local fork replaces it with `--permission-mode dontAsk` plus an explicit ' +
        '--allowedTools allowlist, because batch workers read untrusted job postings. ' +
        'An upstream merge has restored it -- re-apply the scoping.'
      );
    }
    if (!line.includes('--permission-mode dontAsk')) {
      failures.push(`batch/batch-runner.sh:${n} is missing \`--permission-mode dontAsk\``);
    }
    if (!line.includes('--allowedTools')) {
      failures.push(`batch/batch-runner.sh:${n} is missing the explicit --allowedTools allowlist`);
    }
    // Upstream test #506 requires this stays on the same line as the rest of
    // the argv; flagging it here too keeps the local edit from breaking their suite.
    if (!line.includes('--strict-mcp-config')) {
      failures.push(`batch/batch-runner.sh:${n} is missing \`--strict-mcp-config\` (upstream test #506)`);
    }
  }
}

// ── CHECK 2: .gitattributes keeps the two fork rules ────────────────────────
if (!existsSync(GITATTRIBUTES)) {
  failures.push(`.gitattributes is missing (expected at ${GITATTRIBUTES})`);
} else {
  // Comments mention both rules by name while explaining them, so match only
  // real rule lines -- otherwise deleting the rule but keeping its comment
  // would pass.
  const rules = readFileSync(GITATTRIBUTES, 'utf-8')
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'));

  // The one that is silently losable. Without it a lockfile three-way merge
  // resolves CLEANLY into a dependency graph neither side ever tested -- no
  // conflict, no symptom, which is the whole reason the rule exists.
  if (!rules.some(l => /^package-lock\.json\s+.*-merge\b/.test(l))) {
    failures.push(
      '.gitattributes has lost `package-lock.json -merge`. Without it, a lockfile ' +
      'conflict resolves cleanly into an untested dependency graph instead of stopping ' +
      'the merge. Re-add it; resolve lockfiles by checking out one side and regenerating.'
    );
  }

  // LF on shell scripts. Satisfied by an explicit *.sh rule OR by upstream's
  // `* text=auto eol=lf` catch-all -- accepting either avoids failing on a
  // legitimate upstream refactor that still delivers the guarantee.
  const shExplicit = rules.some(l => /^\*\.sh\s+.*eol=lf\b/.test(l));
  const catchAll = rules.some(l => /^\*\s+text=auto\s+eol=lf\b/.test(l));
  if (!shExplicit && !catchAll) {
    failures.push(
      '.gitattributes no longer forces LF on shell scripts (neither `*.sh ... eol=lf` ' +
      'nor the `* text=auto eol=lf` catch-all). Git Bash cannot parse CRLF scripts: ' +
      'batch/batch-runner.sh dies with `syntax error near $\'{\\r\'`.'
    );
  }
}

if (failures.length > 0) {
  console.error('FORK INVARIANT VIOLATED:\n');
  for (const f of failures) console.error(`  - ${f}\n`);
  process.exit(1);
}

console.log('fork invariants OK (batch-runner permission scoping + .gitattributes rules intact)');
