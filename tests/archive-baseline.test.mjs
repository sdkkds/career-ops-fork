import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { planMoves, reconcile, runArchive } from '../archive-baseline.mjs';

const HEADER = '# Applications Tracker\n\n' +
  '| # | Date | Company | Role | Score | Status | PDF | Report | Notes |\n' +
  '|---|------|---------|------|-------|--------|-----|--------|-------|\n';

function makeRepo() {
  const root = mkdtempSync(join(tmpdir(), 'careerops-'));
  mkdirSync(join(root, 'reports'), { recursive: true });
  mkdirSync(join(root, 'data'), { recursive: true });
  mkdirSync(join(root, 'batch/tracker-additions-quarantine-2026-06-11'), { recursive: true });
  writeFileSync(join(root, 'reports/001-acme-2026-01-01.md'), '# report');
  writeFileSync(join(root, 'reports/002-acme-2026-01-02.md'), '# report');
  writeFileSync(join(root, 'data/applications.md'), HEADER + '| 1 | 2026-01-01 | Acme | PM | 4.0/5 | Evaluated | ✅ | [001](reports/001-acme-2026-01-01.md) | n |\n');
  writeFileSync(join(root, 'data/pipeline.md'), '# Pipeline\n\n## Pendientes\n\n- [ ] https://x.test/j/1 | Acme | PM\n');
  writeFileSync(join(root, 'batch/tracker-additions-quarantine-2026-06-11/044-a.tsv'), '44\t2026-01-01\tA\tB\tEvaluated\t4.0/5\t✅\t[044](reports/044-a.md)\tnote');
  return root;
}

test('planMoves covers every store that must be archived', () => {
  const root = makeRepo();
  const kinds = planMoves(root, join(root, 'decisions.jsonl')).map(m => m.kind).sort();
  assert.deepEqual(kinds, ['applications', 'decisions', 'pipeline', 'quarantine', 'reports']);
});

test('runArchive moves everything and leaves live stores empty-but-valid', () => {
  const root = makeRepo();
  const res = runArchive({ root, vaultDecisions: null, dryRun: false });
  assert.equal(res.ok, true, res.detail);
  const base = join(root, 'qa-fixtures/2026-07-26-baseline');
  assert.ok(existsSync(join(base, 'reports/001-acme-2026-01-01.md')));
  assert.ok(existsSync(join(base, 'applications.md')));
  assert.ok(existsSync(join(base, 'tracker-additions-quarantine-2026-06-11/044-a.tsv')));
  assert.equal(readFileSync(join(root, 'data/applications.md'), 'utf-8'), HEADER);
  assert.equal(readFileSync(join(root, 'data/decisions.jsonl'), 'utf-8'), '');
  assert.match(readFileSync(join(root, 'data/pipeline.md'), 'utf-8'), /## Pendientes/);
  assert.doesNotMatch(readFileSync(join(root, 'data/pipeline.md'), 'utf-8'), /x\.test/);
});

test('the reset tracker preserves the header that was actually in use', () => {
  const root = makeRepo();
  const custom = '# Applications Tracker\n\n| # | Date | Company | Role | Score | Status | PDF | Report | URL | Notes |\n|---|---|---|---|---|---|---|---|---|---|\n';
  writeFileSync(join(root, 'data/applications.md'), custom + '| 1 | a | b | c | 1/5 | Evaluated | ✅ | x | y | z |\n');
  runArchive({ root, vaultDecisions: null, dryRun: false });
  assert.equal(readFileSync(join(root, 'data/applications.md'), 'utf-8'), custom);
});

test('dry-run writes nothing', () => {
  const root = makeRepo();
  const res = runArchive({ root, vaultDecisions: null, dryRun: true });
  assert.equal(res.ok, true);
  assert.ok(existsSync(join(root, 'reports/001-acme-2026-01-01.md')), 'source still in place');
  assert.equal(existsSync(join(root, 'qa-fixtures/2026-07-26-baseline')), false);
});

test('reconcile fails on a count gap', () => {
  assert.equal(reconcile({ reports: 2 }, { reports: 2 }).ok, true);
  const bad = reconcile({ reports: 2 }, { reports: 1 });
  assert.equal(bad.ok, false);
  assert.match(bad.detail, /reports/);
});

test('a missing required source aborts the phase (forced failure)', () => {
  const root = makeRepo();
  const res = runArchive({ root, vaultDecisions: join(root, 'nope.jsonl'), dryRun: false, require: ['decisions'] });
  assert.equal(res.ok, false);
  assert.match(res.detail, /decisions/);
});
