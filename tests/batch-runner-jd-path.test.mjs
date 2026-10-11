// tests/batch-runner-jd-path.test.mjs — the JD file path the worker is told to
// read lies inside the directory it is allowed to read.
//
// THE BUG THIS PINS
//
// batch-runner prefetches the posting into `mktemp /tmp/batch-jd-<id>.XXXXXX`,
// names that path in the worker prompt, and adds its directory with
// `--add-dir` because `--restricted` confines file tools to the working dirs.
// Under Git Bash the worker (claude.exe) is a native Windows program, and MSYS
// converts a path only when it is a whole argument: `--add-dir /tmp` arrived as
// the Windows temp dir (a drive-letter path), while the path inside the prompt text
// stayed `/tmp/batch-jd-...`. The worker could not map one to the other, said
// "outside my permitted working directories", and re-fetched every posting with
// WebFetch; a job whose second fetch failed became a failed eval. Found
// 2026-10-10 in the #30 real-posting run (matrix #31).
//
// This test lifts the REAL statements out of batch/batch-runner.sh (the
// worker-path block, the prompt line and the --add-dir line), runs them in
// bash, and hands the result to a native program (node) exactly as the script
// hands it to claude. So the MSYS conversion is exercised for real on Windows;
// on Linux/macOS nothing is converted and both sides agree trivially.
import { pass, fail, rmSync, getBash } from './helpers.mjs';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = readFileSync(join(ROOT, 'batch/batch-runner.sh'), 'utf-8').replace(/\r\n/g, '\n');

console.log('\nbatch-runner.sh — prefetched JD path agrees with --add-dir');

const promptLine = SRC.match(/^\s*(prompt="\$prompt JD file: [^\n]*")\s*$/m);
const addDirLine = SRC.match(/^\s*(claude_args\+=\(--add-dir [^\n]*\))\s*$/m);
// Optional: the block that derives the path handed to the worker. Absent on the
// unfixed script, which is exactly the case this test must catch.
const workerBlock = SRC.match(/^( *local jd_file_worker=[\s\S]*?\n *fi)\n/m);

if (!promptLine || !addDirLine) {
  fail('could not find the "JD file:" prompt line or the --add-dir line in batch/batch-runner.sh — this test needs updating');
} else {
  const work = mkdtempSync(join(tmpdir(), 'cops-jdpath-'));
  try {
    const script = join(work, 'check.sh');
    writeFileSync(script, [
      '#!/usr/bin/env bash',
      'set -euo pipefail',
      'f() {',
      '  local jd_file prompt=""',
      '  jd_file="$(mktemp "${TMPDIR:-/tmp}/batch-jd-test.XXXXXX")"',
      workerBlock ? workerBlock[1] : '',
      '  local -a claude_args=()',
      `  ${promptLine[1]}`,
      `  ${addDirLine[1]}`,
      // node is native on Windows, like claude.exe: it sees what MSYS passes.
      '  node -e "process.stdout.write(JSON.stringify(process.argv.slice(1)))" -- "${claude_args[@]}" "$prompt"',
      '  rm -f "$jd_file"',
      '}',
      'f',
    ].join('\n'));
    const argv = JSON.parse(execFileSync(getBash(), [script], { encoding: 'utf-8', timeout: 30000 }));
    const addDir = argv[argv.indexOf('--add-dir') + 1];
    const named = /JD file: (\S+)/.exec(argv[argv.length - 1])?.[1];

    const norm = p => p.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
    if (named && addDir && norm(named).startsWith(norm(addDir) + '/')) {
      pass(`the worker is told to read a path inside its --add-dir (${addDir})`);
    } else {
      fail(`prompt names "${named}" but --add-dir is "${addDir}" — the --restricted worker cannot read it`);
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

// The {{JD_FILE}} placeholder in batch-prompt.md gets the same path as the
// prompt line, so the system prompt and the user prompt cannot disagree.
if (/esc_jd_file="\$\{jd_file_worker\/\//.test(SRC)) {
  pass('{{JD_FILE}} is filled from the same worker path');
} else {
  fail('{{JD_FILE}} is not filled from jd_file_worker — the system prompt can name a different path than --add-dir');
}
