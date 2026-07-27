# Evaluación: Wiz — Cloud Security Research Engineer

**Fecha:** 2026-05-29
**Arquetipo:** Security Solutions Architect / Cloud Security Architect (adjacent — but practitioner engineer role, not architecture/management)
**Score:** 1.5/5
**Legitimacy:** High Confidence
**URL:** https://www.wiz.io/careers/job/4626498006/cloud-security-research-engineer
**PDF:** ❌ (not generated — SKIP; geographic and role-type hard blockers)
**Batch ID:** nightly-2026-05-29-6

---

## A) Resumen del Rol

| Campo | Detalle |
|-------|---------|
| **Empresa** | Wiz (acquired by Google, Feb 2026, $32B) |
| **Rol** | Cloud Security Research Engineer |
| **Arquetipo detectado** | Hands-on Security Researcher / Cloud Security IC Engineer (practitioner, not management) |
| **Domain** | Cloud Security — Research & Detection Engineering |
| **Function** | Individual Contributor — security research, detection algorithms, CSP API analysis |
| **Seniority** | Mid–Senior IC (no explicit level stated) |
| **Ubicación** | **London, UK** — ONSITE/LOCAL ⛔ |
| **Remote** | Not stated as remote; posted under London, UK |
| **Equipo** | Product team (Research + Backend collaboration) |
| **Salario** | Not disclosed; London market estimate £70K–£125K (~$90K–$160K USD) |
| **TL;DR** | Hands-on coding security researcher role at Wiz London. Builds detection mechanisms in Python/Go, analyzes CSP attack surfaces, ships PoCs to production. Wrong country, wrong role type, wrong tech stack for this candidate. Hard SKIP. |

---

## B) Match con CV

### Requisitos del JD → Mapeo al CV

| Requisito JD | En CV? | Línea / Evidencia | Valoración |
|---|---|---|---|
| Advanced Python + Go coding | ❌ NO | cv.md: No coding proficiency listed. CLAUDE.md: "not a programmer by trade — reads code across many languages, does not write fluently." | **HARD BLOCKER** |
| Docker, Kubernetes, Linux/Windows internals | ❌ NO | cv.md Skills: no container/K8s experience listed | **HARD BLOCKER** |
| IaC (Terraform/CloudFormation) | ❌ NO | No IaC tools in Skills section | **HARD BLOCKER** |
| CI/CD pipelines (CircleCI/GitHub Actions) | ❌ PARTIAL | Azure DevOps listed in Skills but as PM tooling, not CI/CD engineering | Weak adjacent |
| OSI model, networking (VPC peering, Subnets, IAM) | ✅ PARTIAL | cv.md: Network+ cert; AzureGov experience includes networking concepts; 9 years managing network engineers | Functional familiarity, not hands-on research depth |
| CSP API analysis (AWS, Azure, GCP, OCI) | ❌ NO | cv.md: Azure commercial + AzureGov operational experience; AWS Cloud Practitioner cert — but operational, not API exploitation research | Conceptual, not research-grade |
| Cybersecurity frameworks | ✅ YES | cv.md: CISSP; vulnerability management; penetration testing program management; security incident response | Strong domain foundation |
| Attack surface identification mindset | ✅ PARTIAL | cv.md: Penetration testing program management at Fortune 10/200; security remediation verification (NCC Group) — program side, not hands-on technical research | Adjacent but not direct |
| Security research + detection algorithms | ❌ NO | No research engineering background; no published security research | Gap |
| Explain technical risks to engineers + stakeholders | ✅ YES | cv.md Summary: "equally effective with engineers, executives, and non-technical audiences"; SOPs, training playbooks, executive comms | Direct match |
| Self-motivated, collaborative | ✅ YES | cv.md: bi-coastal distributed team leadership, concurrent engagements | Demonstrated |
| Located in / able to work in London | ❌ NO | profile.yml: "Remote only — Seattle Metro Area, Pacific Time"; "No sponsorship needed" (implying US-based) | **HARD BLOCKER** |

### Gap Analysis

| Gap | Type | Mitigation? |
|-----|------|-------------|
| Python + Go advanced coding | **Hard blocker** | No — candidate does not code at this level. Not bridgeable for this role. |
| Docker / Kubernetes / IaC | **Hard blocker** | No — no hands-on container/IaC experience. |
| London location requirement | **Hard blocker** | No — candidate is US-based, remote-only Seattle. No relocation intent. |
| Security research / detection engineering | **Hard blocker** | No — candidate is PM/PO track, not IC researcher track. This is a career change, not a stretch. |
| CSP API exploitation depth | Hard gap | Could demonstrate conceptual AzureGov knowledge, but not research-grade API analysis. |

**4 of 5 hard blockers are unbridgeable.** This role is a practitioner engineering position that requires a software engineering background with security research specialization — fundamentally different from a security program manager / product owner profile.

---

## C) Nivel y Estrategia

### Nivel detectado vs. candidato

| Dimensión | JD | Candidato |
|---|---|---|
| Track | IC Engineer / Researcher | Manager / Program Manager / Product Owner |
| Coding expectation | Advanced Python + Go (required) | None (reads code; does not write fluently) |
| Security depth | Hands-on attack surface research, detection engineering | Program-level: coordination, oversight, stakeholder management |
| Natural level | Mid-Senior IC Engineer | Senior/Principal Program Manager or Director |

### "Vender senior sin mentir" — N/A

This is not an adjustment in framing or seniority positioning. The gap is structural:
- **Role type mismatch:** IC researcher vs. PM/PO
- **Technical requirements:** Require proficiency Sunjay doesn't have and isn't acquiring
- There is no framing strategy that bridges this honestly

### "Si me downlevelan" — N/A

Not applicable. The recommendation is **do not apply**.

---

## D) Comp y Demanda

| Fuente | Data | Rango |
|--------|------|-------|
| London market — Security Researcher | Glassdoor UK/Erieri | £77,560 avg England; ~£85-95K London premium |
| London market — Cloud Security Engineer | Glassdoor UK | £62K UK avg; London +15-20% premium |
| Wiz — no salary disclosed | Wiz careers page | Not listed |
| London Cloud Security Research Engineer inferred | Market synthesis | **£70K–£125K** (~$90K–$160K USD at current rates) |
| Wiz TPM roles (for reference) | Levels.fyi/market 2026 | $215K-$295K senior in US; $146K-$200K (Sr. Technical Enablement PM posted same week) |

**Wiz company signals (positive for company health, irrelevant for this role):**
- Google acquisition ($32B, EU approval Feb 2026) — company financially strong
- No Wiz-specific layoffs in any 2025-2026 layoff tracker
- Active hiring across multiple roles
- 50%+ Fortune 100 client base, scanning 230B+ files/day

**Comp score: 1/5** — London GBP-denominated role; even best-case estimate (~$160K USD) barely clears candidate's $150K floor, no equity clarity post-acquisition, candidate would need UK work authorization, wrong market entirely.

---

## E) Plan de Personalización

**Not applicable — hard SKIP.** No CV or LinkedIn changes recommended for this specific role.

General note: If candidate were to pursue Wiz's US-based PM/TPM roles (there are several active, including Sr. Technical Enablement PM at $146K–$200K), relevant customization would include:
- Emphasize cloud security platform knowledge (Azure + AzureGov depth)
- Lead with Fortune 10/200 client program management at NCC Group
- CISSP + SAFe POPM = direct signals for enterprise security PM roles
- Quantify penetration testing volume (100+ engagements/year, 2023 + 2024 records)

---

## F) Plan de Entrevistas

**Not applicable — do not pursue this role.**

For reference, if a Wiz PM/TPM role were to enter the pipeline, the strongest STAR stories would be:
1. Fortune 10 security remediation verification program (NCC Group) — scale, cross-functional coordination
2. 100+ penetration testing engagements per year — volume management, stakeholder comms
3. Sr. IT PO reclassification — Agile/SAFe, product ownership in offensive security context
4. AzureGov NOC build + team growth 10→45 engineers — infrastructure scale, 24/7 operations

---

## G) Posting Legitimacy

**Assessment: High Confidence (real, active posting)**

| Signal | Status | Detail |
|--------|--------|--------|
| Page loads (not 404) | ✅ Confirmed | wiz.io/careers/job/4626498006 returns full JD content |
| JD specificity | ✅ High | Detailed responsibilities, specific tech stack (Python, Go, Docker, K8s, Terraform, CloudFormation, CircleCI), named CSP APIs — not boilerplate |
| Company hiring signals | ✅ Strong | Google acquisition Feb 2026 ($32B), Fortune 100 client base, no layoffs detected, active multi-role hiring |
| Salary transparency | ⚠️ Missing | No salary listed (London posting; some UK roles omit salary) |
| Reposting / prior appearance | ⚠️ First scan | Added to scan-history.tsv today (2026-05-29); first appearance. Perplexity search shows result dated 2025-12-27, suggesting posting has been live ~5 months |
| Boilerplate ratio | Low | Role-specific language throughout |

**Context Notes:** The posting has likely been open since late 2025 with no fill — possibly hard to hire for (security research engineering in London is a competitive, narrow market). This strengthens that it's a real, active opening. Still a hard SKIP for this candidate.

**Posting freshness:** Unverified (batch mode — Playwright not available). Posting loads and content is intact; no expired signals detected via HTTP fetch.

---

## Score Global

| Dimensión | Score | Nota |
|-----------|-------|------|
| Match con CV | 1/5 | 4 hard blockers: location, coding, IaC, role type |
| Alineación North Star | 1/5 | Moves away from PM/PO/management track → IC engineer track |
| Comp | 1/5 | London GBP role; no USD comp; doesn't meet $150K floor reliably |
| Señales culturales | 3/5 | Wiz is excellent company (Google acquisition, Fortune 100 trust, no layoffs) |
| Red flags | -1 | Geographic hard block; role type mismatch |
| **Global** | **1.5/5** | **SKIP — do not apply** |

---

## Keywords extraídas

cloud security research, detection mechanisms, CSP API analysis, Python Go coding, Docker Kubernetes, attack surface identification, CloudTrail Flow Logs, Terraform CloudFormation, CI/CD pipelines, security scans, cloud environments, AWS Azure GCP OCI, security engineer, proof-of-concept, scalable security, IAM networking, cybersecurity frameworks, Linux internals, vulnerability detection, cloud threat research
