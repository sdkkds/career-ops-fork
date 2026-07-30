#!/usr/bin/env node
/**
 * Fork invariant guard (sdkkds fork). Run after every `git merge upstream/main`.
 *
 *   node check-fork-invariants.mjs
 *
 * Scope is deliberately ONE check. The fork carries four local divergences, but
 * three of them cannot be silently lost:
 *
 *   - run-nightly.ps1 and .gitattributes have no upstream counterpart, so a
 *     merge cannot touch them.
 *   - tests/helpers.mjs's Scoop Git Bash discovery is being sent upstream; if
 *     it lands there is nothing left to protect, and until then a conflict on
 *     those lines is visible during the merge.
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

if (failures.length > 0) {
  console.error('FORK INVARIANT VIOLATED:\n');
  for (const f of failures) console.error(`  - ${f}\n`);
  process.exit(1);
}

console.log('fork invariants OK (batch-runner worker permission scoping intact)');
