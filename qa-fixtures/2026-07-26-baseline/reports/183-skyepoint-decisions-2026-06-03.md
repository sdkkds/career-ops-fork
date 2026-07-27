# Evaluación: SkyePoint Decisions — Vulnerability Management Lead

**Fecha:** 2026-06-03
**Arquetipo:** Vulnerability Management Program Manager (secondary fit) / Technical Security Program Manager
**Score:** 1.0/5
**Legitimacy:** Proceed with Caution
**URL:** https://job-boards.greenhouse.io/skyepointdecisionsinc/jobs/4240049009
**PDF:** ❌ no generado (hard reject — ver más abajo)
**Batch ID:** nightly-2026-06-03-3

---

## ⛔ VEREDICTO: NO APLICAR

Esta oferta dispara **tres hard constraints** del perfil de Sunjay (`modes/_profile.md`). No requiere análisis ponderado — los blockers son absolutos.

| Hard constraint | Regla del perfil | Estado en esta oferta |
|-----------------|------------------|------------------------|
| **Active clearance required** | "Secret clearance required → score 1.0, reject" | JD: *"At least an active Secret clearance"* → **BLOCKER** |
| **Comp < $150K floor** | "Range entirely below $150K → score 1.5, flag" | JD: $90,000–$120,000 → **techo $30K por debajo del piso** |
| **Federal/government work** | "Direct federal employer → reject" | Contratista federal (DoED FSA, Washington DC). No es empleador federal directo, pero el trabajo es 100% federal con clearance. |

Cualquiera de los dos primeros, solo, ya descarta. Juntos, no hay nada que negociar.

---

## A) Resumen del Rol

| Campo | Valor |
|-------|-------|
| **Arquetipo detectado** | Vulnerability Management Program Manager (secondary fit en perfil) |
| **Domain** | Cybersecurity — federal / public sector (DoED Federal Student Aid) |
| **Function** | Vulnerability management, POA&M, ATO, continuous monitoring |
| **Seniority** | Lead |
| **Remote** | Sí (remoto declarado) |
| **Team size** | No especificado; coordina con ISOs/ISSOs/compliance/engineering |
| **Empleador** | SkyePoint Decisions (contratista IT federal, HQ Dulles VA) |
| **Comp** | $90,000–$120,000 |
| **TL;DR** | Lead de vuln management para un contrato del Dept. of Education. Posición **contingente a ganar el contrato**. Requiere clearance Secret activo, ciudadanía US, y cert (CISSP cumple). Comp muy por debajo del piso de Sunjay. |

## B) Match con CV

El match temático **es bueno** — por eso vale la pena documentar por qué aun así se descarta. Sunjay hace exactamente este tipo de trabajo, pero los gates de elegibilidad lo bloquean.

| Requisito del JD | Match en CV | Veredicto |
|------------------|-------------|-----------|
| Oversee vulnerability management, remediation tracking | `cv.md:14` "vulnerability management... programs in healthcare"; `cv.md:24-32` PO Offensive Security | ✅ Fuerte |
| Coordinate with compliance/engineering to close gaps | `cv.md:44` "security remediation verification program" (NCC, Fortune 10); `cv.md:32` stakeholder liaison | ✅ Fuerte |
| Develop dashboards/metrics | `cv.md:67` "reported and analyzed SLA and KPI metrics" | ✅ Adyacente |
| Bachelor + 6 yrs cybersecurity (OS + networking) | `cv.md:86` BA; helpdesk→networking→sysadmin→AzureGov→security ≥6 yrs | ✅ Cumple |
| **Active Secret clearance** | Sin clearance activo. AzureGov/DoD/CJIS exposure (`cv.md:65,75`) pero salió de trabajo cleared en 2021 → cualquier clearance estaría inactivo/expirado | ❌ **HARD BLOCKER** |
| Cert: GCIH/CISSP/CISM/CRISC | `cv.md:95` **CISSP (2015)** | ✅ Cumple |
| US citizen | No declarado en CV; probable, pero no verificable aquí | ⚠️ Sin verificar |
| Tenable, AquaSec, CDM integration | No en CV. Hace vuln management a nivel programa, no tool-specific en estas herramientas | ❌ Gap |
| ATO / POA&M / continuous monitoring | Exposure federal (AzureGov) pero no ownership explícito de ATO/POA&M | ⚠️ Gap parcial |

**Gaps:**
1. **Active Secret clearance** — Hard blocker, no mitigable a corto plazo. Obtener un clearance lo patrocina el empleador y toma meses; no aplica para una posición que lo exige *activo* ya.
2. **Tenable/AquaSec/CDM** — Nice-to-have demostrable con experiencia adyacente, pero irrelevante dado el blocker de clearance.
3. **ATO/POA&M ownership** — Gap real para roles federales; desarrollable, pero no aquí.

## C) Nivel y Estrategia

No aplica — la oferta se descarta por elegibilidad, no por nivel. A nivel de *trabajo*, "Lead" encaja con el seniority de Sunjay. A nivel de *comp*, el rango Lead aquí ($90-120K) está calibrado para mercado federal/GS-equivalente, no para el mercado comercial senior de Sunjay ($150K+).

## D) Comp y Demanda

| Dato | Valor | Fuente |
|------|-------|--------|
| Rango publicado | $90,000–$120,000 | JD (transparencia salarial ✅) |
| Piso de Sunjay | $150,000 | `_profile.md` |
| Brecha | **−$30K bajo el piso, en el techo** | — |
| Score comp | **1.5/5** (well below market para su perfil) | — |

No se ejecutó investigación de mercado adicional (Glassdoor/Levels/Blind): el rango está publicado y es decisivo. El mercado federal-contractor para vuln management leads ronda $100-130K — consistente con lo publicado. Es comp normal *para ese mercado*, simplemente no para Sunjay.

## E) Plan de Personalización

No aplica — no se recomienda aplicar, no se genera CV personalizado.

## F) Plan de Entrevistas

No aplica.

## G) Posting Legitimacy

**Assessment: Proceed with Caution** (modo batch — freshness sin verificar).

| Señal | Lectura |
|-------|---------|
| Calidad de descripción | Alta — responsabilidades específicas, reqs realistas, salario transparente, bajo boilerplate |
| **Contingent on contract win** | ⚠️ JD declara *"This is a contingent position based upon contract win."* — el rol **no existe aún**; depende de que SkyePoint gane el contrato CPSS. Las contingent reqs a menudo se publican para llenar pipeline de candidatos antes de tener vacante real. |
| Reposting | No aparece en `data/applications.md` (sin duplicado). |
| Empleador | SkyePoint Decisions — contratista IT federal legítimo, HQ Dulles VA. Empresa real. |
| Freshness (días publicado / botón apply) | No verificable en modo batch (sin Playwright). |

La empresa es real y la oferta legítima, pero **contingent-on-award** significa que aplicar podría no llevar a nada accionable en el corto plazo aunque fueras elegible.

---

## Score Global

| Dimensión | Score |
|-----------|-------|
| Match con CV (temático) | 4/5 |
| Alineación North Star (vCISO/consulting) | 2/5 |
| Comp | 1.5/5 |
| Señales culturales | 3/5 |
| **Hard constraints (clearance + comp)** | **OVERRIDE → 1.0** |
| **Global** | **1.0/5 — NO APLICAR** |

**Razón del override:** El scoring ponderado es irrelevante cuando se disparan hard constraints absolutas. Clearance Secret activo requerido + comp íntegramente bajo el piso de $150K = descarte automático por política de perfil.

---

## Keywords extraídas

vulnerability management, remediation tracking, POA&M, ATO, continuous monitoring, ISO, ISSO, compliance, Tenable, AquaSec, CDM integration, Secret clearance, GCIH, CISSP, CISM, CRISC, dashboards, metrics, Federal Student Aid, cybersecurity
