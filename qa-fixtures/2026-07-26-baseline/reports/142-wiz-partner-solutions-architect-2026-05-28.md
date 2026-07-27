# Evaluación: Wiz — Partner Solutions Architect

**Fecha:** 2026-05-28
**Arquetipo:** N/A (Sales Engineering / Partner Channel — no target archetype)
**Score:** 1.0/5
**Legitimacy:** Suspicious
**URL:** https://www.wiz.io/careers/job/4671775006/:title?gh_jid=4671775006
**PDF:** ❌ (SKIP — not evaluated for application)
**Batch ID:** nightly-2026-05-28-7

> **⚠️ PIPELINE ANOMALY:** The URL provided had an unfilled `:title` placeholder (batch input artifact). The primary Greenhouse URL (job-boards.greenhouse.io/wiz/jobs/4671775006) returned HTTP 404. The alternate Greenhouse board (boards.greenhouse.io/wizinc/jobs/4671775006) resolved to "Partner Solutions Architect | Remote - Spain | SE" — a geographically blocked, wrong-function role. This posting is **not evaluable for application** and is flagged for immediate discard.

---

## A) Resumen del Rol

| Campo | Valor |
|-------|-------|
| **Arquetipo detectado** | AI Solutions Architect (adjacent) / Pre-Sales SE — neither matches candidate archetypes |
| **Domain** | Cloud Security / Partner Channel |
| **Function** | Sales Engineering (SE) — partner-facing pre-sales |
| **Seniority** | Mid-Senior IC (individual contributor) |
| **Remote** | Remote — Spain only |
| **Team** | Reports to Senior Manager, Partner Solutions Architecture |
| **TL;DR** | Channel/partner SE role at Wiz (now Google Cloud subsidiary). Supports Global Channel Resellers/Partners with technical demos, enablement, and cloud security advisory across AWS/Azure/GCP. Requires legal right to work in Spain. No US applicants. |

**Company context:** Wiz was acquired by Google for $32B; acquisition closed March 11, 2026. Wiz now operates as a Google Cloud subsidiary. Post-acquisition headcount and hiring plans are in flux — $1.5B in retention bonuses suggests stability for existing staff, but new headcount approvals may be subject to Google's internal processes.

---

## B) Match con CV

### Hard Blocks (immediate discard criteria)

| Constraint | Status | Detail |
|-----------|--------|--------|
| **Geography** | ❌ HARD BLOCK | Spain only; requires legal right to work in Spain |
| **Work Authorization** | ❌ HARD BLOCK | "Applicants must have legal right to work in country where position is based, without visa sponsorship" |
| **Function** | ❌ HARD BLOCK | Partner SE / pre-sales technical role; Sunjay targets program management, product ownership, security operations leadership |
| **Language** | ❌ LIKELY BLOCK | Spain-based role likely requires Spanish fluency for partner interactions |

### Requirements vs CV (for completeness)

| JD Requirement | CV Match | Quality |
|----------------|----------|---------|
| Deep expertise building/delivering technical results with partners | Partial — NCC Group Fortune 10/200 client technical delivery, but B2B consulting not channel SE | Weak |
| World-class demo and training experience to partners | Partial — Freelance consultant, technical training experience | Weak |
| Experience with CSPM tools | None documented in cv.md | Gap |
| SaaS selling experience | None — Sunjay has no sales function experience | Gap |
| CSP certifications (AWS, Azure, GCP) | AWS Cloud Practitioner only (associate level); no Azure or GCP certifications | Gap |
| Knowledge of risk-based security assessments | Strong — penetration testing program management, CISSP, vulnerability management | Match |
| Technical sales / pre-sales experience | None — no commercial sales cycle experience documented | Gap |

**Gap summary:** Even ignoring hard geo/work-auth blocks, the function gap (sales engineering vs program management) is fundamental and unbridgeable. Sunjay has zero commercial sales cycle experience, no partner channel background, no CSPM tool hands-on experience, and no SaaS selling background. This is not an adjacent role — it's a different career track.

---

## C) Nivel y Estrategia

Not applicable — this is a SKIP. Even if geo constraints were waived, the function mismatch precludes application.

**Candidate's natural level:** Senior / Principal Program Manager, Product Owner (cybersecurity)
**This role's level:** Mid-Senior IC Sales Engineer (partner channel)

These are different career ladders. No framing strategy can bridge the gap.

---

## D) Comp y Demanda

**No salary disclosed.** Spain-based roles at Wiz would follow European (Spanish) compensation norms, which are significantly below Sunjay's $150K USD floor:

- Spanish SE/SA salaries typically range €50K–€90K base for this level
- Even at the top end, €90K ≈ $97K USD — well below the $150K minimum
- Post-Google-acquisition comp adjustments unknown but unlikely to reach US market rates for a Spain-based role

**Comp score: 1/5** — hard floor miss even before geographic constraints.

**Market demand for Partner SA at Wiz (post-acquisition):**
- Wiz continues hiring globally under Google Cloud
- Partner/channel roles remain active per wiz.io/careers
- Spain-based roles serve the EMEA partner ecosystem
- No hiring freeze signals detected for this function

---

## E) Plan de Personalización

Not applicable — SKIP. No CV customization or LinkedIn changes recommended for this role.

---

## F) Plan de Entrevistas

Not applicable — SKIP.

---

## G) Posting Legitimacy

**Assessment: Suspicious**

> Note: Posting freshness is partially unverified (batch mode). Playwright not available.

| Signal | Status | Notes |
|--------|--------|-------|
| Primary URL liveness | ❌ Dead | `job-boards.greenhouse.io/wiz/jobs/4671775006` → HTTP 404 |
| Alternate board | ⚠️ Redirected | `boards.greenhouse.io/wizinc/jobs/4671775006` resolves to a DIFFERENT role/board than expected |
| URL template integrity | ❌ Broken | URL had unfilled `:title` placeholder — batch processing artifact, possible wrong job ID |
| Job description quality | N/A | Alternate-board JD is complete but for wrong role (Spain SE) |
| Salary transparency | ❌ None | No salary range disclosed |
| Company hiring signals | ⚠️ Mixed | Google acquisition closed Mar 2026; Wiz continues posting jobs but headcount uncertainty post-M&A |
| Reposting history | ✅ No prior appearances | Not in scan-history.tsv |
| Previous Wiz evaluations | ℹ️ One prior | #023 Wiz Technical Writer (SKIP) — Israel-based, Hebrew required, unrelated role |

**Context Notes:**
1. The batch input URL `https://www.wiz.io/careers/job/4671775006/:title?gh_jid=4671775006` has a literal `:title` placeholder that was not substituted — this is a data quality issue in the batch input (pipeline.md or batch-input.tsv), not a Wiz problem.
2. The job ID 4671775006 resolves to a Spain-based Partner Solutions Architect on the `wizinc` Greenhouse org — this is a non-US role with work authorization requirements that automatically disqualify a US-based candidate.
3. The primary Wiz Greenhouse org (`wiz`, not `wizinc`) returns 404 for this job ID, suggesting the posting was removed from the primary board.
4. Post-acquisition (Wiz → Google Cloud, March 2026), it's possible some legacy job IDs from the pre-acquisition Greenhouse org are no longer active.

**Recommendation:** Flag pipeline.md / batch-input.tsv entry for this job ID as a data quality issue. No action on the role itself.

---

## Score Global

| Dimensión | Score |
|-----------|-------|
| Match con CV | 0.5/5 |
| Alineación North Star | 0.5/5 |
| Comp | 1.0/5 |
| Señales culturales | 1.5/5 |
| Red flags | -1.0 (geo hard block, work auth, 404 primary URL, function mismatch) |
| **Global** | **1.0/5** |

---

## Keywords extraídas

Partner Solutions Architect, CSPM, cloud security, AWS, Azure, GCP, channel resellers, partner enablement, pre-sales, SaaS selling, CSP certifications, technical sales, partner strategy, cloud security posture management, security advisory, risk-based assessments, channel partners, solution architecture, Google Cloud
