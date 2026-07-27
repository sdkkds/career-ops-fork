import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { appendNeedsAttention } from '../lib/needs-attention.mjs';

test('creates the file with a header on first append', () => {
  const f = join(mkdtempSync(join(tmpdir(), 'na-')), 'needs-attention.md');
  appendNeedsAttention(f, { url: 'https://x.test/j/1', stage: 'eval', reason: 'no JSON in worker output', at: '2026-07-26 06:10' });
  assert.ok(existsSync(f));
  const text = readFileSync(f, 'utf-8');
  assert.match(text, /^# Needs Attention/);
  assert.match(text, /no JSON in worker output/);
});

test('appends without clobbering earlier entries', () => {
  const f = join(mkdtempSync(join(tmpdir(), 'na-')), 'needs-attention.md');
  appendNeedsAttention(f, { url: 'https://x.test/j/1', stage: 'eval', reason: 'a', at: 't1' });
  appendNeedsAttention(f, { url: 'https://x.test/j/2', stage: 'merge', reason: 'b', at: 't2' });
  const text = readFileSync(f, 'utf-8');
  assert.match(text, /j\/1/);
  assert.match(text, /j\/2/);
  assert.equal((text.match(/^# Needs Attention/gm) || []).length, 1);
});

test('sanitizes pipes so the table cannot column-shift', () => {
  const f = join(mkdtempSync(join(tmpdir(), 'na-')), 'needs-attention.md');
  appendNeedsAttention(f, { url: 'https://x.test/j/1', stage: 'eval', reason: 'boom | crash', at: 't' });
  const row = readFileSync(f, 'utf-8').trim().split('\n').pop();
  assert.equal(row.split('|').length - 1, 5);
});
