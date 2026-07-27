/**
 * lib/needs-attention.mjs — durable, append-only record of anything the
 * pipeline refused to record as success. Never overwritten (unlike
 * morning-review.md, which is rewritten nightly).
 */
import { appendFileSync, existsSync, writeFileSync } from 'node:fs';

export const NEEDS_ATTENTION_HEADER =
  '# Needs Attention\n\n' +
  'Rows land here when the pipeline could not prove success. Nothing here is in the tracker.\n\n' +
  '| When | Stage | URL | Reason |\n|------|-------|-----|--------|\n';

const clean = v => String(v ?? '').replace(/[\t\r\n]+/g, ' ').replace(/\|/g, '/').trim();

export function appendNeedsAttention(file, { url, stage, reason, at }) {
  if (!existsSync(file)) writeFileSync(file, NEEDS_ATTENTION_HEADER, 'utf-8');
  appendFileSync(file, `| ${clean(at)} | ${clean(stage)} | ${clean(url)} | ${clean(reason)} |\n`, 'utf-8');
}
