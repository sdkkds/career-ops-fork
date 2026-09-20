#!/usr/bin/env node
/**
 * check-pr-branch.mjs — fork-local pre-flight gate for an upstream PR branch.
 *
 * FORK-LOCAL. Not an upstream file. Declared in config/local-paths.txt.
 *
 * WHY THIS EXISTS
 *
 * This fork's `main` carries ~70 commits upstream does not, modifies a dozen
 * files upstream owns, and adds a pile of files that exist nowhere upstream
 * (run-nightly.ps1, lib/needs-attention.mjs, digest.mjs, …). A PR branch is
 * supposed to be cut from `upstream/main` so none of that travels. Nothing
 * enforced it, and the failure is quiet: `gh api ... pulls` happily opens a PR
 * carrying a fork-local orchestrator script, and the first person to notice is
 * the maintainer.
 *
 * Run this before opening or updating a PR:
 *
 *     node check-pr-branch.mjs                # checks HEAD
 *     node check-pr-branch.mjs my-branch      # checks a named branch
 *
 * Exit 0 = safe to PR. Exit 1 = something fork-local would travel with it.
 *
 * WHAT IT CANNOT DO
 *
 * It checks provenance and content, not correctness. It cannot tell you that a
 * change is right for upstream users whose tracker column order, URL-key
 * semantics, or gitignore layout differ from this fork's — the subtler failure,
 * and still a human job. See the fork notes in AGENTS.md.
 */

import { execFileSync } from 'child_process';

const UPSTREAM = 'upstream/main';
const TRUNK = 'main';

/**
 * Identifiers that only exist in this fork. A PR that references one is either
 * carrying fork-local code or was written against a fork-local assumption.
 * Deliberately a short literal list of things upstream has no counterpart for —
 * a generic heuristic here would cry wolf and get ignored.
 */
const FORK_ONLY_IDENTIFIERS = [
  'run-nightly',
  'run-batch.ps1',
  'needs-attention',
  'url-identity',
  'prioritise-queue',
  'check-fork-invariants',
  'CAREER_OPS_REPORTS_ROOT',
  'CAREER_OPS_NEEDS_ATTENTION',
  'qa-fixtures',
  'local-paths.txt',
];

// 64 MB. The default 1 MB is not enough: `git diff main..upstream/main` on this
// fork is over a megabyte, and execFileSync does not truncate at the limit — it
// kills the child with SIGTERM and throws ENOBUFS, so the gate died with a stack
// trace instead of reporting the failures it had already found.
function git(args) {
  return execFileSync('git', args, { encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024 }).trim();
}

/** Report and exit. Used to stop before expensive work once the answer is known. */
function report(failures, notes, branchName, changedCount) {
  for (const n of notes) console.log(`NOTE: ${n}`);
  if (failures.length > 0) {
    console.error(`\nFAIL: ${branchName} is not safe to open as an upstream PR:`);
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.log(`OK: ${branchName} is safe to PR — cut from upstream history, ${changedCount} file(s), no fork-local content.`);
  process.exit(0);
}

/** Tracked files at a ref, as a Set. */
function filesAt(ref) {
  const out = git(['ls-tree', '-r', '--name-only', ref]);
  return new Set(out ? out.split('\n').filter(Boolean) : []);
}

const failures = [];
const notes = [];

const branch = process.argv[2] || 'HEAD';

// The upstream ref has to exist and be something we can reason about. Bail
// loudly rather than "passing" a check that never ran — a gate that cannot
// inspect the tree must not report success (same rule as the SYSTEM_PATHS
// coverage guard).
let upstreamSha;
try {
  upstreamSha = git(['rev-parse', UPSTREAM]);
} catch {
  console.error(`FAIL: cannot resolve ${UPSTREAM}. Add the upstream remote and fetch it:`);
  // The project moved orgs; santifer/career-ops only resolves via GitHub's
  // redirect, which lasts until someone claims the old path. Print the real one.
  console.error('      git remote add upstream https://github.com/career-ops-hq/career-ops.git');
  console.error('      git fetch upstream main');
  process.exit(1);
}

const branchSha = git(['rev-parse', branch]);
const branchName = branch === 'HEAD' ? git(['rev-parse', '--abbrev-ref', 'HEAD']) : branch;
const mergeBase = git(['merge-base', branchSha, upstreamSha]);

// 1. The branch must not be the fork trunk, and must not build on it. This is
//    the mechanical mistake the whole script exists for: branching from `main`
//    drags every fork commit into the PR.
if (branchName === TRUNK) {
  failures.push(`${TRUNK} is the fork trunk and carries fork-local commits — never open a PR from it. Branch off ${UPSTREAM} instead.`);
} else {
  let trunkSha = null;
  try { trunkSha = git(['rev-parse', TRUNK]); } catch { /* no trunk locally: fine */ }
  if (trunkSha) {
    const trunkIsAncestor = (() => {
      try {
        execFileSync('git', ['merge-base', '--is-ancestor', trunkSha, branchSha], { stdio: 'ignore' });
        return true;
      } catch { return false; }
    })();
    if (trunkIsAncestor) {
      failures.push(`${branchName} has ${TRUNK} in its history, so it carries this fork's commits. Re-cut it from ${UPSTREAM}.`);
    }
  }
}

// 2. The merge-base must be reachable from upstream — i.e. the branch really
//    was cut from upstream history and not from some unrelated local line.
const baseReachable = (() => {
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', mergeBase, upstreamSha], { stdio: 'ignore' });
    return true;
  } catch { return false; }
})();
if (!baseReachable) {
  failures.push(`${branchName} does not share history with ${UPSTREAM}; its base is not an upstream commit.`);
}

// Provenance is decided. If it already failed, stop here: the remaining checks
// diff the branch against its merge-base, and for a branch built on this fork
// that is the whole fork history — megabytes of diff to restate a conclusion we
// have. Answer the question that was asked, cheaply.
if (failures.length > 0) report(failures, notes, branchName, 0);

// 3. Nothing the branch touches may be a file that exists in this fork but not
//    upstream. Computed rather than hardcoded: a genuinely NEW file for
//    upstream exists in neither tree and is correctly ignored here, while a
//    fork-local file exists in `main` only and is caught even if it was added
//    after this script was written.
const changed = (() => {
  const out = git(['diff', '--name-only', `${mergeBase}..${branchSha}`]);
  return out ? out.split('\n').filter(Boolean) : [];
})();

if (changed.length === 0) {
  notes.push(`${branchName} contributes no file changes over its merge-base — nothing to PR yet.`);
}

let forkOnly = new Set();
try {
  const inFork = filesAt(TRUNK);
  const inUpstream = filesAt(UPSTREAM);
  forkOnly = new Set([...inFork].filter(f => !inUpstream.has(f)));
} catch {
  failures.push(`cannot list trees for ${TRUNK}/${UPSTREAM} — refusing to report a pass on an unchecked tree.`);
}

const leaked = changed.filter(f => forkOnly.has(f));
for (const f of leaked) {
  failures.push(`${f} exists only in this fork — it must not travel in an upstream PR.`);
}

// 4. Content check: the added lines must not reference fork-only machinery.
//    Only ADDED lines are inspected; an untouched upstream line that happens to
//    contain one of these words is not this branch's doing.
if (changed.length > 0) {
  const diff = git(['diff', '--unified=0', `${mergeBase}..${branchSha}`]);
  const added = diff
    .split('\n')
    .filter(l => l.startsWith('+') && !l.startsWith('+++'))
    .map(l => l.slice(1));
  for (const id of FORK_ONLY_IDENTIFIERS) {
    const hit = added.find(l => l.includes(id));
    if (hit) {
      failures.push(`added line references fork-only "${id}" — upstream has no counterpart:\n      ${hit.trim().slice(0, 140)}`);
    }
  }
}

// 5. Advisory only: a branch far behind upstream still merges, but its CI runs
//    against a merge ref you have not tested locally. That is how a test that
//    exists only upstream (tests/source-no-nul-bytes.test.mjs, 2026-08-17) can
//    fail a PR that passed every local run.
if (mergeBase !== upstreamSha) {
  const behind = git(['rev-list', '--count', `${mergeBase}..${upstreamSha}`]);
  notes.push(`${branchName} is ${behind} commit(s) behind ${UPSTREAM}. CI runs the merge ref, so it can exercise tests your local run never saw. Rebase before pushing if CI disagrees with local.`);
}

report(failures, notes, branchName, changed.length);
