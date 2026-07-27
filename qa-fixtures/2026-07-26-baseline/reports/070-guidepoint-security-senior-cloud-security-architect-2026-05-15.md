# Evaluation: GuidePoint Security — Senior Cloud Security Architect

**Date:** 2026-05-15
**Archetype:** Security Solutions Architect (adjacent — not primary target)
**Score:** 1.0/5
**Legitimacy:** High Confidence
**URL:** https://job-boards.greenhouse.io/guidepointsecurity/jobs/5993640004
**PDF:** N/A — SKIP (hard blockers triggered)
**Batch ID:** nightly-2026-05-15-5

> **SKIP — Two hard blockers: (1) active security clearance required for classified information access; (2) primary technical qualifications are coding-first (Python/Go/Bash + Terraform). Role is adjacent archetype with deep technical gaps. Do not apply.**

---

## A) Role Summary

| Field | Value |
|-------|-------|
| Archetype | Security Solutions Architect (adjacent) |
| Domain | Multi-cloud security architecture (AWS / Azure / GCP) |
| Function | Internal — design/own GuidePoint's Zero Trust, cloud posture, AI/ML security program |
| Seniority | Senior IC / Lead Architect |
| Remote | Remote-preferred; NC / VA / MN candidates given preference; non-local considered for "highly qualified" |
| Team size | Not stated |
| Company | GuidePoint Security — private cybersecurity VAR/consulting firm, ~875 employees, founded 2011, Herndon VA; profitable, fast-growing |
| Clearance | **Active clearance process required; "sensitive clearance" required for continuation; security investigation and eligibility for access to classified information** |
| TL;DR | Hands-on cloud security architect to own GuidePoint's internal cloud security program: Zero Trust design, policy-as-code (Terraform), CNAPP/CSPM, AI/ML pipeline security, SOC2. Requires Python/Go/Bash coding proficiency. Federal contract clearance provisions attached. Two hard blockers; adjacent to primary archetypes. |

---

## B) Match with CV

### Requirements Map

| JD Requirement | Match Level | CV Evidence |
|----------------|-------------|-------------|
| Zero Trust architecture design (IAM, micro-segmentation, encryption across AWS/Azure/GCP) | Partial | cv.md: AzureGov infrastructure build; no multi-cloud Zero Trust design ownership stated |
| AI-Native Security: LLM/AI pipeline security, data privacy, model integrity | Weak | cv.md: no AI/ML security architecture experience |
| Policy as Code / Terraform / automated guardrails | None | cv.md: no Terraform or policy-as-code; IaC not mentioned |
| CNAPP / CSPM tools design and integration | None | cv.md: not mentioned |
| Threat modeling for cloud-native systems, APT simulation | Partial | cv.md: security incident management at Microsoft scale; NCC Group pen test coordination; no dedicated threat modeling ownership |
| Identity-First Security: CIEM, JIT access, OIDC/SAML expert | None | cv.md: Active Directory (on-prem/cloud) mentioned; no CIEM/JIT/OIDC listed |
| Python / Go / Bash proficiency (security automations, SOAR integration) | None | cv.md: no scripting/coding experience listed |
| CNAPP / CSPM tooling (NIST, CIS Benchmarks, automated auditing) | None | cv.md: not mentioned |
| SOC2 compliance advisory | Partial | cv.md: compliance adjacent (CJIS/DoD environments, AzureGov); no SOC2 direct experience |
| CISSP | Strong | cv.md: CISSP (ISC²) 2015 — direct match |
| Cloud experience (Azure) | Partial | cv.md: AzureGov infrastructure build at Microsoft (9 years); not architect-level cloud security design |
| US Citizen | Strong | Profile: US Citizen |
| Active security clearance eligibility | Strong | Meets citizenship/residency requirements |

### Gaps and Hard Blockers

| Gap | Severity | Notes |
|-----|----------|-------|
| **Active clearance required** | **HARD BLOCKER** | "Applicants selected will be subject to a security investigation and must meet eligibility requirements for access to classified information." Continuation of employment contingent on receiving a sensitive clearance. Per _profile.md: active clearance required = score 1.0, reject. |
| **Coding-primary qualifications** | **HARD BLOCKER (borderline)** | "Proficiency in Python, Go, or Bash" is listed as a core Technical Qualification, not a nice-to-have. SOAR integration, security automations. Sunjay reads code but does not write it. For an architect role this borders on SWE-primary. |
| Terraform / Policy as Code | Critical gap | No IaC experience in CV. Core responsibility, not optional. |
| CIEM / JIT / OIDC / SAML expert | Critical gap | Identity-First Security listed as first Technical Qualification. No evidence in CV. |
| CNAPP / CSPM tools | Critical gap | Core responsibility (design + integrate). Not mentioned in CV or certifications. |
| Zero Trust architecture ownership | Significant gap | Sunjay has infrastructure-operations background; architect-as-designer-of-ZTA is different from operator in a ZTA environment. |
| AI/ML pipeline security | Significant gap | Emerging area; no evidence in CV or certifications. |
| Threat modeling (formal methodology) | Partial | Incident management is adjacent but not the same as proactive threat modeling. |

---

## C) Level and Strategy

**Detected level:** Senior IC Architect / Lead — individual contributor with strategic ownership, no team management stated.

**Candidate's natural level:** Senior Program Manager / Product Owner with deep operational security background. The operational-to-architect jump is significant: this role requires designing security systems from scratch, not managing programs that use them.

**Framing if pursuing (hypothetical — not recommended):**
- Lead with AzureGov infrastructure depth as practical cloud security foundation
- CISSP as architectural credibility signal
- NCC Group pen test coordination as threat-awareness proof point
- Frame Microsoft incident management as real-world threat modeling at scale

**Reality check:** Even with optimal framing, the Terraform / Python / CIEM gaps are screening-level disqualifiers for a technical interview process. The clearance requirement is a separate, independent hard block.

---

## D) Comp and Demand

**No salary posted.** GuidePoint is private — no public compensation filings.

**Market data for Senior Cloud Security Architect (2025-2026, US, cybersecurity consulting firms):**

| Source | Range |
|--------|-------|
| Glassdoor — Senior Cloud Security Architect (US avg) | ~$206K total |
| Levels.fyi — Cloud Security Architect median (US) | ~$203K total |
| Cybersecurity consulting firm typical band (GuidePoint/Optiv/Presidio tier) | $175K–$230K total ($155–$195K base + 10–20% bonus) |
| Upper end (high-cost metro / principal-track) | $230K–$280K total |

*Sources: Glassdoor glassdoor.com/Salaries/senior-cloud-security-architect; Levels.fyi levels.fyi/t/solution-architect/title/security-architect; unihackers.com/blog/cybersecurity-salary-guide-2026*

**Comp score: 3/5** — Market range meets the $150K floor and potentially reaches $200K+, but no posted range, private company, and federal-contract nature of the role (with clearance provisions) introduces downward pressure in some markets.

**Company health signals:** GuidePoint published a 2026 ransomware threat report (January 2026) — active research output. No layoff or hiring freeze signals found. ~875 employees as of early 2026. Profitable, private. No red flags.

---

## E) Personalization Plan

*Not applicable — SKIP recommendation. No CV tailoring warranted for a role with active clearance requirement and coding-primary technical gaps that cannot be bridged.*

If pursuing despite recommendation:
- Top 5 CV changes would be: (1) foreground AzureGov security architecture aspects of Microsoft tenure, (2) add any IaC/automation adjacent work, (3) expand CJIS/DoD compliance exposure, (4) reframe NCC Group as security architecture advisory, (5) add any Python scripting exposure from current role.

---

## F) Interview Prep

*Not applicable — SKIP.*

---

## G) Posting Legitimacy

**Assessment: High Confidence (posting is real and active)**

| Signal | Status | Notes |
|--------|--------|-------|
| Apply button | Active (unverified — batch mode) | Greenhouse form fully rendered with all fields |
| JD specificity | High | Detailed responsibilities, named tech stack (Terraform, CNAPP/CSPM, CIEM, SOAR, OIDC/SAML), named compliance frameworks (NIST, CIS, SOC2). Not boilerplate. |
| Requirements realism | High | Technically specific, internally consistent, appropriate for senior architect. |
| Salary transparency | None | No range posted. Typical for GuidePoint — none of their public postings show salary. |
| Company health | Clean | Active research output (Jan 2026 ransomware report), ~875 employees, profitable. No freeze/layoff signals. |
| Reposting pattern | Not checked | No prior GuidePoint Cloud Security Architect entries in recent scan history. (Previous GuidePoint entry #009 was Director of Cybersecurity Advisory — different role.) |
| Federal contract language | Present | Additional Provisions section with clearance, drug screening, dress code = standard federal contract boilerplate appended to GuidePoint postings with federal client work. Confirms this role will involve federal client infrastructure access. |

**Context notes:** The "REMOTE" framing in the title is accurate but qualified — preference for NC/VA/MN candidates (GuidePoint office locations), non-local considered. The clearance provisions are embedded in the main job posting, not a separate federal job family — this is intentional and role-specific, not boilerplate that was accidentally attached.

---

## Keywords Extracted

Cloud Security Architecture, Zero Trust, Identity-First Security, CIEM, JIT Access, OIDC, SAML, AWS, Azure, GCP, Terraform, Policy as Code, CNAPP, CSPM, Threat Modeling, SOAR, Python, AI/ML Security, SOC2, NIST, CIS Benchmarks, Security as Code, Multi-cloud, APT, Blast Radius Analysis

---

## Score Summary

| Dimension | Score | Notes |
|-----------|-------|-------|
| Match with CV | 1.0/5 | Clearance hard blocker; coding-primary gap; adjacent archetype only |
| North Star alignment | 1.5/5 | "Security Solutions Architect" is adjacent, not primary target |
| Comp | 3.0/5 | Market rate meets floor; no posted range; private company |
| Cultural signals | 3.5/5 | Solid firm, good culture signals, fast-growing, profitable |
| Red flags | -2.0 | Active clearance requirement; coding-primary qualifications |
| **Global** | **1.0/5** | Hard blocker applied per profile constraints |
