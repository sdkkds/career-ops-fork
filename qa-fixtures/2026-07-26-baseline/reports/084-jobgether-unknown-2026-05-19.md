# Evaluación: Jobgether (Aggregator) — Unknown Role

**Fecha:** 2026-05-19
**Arquetipo:** N/A — contenido inaccesible
**Score:** N/A
**Legitimacy:** Suspicious
**URL:** https://jobs.lever.co/jobgether/82b93bc0-e2a2-4149-8763-c84449743758
**Verification:** Unconfirmed (batch mode) — URL confirmed 404 via Lever page + Lever API
**PDF:** N/A
**Batch ID:** nightly-2026-05-19-8

---

## G) Posting Legitimacy

**Assessment: Suspicious — Confirmed Dead**

| Signal | Value | Weight |
|--------|-------|--------|
| Lever job page | HTTP 404 | High negative |
| Lever API (`/v0/postings/jobgether/{id}`) | HTTP 404 | High negative |
| Actual employer | Unknown (Jobgether is an aggregator) | High negative |
| Scan history prior appearance | Not found | Neutral |
| Posting freshness | Unverified (batch mode) | N/A |
| JD content available | None | N/A |

**Context Notes:**
- Jobgether posts jobs on behalf of partner companies using Lever as ATS. The actual employer is unknown — the Lever posting was the only source.
- Both the public job page and the Lever API v0 endpoint returned HTTP 404, meaning the posting is deleted or expired server-side.
- A prior Jobgether Lever posting evaluated 2026-04-19 (entry #30, report 030) had the same outcome — "Posting 404'd; actual employer unknown (aggregator); zero evaluable content; confirmed dead."
- This is consistent with scan-history patterns: multiple Jobgether Lever URLs tagged `skipped_expired` in recent scans (2026-05-14, 2026-05-15).
- **No evaluation possible.** Zero JD content to analyze.

---

## Summary

Posting confirmed dead before any content could be retrieved. No company name, role title, requirements, or salary data available. Jobgether is a remote job aggregator — the underlying employer is unknown. Discarded.

**Recommendation:** No action. Monitor Jobgether aggregator reliability — high expiry rate observed in scan history.
