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

// Tolerant regex: marker, URL, and everything after the URL as raw remainder.
// Allows whitespace flexibility: `-  [ ]` or `-\t[x]` etc.
const LINE_RX = /^-\s*\[([ x~!-])\]\s+(\S+)(.*)$/;

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

  lines[entry.lineIndex] = line;
  return lines.join('\n');
}

export function listActionable(text, { limit = 10, maxAttempts = RETRY_BUDGET } = {}) {
  const entries = parsePipeline(text);
  const pending = entries.filter(e => e.state === 'pending');
  const retryable = entries.filter(e => e.state === 'failed' && e.attempts < maxAttempts);
  return [...pending, ...retryable].slice(0, limit);
}
