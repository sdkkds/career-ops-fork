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
