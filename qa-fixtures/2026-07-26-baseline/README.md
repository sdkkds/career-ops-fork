# QA fixture corpus — career-ops baseline, 2026-07-26

Frozen snapshot of the pre-v1.22 pipeline state. **Read-only.** No pipeline code
writes here; only tests read from it.

| Path | What it is | Defects it exercises |
|---|---|---|
| `reports/` | ~210 eval reports, nums 1–212 with gaps | report 45 has no TSV; reports 78 and 164 have TSVs but no report file |
| `applications.md` | 43 tracker rows, never acted on | 9-column legacy schema, no URL column |
| `pipeline.md` | 293 pending / 2 done | a queue that never drained; all postings 6+ weeks expired |
| `decisions.jsonl` | 174 lines, 173 distinct `report_num` | `report_num` NOT unique — 204 appears twice; may carry a UTF-8 BOM |
| `tracker-additions-quarantine-2026-06-11/` | 168 TSVs covering reports 44–212 | 105 claim `num=44`; 117 are status SKIP; legacy 9-column schema |

Used by `tests/merge-tracker.url-dedup.test.mjs` and `tests/filter-precision.test.mjs`.
