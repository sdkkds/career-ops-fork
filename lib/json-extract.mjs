/**
 * lib/json-extract.mjs — pull the worker's result object out of stdout.
 *
 * The old orchestrator scanned for the last '{' and last '}', which mangled
 * pretty-printed JSON and picked up braces from prose. Only an explicit
 * sentinel block (or a ```json fence) counts.
 */
const BEGIN = 'CAREEROPS_RESULT_JSON_BEGIN';
const END = 'CAREEROPS_RESULT_JSON_END';

function lastBetween(text, begin, end) {
  const endIdx = text.lastIndexOf(end);
  if (endIdx === -1) return null;
  const beginIdx = text.lastIndexOf(begin, endIdx);
  if (beginIdx === -1) return null;
  return text.slice(beginIdx + begin.length, endIdx).trim();
}

/**
 * Strip one surrounding markdown fence, if the text is entirely wrapped in one.
 *
 * Needed because a worker may emit BOTH the sentinels and a fence inside them.
 * Before this, the fence was only stripped on the fallback path (no sentinels),
 * so the *more* compliant worker — the one that used the sentinels as told and
 * then fenced out of habit — was the one that failed to parse.
 *
 * Deliberately narrow: the text must both open and close with a fence, so a
 * stray backtick inside the payload is left alone and still fails loudly. The
 * language tag is optional and not validated (```json, ```JSON and a bare ```
 * all unwrap). Unwrapping never rescues bad JSON — it only removes the fence,
 * and whatever is inside still has to parse.
 *
 * @param {string} text - Candidate result block.
 * @returns {string} The unwrapped payload, or `text` unchanged if not fenced.
 */
function unwrapFence(text) {
  const m = /^```[^\n`]*\n([\s\S]*?)\n?```$/.exec(text.trim());
  return m ? m[1].trim() : text;
}

export function extractResultJson(stdout) {
  if (typeof stdout !== 'string' || !stdout.trim()) {
    return { ok: false, reason: 'no result block: worker produced no output' };
  }
  const text = stdout.replace(/^﻿/, '');

  let raw = lastBetween(text, BEGIN, END);
  if (raw === null) {
    const fences = text.match(/```json\s*[\s\S]*?```/g);
    if (fences?.length) {
      raw = fences[fences.length - 1].replace(/```json\s*/, '').replace(/```$/, '').trim();
    }
  }
  // Applied to BOTH paths, not just the fallback — see unwrapFence above.
  if (raw) raw = unwrapFence(raw);

  if (!raw) {
    return { ok: false, reason: 'no result block: sentinel or ```json fence not found' };
  }

  try {
    const value = JSON.parse(raw);
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      return { ok: false, reason: 'result block did not parse to an object' };
    }
    return { ok: true, value };
  } catch (err) {
    return { ok: false, reason: `result block failed to parse: ${err.message}` };
  }
}
