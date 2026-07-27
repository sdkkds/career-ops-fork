#!/usr/bin/env node
/**
 * archive-baseline.mjs — Phase 0: freeze the stale pipeline state as a QA
 * corpus and reset the live stores to empty-but-valid.
 *
 * Moves with the filesystem, NOT `git mv`: the sources are gitignored, so git
 * does not track them and `git mv` fails with "not under version control".
 * The destination under qa-fixtures/ is not covered by the root-anchored
 * ignore patterns, so a plain `git add qa-fixtures` commits the corpus.
 */
import {
  existsSync, mkdirSync, readdirSync, renameSync, copyFileSync,
  readFileSync, writeFileSync, statSync,
} from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

export const FIXTURE_DIR = 'qa-fixtures/2026-07-26-baseline';
export const PIPELINE_EMPTY = '# Pipeline — Pending Evaluations\n\n## Pendientes\n\n## Procesadas\n';

export function planMoves(root, vaultDecisions) {
  return [
    { kind: 'reports', from: join(root, 'reports'), to: join(root, FIXTURE_DIR, 'reports'), dir: true },
    { kind: 'applications', from: join(root, 'data/applications.md'), to: join(root, FIXTURE_DIR, 'applications.md'), dir: false },
    { kind: 'pipeline', from: join(root, 'data/pipeline.md'), to: join(root, FIXTURE_DIR, 'pipeline.md'), dir: false },
    { kind: 'quarantine', from: join(root, 'batch/tracker-additions-quarantine-2026-06-11'), to: join(root, FIXTURE_DIR, 'tracker-additions-quarantine-2026-06-11'), dir: true },
    { kind: 'decisions', from: vaultDecisions ?? join(root, 'data/decisions.jsonl'), to: join(root, FIXTURE_DIR, 'decisions.jsonl'), dir: false, copy: true },
  ];
}

function countAt(target, isDir) {
  if (!existsSync(target)) return 0;
  if (isDir) return readdirSync(target).filter(f => !f.startsWith('.')).length;
  return 1;
}

export function reconcile(before, after) {
  const gaps = [];
  for (const [k, v] of Object.entries(before)) {
    if (after[k] !== v) gaps.push(`${k}: expected ${v}, found ${after[k]}`);
  }
  return gaps.length ? { ok: false, detail: gaps.join('; ') } : { ok: true, detail: 'all counts reconciled' };
}

/** Keep the header block exactly as it was — v1.22 parses by header name. */
function trackerHeader(appsFile) {
  const fallback = '# Applications Tracker\n\n' +
    '| # | Date | Company | Role | Score | Status | PDF | Report | Notes |\n' +
    '|---|------|---------|------|-------|--------|-----|--------|-------|\n';
  if (!existsSync(appsFile)) return fallback;
  const lines = readFileSync(appsFile, 'utf-8').split('\n');
  const sep = lines.findIndex(l => /^\|[\s:-]+\|/.test(l));
  if (sep === -1) return fallback;
  return lines.slice(0, sep + 1).join('\n') + '\n';
}

function moveInto(from, to, isDir, copy) {
  mkdirSync(dirname(to), { recursive: true });
  if (isDir) {
    mkdirSync(to, { recursive: true });
    for (const f of readdirSync(from)) {
      if (f.startsWith('.')) continue;
      renameSync(join(from, f), join(to, f));
    }
  } else if (copy) {
    copyFileSync(from, to);
  } else {
    renameSync(from, to);
  }
}

export function runArchive({ root, vaultDecisions, dryRun = false, require: required = [] }) {
  const moves = planMoves(root, vaultDecisions);

  for (const kind of required) {
    const m = moves.find(x => x.kind === kind);
    if (!m || !existsSync(m.from)) {
      return { ok: false, detail: `required source missing: ${kind} (${m ? m.from : 'unplanned'})` };
    }
  }

  const before = {};
  for (const m of moves) before[m.kind] = countAt(m.from, m.dir);

  if (dryRun) {
    return { ok: true, detail: 'dry-run — nothing written', before, moves: moves.map(m => `${m.from} -> ${m.to}`) };
  }

  const header = trackerHeader(join(root, 'data/applications.md'));

  for (const m of moves) {
    if (!existsSync(m.from)) continue;
    moveInto(m.from, m.to, m.dir, m.copy);
  }

  const after = {};
  for (const m of moves) after[m.kind] = countAt(m.to, m.dir);

  const rec = reconcile(before, after);
  if (!rec.ok) return { ok: false, detail: `count reconciliation FAILED — ${rec.detail}`, before, after };

  mkdirSync(join(root, 'data'), { recursive: true });
  mkdirSync(join(root, 'reports'), { recursive: true });
  mkdirSync(join(root, 'batch/tracker-additions'), { recursive: true });
  writeFileSync(join(root, 'data/applications.md'), header, 'utf-8');
  writeFileSync(join(root, 'data/pipeline.md'), PIPELINE_EMPTY, 'utf-8');
  writeFileSync(join(root, 'data/decisions.jsonl'), '', 'utf-8'); // 0 bytes, no BOM
  writeFileSync(join(root, 'data/needs-attention.md'),
    '# Needs Attention\n\n| When | Stage | URL | Reason |\n|------|-------|-----|--------|\n', 'utf-8');

  return { ok: true, detail: rec.detail, before, after };
}

if (process.argv[1] && basename(process.argv[1]) === 'archive-baseline.mjs') {
  const root = dirname(fileURLToPath(import.meta.url));
  const vault = 'D:\\sunja\\projects\\personal\\Fortress of Solitude\\career-ops\\decisions.jsonl';
  const res = runArchive({
    root,
    vaultDecisions: existsSync(vault) ? vault : null,
    dryRun: process.argv.includes('--dry-run'),
  });
  console.log(JSON.stringify(res, null, 2));
  if (!res.ok) { console.error('ARCHIVE FAILED — stop here.'); process.exit(1); }
}
