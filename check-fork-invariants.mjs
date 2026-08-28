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
 * CHECK 3 -- batch-tailor.mjs -- added 2026-08-28, and it WARNS rather than
 * fails. batch-tailor.mjs:119 passes --dangerously-skip-permissions to a worker
 * whose prompt embeds a job URL and an evaluation report, so it is the same
 * threat class as CHECK 1: untrusted-derived content reaching a worker with
 * full tool access. It is upstream-maintained (#1882, #2961), so a merge
 * maintains that line exactly as it does batch-runner.sh's.
 *
 * Three reasons it warns instead of failing, all of which should be revisited
 * if any of them stops being true:
 *
 *   1. The flag is present RIGHT NOW. This script gates the nightly at
 *      run-nightly.ps1:312 and exit 1 there is FATAL, so failing on the current
 *      tree would stop tonight's run over a file the nightly never invokes.
 *      The scoping has to land before the guard can be hard.
 *   2. batch-tailor.mjs is manual Conductor mode. run-nightly.ps1 never calls
 *      it, so there is a human present when it runs -- a materially different
 *      exposure from an unattended 3am batch.
 *   3. Scoping it is not a copy of CHECK 1's allowlist, and assuming otherwise
 *      would do real harm. batch-runner.sh's workers only evaluate offers, so
 *      they need exactly one shell command. batch-tailor runs modes/pdf.md,
 *      which needs npm run application:init, npm run jd:similarity, and node
 *      find.mjs / jd-skill-gap.mjs / build-cv-html.mjs / verify-cv-facts.mjs /
 *      generate-pdf.mjs / cv-templates.mjs / generate-cover-letter.mjs, plus
 *      curl and file on the Canva path. Copying CHECK 1's narrow allowlist
 *      would silently drop verify-cv-facts.mjs -- the CV fact gate, which is
 *      exactly what the comment at batch-tailor.mjs:121-125 warns about. A
 *      too-narrow allowlist here removes an anti-fabrication check while
 *      looking like a security improvement.
 *
 * A warning is only worth emitting if something reads it: run-nightly.ps1
 * discarded this script's stdout on success until the same commit that added
 * this check taught it to log WARN lines. If that logging is ever removed, this
 * check goes silent and should be deleted rather than left as decoration.
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

// ── CHECK 3: batch-tailor.mjs permission scoping (WARNS, never fails) ───────
// See the header for why this one is not a failure. Narrowed to the worker argv
// array the same way CHECK 1 narrows to `claude_args=(`, so the explanatory
// comments inside that array do not trip it.
if (!existsSync(TAILOR)) {
  warnings.push(
    `batch-tailor.mjs is missing (expected at ${TAILOR}). It is upstream-maintained, so ` +
    'this may be an upstream removal rather than a problem -- but CHECK 3 is now blind.'
  );
} else {
  const lines = readFileSync(TAILOR, 'utf-8').split(/\r?\n/);
  const start = lines.findIndex(l => /claudeArgs\s*=\s*\[/.test(l));

  if (start === -1) {
    warnings.push(
      'could not find the worker argv array (`claudeArgs = [`) in batch-tailor.mjs -- ' +
      'upstream may have restructured the invocation; re-check the permission scoping by hand'
    );
  } else {
    let closed = false;
    for (let i = start; i < lines.length; i++) {
      if (i > start && /^\s*\];/.test(lines[i])) { closed = true; break; }
      if (lines[i].includes('--dangerously-skip-permissions')) {
        warnings.push(
          `batch-tailor.mjs:${i + 1} passes --dangerously-skip-permissions to the worker. ` +
          'Its prompt embeds a job URL and an evaluation report, so this is the same threat ' +
          'class as batch-runner.sh -- but it is manual Conductor mode, not the nightly path. ' +
          'KNOWN AND ACCEPTED, not new drift. Scoping it needs an allowlist covering all of ' +
          "modes/pdf.md's commands; copying batch-runner.sh's narrow one would silently drop " +
          'verify-cv-facts.mjs, the CV fact gate. Scope it deliberately or accept it deliberately.'
        );
      }
    }
    if (!closed) {
      warnings.push(
        'batch-tailor.mjs: the `claudeArgs = [` array never closes with `];` -- CHECK 3 read to ' +
        'end of file, so its result is unreliable. Re-check the permission scoping by hand.'
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
