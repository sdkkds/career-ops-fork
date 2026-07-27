# Evaluación: Keeper Security — Information Security Engineer

**Fecha:** 2026-06-03
**Arquetipo:** IC Security Operations Engineer (híbrido Vulnerability Management PM / Security Operations) — fuera del carril natural PM/PO de Sunjay
**Score:** 2.4/5 — **DO NOT APPLY**
**Legitimacy:** High Confidence (verified live via browser — title + full JD + active application form)
**URL:** https://job-boards.greenhouse.io/keepersecurity/jobs/4139678009
**PDF:** output/cv-sunjay-kelkar-keeper-security-2026-06-03.pdf
**Batch ID:** nightly-2026-06-03-5
**Verification:** confirmed live (Playwright snapshot, 2026-06-03)

---

## A) Resumen del Rol

| Campo | Detalle |
|-------|---------|
| **Arquetipo** | IC Security Operations Engineer (hands-on). Híbrido más cercano: *Vulnerability Management PM* + *Security Operations*. NO es un rol de PM/PO. |
| **Domain** | Cybersecurity SaaS — Privileged Access Management (PAM) vendor |
| **Function** | Security operations execution + security control ownership (IR, EDR/SaaS controls, vuln remediation, access governance, compliance evidence) |
| **Seniority** | IC mid-senior (5+ años). Exempt. NO management. |
| **Remote** | 100% remote US (hybrid opcional El Dorado Hills, CA / Chicago, IL) |
| **Team** | Trabaja con Observability Eng, AppSec, Vulnerability Management leadership. Es ejecutor, no líder de programa. |
| **Restricción dura** | "Due to FedRAMP requirements, candidates must be a U.S. Person." ✅ Sunjay cumple. |

**TL;DR:** Rol de **ingeniero IC de operaciones de seguridad hands-on** en un vendor PAM en rápido crecimiento. El JD explícitamente acota el rol a *"security operations execution and security control ownership, not… application security program leadership"* y busca *"an engineer who enjoys turning security priorities into operational reality."* Sunjay es **program/product leadership** — coordina pentests, posee el programa de vuln management, escribe runbooks/SOPs. La mitad del JD es genuinamente suya (IR coordination, runbooks, remediation tracking, compliance, CISSP, cloud security, US Person). La otra mitad es **hands-on engineering que no hace**: operar EDR/email/SaaS controls, triage/containment como ingeniero, detection engineering/SOAR, Python/Bash. **Mismatch de carril y nivel + comp por debajo de target → no aplicar.**

## B) Match con CV

| Requisito del JD | Match en CV | Fuerza |
|------------------|-------------|--------|
| 5+ años InfoSec / Security Eng / Security Ops (IC, SaaS/cloud) | Tiene 25+ años, pero en **program/product management de seguridad**, no en roles IC de security engineering/ops. Gap de *carril*. | ⚠️ Parcial |
| IR: triage, investigation, containment, lessons learned, corrective actions | cv.md L67: *"Incident manager for service outages, crisis management, and security incidents"* (Microsoft). Coordinación/gestión de incidentes real — pero a nivel infra/operacional, no SOC security triage hands-on. | ✅ Coordinación / ⚠️ hands-on |
| IR playbooks, runbooks, escalation paths, tabletops | cv.md L68: *"Authored security SOPs, business continuity plans, team training playbooks, and troubleshooting guides"*; L49 documentación técnica. **Match fuerte.** | ✅ Fuerte |
| Operar/mejorar security controls (EDR, SaaS security, email security, access control) | Sin experiencia hands-on operando EDR/email/SaaS security tooling. Gap duro. | ❌ Gap |
| Partner con Vuln Management para remediation execution, reducir repeat findings | cv.md L24-31: Product Owner de vuln management + offensive security; L44 *"owned… security remediation verification program"* (NCC, Fortune 10). El JD pide *"familiarity… even if not the program owner"* — Sunjay **excede** esto (es dueño del programa). | ✅ Fuerte (excede) |
| Coordinar investigaciones con DevOps/IT/Eng, track to closure | cv.md L46-48: coordinación cross-funcional, tracking de milestones/dependencies/issues en Azure DevOps. **Match.** | ✅ Fuerte |
| Access governance, least-privilege, access reviews, privileged access | Adyacente (CISSP, AzureGov, AD on-prem/cloud L76) pero sin ownership directo de access-review programs. | ⚠️ Adyacente |
| Security documentation para procesos/controles/procedimientos | cv.md L49, L68. **Match muy fuerte** — es una de sus superpowers. | ✅ Fuerte |
| Compliance evidence/readiness (SOC 2, ISO 27001, FedRAMP/GovRAMP, NIST 800-53) | CJIS/DoD, AzureGov environments (L75) — adyacente a FedRAMP/NIST. Sin SOC2/ISO evidence directo, pero readiness mindset transferible. | ⚠️ Adyacente |
| Cloud security fundamentals (AWS/Azure/GCP), SSO/MFA/RBAC | Azure (commercial+gov), AWS, AD (L76). **Match.** | ✅ Bueno |
| Vuln/risk concepts (CVEs, prioritization, remediation tracking) | Pentest + vuln management program management. **Match fuerte.** | ✅ Fuerte |
| Scripting/automation (Python, Bash, PowerShell), APIs | PowerShell sí; Python en aprendizaje; Bash básico. Parcial. | ⚠️ Parcial |
| Detection engineering, threat intel, SOAR | Sin experiencia. Gap. | ❌ Gap |
| U.S. Person (FedRAMP) | ✅ Sí, no sponsorship needed. | ✅ |

### Gaps y mitigación

1. **Carril IC vs PM/PO (hard blocker estructural).** El JD busca un *ingeniero* hands-on; Sunjay es *program/product leadership*. No es "no calificado" — es el carril equivocado. Mitigación: ninguna honesta que no implique venderse como algo que no es. **Este es el motivo principal del no-apply.**
2. **Operar EDR/email/SaaS security controls (hard gap).** Sin experiencia hands-on. Mitigación: solo experiencia adyacente (asset/change management, Azure infra ops) — insuficiente para el core del rol.
3. **IR triage/containment como ingeniero (gap parcial).** Tiene incident *management/coordination* (Microsoft), no triage SOC hands-on. Mitigación: enmarcar como coordinación de incidentes + corrective-action tracking, pero no cubre la ejecución técnica que piden.
4. **Detection engineering / SOAR (gap, preferred).** Solo "preferred", no blocker. Sin mitigación necesaria.
5. **Python/Bash (gap parcial).** PowerShell cubre parte de "scripting/automation"; Python/Bash no. Mitigación: liderar con PowerShell automation real.

## C) Nivel y Estrategia

1. **Nivel JD vs nivel natural.** JD = IC mid-senior (5+ años), Exempt, sin management. Nivel natural de Sunjay = Senior PM/PO de seguridad / camino a Director / vCISO, con experiencia gestionando equipos de 45. **Este rol es un paso lateral-hacia-abajo de carril** (de líder de programa a ejecutor IC).
2. **"Vender senior sin mentir":** No aplica favorablemente aquí. Aunque podría enmarcar IR coordination + vuln ownership + runbook authoring como senior, el rol **no premia** liderazgo de programa — explícitamente lo excluye. Venderse senior choca con lo que compran.
3. **"Si me downlevelan":** El rol *ya es* un downlevel de carril. No hay review a 6 meses que convierta un IC security ops engineer en su track de PM/Director. Aceptar solo si hubiera una razón estratégica concreta (entrar a Keeper por la marca de seguridad, pivote deliberado a hands-on) — y la comp no lo justifica.

## D) Comp y Demanda

| Dato | Valor | Fuente |
|------|-------|--------|
| Mercado US InfoSec Eng (5+ yrs), base | ~$140K–190K | Perplexity research (Levels.fyi/Glassdoor/Built In agregados) |
| Mercado US, total cash (base+bonus, sin equity) | ~$155K–215K | idem |
| **Keeper-specific target (mid SaaS, no big-tech)** | **base ~$130K–165K; base+bonus ~$140K–180K** | Perplexity (Comparably/Glassdoor banding) |
| Keeper Glassdoor overall | ~2.9/5 (culture 2.8, WLB 3.1, career 2.9) | Glassdoor / Comparably |
| Keeper comp percentile | Bottom third de firmas de tamaño similar | Comparably |
| "Above market annual bonuses" (claim del JD) | Afirmado, no verificado independientemente | JD |
| Crecimiento Keeper | 2º vendor de security software de más rápido crecimiento; +53.42% YoY; CAGR 5yr 62% | Gartner 2025 (vía Perplexity) |
| Layoffs/freeze 2025-26 | Ninguno anunciado | Perplexity search |

**Score comp: 2/5.** Target de Keeper para este rol (~$130–165K base) cae **por debajo** del target de Sunjay ($150–200K+); solo solapa en el extremo inferior. Glassdoor 2.9 + comp bottom-third refuerzan el descuento. Bono "above market" es el único upside, no verificable. Empresa financieramente sana y en crecimiento (no es red flag de viabilidad), pero la ecuación comp+nivel no funciona.

## E) Plan de Personalización

*(Aplicaría solo si decidiera aplicar — no recomendado.)*

| # | Sección | Estado actual | Cambio propuesto | Por qué |
|---|---------|---------------|------------------|---------|
| 1 | Summary | PM/PO framing | Liderar con "security operations + incident coordination + vuln remediation + runbooks" | Acercar al vocabulario IC del JD |
| 2 | Experiencia MS | "Incident manager… security incidents" | Reordenar al top; añadir "corrective-action tracking" | Mapea a IR responsibilities |
| 3 | Experiencia actual | Product Owner offensive security | Enfatizar "remediation tracking, CVE prioritization, repeat-finding reduction" | Mapea a vuln management partner |
| 4 | Skills | Genérico | Añadir línea "Security Operations: IR runbooks, SOPs, remediation tracking, access governance, compliance readiness (SOC 2/ISO 27001/FedRAMP-adjacent)" | ATS keywords |
| 5 | Certs | CISSP presente | Mantener CISSP arriba | Señal core para el rol |

**Top 5 LinkedIn:** (1) headline con "Security Operations & Incident Coordination"; (2) about con runbook/SOP authoring; (3) featured: vuln management program; (4) skills: IR, remediation, compliance; (5) CISSP destacado. *No accionar — rol no recomendado.*

## F) Plan de Entrevistas

*(Material STAR disponible si pivotara, pero el rol no es recomendado. Resumen breve.)*

| # | Requisito JD | Historia STAR | S/T/A/R |
|---|--------------|---------------|---------|
| 1 | IR coordination + corrective actions | Incident manager Microsoft AzureGov | S: outages/security incidents a escala / T: coordinar respuesta + SLA / A: incident mgmt + post-incident SOPs / R: SLA/KPI reporting, playbooks |
| 2 | Vuln remediation + repeat-finding reduction | Remediation verification program NCC (Fortune 10) | S: cliente Fortune 10 / T: verificar remediación / A: owned+streamlined SOPs / R: programa documentado y repetible |
| 3 | Runbooks/SOPs/documentation | SOP authoring Microsoft | S: equipo bicostal 45 / T: consistencia operativa / A: authored security SOPs/BCP/playbooks / R: onboarding y troubleshooting estandarizado |
| 4 | Cross-team investigation coordination | Pentest coordination NCC | S: engagements paralelos / T: coordinar DevOps/security / A: tracking en Azure DevOps / R: entregas a tiempo |

- **Case study recomendado:** Remediation verification program NCC (Fortune 10) — el más cercano al "remediation execution / reduce repeat findings" del JD.
- **Red-flag a anticipar:** "¿Has operado EDR/SIEM/SOAR hands-on?" — respuesta honesta es no; este es el punto donde el rol revela el mismatch. Mejor no llegar a esa entrevista.

## G) Posting Legitimacy

**Assessment: High Confidence (verified live).**

| Señal | Estado | Nota |
|-------|--------|------|
| Posting freshness / Apply activo | ✅ **Verified live** | Playwright snapshot 2026-06-03: título + JD completo + formulario de aplicación funcional con campos screening específicos del rol |
| Calidad de descripción | ✅ Alta | JD muy específico (scope explícito, "not X / not Y" boundaries, screening questions a medida sobre IR end-to-end y control ownership). Cero boilerplate genérico. |
| Salary transparency | ⚠️ Parcial | No publica rango (legal en algunos estados listados); benefits detallados + "above market bonuses" |
| Company hiring signals | ✅ Positivo | Gartner: 2º vendor security software de más rápido crecimiento (+53% YoY). Sin layoffs/freeze 2025-26. |
| Reposting (scan-history) | — | No aparición previa relevante (no Keeper en applications.md) |

**Context Notes:** Posting legítimo y activo de una empresa real, sana y en crecimiento. Screening questions a medida (IR end-to-end en últimos 24 meses; describe un security control que poseíste y mejoraste con métricas) confirman un rol genuino con un hiring manager real — y al mismo tiempo **filtran exactamente la experiencia hands-on que Sunjay no tiene**. Legitimidad alta; fit bajo.

---

## Score Global

| Dimensión | Score |
|-----------|-------|
| Match con CV | 3/5 (fuerte en runbooks/vuln/IR-coordination/compliance; débil en hands-on engineering core) |
| Alineación North Star | 2/5 (IC ops engineer vs track PM/PO/vCISO) |
| Comp | 2/5 (Keeper ~$130–165K base, bajo target $150–200K+; Glassdoor 2.9) |
| Señales culturales | 3/5 (pedigree de seguridad + crecimiento fuerte; Glassdoor mediocre) |
| Red flags | -0.5 (mismatch de carril/nivel + "ops execution, not program leadership" + comp bajo target) |
| **Global** | **2.4/5 — DO NOT APPLY** |

**Recomendación:** **No aplicar.** Posting legítimo y empresa sólida, pero es un rol IC de operaciones de seguridad hands-on (operar EDR, triage/containment, detection engineering, Python/Bash) que está fuera del carril de program/product leadership de Sunjay y por debajo de su target de comp. La mitad del JD es genuinamente suya (vuln ownership, runbooks, IR coordination, compliance, CISSP) — pero el core del rol premia ejecución hands-on que no tiene, y el JD explícitamente excluye su fortaleza (program leadership). Mejor invertir el esfuerzo en roles Senior Security Program Manager / PO / vCISO.

---

## Keywords extraídas

security operations, incident response, IR playbooks, runbooks, escalation paths, tabletop exercises, security controls, EDR / endpoint protection, SaaS security controls, email security, access governance, least privilege, privileged access management (PAM), vulnerability management, remediation tracking, CVE prioritization, SOC 2, ISO 27001, FedRAMP, GovRAMP, NIST 800-53, SSO / MFA / RBAC, cloud security (AWS / Azure / GCP), security automation, PowerShell scripting, US Person
