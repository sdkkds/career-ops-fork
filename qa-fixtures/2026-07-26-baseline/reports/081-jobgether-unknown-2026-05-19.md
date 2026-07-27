# Evaluación: Jobgether (Aggregator) — Unknown Role

**Fecha:** 2026-05-19
**Arquetipo:** N/A — JD unavailable
**Score:** N/A
**Legitimacy:** Suspicious
**URL:** https://jobs.lever.co/jobgether/d62d95ac-6a09-44b3-977a-567907d42421
**PDF:** N/A
**Batch ID:** nightly-2026-05-19-5

---

## Status: Dead Posting — No Evaluable Content

Posting returned HTTP 404. Confirmed via:
1. `ctx_fetch_and_index` → HTTP 404
2. Playwright `browser_navigate` → "Not found – 404 error" (page title)
3. WebSearch → no cached version found; UUID not indexed anywhere

**Jobgether context:** Jobgether is a job aggregator that re-posts roles from actual employers through their Lever board (`jobs.lever.co/jobgether`). The actual employer and role title are unknown because the JD is no longer accessible. This matches the pattern seen in report [030](reports/030-jobgether-ciso-remote-2026-04-19.md) (also a dead Jobgether Lever posting).

**No evaluation produced.** Scoring, match analysis, PDF, and personalization plan require JD content.

---

## G) Posting Legitimacy

**Assessment: Suspicious**

| Signal | Value | Reliability |
|--------|-------|-------------|
| URL liveness | HTTP 404 | High |
| Playwright verification | "Not found – 404 error" | High |
| WebSearch cache | Not indexed | Medium |
| scan-history.tsv | Not previously seen | Medium |
| Jobgether aggregator pattern | Prior dead posting (report 030) | Low |

**Context Notes:**
- Jobgether aggregates third-party roles; when the source employer closes the listing, Jobgether's Lever entry also becomes unreachable
- No indication of fraud — simply an expired aggregated listing
- Cannot determine actual employer, role, or whether it was ever a strong match

**Recommendation:** Discard. No action possible without JD content.

---

## Keywords extraídas

None — JD unavailable.
