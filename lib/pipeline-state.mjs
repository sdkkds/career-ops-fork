/**
 * lib/pipeline-state.mjs — durable two-phase drain markers for data/pipeline.md.
 *
 * The marker is written BEFORE the worker runs (in-progress) and again after
 * the artifact check (done / failed), so a mid-run crash leaves an accurate
 * record. Restarting skips done, retries failed within a budget, and never
 * re-evaluates a completed job.
 */
import { normalizeUrl } from './url-identity.mjs';

export const RETRY_BUDGET = 2;

const MARKERS = { ' ': 'pending', '~': 'in-progress', x: 'done', '!': 'failed', '-': 'expired' };
const SYMBOLS = { pending: ' ', 'in-progress': '~', done: 'x', failed: '!', expired: '-' };

const LINE_RX = /^- \[([ x~!-])\] (\S+)(?:\s*\|\s*([^|]*?))?(?:\s*\|\s*([^|]*?))?\s*(?:<!--\s*attempts:(\d+)\s*-->)?\s*$/;

export function parsePipeline(text) {
  const out = [];
  const lines = String(text ?? '').split('\n');
  lines.forEach((raw, lineIndex) => {
    const m = raw.match(LINE_RX);
    if (!m) return;
    out.push({
      state: MARKERS[m[1]],
      url: m[2],
      company: (m[3] ?? '').trim(),
      title: (m[4] ?? '').trim(),
      attempts: m[5] ? parseInt(m[5], 10) : 0,
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
  const entry = parsePipeline(text).find(e => normalizeUrl(e.url) === key);
  if (!entry) throw new Error(`url not found in pipeline: ${url}`);

  const parts = [`- [${symbol}] ${entry.url}`];
  if (entry.company) parts.push(entry.company);
  if (entry.title) parts.push(entry.title);
  let line = parts.join(' | ');

  const nextAttempts = attempts ?? entry.attempts;
  if (state === 'failed' && nextAttempts > 0) line += ` <!-- attempts:${nextAttempts} -->`;

  lines[entry.lineIndex] = line;
  return lines.join('\n');
}

export function listActionable(text, { limit = 10, maxAttempts = RETRY_BUDGET } = {}) {
  const entries = parsePipeline(text);
  const pending = entries.filter(e => e.state === 'pending');
  const retryable = entries.filter(e => e.state === 'failed' && e.attempts < maxAttempts);
  return [...pending, ...retryable].slice(0, limit);
}
