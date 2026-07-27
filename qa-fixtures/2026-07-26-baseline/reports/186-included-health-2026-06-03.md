# Evaluación: Included Health — Senior Security Engineer

**Fecha:** 2026-06-03
**Arquetipo:** Security Engineer (hands-on coding) — NO mapea a ningún arquetipo target
**Score:** 1.0/5
**Legitimacy:** High Confidence
**URL:** https://jobs.lever.co/includedhealth/52d003b5-b635-4950-9d1b-7aa988ac9c8f
**PDF:** N/A — no generado (hard-reject)
**Batch ID:** nightly-2026-06-03-6
**Verification:** unconfirmed (batch mode)

---

## A) Resumen del Rol

| Campo | Valor |
|-------|-------|
| Arquetipo detectado | **Security Engineer / Application Security Engineer** (hands-on, code-primary) |
| Domain | Healthcare / telehealth (PHI, HIPAA) |
| Function | Hands-on security engineering — automation, AppSec, cloud security, crypto |
| Seniority | Senior (IC) |
| Remote | Sí — fully remote |
| Reports to | Senior Manager, Security Engineering |
| Team size | No especificado |

**TL;DR:** Rol de ingeniería de seguridad **manos al teclado**. Construir automatización en Python/Go/Terraform/Tines, escribir reglas SAST custom, hacer manual code reviews de features de alto riesgo y de implementaciones criptográficas, diseñar arquitectura de red cloud (VPCs, subnets, NACLs), gestionar key lifecycle. **Es un rol de SWE de seguridad, no de programa/producto.**

## B) Match con CV

| Requisito JD | Match CV | Fuerza |
|--------------|----------|--------|
| Build automation en **Python o Go** | Ninguno — candidato lee código, no programa con fluidez | ❌ Hard gap |
| Reglas SAST custom | Ninguno | ❌ |
| Manual security code reviews (crypto) | Ninguno | ❌ |
| SAST/DAST/SCA en CI/CD pipeline | Adyacente — gestionó pen testing programs, no operó tooling | ⚠️ Débil |
| Terraform / IaC | Ninguno | ❌ |
| JIT/PAM access controls (diseño e implementación) | Conceptual — sin implementación hands-on | ❌ |
| Cloud network architecture (VPC/subnet/NACL) | Adyacente — AzureGov infra, pero como manager, no diseño hands-on AWS | ⚠️ Débil |
| Vuln management lifecycle | Sí — product owner de vuln mgmt + pen testing (`cv.md:14`, `cv.md:27-32`) | ✅ Pero el JD quiere *engineering* del lifecycle, no ownership |
| Healthcare / HIPAA / PHI | Sí — health insurance actual (`cv.md:25`) | ✅ |
| AWS (primario), GCP | Débil — experiencia es Azure (`cv.md:76`) | ⚠️ |

**Gaps (todos hard blockers para este rol):**

1. **Programación Python/Go** — núcleo del rol. Candidato no programa con fluidez. No mitigable con framing. **Hard blocker.**
2. **AppSec hands-on (SAST rules, code review, crypto)** — sin experiencia. **Hard blocker.**
3. **IaC/Terraform + AWS network design** — experiencia es Azure a nivel management, no diseño/implementación AWS. **Hard blocker.**

No hay estrategia de mitigación honesta. El 80% de las responsabilidades son tareas de ingeniería que el candidato no ha realizado.

## C) Nivel y Estrategia

- **Nivel JD:** Senior IC, hands-on engineer.
- **Nivel candidato:** Senior Program/Product leadership (security).
- **Mismatch de eje, no de nivel.** No es cuestión de senior vs staff — es ingeniería vs gestión de programa. No hay forma de "vender senior sin mentir" porque el rol pide ejecución técnica directa (escribir y revisar código) que el candidato no hace.
- **Recomendación:** NO aplicar. Aplicar aquí desperdiciaría tiempo del candidato y del recruiter (ver ethical use en CLAUDE.md).

## D) Comp y Demanda

Sin rango publicado en el posting. Estimación de mercado (no verificada en esta corrida):

| Métrica | Estimación |
|---------|-----------|
| Senior Security Engineer, remote US | ~$160K–$215K base |
| Demanda del rol | Alta (AppSec/security automation muy demandado) |
| Score comp | 4/5 (estimado) — pero irrelevante: role-fit mata la oferta |

Comp probablemente cumple el floor de $150K, pero no rescata un mismatch de función fundamental.

## E) Plan de Personalización

**No aplica.** No se recomienda aplicar. No se generan cambios de CV/LinkedIn para esta oferta.

## F) Plan de Entrevistas

**No aplica.** Sin plan de entrevistas — el candidato no superaría un screen técnico que pida live coding en Python/Go o revisión de código criptográfico.

## G) Posting Legitimacy

**Assessment: High Confidence (real, active posting)**

| Señal | Lectura |
|-------|---------|
| JD specificity | Alta — responsabilidades concretas y técnicas (JIT/PAM, SAST custom rules, key lifecycle), no boilerplate |
| Requirements realism | Realista y coherente para un Senior Security Engineer |
| Salary transparency | Ausente (común en Lever, no es red flag por sí solo) |
| Boilerplate ratio | Bajo |
| Reposting | No verificado contra scan-history en esta corrida |
| ATS | Lever (jobs.lever.co) — ATS legítimo |

**Context Notes:** Freshness (días posteado, estado del botón apply) no verificable en batch mode (sin Playwright). La calidad y especificidad del JD indican una vacante real y activa. Included Health es una empresa de telehealth establecida.

---

## Score Global

| Dimensión | Score |
|-----------|-------|
| Match con CV | 1/5 |
| Alineación North Star (vCISO/security PM track) | 1/5 |
| Comp | 4/5 (estimado) |
| Señales culturales | 3/5 |
| Red flags | Hard constraint: **Software engineering primary → Reject** |
| **Global** | **1.0/5 — NO APLICAR** |

**Veredicto:** SKIP. Rol de ingeniería de seguridad hands-on (Python/Go/Terraform, SAST custom, code review de crypto). Choca directamente con el deal-breaker del perfil: "Primary role is software development or engineering → Reject." El único solapamiento real (vuln management + healthcare/HIPAA) no compensa que el 80% del rol es ejecución de código que el candidato no realiza.

---

## Keywords extraídas

Just-in-Time access, PAM, least-privilege, SAST, DAST, SCA, secrets scanning, custom SAST rules, manual code review, vulnerability management lifecycle, Python, Go, Terraform, Tines, SIEM correlation, encryption at rest/in transit, HIPAA, PHI, key management, cloud network architecture, VPC, AWS, GCP, DLP, CI/CD security
