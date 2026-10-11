// tests/batch-runner-result-extract.test.mjs — batch-runner reads the worker's
// result block the way batch-prompt.md tells the worker to write it.
//
// THE BUG THIS PINS
//
// batch-prompt.md Step 6 tells the worker to print its final JSON between
// CAREEROPS_RESULT_JSON_BEGIN / CAREEROPS_RESULT_JSON_END. batch-runner.sh only
// looked for the last ```json fence. A worker that followed the contract exactly
// (sentinels, no fence), or wrapped the sentinel block in a bare ``` fence, gave
// the parser nothing. The run still passed the report-on-disk check, so the state
// file read `completed` with score `-`, and batch-tailor, which selects jobs by
// score, silently skipped it. Found 2026-10-09 in the isolation acceptance run.
//
// The extractor now runs node, so it can also break (a moved module, a syntax
// error). That must surface as a nonzero exit, never as "no result block", or
// the same silent score "-" comes back by a different road.
//
// This test extracts the REAL extraction command from batch/batch-runner.sh and
// runs it against a log file, so the test and the script cannot drift apart.
import { pass, fail, rmSync, getBash } from './helpers.mjs';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = readFileSync(join(ROOT, 'batch/batch-runner.sh'), 'utf-8').replace(/\r\n/g, '\n');

console.log('\nbatch-runner.sh — worker result block extraction');

// The whole `worker_result_json=$( ... )` command substitution, up to the
// `) || extract_rc=$?` that closes it.
const cmd = SRC.match(/^\s*worker_result_json=\$\(([\s\S]*?)\) \|\| extract_rc=\$\?\s*$/m);
const posix = p => p.replace(/\\/g, '/');

// Runs the real command with PROJECT_DIR=projectDir; returns { rc, out }.
function extract(work, projectDir, log) {
  const logFile = join(work, 'worker.log');
  writeFileSync(logFile, log);
  const script = join(work, 'check.sh');
  writeFileSync(script, [
    '#!/usr/bin/env bash',
    `PROJECT_DIR=${JSON.stringify(posix(projectDir))}`,
    `log_file=${JSON.stringify(posix(logFile))}`,
    'extract_rc=0',
    `worker_result_json=$(${cmd[1]}) || extract_rc=$?`,
    'printf "%s\\x1f%s" "$extract_rc" "$worker_result_json"',
  ].join('\n'));
  const [rc, out] = execFileSync(getBash(), [script], { encoding: 'utf-8', timeout: 30000 }).split('\x1f');
  return { rc: Number(rc), out: out.trim() };
}

const F = '```';
const RESULT = '{"status":"completed","id":"1","score":3.4,"error":null}';
const CASES = [
  ['sentinel block, no fence (the batch-prompt.md Step 6 contract)',
    `prose\nCAREEROPS_RESULT_JSON_BEGIN\n${RESULT}\nCAREEROPS_RESULT_JSON_END\n`, 3.4],
  ['sentinel block inside a bare fence (the 2026-10-09 acceptance log)',
    `prose\n${F}\nCAREEROPS_RESULT_JSON_BEGIN\n${RESULT}\nCAREEROPS_RESULT_JSON_END\n${F}\n`, 3.4],
  ['fence inside the sentinel block',
    `prose\nCAREEROPS_RESULT_JSON_BEGIN\n${F}json\n${RESULT}\n${F}\nCAREEROPS_RESULT_JSON_END\n`, 3.4],
  ['```json fence only (the Step 1 hard-stop failure path)',
    `prose\n${F}json\n{"status":"failed","error":"JD unreadable"}\n${F}\n`, 'failed'],
  ['a fenced example earlier in the log does not beat the final sentinel block',
    `${F}json\n{"status":"completed","score":1.0}\n${F}\nCAREEROPS_RESULT_JSON_BEGIN\n${RESULT}\nCAREEROPS_RESULT_JSON_END\n`, 3.4],
  ['no result block at all yields nothing',
    'the worker crashed before printing a result\n', null],
];

if (!cmd) {
  fail('could not find the worker_result_json=$(...) || extract_rc=$? extraction in batch/batch-runner.sh — this test needs updating');
} else {
  const work = mkdtempSync(join(tmpdir(), 'cops-extract-'));
  try {
    for (const [name, log, want] of CASES) {
      const { rc, out } = extract(work, ROOT, log);
      let obj = null;
      try { obj = out ? JSON.parse(out) : null; } catch { /* reported below */ }
      const got = obj === null ? null : (typeof obj.score === 'number' ? obj.score : obj.status);
      if (rc === 0 && got === want) {
        pass(`${name}: ${want === null ? 'empty' : JSON.stringify(want)}`);
      } else {
        fail(`${name}: expected rc 0 and ${JSON.stringify(want)}, got rc ${rc} and ${JSON.stringify(out)}`);
      }
    }

    // Forced failure: a project dir with no lib/json-extract.mjs.
    const broken = join(work, 'no-lib');
    mkdirSync(broken);
    const { rc, out } = extract(work, broken, CASES[0][1]);
    if (rc !== 0 && out === '') {
      pass(`a broken extractor exits nonzero (rc ${rc}) instead of reading as "no result block"`);
    } else {
      fail(`a broken extractor returned rc ${rc} with ${JSON.stringify(out)}; it must exit nonzero`);
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

// The caller must turn a nonzero extract_rc into a recorded failure, ahead of
// the "parsed JSON" branch, so it can never fall through to `completed`.
if (/if \(\( extract_rc != 0 \)\); then\s+worker_failed_match="failed"/.test(SRC)) {
  pass('a nonzero extract_rc is recorded as a failed run');
} else {
  fail('batch-runner.sh no longer turns a nonzero extract_rc into worker_failed_match="failed"');
}
