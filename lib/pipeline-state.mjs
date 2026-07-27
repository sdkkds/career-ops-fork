/**
 * lib/pipeline-state.mjs — durable two-phase drain markers for data/pipeline.md.
 *
 * The marker is written BEFORE the worker runs (in-progress) and again after
 * the artifact check (done / failed), so a mid-run crash leaves an accurate
 * record. Restarting skips done, retries failed within a budget, and never
 * re-evaluates a completed job.
 */
import { basename } from 'node:path';
import { normalizeUrl } from './url-identity.mjs';

export const RETRY_BUDGET = 2;

// `expired` ('-') is RESERVED for check-liveness.mjs / liveness-core.mjs: a row
// whose posting has been proven dead should be parked, not retried. Nothing in
// this branch sets it yet — it is defined so the marker is already understood
// (and already excluded from listActionable) when the liveness checker starts
// writing it, rather than being read as a corrupt row. Deliberate, not dead code.
const MARKERS = { ' ': 'pending', '~': 'in-progress', x: 'done', '!': 'failed', '-': 'expired' };
const SYMBOLS = { pending: ' ', 'in-progress': '~', done: 'x', failed: '!', expired: '-' };

// Tolerant regex: marker, URL, and everything after the URL as raw remainder.
// Allows whitespace flexibility: `-  [ ]` or `-\t[x]` etc.
//
// The trailing `\r?` is load-bearing on Windows. We split on '\n', so a CRLF
// file leaves a '\r' at the end of every line. JS `.` does not match '\r' and
// `$` (non-multiline) only matches true end-of-string, so without `\r?` the
// pattern fails outright on every CRLF row — the row parses as nothing, the job
// is never listed, never dispatched, never drained. node writes LF but
// PowerShell's Add-Content/Out-File and every Windows editor write CRLF, so
// both endings turn up in the same data/pipeline.md.
const LINE_RX = /^-\s*\[([ x~!-])\]\s+(\S+)(.*)\r?$/;

export function parsePipeline(text) {
  const out = [];
  const lines = String(text ?? '').split('\n');
  lines.forEach((raw, lineIndex) => {
    const m = raw.match(LINE_RX);
    if (!m) return;

    const marker = m[1];
    const url = m[2];
    const remainder = m[3];

    // Parse attempts out of trailing <!-- attempts:N --> comment in remainder.
    let attempts = 0;
    const attemptsMatch = remainder.match(/<!--\s*attempts:\s*(\d+)\s*-->/);
    if (attemptsMatch) {
      attempts = parseInt(attemptsMatch[1], 10);
    }

    // Remove attempts comment from remainder for display extraction.
    // Keep the raw remainder intact for lossless round-trip in setState.
    const remainderForDisplay = remainder.replace(/\s*<!--\s*attempts:\s*\d+\s*-->\s*$/, '');

    // Derive company and title for display by splitting remainder on | and taking first two segments.
    // Treat as convenience view only, not source of truth.
    const segments = remainderForDisplay.split('|').map(s => s.trim()).filter(s => s);
    const company = segments[0] ?? '';
    const title = segments[1] ?? '';

    out.push({
      state: MARKERS[marker],
      url,
      company,
      title,
      attempts,
      remainder, // Preserve raw remainder for lossless round-trip
      eol: raw.endsWith('\r') ? '\r' : '', // Re-appended by setState so CRLF files stay CRLF
      raw,
      lineIndex,
    });
  });
  return out;
}

export function setState(text, url, state, { attempts } = {}) {
  const symbol = SYMBOLS[state];
  if (!symbol) throw new Error(`unknown pipeline state: ${state}`);
  const key = normalizeUrl(url);
  if (!key) throw new Error(`cannot set state for unparseable url: ${url}`);

  const lines = String(text ?? '').split('\n');

  // Collect ALL matches, never `.find`. Two rows can normalize to one identity
  // (scan.mjs's own dedup is looser than normalizeUrl: it keeps scheme, `www.`,
  // host case and param order, so `http://www.host/j/1` and `https://host/j/1`
  // are two rows to the scanner and one identity here). First-match-wins would
  // then mark row 1 while row 2 stayed pending, get re-dispatched every night,
  // mark row 1 again, and never drain — burning a paid worker per run while
  // reporting `completed`. Failing loud routes it into run-nightly.ps1's
  // existing "the queue and this run have diverged" abort instead.
  const matches = parsePipeline(text).filter(e => normalizeUrl(e.url) === key);
  if (matches.length === 0) throw new Error(`url not found in pipeline: ${url}`);
  if (matches.length > 1) {
    const where = matches.map(e => `line ${e.lineIndex + 1} (${e.url})`).join(', ');
    throw new Error(
      `ambiguous url in pipeline: ${matches.length} rows share the identity ${key} — ${where}. ` +
      `Marking one would silently strand the others; de-duplicate the file by hand.`
    );
  }
  const entry = matches[0];

  // Rewrite only the marker character and attempts comment; preserve remainder byte-for-byte.
  const nextAttempts = attempts ?? entry.attempts;

  // Start with marker and URL
  let line = `- [${symbol}] ${entry.url}`;

  // Remove any existing attempts comment from remainder, then append new one (if needed)
  let newRemainder = entry.remainder.replace(/\s*<!--\s*attempts:\s*\d+\s*-->\s*$/, '');

  // Write attempts comment when attempts > 0, regardless of state
  if (nextAttempts > 0) {
    line += `${newRemainder} <!-- attempts:${nextAttempts} -->`;
  } else {
    line += newRemainder;
  }

  // Restore the line's own terminator. `remainder` excludes the '\r' (the regex
  // consumed it), so the comment lands before it and a CRLF file stays CRLF.
  line += entry.eol;

  lines[entry.lineIndex] = line;
  return lines.join('\n');
}

/**
 * Split a selection of rows into ones the orchestrator can actually work and
 * ones it can never work.
 *
 * `modes/pipeline.md` documents `local:jds/foo.md` as a legitimate hand-added
 * entry, and the row regex accepts any non-space token. But normalizeUrl
 * rejects a non-http(s) scheme, so setState throws on such a row — which used
 * to abort the ENTIRE nightly batch and leave the row unmarked, so it was
 * selected first again the next night. One hand-pasted row wedged the pipeline
 * permanently (and leaked an inflight entry each run). Splitting them out here
 * keeps the blast radius at one row: the orchestrator records a needs-attention
 * line for each unusable entry and drains the rest of the queue.
 */
function partition(entries, limit) {
  const usable = [];
  const unusable = [];
  for (const e of entries) {
    (normalizeUrl(e.url) === null ? unusable : usable).push(e);
  }
  return { rows: typeof limit === 'number' ? usable.slice(0, limit) : usable, unusable };
}

export function selectActionable(text, { limit = 10, maxAttempts = RETRY_BUDGET } = {}) {
  const entries = parsePipeline(text);
  const pending = entries.filter(e => e.state === 'pending');
  const retryable = entries.filter(e => e.state === 'failed' && e.attempts < maxAttempts);
  return partition([...pending, ...retryable], limit);
}

export function selectByState(text, state) {
  return partition(parsePipeline(text).filter(e => e.state === state), null);
}

export function listActionable(text, opts = {}) {
  return selectActionable(text, opts).rows;
}

/**
 * CLI — lets run-nightly.ps1 drive the markers without parsing pipeline rows
 * itself. PowerShell string-splitting on these rows is exactly the bug this
 * module replaces, so the orchestrator passes whole files through here.
 *
 *   node lib/pipeline-state.mjs --file data/pipeline.md --list [--limit N]
 *     -> JSON {rows: [...], unusable: [...]}, each element
 *        {url, company, title, attempts, state}. `rows` is actionable work;
 *        `unusable` is rows whose url is not a usable http(s) URL, which the
 *        caller must report and skip rather than dispatch (setState cannot mark
 *        them, and failing the whole batch on one bad row is the wrong blast
 *        radius). Both keys are always present; either may be empty.
 *
 *   node lib/pipeline-state.mjs --file data/pipeline.md --list --state in-progress
 *     -> the same {rows, unusable} shape for every row in that state,
 *        unfiltered by the retry budget. Used to reap rows stranded in-progress
 *        by a crashed run; listActionable deliberately skips them, so without
 *        this they would never be retried.
 *
 *   node lib/pipeline-state.mjs --file data/pipeline.md --url URL --state S [--attempts N]
 *     -> JSON {ok:true,...}; exits non-zero if the URL is not in the pipeline.
 *
 * A failed --state call means the queue and the run have diverged. It exits
 * non-zero on purpose; the caller must treat that as fatal, not warn past it.
 */
if (process.argv[1] && basename(process.argv[1]) === 'pipeline-state.mjs') {
  const { readFileSync, writeFileSync } = await import('node:fs');
  const arg = name => {
    const i = process.argv.indexOf(`--${name}`);
    return i === -1 ? null : process.argv[i + 1];
  };

  try {
    const file = arg('file');
    if (!file) throw new Error('--file is required');
    const text = readFileSync(file, 'utf-8');

    if (process.argv.includes('--list')) {
      const wanted = arg('state');
      let selection;
      if (wanted) {
        if (!Object.values(MARKERS).includes(wanted)) throw new Error(`unknown pipeline state: ${wanted}`);
        selection = selectByState(text, wanted);
      } else {
        const limit = parseInt(arg('limit') ?? '10', 10);
        if (!Number.isInteger(limit) || limit < 0) throw new Error(`--limit must be a non-negative integer, got ${arg('limit')}`);
        selection = selectActionable(text, { limit });
      }
      // Project to a stable contract; `remainder`/`raw`/`lineIndex` are internals.
      const project = rows => rows.map(({ url, company, title, attempts, state }) =>
        ({ url, company, title, attempts, state }));
      console.log(JSON.stringify({
        rows: project(selection.rows),
        unusable: project(selection.unusable),
      }));
    } else {
      const url = arg('url');
      const state = arg('state');
      if (!url || !state) throw new Error('--url and --state are required when not listing');
      const attempts = arg('attempts');
      // setState throws when the URL is absent — let it propagate.
      const next = setState(text, url, state, attempts ? { attempts: parseInt(attempts, 10) } : {});
      writeFileSync(file, next, 'utf-8');
      console.log(JSON.stringify({ ok: true, url, state }));
    }
  } catch (err) {
    process.stderr.write(`pipeline-state: ${err.message}\n`);
    process.exitCode = 1;
  }
}
