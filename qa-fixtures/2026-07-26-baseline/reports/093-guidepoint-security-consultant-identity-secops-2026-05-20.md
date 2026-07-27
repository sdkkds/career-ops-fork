# Evaluación: GuidePoint Security — Security Consultant (Identity & SecOps)

**Fecha:** 2026-05-20
**Arquetipo:** Cybersecurity Consultant (practitioner variant) — hands-on Identity & SecOps engineering
**Score:** 1.5/5
**Legitimacy:** High Confidence
**URL:** https://boards.greenhouse.io/guidepointsecurity/jobs/5996104004?gh_jid=5996104004
**PDF:** N/A — SKIP (hard constraints triggered)
**Batch ID:** nightly-2026-05-20-7

---

## A) Resumen del Rol

| Campo | Detalle |
|-------|---------|
| **Arquetipo detectado** | Cybersecurity Consultant — hands-on practitioner (Identity & SecOps engineering) |
| **Domain** | Identity & Access Management, Microsoft Entra ID / Azure AD, M365 Security, SecOps |
| **Function** | Hands-on security consulting / technical implementation |
| **Seniority** | Mid-level (4+ years required; "Consultant" title — not Senior/Manager) |
| **Remote** | Remote — but **Mid-Atlantic states only**: NC, VA, MD, DC, WV, DE, PA, NJ |
| **Time Zone** | **Eastern Time Zone required** (explicitly stated) |
| **Team size** | Mid-Atlantic Security Consulting practice; collaborates across GuidePoint SecCon + SecOps teams |
| **Travel** | Not specified; application asks "how much travel are you open to?" |
| **TL;DR** | Hands-on Entra ID / M365 security consultant for Mid-Atlantic regional practice. Configure, harden, implement — not manage programs. Wrong geography, wrong timezone, wrong archetype for Sunjay. |

**HARD CONSTRAINTS TRIGGERED (2):**
1. **Location**: Mid-Atlantic states required (NC, VA, MD, DC, WV, DE, PA, NJ). Sunjay is in Seattle Metro, WA. Application form explicitly asks if candidate meets this requirement.
2. **Time Zone**: Eastern Time Zone required. Sunjay is Pacific Time.

---

## B) Match con CV

### Positives

| Requirement | CV Match | Source |
|-------------|----------|--------|
| CISSP (preferred cert) | "CISSP (Certified Information Systems Security Professional) | ISC² | 2015" | cv.md — Certifications |
| Azure experience | "24/7/365 operation building Azure Government infrastructure for Microsoft federal clients" | cv.md — Microsoft tenure (Lockheed/Leidos/Avanade/TCS/Mindtree) |
| Consulting / professional services background | "Managed two concurrent cloud migrations... for NCC Group's largest North American client (Fortune 10)" | cv.md — NCC Group |
| Managing parallel engagements | "Prepared client communications and organized cross-functional teams for multiple parallel penetration testing engagements" | cv.md — NCC Group |
| Technical documentation | "Authored and maintained technical and non-technical documentation for various end-users"; "Authored security SOPs, business continuity plans, team training playbooks" | cv.md — NCC Group + Microsoft |
| Written/verbal communication | Strong match across all roles — referenced in summary and every position | cv.md — Summary |
| Azure DevOps / TFS / tooling | "Tracked milestones, progress, dependencies, and issues in Azure DevOps" | cv.md — NCC Group |

### Gaps (Significant — Most Are Hard Technical Gaps)

| Gap | Severity | Mitigation Available? |
|-----|----------|-----------------------|
| **Entra ID / Azure AD hands-on configuration** | HARD BLOCKER | No — Sunjay managed Azure *infrastructure* (networking, NOC), not IAM configuration. These are distinct disciplines. |
| **IAM controls: MFA, Conditional Access, PIM, RBAC, SSO implementation** | HARD BLOCKER | No — not in CV, not adjacent in recent roles |
| **M365 security hardening** | HARD BLOCKER | No evidence in CV |
| **FIDO2 / passwordless authentication** | Hard gap | No |
| **ITDR, SIEM, SOC technology hands-on** | Hard gap | Sunjay was *incident manager* at Microsoft scale, not a SIEM/SOC engineer |
| **CrowdStrike, Okta, Duo, SailPoint, CyberArk** | Hard gap | None in CV |
| **SC-300, AZ-500, SC-100 certs** | Gap | Has CISSP (listed as preferred); AZ-specific certs not present |
| **Hands-on work "within customer environments"** | Moderate gap | NCC Group is closest but Sunjay was PM, not hands-on practitioner |
| **Eastern Time Zone** | HARD BLOCKER (non-technical) | No |
| **Mid-Atlantic state residency** | HARD BLOCKER (non-technical) | No — would require relocation |

### Summary Assessment

Even stripping the geographic/timezone blockers, the core role demands a **hands-on IAM practitioner** who configures Entra ID, implements Conditional Access policies, deploys FIDO2, and works inside customer environments to harden M365. Sunjay's Azure background is infrastructure/operations (networking, NOC, AzureGov), not identity and access management. The practitioner gap is wide — this role is looking for someone who *does the hands-on work*, not someone who *manages programs* around it.

**Match score: 1.5/5**

---

## C) Nivel y Estrategia

**Nivel detectado:** Mid-level practitioner consultant (4+ years required; "Security Consultant" is typically an IC practitioner title at GuidePoint — below Senior Consultant and Managing Consultant).

**Sunjay's natural level:** Senior/Director in program management, product ownership, or consulting engagement management.

**Observation:** This isn't a downlevel issue — it's an archetype mismatch. The role is for someone who *implements* IAM controls, *configures* security technologies, and *works hands-on inside customer environments*. Sunjay's competitive advantage (managing programs, stakeholder communication, PM discipline) is secondary-to-irrelevant for this role. Even if Sunjay were willing to take a practitioner step-back, the hands-on Entra ID / M365 / IAM technical skills are simply not in the CV.

**No viable framing strategy.** The blockers are structural (geography + timezone + practitioner skill gap), not positioning.

---

## D) Comp y Demanda

| Source | Data | Notes |
|--------|------|-------|
| Glassdoor — GuidePoint Security Consultant | ~$129,829/year average | Security Consultant generalist |
| Salary.com — GuidePoint AppSec Consultant (Remote) | $125K–$159K, avg $142K | Remote premium; AppSec is close analog |
| Levels.fyi — GuidePoint median total comp | $143,727 | All roles; Cybersecurity Analyst median $140K |
| EC-Council — Security Consultant market range | $110K–$150K | Industry benchmark |
| PlexTrac — Security Consultant range | $80K–$150K | Broad range |
| GuidePoint — IAM/SecOps Consultant estimated | $115K–$145K | Synthesized from above |

**Comp Score: 1.5/5** — Expected total comp ($115K–$145K) is **at or below the $150K floor**. The upper end of the range ($145K) barely clears the walk-away number and would require negotiating to the max of what GuidePoint typically pays this level. Midpoint ($125K–$130K) is well below target.

**Market demand for Identity consultants:** High. Entra ID / IAM skills are in strong demand as organizations migrate from on-prem AD to cloud identity. GuidePoint's Mid-Atlantic practice focus means geographic concentration creates supply constraints — hence the regional requirement.

**GuidePoint reputation on comp:** At-market to slightly above-market for mid-level cybersecurity consultants. Not FAANG, not boutique-premium, but not below-market either. The constraint here is *role level* (Consultant vs Senior/Managing Consultant) and comp floor mismatch.

---

## E) Plan de Personalización

**N/A — SKIP recommended.** Hard constraints (location + timezone + practitioner gap) make this role non-viable. No personalization planned.

For reference only: If Sunjay were geographically located in a Mid-Atlantic state AND had Entra ID hands-on experience, the CISSP cert and consulting background at NCC Group would be genuine differentiators.

---

## F) Plan de Entrevistas

**N/A — SKIP recommended.**

---

## G) Posting Legitimacy

**Assessment: High Confidence** — Real, active opening.

| Signal | Assessment | Notes |
|--------|-----------|-------|
| JD quality / specificity | ✅ High | Detailed technical requirements (Entra ID, Conditional Access, PIM, FIDO2, SIEM/ITDR); specific tech named; not boilerplate |
| Requirements realism | ✅ Realistic | 4+ years, specific certs listed as preferred not required; achievable profile |
| Salary transparency | ⚠️ Not disclosed | Application form asks "expected annual compensation" — common at consulting firms |
| Apply button active | ✅ Active | Confirmed via fetch — apply form fully functional |
| "New" badge on posting | ✅ Fresh | Posting tagged as "New" at time of fetch |
| Reposting pattern | ✅ No prior match | scan-history.tsv: GuidePoint prior entry was job ID 5852081004 (Director of Cybersecurity Advisory, 2026-04-18) — completely different role and job ID |
| Company hiring signals | ✅ No freeze concerns | GuidePoint actively hiring across multiple roles; stable private cybersecurity consultancy |
| Role-company fit | ✅ Strong | Identity & SecOps consulting is core GuidePoint practice; Mid-Atlantic focus aligns with their regional delivery model |

**Context:** GuidePoint Security is a well-established, privately-held pure-play cybersecurity consultancy with 1,000+ employees. They have a track record of active hiring and regional practice expansion. No layoff news. The Mid-Atlantic regional requirement is a consistent pattern in their consulting roles (same as the 2026-04-18 Director of Cybersecurity Advisory role which also had a regional restriction). This is a real, legitimate, active opening — it's just not viable for Sunjay.

**Verification note:** Apply button state and exact posting age not confirmed via Playwright (batch mode). Marked unverified per batch mode protocol. Posted content + "New" badge + active form strongly suggest freshness.

---

## Score Global

| Dimensión | Score | Notas |
|-----------|-------|-------|
| Match con CV | 1.5/5 | Azure infra background; CISSP match; but IAM practitioner gap is wide |
| Alineación North Star | 1.5/5 | Wrong archetype — practitioner consultant, not PM/PO/program leader |
| Comp | 1.5/5 | $115K–$145K expected; at or below $150K floor |
| Señales culturales | 3.0/5 | GuidePoint is a solid security firm; good reputation, stable |
| Red flags | -1.5 | Mid-Atlantic residency required + ET timezone required + practitioner gap |
| **Global** | **1.5/5** | |

**Recommendation: SKIP.** Two hard geographic/timezone blockers independent of skill fit. Even resolving those, the hands-on IAM practitioner requirement doesn't match Sunjay's PM/program management career trajectory.

**Monitor:** If GuidePoint posts a Security Program Manager or Engagement Manager role (especially remote-friendly), that would be worth evaluating — NCC Group + CISSP is a strong fit signal for their practice.

---

## Keywords extraídas

Microsoft Entra ID, Azure Active Directory, Identity & Access Management (IAM), Conditional Access, Multi-Factor Authentication (MFA), Privileged Identity Management (PIM), Role-Based Access Control (RBAC), Zero Trust, FIDO2, passwordless authentication, M365 security, Security Operations (SecOps), ITDR, SIEM, SOC, Microsoft Sentinel, CrowdStrike, SailPoint, CyberArk, security architecture review, CISSP, CCSP, AZ-500, SC-300
