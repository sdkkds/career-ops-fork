@AGENTS.md

<!-- Claude Code-specific guidance only. Everything with an AGENTS.md counterpart lives there. -->

---

## Operational Notes (discovered in use)

**Tool selection — always use the best tool for the job in the moment. Prior situational choices recorded here for reference:**

- **Indeed MCP always fails** — `mcp__claude_ai_Indeed__get_job_details` consistently errors; skip it and go straight to WebFetch for all Indeed URLs
- **First scan setup** — `data/scan-history.tsv` and `data/pipeline.md` must exist before launching the scan subagent; create them if missing (scan mode does not auto-create)
- **Batch workers need profile context injected** — `batch/batch-prompt.md` uses AI/ML archetypes from the original system; always inject `modes/_profile.md` cybersecurity archetypes explicitly when dispatching batch Agent calls for this user
- **Scan URL staleness** — Level 3 (WebSearch) results go stale fast; ~50% of a typical batch may be 404/expired; Level 2 (Greenhouse API) results are significantly more reliable; prefer API over WebSearch where available
- **Perplexity for research depth** — use `perplexity_ask` for Block D comp research (synthesizes Glassdoor/Levels.fyi/Blind better than raw WebSearch), `perplexity_search` with recency filter for Block G layoff/hiring freeze signals, `perplexity_research` for `/career-ops deep` company dives and `/career-ops contacto` contact discovery; do NOT use for `site:`-filtered scan queries (WebSearch handles `site:` syntax, Perplexity does not)
- **run-nightly.ps1** — PS nightly orchestrator at project root; local-only file (not in upstream), so upstream merges never touch it; test with `-EvalOnly -MaxJobs 1 -DryRun` (smoke) or `-EvalOnly -MaxJobs 1` (live); Task Scheduler job `CareerOps-Nightly` runs daily at 6am and is currently **Disabled**; output goes to Vault `Fortress of Solitude\career-ops\`
- **Worker no-JSON on dead JD** — worker exits 0 but emits no JSON block when URL is dead/JD unavailable; script records status=completed, score=null; not a script error, just a dead posting
- **Dead URL bulk check** — Python `urllib.request` HEAD requests reliably detect 404s on Greenhouse/Ashby/Lever; ~30% of scan results go stale within weeks; run before large batch evals
- **decisions.jsonl is append-only** — lives in Vault (`Fortress of Solitude\career-ops\decisions.jsonl`), not project dir; wipe manually after test runs
- **LinkedIn public job URLs** — work via Playwright without login; safe to add to pipeline.md
- **PDF verification is mandatory** — after every pipeline run, explicitly assert the PDF file exists and is non-null before reporting success; `pdf: null` in 8+ sessions went unreported; log `❌` in tracker and surface the failure explicitly rather than silently skipping
- **Tracker count: verify before reporting** — after adding entries, re-read `data/pipeline.md` and `data/applications.md` and count the actual diff; report the verified count, not the expected count — truncated outputs and dedup edge cases have caused count mismatches repeatedly

---

## Local Fork Notes (sdkkds)

- **Upstream is `santifer/career-ops`; `origin` is `sdkkds/career-ops`.** Upgraded v1.3.0 → v1.22.0 on 2026-07-26 by git-merging `upstream/main`, **not** via `update-system.mjs apply` — the v1.3 updater's hardcoded `SYSTEM_PATHS` list predates ~70 new top-level `.mjs` modules, so applying it would have installed a `merge-tracker.mjs` whose imports (`tracker-utils.mjs`, `tracker-parse.mjs`, `role-matcher.mjs`, `tracker-links.mjs`) were never copied. Use `git merge upstream/main` for future upgrades.
- **Local hardening to preserve across upgrades:** `batch/batch-runner.sh` replaces upstream's `--dangerously-skip-permissions` with an explicit `--allowedTools` allowlist plus `--permission-mode dontAsk`, because batch workers read untrusted job postings. Re-check this line after every upstream merge.
- **`run-nightly.ps1` scan interlock:** scan refuses to run unless `CAREEROPS_ALLOW_SCAN=1`. This is deliberate defense-in-depth on top of the disabled scheduled task. Do not remove without reading the SCAN SAFETY GATE comment block in that file.
