#!/usr/bin/env node
/**
 * lib/eval-verify.mjs — the success definition, enforced against disk.
 *
 * An eval succeeded only if ALL of these hold:
 *   1. a sentinel JSON block parsed, and its status is "completed"
 *   2. the report .md exists at the expected path
 *   3. the TSV exists at the expected path
 *   4. score is non-null, OR the tracker status is an explicit SKIP
 *   5. if the worker claimed a PDF path, that file exists
 *   6. the worker's url matches the URL the orchestrator dispatched
 *
 * A worker printing {"status":"completed"} proves nothing on its own.
 */
import { existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { extractResultJson } from './json-extract.mjs';
import { normalizeUrl } from './url-identity.mjs';

export function verifyEval({ stdout, root, expect }) {
  const reasons = [];
  const parsed = extractResultJson(stdout);
  if (!parsed.ok) return { status: 'failed', reasons: [parsed.reason], value: null };

  const v = parsed.value;
  if (v.status !== 'completed') reasons.push(`worker reported status "${v.status}"${v.error ? `: ${v.error}` : ''}`);
  if (!expect.reportPath || !existsSync(join(root, expect.reportPath))) {
    reasons.push(`report file missing: ${expect.reportPath}`);
  }
  if (!expect.tsvPath || !existsSync(join(root, expect.tsvPath))) {
    reasons.push(`tsv missing: ${expect.tsvPath}`);
  }

  const isSkip = String(v.tracker_status ?? '').toUpperCase() === 'SKIP';
  if ((v.score === null || v.score === undefined) && !isSkip) {
    reasons.push('score is null and status is not an explicit SKIP');
  }
  if (v.pdf && !existsSync(join(root, String(v.pdf).replace(/^\.?[\\/]/, '')))) {
    reasons.push(`claimed pdf does not exist: ${v.pdf}`);
  }

  const expected = normalizeUrl(expect.url);
  const reported = normalizeUrl(v.url);
  if (expected && reported && expected !== reported) {
    reasons.push(`url mismatch: dispatched ${expected}, worker reported ${reported}`);
  }

  return { status: reasons.length ? 'failed' : 'completed', reasons, value: v };
}

if (process.argv[1] && basename(process.argv[1]) === 'eval-verify.mjs') {
  const { readFileSync } = await import('node:fs');
  const arg = name => {
    const i = process.argv.indexOf(`--${name}`);
    return i === -1 ? null : process.argv[i + 1];
  };
  const logPath = arg('log');
  const stdout = logPath && existsSync(logPath) ? readFileSync(logPath, 'utf-8') : '';
  const result = verifyEval({
    stdout,
    root: arg('root') ?? process.cwd(),
    expect: { reportPath: arg('report'), tsvPath: arg('tsv'), url: arg('url') },
  });
  console.log(JSON.stringify(result));
  process.exit(result.status === 'completed' ? 0 : 1);
}
