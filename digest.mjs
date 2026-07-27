#!/usr/bin/env node
/**
 * digest.mjs — email the night's >= minScore results.
 *
 * A send failure must never look like a quiet night: the heartbeat is emitted
 * either way, and a failed send exits non-zero and lands in needs-attention.
 *
 * File path note: decisions.jsonl is written by run-nightly.ps1 to the vault
 * dir ($DecisionsLog), NOT to the project's data/decisions.jsonl (that file
 * exists as an empty placeholder for local/manual runs and tests). The
 * orchestrator MUST pass --file pointing at the real decisions log, or this
 * script will silently select nothing every night — exactly the failure
 * mode this task exists to prevent, just at the file-path layer instead of
 * the field-name layer.
 */
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { basename } from 'node:path';
import { appendNeedsAttention } from './lib/needs-attention.mjs';

export function selectDigest(lines, { minScore = 3.0, since = null } = {}) {
  const heartbeat = { evaluated: 0, failed: 0, belowThreshold: 0, unparseable: 0, sendRequired: false };
  const items = [];

  for (const line of lines) {
    if (!String(line).trim()) continue;
    let r;
    try { r = JSON.parse(String(line).replace(/^﻿/, '')); }
    catch { heartbeat.unparseable++; continue; }

    if (since && r.evaluated_at && r.evaluated_at < since) continue;
    heartbeat.evaluated++;

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

function parseArgs(argv) {
  const out = { file: 'data/decisions.jsonl', needsAttention: 'data/needs-attention.md', since: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--file' && argv[i + 1]) out.file = argv[++i];
    else if (argv[i] === '--needs-attention' && argv[i + 1]) out.needsAttention = argv[++i];
    else if (argv[i] === '--since' && argv[i + 1]) out.since = argv[++i];
  }
  return out;
}

if (process.argv[1] && basename(process.argv[1]) === 'digest.mjs') {
  const { file, needsAttention, since } = parseArgs(process.argv.slice(2));
  const lines = existsSync(file) ? readFileSync(file, 'utf-8').split('\n') : [];
  const { items, heartbeat } = selectDigest(lines, { minScore: 3.0, since });

  console.log(`HEARTBEAT ${JSON.stringify(heartbeat)}`);

  if (!heartbeat.sendRequired) {
    console.log('Nothing to send — this is a legitimately empty night, not a failure.');
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
  const prefixArgs = process.env.CAREEROPS_DIGEST_PREFIX_ARGS
    ? JSON.parse(process.env.CAREEROPS_DIGEST_PREFIX_ARGS) : [];

  try {
    execFileSync(digestCmd, [
      ...prefixArgs,
      'gmail-send', '--subject', `career-ops: ${items.length} result(s) >= 3.0`, '--body', body,
    ], { stdio: 'inherit' });
    console.log(`Sent ${items.length} result(s).`);
  } catch (err) {
    const reason = `digest send failed: ${err.message}`;
    console.error(reason);
    appendNeedsAttention(needsAttention, {
      url: '', stage: 'digest', reason, at: new Date().toISOString(),
    });
    process.exit(1);
  }
}
