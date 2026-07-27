#!/usr/bin/env node
/**
 * digest.mjs — email the night's >= minScore results.
 *
 * A send failure must never look like a quiet night: the heartbeat is emitted
 * on every path (empty, sent, send-failed, read-failed), and any failure to
 * notify the user exits non-zero and lands in needs-attention.
 *
 * File path note: decisions.jsonl is written by run-nightly.ps1 to the vault
 * dir ($DecisionsLog), NOT to the project's data/decisions.jsonl (that file
 * exists as an empty placeholder for local/manual runs and tests). The
 * orchestrator MUST pass --file pointing at the real decisions log, or this
 * script will silently select nothing every night — exactly the failure
 * mode this task exists to prevent, just at the file-path layer instead of
 * the field-name layer.
 *
 * Cursor note: decisions.jsonl is append-only and never pruned, so selection
 * cannot simply use "this run's timestamp" as --since (that would re-select
 * and re-email the entire history forever). A durable cursor file records the
 * timestamp of the newest decision successfully digested, and is advanced
 * ONLY after a confirmed-empty night or a successful send — never after a
 * read failure or a send failure — so a crashed or failed digest re-digests
 * those results next time instead of silently dropping them. --since (passed
 * by the caller) is used only as the bootstrap fallback before a cursor
 * exists, so the very first run does not dump the entire history.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { basename } from 'node:path';
import { appendNeedsAttention } from './lib/needs-attention.mjs';

export function selectDigest(lines, { minScore = 3.0, since = null } = {}) {
  const heartbeat = {
    evaluated: 0, failed: 0, belowThreshold: 0, unparseable: 0, noTimestamp: 0,
    sendRequired: false, newestEvaluatedAt: null,
  };
  const items = [];

  for (const line of lines) {
    if (!String(line).trim()) continue;
    let r;
    try { r = JSON.parse(String(line).replace(/^﻿/, '')); }
    catch { heartbeat.unparseable++; continue; }

    if (since) {
      // A record with no evaluated_at can't be proven to be in-window. Treat
      // it as OUT of the window (never bypass the filter) but still count it,
      // so a malformed/legacy record is visible in the heartbeat instead of
      // silently swallowed in either direction.
      if (!r.evaluated_at) { heartbeat.noTimestamp++; continue; }
      if (r.evaluated_at < since) continue;
    }

    heartbeat.evaluated++;
    if (r.evaluated_at && (!heartbeat.newestEvaluatedAt || r.evaluated_at > heartbeat.newestEvaluatedAt)) {
      heartbeat.newestEvaluatedAt = r.evaluated_at;
    }

    if (r.status !== 'completed') { heartbeat.failed++; continue; }
    if (typeof r.score !== 'number' || r.score < minScore) { heartbeat.belowThreshold++; continue; }
    items.push(r);
  }

  items.sort((a, b) => b.score - a.score);
  heartbeat.sendRequired = items.length > 0;
  return { items, heartbeat };
}

export function renderDigest(items) {
  if (!items.length) return 'No results at or above the threshold tonight.';
  return items.map((r, i) =>
    `${i + 1}. ${r.company} — ${r.role}\n   Score: ${r.score}/5${r.legitimacy ? ` · ${r.legitimacy}` : ''}\n   ${r.url}`
  ).join('\n\n');
}

// Isolated so the CLI can distinguish "file doesn't exist yet" (fine, treat
// as no lines) from "file exists but could not be read" (a locked/mid-write
// file — OneDrive sync, a network hiccup, the orchestrator still appending —
// which must NOT be swallowed: it must fail loud, not silently look like a
// quiet night with zero lines).
export function readDecisionsFile(file) {
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf-8').split('\n');
}

// Cursor is a tiny JSON file: { since, updated_at }. Corrupt/unreadable
// cursors fail SAFE by falling back to the caller's --since bootstrap value
// rather than crashing the whole digest over a damaged cursor file.
export function readCursor(cursorFile) {
  try {
    if (!existsSync(cursorFile)) return null;
    const raw = readFileSync(cursorFile, 'utf-8').trim();
    if (!raw) return null;
    const obj = JSON.parse(raw);
    return obj && typeof obj.since === 'string' ? obj.since : null;
  } catch {
    return null;
  }
}

export function writeCursor(cursorFile, since) {
  writeFileSync(cursorFile, JSON.stringify({ since, updated_at: new Date().toISOString() }, null, 2) + '\n', 'utf-8');
}

function parseArgs(argv) {
  const out = {
    file: 'data/decisions.jsonl',
    needsAttention: 'data/needs-attention.md',
    cursor: 'data/digest-cursor.json',
    since: null,
  };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--file' && argv[i + 1]) out.file = argv[++i];
    else if (argv[i] === '--needs-attention' && argv[i + 1]) out.needsAttention = argv[++i];
    else if (argv[i] === '--cursor' && argv[i + 1]) out.cursor = argv[++i];
    else if (argv[i] === '--since' && argv[i + 1]) out.since = argv[++i];
  }
  return out;
}

if (process.argv[1] && basename(process.argv[1]) === 'digest.mjs') {
  const { file, needsAttention, cursor, since: sinceFallback } = parseArgs(process.argv.slice(2));

  let lines;
  try {
    lines = readDecisionsFile(file);
  } catch (err) {
    // Finding: existsSync() only proves the file existed a moment ago, not
    // that it was readable. A raw throw here used to skip the heartbeat line
    // entirely and never reach the try/catch around the send — the exact
    // failure this task exists to prevent, just one step earlier.
    const heartbeat = {
      evaluated: 0, failed: 0, belowThreshold: 0, unparseable: 0, noTimestamp: 0,
      sendRequired: false, newestEvaluatedAt: null, readError: true,
    };
    console.log(`HEARTBEAT ${JSON.stringify(heartbeat)}`);
    const reason = `digest could not read decisions file '${file}': ${err.message}`;
    console.error(reason);
    appendNeedsAttention(needsAttention, {
      url: '', stage: 'digest-read', reason, at: new Date().toISOString(),
    });
    process.exit(1);
  }

  const persistedSince = readCursor(cursor);
  const since = persistedSince || sinceFallback || null;

  const { items, heartbeat } = selectDigest(lines, { minScore: 3.0, since });

  console.log(`HEARTBEAT ${JSON.stringify(heartbeat)}`);

  if (!heartbeat.sendRequired) {
    console.log('Nothing to send — this is a legitimately empty night, not a failure.');
    if (heartbeat.newestEvaluatedAt) {
      try { writeCursor(cursor, heartbeat.newestEvaluatedAt); }
      catch (err) { console.error(`digest: could not advance cursor: ${err.message}`); }
    }
    process.exit(0);
  }

  const body = renderDigest(items);

  // Send command is overridable ONLY for tests, mirroring run-nightly.ps1's
  // CAREEROPS_WORKER_CMD hook — never set these outside a test harness.
  // CAREEROPS_DIGEST_CMD replaces the executable (default 'gws'); optional
  // CAREEROPS_DIGEST_PREFIX_ARGS (a JSON array) is spliced in before the
  // normal args, e.g. to point a stub node script at itself:
  //   CAREEROPS_DIGEST_CMD=<path to node.exe>
  //   CAREEROPS_DIGEST_PREFIX_ARGS=["C:\\...\\stub.mjs"]
  // Kept off the shell (no `shell: true`) so subject/body — which can
  // contain arbitrary company/role text — are never interpreted as shell
  // syntax, in production or in tests.
  const digestCmd = process.env.CAREEROPS_DIGEST_CMD || 'gws';
  let prefixArgs = [];
  if (process.env.CAREEROPS_DIGEST_PREFIX_ARGS) {
    try {
      prefixArgs = JSON.parse(process.env.CAREEROPS_DIGEST_PREFIX_ARGS);
    } catch (err) {
      console.error(`digest: CAREEROPS_DIGEST_PREFIX_ARGS is not valid JSON: ${err.message}`);
      process.exit(1);
    }
  }

  try {
    execFileSync(digestCmd, [
      ...prefixArgs,
      'gmail-send', '--subject', `career-ops: ${items.length} result(s) >= 3.0`, '--body', body,
    ], { stdio: 'inherit' });
    console.log(`Sent ${items.length} result(s).`);
    if (heartbeat.newestEvaluatedAt) {
      try { writeCursor(cursor, heartbeat.newestEvaluatedAt); }
      catch (err) { console.error(`digest: could not advance cursor: ${err.message}`); }
    }
  } catch (err) {
    const reason = `digest send failed: ${err.message}`;
    console.error(reason);
    appendNeedsAttention(needsAttention, {
      url: '', stage: 'digest-send', reason, at: new Date().toISOString(),
    });
    // Cursor is deliberately NOT advanced here — these results must be
    // re-digested on the next run, not dropped.
    process.exit(1);
  }
}
