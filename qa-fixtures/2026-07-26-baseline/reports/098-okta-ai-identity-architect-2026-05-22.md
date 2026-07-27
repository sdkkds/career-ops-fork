# Evaluation: Okta — AI Identity Architect

**Date:** 2026-05-22
**Archetype:** Security Solutions Architect (AI/Identity specialization) — adjacent fit
**Score:** 2.0/5
**Legitimacy:** High Confidence
**URL:** https://www.okta.com/company/careers/opportunity/7749222?gh_jid=7749222
**PDF:** ❌ (skipped — SKIP-scored offer)
**Batch ID:** nightly-2026-05-22-1

---

## A) Role Summary

| Field | Detail |
|-------|--------|
| **Archetype** | Security Solutions Architect (AI/Identity sub-specialty) |
| **Domain** | Identity Security / IAM — AI agent identity specifically |
| **Function** | Architecture + Product Roadmap Input + Thought Leadership |
| **Seniority** | Principal/Staff (7+ years IAM required) |
| **Remote** | Hybrid/Remote (#LI-Hybrid #LI-Remote) |
| **Location** | Bellevue WA; Chicago IL; New York NY; San Francisco CA; Washington DC |
| **Reports To** | VP of Identity & Access Management |
| **Team Size** | Not stated |
| **TL;DR** | Deep IAM architect who has personally secured AI agents in production, owns product roadmap input for NHI/agentic identity at Okta, and serves as Customer Zero for internal AI security frameworks. |

**Note:** Bellevue WA is geographically favorable (Seattle Metro candidate). Remote tag is present. Location is not a blocker.

---

## B) Match with CV

| # | JD Requirement | Match | CV Evidence / Gap |
|---|----------------|-------|-------------------|
| 1 | 7+ years IAM/Security Architecture (workforce, customer, NHI) | ❌ Hard Gap | CV shows pen testing PM (NCC Group) and Azure infrastructure build (Microsoft). No IAM architecture ownership. Managed programs that USE identity systems; did not design or implement them. |
| 2 | Proven track record securing AI agents / NHIs in production | ❌ Hard Gap | No evidence anywhere in CV. No LangChain, agent orchestration, or NHI work. |
| 3 | Deep knowledge: OAuth2/OIDC (Token Exchange), SAML, mTLS, JWT, MCP | ❌ Hard Gap | Not in CV. General security background ≠ IAM protocol implementation. |
| 4 | Hands-on SPIFFE/SPIRE | ❌ Hard Gap | Not in CV. |
| 5 | Author Architecture Decision Records (ADRs) | ❌ Missing | Not in CV. SOP/BCP authoring is present but ADRs are an architecture-specific artifact. |
| 6 | Influence at VP/CTO level | ✅ Match | "Executive reporting" in Skills; Fortune 10/200 stakeholder management at NCC Group; cross-functional leadership at Microsoft. Solid evidence. |
| 7 | Act as peer to Product Management, drive roadmap | ✅ Match | Current role is literally IT Product Owner. Backlog management, sprint planning, stakeholder alignment — all present. |
| 8 | LangChain, LangGraph, AutoGPT, CrewAI, LlamaIndex, Semantic Kernel | ❌ Hard Gap | Not in CV. No AI orchestration framework experience. |
| 9 | Azure OpenAI / AWS Bedrock / Google Vertex AI | ⚠️ Partial | Azure (commercial + AzureGov) is strong; AI services layer is absent. |
| 10 | ISPM, Zero Trust (NIST 800-207), Identity Debt remediation | ⚠️ Partial | General security posture awareness likely; no specific ISPM or NIST 800-207 in CV. |
| 11 | JIT/JEA access, ephemeral secrets, privileged access | ❌ Missing | Not in CV. Pen test coordination touched these concepts as attack surfaces; not as architect. |
| 12 | ReBAC, fine-grained authorization | ❌ Missing | Not in CV. |
| 13 | Joiner-Mover-Leaver lifecycle automation for agents | ❌ Missing | JML in IAM context not in CV. |
| 14 | Active Directory on-prem/cloud | ✅ Match | Explicit in Skills section. AzureGov AD work at Microsoft. |
| 15 | Public white papers, blogs, technical guides | ⚠️ Partial | SOPs, training playbooks, BCP authoring present. No published public-facing content in CV. |
| 16 | Cross-App access, brokered delegation patterns | ❌ Missing | Not in CV. |
| 17 | Policy-as-code (OPA/Cedar), service-mesh identity (extra credit) | ❌ Missing | Not in CV. |
| 18 | CISSP-ISSAP / CCSP / TOGAF (extra credit, not required) | ⚠️ Partial | CISSP present. ISSAP specialization not earned. CCSP, TOGAF absent. |

**Matches (hard evidence):** 3/18 requirements (Executive influence, PM peer, Active Directory)
**Partial matches:** 5/18 (Azure cloud background, general security posture, CISSP, SOP writing, AI cloud provider adjacency)
**Hard gaps:** 10/18 (IAM architecture, AI agent security, core protocols, SPIFFE/SPIRE, LangChain stack, ReBAC, JIT/JEA, ADRs, policy-as-code, NHI lifecycle)

### Gap Analysis

| Gap | Hard Blocker? | Adjacent Evidence? | Mitigation |
|-----|--------------|---------------------|------------|
| IAM/Security Architecture 7+ years | **Yes** | Pen test PM shows attack surface awareness of identity; Azure AD admin exposure | No quick mitigation. Would take 2–3 years of dedicated IAM work. |
| AI agent / NHI security in production | **Yes** | None. This is an emerging niche even for IAM specialists. | Could build a demo/project with LangChain + Okta OIDC, but hiring bar here is production scale. |
| OAuth2/OIDC protocol depth | **Yes** | Understands these conceptually from security PM work | Cover letter could frame "securing pen test engagements that exploited OAuth misconfigs" but recruiters will probe depth |
| SPIFFE/SPIRE | **Yes** | None | Not mitigable in short term |
| LangChain/agentic frameworks | **Yes** | None in CV | Could build small project but 3-month prep minimum |
| ADR authoring | No (soft) | SOPs/BCP is adjacent writing skill | Frame SOP authoring as architectural documentation; weak but not disqualifying alone |

---

## C) Level and Strategy

**Detected JD Level:** Principal/Staff Security Architect — specialized in IAM and AI identity. Equivalent to L6–L7 at large tech companies. Requires deep implementation history, not just program oversight.

**Candidate's natural level for this archetype:** Not in scope. Sunjay is a strong Principal-level **Security Program Manager / Product Owner**. He is NOT an IAM architect by trade or history. This is a fundamentally different job family.

**"Sell senior without lying" plan:** Not applicable — the gap is not a framing problem. The role requires you to have personally implemented SPIFFE/SPIRE, written OAuth token exchange logic, and debugged LangChain auth loops. Framing pen test coordination as "security architecture experience" would collapse in the first technical interview.

**If downleveled:** Irrelevant — no level of this role fits the candidate's profile. The issue is archetype mismatch, not level mismatch.

**Honest assessment:** Even a stellar cover letter and strong referral would likely result in screening out at the first technical round once protocol depth is probed.

---

## D) Comp and Demand

| Metric | Data | Source |
|--------|------|--------|
| **JD Salary (WA/Seattle candidates)** | $216,000–$297,000 base | Okta JD (explicit) |
| **JD Salary (SF Bay Area)** | $242,000–$332,000 base | Okta JD (explicit) |
| **Plus:** | Equity + bonus + health/dental/vision + 401(k) + parental leave | Okta Total Rewards |
| **Estimated TC** | $280K–$400K+ depending on equity | Perplexity market analysis |
| **Market position** | At market to slightly above for identity/security specialty; below top Big Tech | Levels.fyi / market synthesis |
| **Okta layoffs 2024–2025** | No confirmed major layoff event found; cost-disciplined environment sector-wide | Perplexity search |
| **Hiring signal** | Active posting with application form live and salary range published | Direct page verification |

**Comp Score: 5/5** — WA range of $216K–$297K base is 44–98% above candidate's $150K floor. If TC is $280K–$340K total, this is top-quartile for Seattle-area security roles. Irrelevant given the match score, but objective comp data is excellent.

**Demand:** NHI and AI agent identity is a genuine emerging specialty with almost no supply. The few people who truly qualify for this role will receive multiple competing offers. Okta is paying to reflect that scarcity.

---

## E) Personalization Plan

Not actionable for a SKIP-recommended offer. For reference only, gaps that would need to close before this archetype becomes reachable:

| Priority | Action | Timeline |
|----------|--------|----------|
| 1 | Deep-dive OAuth2/OIDC Token Exchange, PKCE, mTLS — not just conceptually but implementation | 3–6 months study |
| 2 | Build LangChain + Okta/Auth0 OIDC integration project with public GitHub | 2–3 months |
| 3 | Earn CISSP-ISSAP (Architecture specialization) | 6–12 months |
| 4 | Contribute to NHI or agent identity open source or write public content | Ongoing |
| 5 | Target a transitional role: IAM Product Manager, Identity Platform PM, or Identity Solutions Architect at a vendor | Next role pivot |

**This role is not a stretch — it is a different career track.** The path from Security PM → IAM Architect is viable but requires deliberate skill investment over 1–2 years.

---

## F) Interview Stories

Not recommended to pursue. Provided for educational mapping only.

| # | JD Requirement | Closest Story | Gap |
|---|----------------|---------------|-----|
| 1 | Securing AI agents at scale | None directly applicable | Could stretch "coordinating pen tests that found OAuth misconfigs at Fortune 10" but examiner will ask for implementation depth |
| 2 | Product roadmap influence (VP/CTO) | Current health insurance CISO/exec stakeholder work; NCC Group client advisory | This actually maps well — strongest overlap |
| 3 | Customer Zero implementation | AzureGov infrastructure build as internal "customer zero" concept | Reasonable framing but lacks identity protocol specifics |
| 4 | Cross-functional architecture + documentation | SOPs, BCP, training playbooks across all roles | Weakest mapping — ADRs are different format and depth |

**Recommended case study if applying despite advice:** AzureGov infrastructure build — frame as "architecting secure identity and access at government-compliance scale (CJIS/DoD) with Active Directory at 45-engineer org." Only marginally relevant but it's the strongest adjacent proof point.

---

## G) Posting Legitimacy

**Assessment: High Confidence**

| Signal | Value | Reliability | Notes |
|--------|-------|-------------|-------|
| Application form live | ✅ Active | High | Full form with upload fields verified via page fetch |
| Salary range stated | ✅ Yes ($216K–$297K WA) | High | Strong legitimacy signal; Okta consistently publishes ranges |
| Tech specificity | ✅ High | Medium | SPIFFE/SPIRE, Token Exchange, ReBAC, LangGraph, MCP — not boilerplate |
| Requirements realism | ✅ Realistic | Medium | 7+ years IAM is appropriate for this scope; no contradictions |
| Reporting structure stated | ✅ VP of IAM | High | Specific, not generic |
| Reposting pattern | ✅ Not previously seen | Medium | JD #7749222 not in scan-history.tsv; different from other Okta roles scanned (7895690, 7775832, etc.) |
| Okta layoff/freeze news | ✅ None confirmed 2024–2025 | Medium | Cost-disciplined environment but no broad freeze or RIF |

**Context:** Okta is actively building out AI identity capabilities — this aligns with their FY2025–2026 product direction (Secure Identity Commitment, ISPM launch, AI agent identity roadmap). This is a real strategic hire, not a pipeline builder or ghost posting.

**Note:** Posting freshness (days posted, exact date) unverified — batch mode, Playwright not available. All other signals point to active opening.

---

## Score Summary

| Dimension | Score | Notes |
|-----------|-------|-------|
| Match with CV | 1.5/5 | 3 hard matches out of 18 requirements; 10 hard blockers |
| North Star alignment | 2.0/5 | Security Solutions Architect is "adjacent" in _profile.md — but this requires depth of practice Sunjay doesn't have |
| Comp | 5.0/5 | $216K–$297K WA base is exceptional; well above $150K floor |
| Cultural signals | 3.5/5 | Okta well-regarded; remote possible; identity-first company; AI investment real |
| Red flags | -0.5 | Primary role expects hands-on implementation (borderline SWE constraint) |
| **Global** | **2.0/5** | **Do not apply** |

## RECOMMENDATION: SKIP

The comp is extraordinary and the location is favorable (Bellevue). But this role requires a career that Sunjay has not had — specifically 7+ years of hands-on IAM architecture with OAuth/OIDC/SPIFFE implementation in production. The gap is not a framing problem. It would be discovered in the first technical screen.

Applying would waste a recruiter's time and burn goodwill at a company where other, better-fit roles exist (see Okta scan history: 7775832 = Staff TPM Security, 7893951 = Staff TPM — both are much better matches).

**Action:** Don't apply to this role. Flag Okta as a high-interest target company. Pursue 7775832 (Staff Technical Program Manager, Security) or 7893951 (Staff Technical Program Manager) instead — those fit the Security Program Manager archetype directly.

---

## Keywords Extracted

Non-Human Identity (NHI), AI agent security, OAuth2, OIDC Token Exchange, SPIFFE/SPIRE, mTLS, JWT, MCP, Zero Trust, NIST 800-207, ISPM, Identity Security Posture Management, JIT/JEA, ReBAC, LangChain, LangGraph, IAM architecture, privileged access, ephemeral secrets, Architecture Decision Records, Okta Identity Engine, Auth0, Customer Zero, agentic systems, workload attestation
