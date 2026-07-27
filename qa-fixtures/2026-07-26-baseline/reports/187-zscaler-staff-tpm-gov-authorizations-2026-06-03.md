# Evaluación: Zscaler — Staff Technical Program Manager, Government Authorizations

**Fecha:** 2026-06-03
**Arquetipo:** Technical Security Program Manager (con fuerte componente GRC / Compliance)
**Score:** 3.1/5
**Legitimacy:** High Confidence
**URL:** https://job-boards.greenhouse.io/zscaler/jobs/5124741007
**PDF:** output/cv-sunjay-kelkar-zscaler-staff-tpm-gov-auth-2026-06-03.pdf
**Batch ID:** nightly-2026-06-03-7
**Verification:** confirmed live (Playwright snapshot, 2026-06-03 — "New" tag, Apply active, full JD + salary present)

> **Recomendación: SKIP — salvo pivote deliberado a GRC/FedRAMP.** Forma correcta (TPM, gobierno, remoto, comp total fuerte) pero especialización equivocada. Los dos min-quals núcleo (5+ años liderando auditorías de compliance del gobierno US; dominio de NIST 800-53 Rev 5 / DoD Cloud SRG / CNSSI 1253) **no se cumplen directamente** y probablemente filtran en el screen. Aplicar solo si Sunjay quiere construir credencial FedRAMP/ATO conscientemente.

---

## A) Resumen del Rol

| Campo | Valor |
|-------|-------|
| Arquetipo | Technical Security Program Manager + GRC/Compliance (híbrido; segundo más cercano: Cybersecurity Consultant / Program Manager) |
| Domain | Cloud security vendor — FedRAMP & DoD authorizations (Government Authorizations) |
| Function | Program management de autorizaciones gov: ATO end-to-end, continuous monitoring, audits |
| Seniority | Staff (≈ Senior/Principal IC) |
| Reporta a | Director, Technology, Risk & Compliance — dept. Exposure Management & Security Operations |
| Remote | **Sí** (Remote - USA; `#LI-Remote`). Preferencia hybrid San Jose, CA — no obligatorio |
| Team size | No declarado; rol IC con scope cross-funcional (Compliance Engineering, Compliance Architecture, 3PAO, gov stakeholders) |
| Comp (base) | **$122,500 – $175,000 USD** base (excluye bonus/equity/benefits) |

**TL;DR:** Zscaler busca un Staff TPM para ser dueño end-to-end de las autorizaciones FedRAMP/DoD (SSPs, POA&Ms, SARs en todos los impact levels), facilitar audits con 3PAO, y correr continuous monitoring. Es un rol **GRC-primario** con envoltorio TPM. La disciplina de program management y el contexto gobierno/AzureGov de Sunjay encajan; la expertise específica en autorización FedRAMP (el producto real del puesto) es un gap material.

---

## B) Match con CV

| Requisito del JD | Match en CV | Fuerza |
|------------------|-------------|--------|
| Liderar ejecución cross-funcional de programas (onboarding→authorization→sustainment) | `cv.md:27` Product Owner Red Team, features/user stories ADO+Jira Align, cadencias SAFe; `cv.md:44` owned remediation verification program (Fortune 10) | **Fuerte** |
| "Facilitate audit interviews, evidence collection and remediation" | `cv.md:46` "organized cross-functional teams for parallel pen testing engagements"; `cv.md:47` tracked milestones/dependencies/issues en ADO | Media-Fuerte (adyacente, no auditoría gov formal) |
| Continuous monitoring: incident response, access reviews, **vulnerability scan analysis**, change reviews | `cv.md:14` "vulnerability management"; `cv.md:17/67` security incident manager / crisis management; `cv.md:75` vuln management, security incident response | **Fuerte** (en su núcleo actual) |
| Government cloud context (DoD Cloud Computing SRG) | `cv.md:65` "Azure Government infrastructure for Microsoft federal clients"; `cv.md:75` "AzureGov, CJIS/DoD environments" | **Fuerte** (entorno), Débil (control framework) |
| Interface con gov stakeholders y 3PAO | `cv.md:32` liaison VP/Director stakeholders; `cv.md:46/48` client comms y account managers (NCC) | Media (stakeholder mgmt sí; 3PAO/gov AO no) |
| Comunicación técnica + no-técnica (preferred qual) | `cv.md:18` "equally effective with engineers, executives, non-technical"; `cv.md:68/79` SOPs, BCP, exec reporting | **Fuerte** |
| Bachelor's en CS/Eng/IS o equivalente | `cv.md:86` BA History & Political Science → "equivalent practical experience" + CISSP cubre | Media (no STEM; equivalencia + 25 años) |
| US citizen (min-qual binario) | **Asunción: sí** — su trabajo AzureGov/CJIS/DoD exigió US-person status. **Verificar explícitamente antes de aplicar.** | Asunción |

### Gaps

| Gap | ¿Blocker o nice-to-have? | Experiencia adyacente | Mitigación |
|-----|--------------------------|------------------------|------------|
| **5+ años liderando auditorías de compliance del gobierno US + remediación POA&M** | **Hard-ish min-qual** | Remediation verification program (NCC Fortune 10), pen test program management, vuln management | No es cubrible honestamente como equivalente directo. Es el filtro probable de screen. Bridge solo via "remediation tracking + program ownership a escala Fortune 10/gobierno". |
| **Dominio NIST 800-53 Rev 5 / DoD Cloud SRG / CNSSI 1253** | **Hard min-qual** | CISSP (conceptual NIST/security fundamentals); AzureGov/CJIS exposure | CISSP da fundamentos conceptuales, NO implementación 800-53. Gap real. No fabricar en CV. |
| **FedRAMP/DoD ATO packages, SSPs/POA&Ms/SARs, ConMon submissions** (núcleo del rol) | Preferred + es el trabajo | Ninguna directa | Gap central. Es literalmente el output del puesto. Solo cubrible aprendiendo el dominio. |
| **Interacción con AO / 3PAO assessors** | Preferred | Client/stakeholder management (NCC) | Stakeholder management transferible; el contexto FedRAMP no. |
| Bachelor's STEM | Nice-to-have (acepta equivalente) | 25+ años práctica + CISSP | Cubierto por "equivalent practical experience". |

**Veredicto del bloque:** Sunjay aporta la **maquinaria de program management** y el **contexto de gobierno/AzureGov**, pero no la **sustancia de autorización FedRAMP**. Un screener buscando "5+ años de auditorías gov + NIST 800-53 profundo" probablemente lo descarta a nivel resume.

---

## C) Nivel y Estrategia

1. **Nivel JD vs natural:** "Staff" en Zscaler ≈ Senior/Principal IC. El nivel de Sunjay (Senior PM/PO con 25 años) es coherente con "Staff" en program management. El nivel **no** es el problema — la **especialización** sí.

2. **"Vender senior sin mentir":**
   - Liderar con escala y ownership real: programa de remediation verification para el cliente #1 de NCC en Norteamérica (Fortune 10); construcción de infraestructura AzureGov 24/7/365 (equipo 10→45) para clientes federales de Microsoft.
   - Enmarcar el contexto gobierno como genuino: "9 años construyendo y operando infraestructura Azure Government para clientes federales — entiendo entornos CJIS/DoD desde dentro."
   - Honestidad sobre el gap: posicionarse como "Staff TPM que domina la ejecución de programas de seguridad gov y está construyendo la profundidad FedRAMP/ATO", no como experto FedRAMP existente.

3. **Si me downlevelan:** N/A — el riesgo aquí no es downlevel sino **rechazo por specialization mismatch**. Si avanza, no aceptar un re-scope que sea GRC puro de bajo nivel sin path de crecimiento; el valor está en el ángulo program-management.

---

## D) Comp y Demanda

| Métrica | Dato | Fuente |
|---------|------|--------|
| Base posted (este rol) | $122,500 – $175,000 | JD Greenhouse (live) |
| Total comp TPM @ Zscaler (mediana) | ~$295K ($277K–$316K; top ~$348K) | Levels.fyi |
| Total comp "Staff I" @ Zscaler | avg ~$242K ($226K–$295K; mediana ~$243K) | 6figr |
| Total comp Bay Area (Blind) | mediana ~$224K; P90 mid-$300Ks | Blind |
| Peer base (Okta Staff TPM) | avg ~$238K base | 6figr |

**Lectura:** La **base** ($122.5K–175K) está en la parte baja del mercado en aislamiento — por debajo del piso de $150K de Sunjay en su extremo inferior. Pero el **total comp** (base + equity SBC fuerte + bonus) cae en $230K–$295K, **muy por encima** del piso de $150K y del target $200K+. Zscaler paga generoso en equity ($610.3M SBC en 9 meses FY26). **Crítico negociar el paquete total, no la base.** Si el offer aterriza cerca del top de base ($170K) + equity/bonus típicos, total ≈ $250K+.

**Demanda:** Alta para Staff TPM en seguridad/compliance. Zscaler activamente contratando.

**Score comp: 4/5** — base modesta, total comp fuerte.

---

## E) Plan de Personalización

| # | Sección | Estado actual | Cambio propuesto | Por qué |
|---|---------|---------------|------------------|---------|
| 1 | Summary | "security program management" genérico | Inyectar "government cloud authorizations context", "continuous monitoring", "program ownership for federal-client environments" — **sin** inventar FedRAMP | ATS + alinea al gobierno sin mentir |
| 2 | Current role | "vulnerability management" | "continuous monitoring incl. vulnerability scan analysis and remediation tracking" | Match directo a ConMon del JD |
| 3 | NCC role | "remediation verification program" | "security remediation program — tracking and closing risks across stakeholders (POA&M-adjacent remediation)" | Bridge honesto a POA&M sin fabricar |
| 4 | Microsoft role | "Azure Government infrastructure" | Destacar "AzureGov / DoD / CJIS environments for federal clients" como bullet líder | El ángulo gobierno es su activo más fuerte aquí |
| 5 | Skills/Certs | CISSP listado | Agrupar CISSP + Security+ bajo "Security & compliance fundamentals (NIST-aligned)" | Conceptual, honesto, ATS |

**Top 5 LinkedIn:** (1) headline con "Government cloud security program management"; (2) about destacando AzureGov federal; (3) skill "Continuous Monitoring"; (4) skill "Security Program Management"; (5) featured: programa remediation Fortune 10.

---

## F) Plan de Entrevistas

| # | Requisito JD | Historia STAR | S | T | A | R |
|---|--------------|---------------|---|---|---|---|
| 1 | Ownership de ejecución cross-funcional | AzureGov build | Microsoft federal cloud, sin infra madura | Construir/operar infra gov 24/7/365 | Lideré equipo bi-costa 10→45, NOC build-out, change/asset mgmt | Infra federal operativa, SLAs/KPIs reportados |
| 2 | Remediation tracking (POA&M-adjacent) | NCC Fortune 10 remediation program | Cliente #1 NA de NCC sin SOPs claros | Owned remediation verification program | Documenté y streamlined SOPs, cerré riesgos con stakeholders | Programa estandarizado, verificación consistente |
| 3 | Evidence collection cross-stakeholder | Pen test coordination NCC | Múltiples engagements paralelos Fortune 10/200 | Coordinar equipos cross-funcionales init→delivery | Comms a clientes, tracking ADO de milestones/deps | Engagements entregados en paralelo |
| 4 | Continuous monitoring / vuln analysis | Current vuln mgmt + pen testing PO | Programa Red Team salud, targets anuales | Owner de features/user stories, cadencia SAFe | Mejoré coordinación, reduje scheduling lag | Superé targets 2023 y 2024 (récord histórico) |
| 5 | Stakeholder comms técnico/no-técnico | Exec liaison (current) | VP/Director/Lead stakeholders multi-org | Liaison primario Offensive Security↔business | Traduje seguridad a lenguaje de negocio | Alineación sostenida cross-org |
| 6 | Incident response (ConMon) | Microsoft incident manager | Outages/security incidents a escala MS | Incident manager, crisis management | Authored SOPs/BCP, analicé SLA/KPI | Respuesta estructurada, post-mortems |
| 7 | Ambigüedad / "build the path" | AzureGov greenfield | Entorno gov sin playbooks | Build-out NOC + procesos desde cero | Creé SOPs, training playbooks, change mgmt | Operación federal estable |

**Case study recomendado:** Programa de remediation verification de NCC (Fortune 10) — es el puente más cercano a POA&M/audit remediation. Presentar como "ownership de un programa de cierre de riesgos a escala enterprise, con SOPs y verificación cross-stakeholder".

**Preguntas red-flag y respuestas:**
- *"¿Has llevado un ATO package FedRAMP/DoD de principio a fin?"* → Honestidad: "No un ATO FedRAMP formal. He llevado programas de remediation y compliance-adjacent a escala Fortune 10 y operado infra AzureGov para clientes federales. Conozco el entorno gobierno y la disciplina de program management; el framework FedRAMP específico es donde estoy construyendo profundidad activamente." No bluffear.
- *"¿NIST 800-53 / DoD SRG hands-on?"* → "Fundamentos via CISSP y exposición operativa en AzureGov/CJIS; no implementación de controles 800-53 control-by-control. Aprendizaje rápido — mi track record es entrar a dominios nuevos de seguridad y volverme operativo."

---

## G) Posting Legitimacy

**Tier: High Confidence.**

| Señal | Estado | Nota |
|-------|--------|------|
| Posting freshness (días exactos) | Verificado parcial | Tag "New" visible; Playwright confirmó página viva 2026-06-03 |
| Apply button activo | **Verificado** | Apply + formulario Greenhouse completo y funcional |
| Calidad/especificidad de descripción | **Alta** | Min-quals específicos (NIST 800-53 Rev5, DoD SRG, CNSSI 1253, FedRAMP 20x), responsabilidades concretas, bajo boilerplate |
| Transparencia salarial | **Sí** | Rango base publicado ($122.5K–$175K) + disclaimer de pay transparency |
| Company hiring signals | **Saludable** | Q3 FY26 rev ~$850M (+25% YoY); headcount ~4,456 (+7.2% YoY); 531 hires YTD; guidance FY26 subida; SBC $610M/9M; cash ~$3.39B |
| Layoffs/freeze | Bajo riesgo | Sin mass layoffs desde 3% en feb-2023; freezes/rescinds aislados anecdóticos (Blind) |
| Reposting detection | No detectado | Sin aparición previa de este rol en historial; otros roles Zscaler evaluados son distintos (#024 Field CISO, #025 Director Data Security) |

**Context note:** Empleador privado (no gobierno directo) — no aplica el reject de "federal employer". Clearance "a plus", **no requerido** — no es blocker. Min-qual "Must be a U.S citizen" es binario y asumido cumplido — verificar. Fuentes comp/financieras: Perplexity research (Levels.fyi, 6figr, Blind, Glassdoor, Crunchbase, 10-Q FY26).

---

## Score Global

| Dimensión | Score | Peso |
|-----------|-------|------|
| Match con CV (role fit) | 3/5 | **Alto** — forma TPM encaja, especialización FedRAMP no; 2 min-quals núcleo sin cumplir |
| Alineación North Star | 4/5 | Medio — Staff en top security vendor; GRC/FedRAMP es vCISO-adyacente |
| Comp | 4/5 | Alto — base modesta, total comp $230–295K fuerte |
| Señales culturales | 4/5 | Medio-Alto — saludable, security-forward, ownership culture, remoto |
| Red flags | 0 | Sin hard blocker; GRC-primario = gap developmental, no red flag |
| **Global** | **3.1/5** | Role fit (alto peso) limita el conjunto |

**Decisión: Evaluated → recomendación SKIP** salvo que Sunjay decida pivotar conscientemente a program management de compliance FedRAMP/DoD. La forma del rol (TPM, gobierno, remoto, comp total) es atractiva; la sustancia (autorización FedRAMP) es un gap que probablemente filtra en screen y que no es honestamente cubrible en el CV.

---

## Keywords extraídas

FedRAMP, DoD authorizations, ATO (Authorization to Operate), SSP, POA&M, SAR, NIST 800-53 Rev 5, DoD Cloud Computing SRG, CNSSI 1253, continuous monitoring (ConMon), 3PAO, FedRAMP 20x, vulnerability scan analysis, evidence collection, security compliance audits, Technical Program Manager, government authorizations, risk and compliance, access reviews, GRC controls, security program management, stakeholder communication
