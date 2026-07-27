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
import { join, basename, resolve, relative, isAbsolute } from 'node:path';
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

  if (v.pdf) {
    // Resolve against root and require the result to stay under root — a
    // worker-claimed path with `..` segments must never be able to point at
    // some unrelated file that happens to exist elsewhere on disk and get
    // treated as proof the CV was generated (that's the historical null-PDF
    // leniency in a new form).
    const resolvedRoot = resolve(root);
    const resolvedPdf = resolve(root, String(v.pdf));
    const rel = relative(resolvedRoot, resolvedPdf);
    const escapesRoot = rel.startsWith('..') || isAbsolute(rel);
    if (escapesRoot) {
      reasons.push(`claimed pdf path escapes project root: ${v.pdf}`);
    } else if (!existsSync(resolvedPdf)) {
      reasons.push(`claimed pdf does not exist: ${v.pdf}`);
    }
  }

  // Condition 6 is unconditional (unlike condition 5's "if claimed"): every
  // eval must prove it worked the URL the orchestrator actually dispatched.
  // A missing or unparseable expect.url/v.url must itself fail closed —
  // never fall through silently just because one side is absent.
  const expected = normalizeUrl(expect.url);
  if (!expected) {
    reasons.push(`no usable dispatched url to verify against: ${expect.url}`);
  } else {
    const reported = normalizeUrl(v.url);
    if (!reported) {
      reasons.push(`worker result is missing a usable url (dispatched ${expected})`);
    } else if (expected !== reported) {
      reasons.push(`url mismatch: dispatched ${expected}, worker reported ${reported}`);
    }
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
