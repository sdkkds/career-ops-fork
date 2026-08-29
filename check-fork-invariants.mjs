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
 *
 * CHECK 3 -- batch-tailor.mjs -- added 2026-08-28. It passes
 * --dangerously-skip-permissions upstream, to a worker whose prompt embeds a job
 * URL and an evaluation report derived from an untrusted job posting: the same
 * threat class as CHECK 1. It is upstream-maintained (#1882, #2961), so a merge
 * maintains that line exactly as it does batch-runner.sh's, and nothing guarded
 * it until now.
 *
 * It shipped as a WARNING for a few hours and is now a FAILURE, because the one
 * reason it could not be hard -- the flag was still present, and exit 1 here is
 * FATAL at run-nightly.ps1:312 -- was removed in the same session by scoping the
 * invocation. Recorded because the ordering is the reusable part: a guard that
 * fails on the tree it is added to cannot be added first.
 *
 * The allowlist this now protects is NOT batch-runner.sh's, and copying that one
 * would do real harm. Those workers only evaluate offers and need exactly one
 * shell command. batch-tailor runs modes/pdf.md, which instructs npm run
 * application:init, npm run jd:similarity, and node find.mjs / jd-skill-gap.mjs /
 * cv-templates.mjs / build-cv-html.mjs / verify-cv-facts.mjs / generate-pdf.mjs /
 * generate-cover-letter.mjs. The narrow list would silently drop
 * verify-cv-facts.mjs -- the CV fact gate at step 19 -- which is exactly what the
 * comment at batch-tailor.mjs warns about losing.
 *
 * Hence the fourth assertion here: the allowlist must still name
 * verify-cv-facts.mjs. That entry is the one whose absence is invisible. Losing
 * Bash(node generate-pdf.mjs *) fails a run loudly; losing the fact gate just
 * produces an unverified CV, and nothing else in the system would notice.
 *
 * The `warnings` channel is kept for the one case that is genuinely
 * indeterminate rather than wrong: an unclosed array literal, where this check
 * cannot tell what it read. run-nightly.ps1 logs WARN-prefixed lines on a zero
 * exit; if that logging is ever removed, delete the warning path rather than
 * leaving it as decoration.
 *
 * TESTS: check-fork-invariants.test.ps1 (fork-local). Eleven cases, every
 * assertion exercised in both directions. Run it after touching this file --
 * a mutation run is what caught the fact-gate assertion matching a neighbouring
 * COMMENT instead of the allowlist, which had left a deleted entry green.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const RUNNER = join(ROOT, 'batch', 'batch-runner.sh');
const GITATTRIBUTES = join(ROOT, '.gitattributes');
const TAILOR = join(ROOT, 'batch-tailor.mjs');

const failures = [];
const warnings = [];

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

// ── CHECK 3: batch-tailor.mjs permission scoping ────────────────────────────
// Two separate regions are read, because the scoping lives in two places: the
// worker argv array (`claudeArgs = [`) carries the flags, and the allowlist
// array (`allowedTools = [`) carries the commands.
//
// COMMENT LINES ARE STRIPPED FROM BOTH before any match. Both arrays carry
// comments that name the very strings being checked -- the argv array's comment
// explains the CV fact gate by name -- so matching raw text passes for the wrong
// reason. A mutation run caught exactly that: deleting the fact gate from the
// allowlist left this check green, because the neighbouring comment still said
// the words. This is the same hazard CHECK 1's header notes for `claude_args=(`.
const stripComments = (arr) => arr.filter(({ line }) => !/^\s*\/\//.test(line));
const numbered = (arr, offset) => arr.map((line, i) => ({ line, n: offset + i + 1 }));

/** Slice a bracketed array literal starting at `openRe`, ending at `closeRe`. */
function readArrayBlock(lines, openRe, closeRe) {
  const start = lines.findIndex(l => openRe.test(l));
  if (start === -1) return null;
  let end = -1;
  for (let i = start + 1; i < lines.length; i++) {
    if (closeRe.test(lines[i])) { end = i; break; }
  }
  const slice = lines.slice(start, (end === -1 ? lines.length : end) + 1);
  return { rows: stripComments(numbered(slice, start)), closed: end !== -1 };
}

if (!existsSync(TAILOR)) {
  failures.push(
    `batch-tailor.mjs is missing (expected at ${TAILOR}). If upstream removed it, delete CHECK 3 ` +
    'deliberately rather than letting it fail -- but do not assume that without looking.'
  );
} else {
  const lines = readFileSync(TAILOR, 'utf-8').split(/\r?\n/);
  const argv = readArrayBlock(lines, /claudeArgs\s*=\s*\[/, /^\s*\];/);
  const allow = readArrayBlock(lines, /allowedTools\s*=\s*\[/, /^\s*\]\.join\(/);

  if (!argv) {
    failures.push(
      'could not find the worker argv array (`claudeArgs = [`) in batch-tailor.mjs -- upstream ' +
      'may have restructured the invocation; re-check the permission scoping by hand'
    );
  } else {
    const argvText = argv.rows.map(r => r.line).join('\n');

    for (const { line, n } of argv.rows) {
      if (line.includes('--dangerously-skip-permissions')) {
        failures.push(
          `batch-tailor.mjs:${n} passes --dangerously-skip-permissions to the worker. Its prompt ` +
          'embeds a job URL and an evaluation report derived from an untrusted job posting, so ' +
          'the local fork replaces it with `--permission-mode dontAsk` plus an explicit ' +
          '--allowedTools allowlist. An upstream merge has restored it -- re-apply the scoping. ' +
          "NOTE: do NOT copy batch-runner.sh's allowlist; this worker runs modes/pdf.md and needs " +
          'about ten commands, and the narrow list silently drops verify-cv-facts.mjs.'
        );
      }
    }
    if (!argvText.includes('--permission-mode')) {
      failures.push('batch-tailor.mjs: the worker argv is missing `--permission-mode dontAsk`');
    }
    if (!argvText.includes('--allowedTools')) {
      failures.push('batch-tailor.mjs: the worker argv is missing the explicit --allowedTools allowlist');
    }
    if (!argv.closed) {
      warnings.push(
        'batch-tailor.mjs: the `claudeArgs = [` array never closes with `];` -- CHECK 3 read to ' +
        'end of file, so its result is unreliable. Re-check the permission scoping by hand.'
      );
    }
  }

  if (!allow) {
    failures.push(
      'could not find the allowlist array (`allowedTools = [`) in batch-tailor.mjs -- the ' +
      'permission scoping may have been restructured; re-check it by hand'
    );
  } else {
    const allowText = allow.rows.map(r => r.line).join('\n');
    // The fact gate is the entry whose absence is INVISIBLE. Losing
    // Bash(node generate-pdf.mjs *) fails a run loudly; losing this one just
    // produces an unverified CV, and nothing else in the system would notice.
    if (!allowText.includes('verify-cv-facts.mjs')) {
      failures.push(
        'batch-tailor.mjs: the allowlist no longer permits `node verify-cv-facts.mjs` -- the CV ' +
        'fact gate (modes/pdf.md step 19). Losing it does not fail a run, it silently produces an ' +
        'unverified CV, so nothing else would catch this.'
      );
    }
    if (!allow.closed) {
      warnings.push(
        'batch-tailor.mjs: the `allowedTools = [` array never closes with `].join(` -- CHECK 3 ' +
        'read to end of file, so its result is unreliable.'
      );
    }
  }
}

if (warnings.length > 0) {
  for (const w of warnings) console.error(`WARN: ${w}`);
}

if (failures.length > 0) {
  console.error('FORK INVARIANT VIOLATED:\n');
  for (const f of failures) console.error(`  - ${f}\n`);
  process.exit(1);
}

console.log(
  'fork invariants OK (batch-runner permission scoping + .gitattributes rules intact)' +
  (warnings.length ? ` -- ${warnings.length} warning(s) above` : '')
);
