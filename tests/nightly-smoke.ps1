<#
.SYNOPSIS
  Smoke + forced-failure test for run-nightly.ps1.

.DESCRIPTION
  Two scenarios, both of which actually EXECUTE the orchestrator rather than
  just parsing it:

    1. Dry run against the isolated pipeline. Proves the script parses, the
       node helpers are reachable, and the reconciliation gate runs.

    2. Forced failure. Puts one URL in the pipeline and points the orchestrator
       at a stub worker that prints prose and exits 0 — the exact shape of the
       old bug, where "exit 0 and some braces somewhere in stdout" was recorded
       as a successful evaluation. The run must refuse to call it a success.

  Safety: this never invokes the real `claude` worker (costs money, hits live
  job boards) and never runs a scan (CAREEROPS_ALLOW_SCAN stays unset, and both
  scenarios pass -EvalOnly). It does not touch the scheduled task.

  Isolation: vault writes are redirected to a temp dir via CAREEROPS_VAULT_DIR,
  and pipeline.md / applications.md / needs-attention.md are redirected to a
  per-run temp data dir via CAREEROPS_DATA_DIR (run-nightly.ps1 propagates that
  to merge-tracker.mjs / verify-pipeline.mjs / reserve-report-num.mjs via
  CAREER_OPS_TRACKER, so nothing in this suite reads or writes the user's real
  ~176-row queue or 11-row tracker). The real data/pipeline.md,
  data/applications.md and data/needs-attention.md are additionally backed up
  and restored as defence in depth, even though nothing should touch them now.
#>
$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false

Set-Location $PSScriptRoot\..
$Root = $PWD.Path

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw "ASSERTION FAILED: $Message" }
    Write-Host "    ok: $Message" -ForegroundColor DarkGray
}

Write-Host "1. Syntax check" -ForegroundColor Cyan
$parseErrors = $null
$null = [System.Management.Automation.Language.Parser]::ParseFile(
    "$Root\run-nightly.ps1", [ref]$null, [ref]$parseErrors)
if ($parseErrors) { throw "run-nightly.ps1 has parse errors: $($parseErrors | Out-String)" }
Write-Host "    ok" -ForegroundColor DarkGray

Write-Host "1b. Fail-loud lint: no bare catch {}" -ForegroundColor Cyan
# A bare `catch {}` sends an error down the success path and destroys the only
# evidence it happened. Absorbing a failure is sometimes correct — a diagnostic
# tracer must not end the run — but absorbing it SILENTLY is not: the handler
# has to leave a record of why.
#
# Static, on purpose. The cases worth catching here are the ones no scenario
# reaches: a tracer whose own log is unwritable does not happen on a healthy
# box, so only reading the source finds it.
# Matched on the AST, not on text. A regex for 'catch\s*\{\s*\}' also matches
# the string inside a comment explaining why a catch is NOT bare — which it did
# on the first run of this very check. A lint that flags prose is a lint that
# gets switched off.
function Get-BareCatch {
    param([scriptblock]$Predicate = $null, $Ast)
    @($Ast.FindAll({
        param($n)
        $n -is [System.Management.Automation.Language.CatchClauseAst] -and
        $n.Body.Statements.Count -eq 0
    }, $true))
}
$orchAst = [System.Management.Automation.Language.Parser]::ParseFile(
    "$Root\run-nightly.ps1", [ref]$null, [ref]$null)
$bareCatch = Get-BareCatch -Ast $orchAst
$bareCatchWhere = if ($bareCatch) {
    ' at line(s) ' + (($bareCatch | ForEach-Object { $_.Extent.StartLineNumber }) -join ', ')
} else { '' }
Assert-True ($bareCatch.Count -eq 0) `
            "no bare 'catch {}' in run-nightly.ps1 (found $($bareCatch.Count)$bareCatchWhere)"

# Control: the check must be capable of firing, or the assertion above is
# vacuous and would stay green if a bare catch were reintroduced tomorrow.
$controlAst = [System.Management.Automation.Language.Parser]::ParseInput(
    'try { throw "x" } catch { }', [ref]$null, [ref]$null)
Assert-True ((Get-BareCatch -Ast $controlAst).Count -eq 1) `
            "control: the bare-catch check detects a known bare catch"
# And the inverse: a catch WITH a body must not be reported, or the check would
# simply flag every catch and say nothing about silence.
$controlAst2 = [System.Management.Automation.Language.Parser]::ParseInput(
    'try { throw "x" } catch { Write-Host $_ }', [ref]$null, [ref]$null)
Assert-True ((Get-BareCatch -Ast $controlAst2).Count -eq 0) `
            "control: a catch with a body is not reported as bare"
Write-Host "    ok" -ForegroundColor DarkGray

# --- Scratch state so neither scenario pollutes the vault or the user's real
#     data dir. Built BEFORE any node helper call below so isolation is in
#     effect for the whole suite, not just the run-nightly.ps1 invocations.
#
#     Deliberately NOT under the OS temp dir ([IO.Path]::GetTempPath(), i.e.
#     %TEMP%): on this box %TEMP% is on C: while the repo is on D:, and
#     merge-tracker.mjs's report-link math uses path.relative(trackerDir,
#     reportsDir) — Node's path.relative() cannot compute a relative path
#     across two different Windows drive letters and silently falls back to
#     returning the absolute target path instead, which then fails
#     verify-pipeline's report-link existence check. Keeping the scratch dir
#     on the repo's own drive sidesteps that entirely and matches how the
#     real data dir is always co-located with the repo in production. ---
$Scratch      = Join-Path $Root ".smoke-tmp\careerops-smoke-$PID"
$VaultStub    = Join-Path $Scratch 'vault'
$DataStub     = Join-Path $Scratch 'data'
$StubWorker   = Join-Path $Scratch 'stub-worker.ps1'
New-Item -ItemType Directory -Force -Path $VaultStub | Out-Null
New-Item -ItemType Directory -Force -Path $DataStub  | Out-Null

# Isolated pipeline/tracker/needs-attention live under $DataStub for the whole
# run. run-nightly.ps1 reads CAREEROPS_DATA_DIR and propagates it (via
# CAREER_OPS_TRACKER) to merge-tracker.mjs / verify-pipeline.mjs /
# reserve-report-num.mjs, so every one of those child processes also targets
# this temp dir instead of the user's real data/applications.md.
$PipelineFile = Join-Path $DataStub 'pipeline.md'
$Tracker      = Join-Path $DataStub 'applications.md'
$NeedsAttn    = Join-Path $DataStub 'needs-attention.md'

# Section headers ('## Pendientes' / '## Procesadas') are load-bearing —
# reconcile-pipeline.mjs and scan.mjs key off them by name — so the seed must
# use the same structure as the real file, not an ad hoc placeholder.
"# Pipeline - Pending Evaluations`n`n## Pendientes`n`n## Procesadas`n" |
    Set-Content $PipelineFile -Encoding utf8 -NoNewline

# Matches the real data/applications.md header exactly (11 columns) so
# merge-tracker.mjs's row parser sees the same shape it does in production.
"# Applications Tracker`n`n| # | Date | Company | Via | Role | Score | Status | PDF | Report | URL | Notes |`n|---|------|---------|-----|------|-------|--------|-----|--------|-----|-------|`n" |
    Set-Content $Tracker -Encoding utf8 -NoNewline

Write-Host "2. Node helpers reachable" -ForegroundColor Cyan
node lib/pipeline-state.mjs --file "$PipelineFile" --list --limit 1 | Out-Null
if ($LASTEXITCODE -ne 0) { throw "pipeline-state CLI failed" }
node lib/eval-verify.mjs --log nul --root $Root --report x.md --tsv x.tsv --url https://x.test | Out-Null
if ($LASTEXITCODE -ne 1) { throw "eval-verify should exit 1 on an empty log, got $LASTEXITCODE" }
Write-Host "    ok" -ForegroundColor DarkGray

# Stub A ignores every flag the orchestrator passes, prints prose, exits 0.
# This is the exact shape of the old bug: exit 0 plus some braces in stdout used
# to be recorded as a successful evaluation.
@'
param()
Write-Output "I evaluated the role and it looks great! Score is around 4.5 I think."
Write-Output "Some prose with { braces } in it, and a stray } at the end."
exit 0
'@ | Set-Content $StubWorker -Encoding utf8

# Stub B is an honest worker: it writes the report and TSV artifacts and emits a
# well-formed sentinel block. Used to prove the success path still records a
# completed eval, marks the row done, and lets the run exit 0.
$GoodWorker = Join-Path $Scratch 'good-worker.ps1'
@'
param()
$all = $args -join ' '
$num  = [regex]::Match($all, 'Report number:\s*(\d+)').Groups[1].Value
$id   = [regex]::Match($all, 'Batch ID:\s*(\S+)').Groups[1].Value
$url  = [regex]::Match($all, 'URL:\s*(\S+)').Groups[1].Value
$date = [regex]::Match($all, 'Date:\s*(\S+)').Groups[1].Value
$root = $env:CAREEROPS_SMOKE_ROOT

# Record what the orchestrator handed the worker, for scenario 7's wiring
# assertions. The resolved prompt file is deleted once the worker exits, so it
# has to be copied now, not read afterwards.
$args | Set-Content "$env:CAREEROPS_SMOKE_SCRATCH\last-argv.txt" -Encoding utf8
$pi = [array]::IndexOf($args, '--append-system-prompt-file')
if ($pi -ge 0) { Copy-Item $args[$pi + 1] "$env:CAREEROPS_SMOKE_SCRATCH\last-prompt.md" -Force }

Set-Content "$root\reports\$num-stubco-$date.md" -Encoding utf8 -Value @"
# $num - StubCo - Senior Security PM
**Score:** 4.2/5
**URL:** $url
**Legitimacy:** High Confidence
"@

$cols = @($num, $date, 'StubCo', 'Senior Security PM', 'Evaluated', '4.2/5', "$([char]0x274C)", "[$num](reports/$num-stubco-$date.md)", 'smoke stub')
Set-Content "$root\batch\tracker-additions\$num-$id.tsv" -Encoding utf8 -Value ($cols -join "`t")

Write-Output "Chatty preamble the orchestrator must ignore. { not json }"
Write-Output "CAREEROPS_RESULT_JSON_BEGIN"
Write-Output (@{
    status = 'completed'; id = $id; report_num = $num; url = $url
    company = 'StubCo'; role = 'Senior Security PM'; score = 4.2
    tracker_status = 'Evaluated'; legitimacy = 'High Confidence'; pdf = $null
    report = "reports/$num-stubco-$date.md"; tsv = "batch/tracker-additions/$num-$id.tsv"; error = $null
} | ConvertTo-Json -Compress)
Write-Output "CAREEROPS_RESULT_JSON_END"
exit 0
'@ | Set-Content $GoodWorker -Encoding utf8

# Stub C: succeeds for URLs containing "good", fails for everything else. Used
# to produce a genuinely mixed batch — the normal nightly outcome once some
# postings have gone dead.
$MixedWorker = Join-Path $Scratch 'mixed-worker.ps1'
@'
param()
$all = $args -join ' '
$url = [regex]::Match($all, 'URL:\s*(\S+)').Groups[1].Value
if ($url -notmatch 'good') {
    Write-Output "This posting appears to be gone. { no json here }"
    exit 0
}
& (Join-Path $env:CAREEROPS_SMOKE_SCRATCH 'good-worker.ps1') @args
'@ | Set-Content $MixedWorker -Encoding utf8

# Digest send stub. From scenario 7 onward the good/mixed workers produce a
# completed eval scoring 4.2, which now triggers run-nightly.ps1's digest
# step. digest.mjs must NEVER be allowed to shell out to the real `gws`
# during a test run, so point it at a trivial node script via the same
# test-only override pattern as CAREEROPS_WORKER_CMD (see digest.mjs's
# CAREEROPS_DIGEST_CMD / CAREEROPS_DIGEST_PREFIX_ARGS). Node itself is
# always directly spawnable on Windows (no .cmd/.bat shell requirement),
# which is why the stub is a .mjs file rather than a .ps1.
$DigestStub = Join-Path $Scratch 'digest-stub.mjs'
@'
console.log("digest stub: pretending to send");
process.exit(0);
'@ | Set-Content $DigestStub -Encoding utf8
$env:CAREEROPS_DIGEST_CMD         = 'node'
$env:CAREEROPS_DIGEST_PREFIX_ARGS = "[$($DigestStub | ConvertTo-Json)]"

# Digest FAILURE stub — exits 1, simulating a send failure (gws down, not
# authenticated, network error) without ever touching a real mail transport.
# Used by scenario 13 below.
$DigestFailStub = Join-Path $Scratch 'digest-fail-stub.mjs'
@'
console.error("digest stub: simulated send failure");
process.exit(1);
'@ | Set-Content $DigestFailStub -Encoding utf8

# Real live files, kept ONLY for the defence-in-depth backup/restore below.
# Nothing in this suite should read or write these once CAREEROPS_DATA_DIR is
# set — they are the user's real ~176-row queue and 11-row tracker.
$RealPipelineFile = "$Root\data\pipeline.md"
$RealTracker      = "$Root\data\applications.md"
$RealNeedsAttn    = "$Root\data\needs-attention.md"
$InflightFile     = "$Root\batch\.nightly-inflight.json"
$pipelineBackup   = Get-Content $RealPipelineFile -Raw -Encoding utf8
$trackerBackup    = Get-Content $RealTracker -Raw -Encoding utf8
$needsBackup      = if (Test-Path $RealNeedsAttn) { Get-Content $RealNeedsAttn -Raw -Encoding utf8 } else { $null }

try {
    Write-Host "3. Dry run, eval only" -ForegroundColor Cyan
    $env:CAREEROPS_VAULT_DIR = $VaultStub
    $env:CAREEROPS_DATA_DIR  = $DataStub
    pwsh -NoProfile -File "$Root\run-nightly.ps1" -EvalOnly -MaxJobs 1 -DryRun | Out-Null
    Assert-True ($LASTEXITCODE -eq 0) "dry run exited 0 (got $LASTEXITCODE)"
    Assert-True (-not (Test-Path (Join-Path $VaultStub 'morning-review.md'))) "dry run wrote no morning-review"
    Assert-True (-not (Test-Path (Join-Path $VaultStub 'decisions.jsonl'))) "dry run wrote no decisions"

    Write-Host "4. Forced failure: stub worker prints prose and exits 0" -ForegroundColor Cyan
    $url = 'https://x.test/j/smoke'
    # Add-Content writes CRLF — that is deliberate. A Windows-written pipeline
    # row must be visible to the parser, which it was not before this change.
    Add-Content $PipelineFile "- [ ] $url | StubCo | Senior Security PM" -Encoding utf8

    $env:CAREEROPS_WORKER_CMD = $StubWorker
    pwsh -NoProfile -File "$Root\run-nightly.ps1" -EvalOnly -MaxJobs 1 | Out-Null
    $runExit = $LASTEXITCODE

    $row = (Get-Content $PipelineFile -Encoding utf8 | Where-Object { $_ -match [regex]::Escape($url) })
    $naRow = if (Test-Path $NeedsAttn) {
        Get-Content $NeedsAttn -Encoding utf8 | Where-Object { $_ -match [regex]::Escape($url) } | Select-Object -Last 1
    } else { $null }
    # Assign in two steps: `$x = if (...) { @(...) }` unwraps a single-element
    # array back to a scalar, and indexing a scalar string yields a character.
    $decisionsFile = Join-Path $VaultStub 'decisions.jsonl'
    $decisions = @()
    if (Test-Path $decisionsFile) { $decisions = @(Get-Content $decisionsFile -Encoding utf8) }

    Write-Host "    pipeline row : $row" -ForegroundColor DarkGray
    Write-Host "    needs-attn   : $naRow" -ForegroundColor DarkGray
    Write-Host "    decisions    : $($decisions.Count) line(s)" -ForegroundColor DarkGray
    if ($decisions.Count -gt 0) { Write-Host "    decision[0]  : $($decisions[0])" -ForegroundColor DarkGray }

    # Exit-code contract: nothing completed, so this is a broken run (1), not a
    # partial batch (2).
    Assert-True ($runExit -eq 1) "run exited 1 — nothing completed (got $runExit)"
    Assert-True ($null -ne $row) "the CRLF-written pipeline row was seen at all"
    Assert-True ($row -match '^\- \[!\]') "pipeline row ends as failed '- [!]'"
    Assert-True ($row -match '<!-- attempts:1 -->') "pipeline row records attempts:1"
    Assert-True ($null -ne $naRow) "needs-attention row names the URL"
    Assert-True ($naRow -match 'eval') "needs-attention row records the eval stage"
    Assert-True ($decisions.Count -eq 1) "exactly one decision line appended (got $($decisions.Count))"
    Assert-True ($decisions[0] -match '"status":"failed"') "the decision records status=failed"
    # Tightened 2026-09-19. The old form was `-not (Test-Path ...) -or <content
    # matches>`, which passed whether or not the file was written at all — it
    # would have stayed green through the very defect scenario 7b now covers.
    # A run whose only job failed still has results to render, so require the
    # file rather than tolerating its absence.
    Assert-True (Test-Path (Join-Path $VaultStub 'morning-review.md')) `
                "a run whose only job failed still wrote a morning review"
    Assert-True ((Get-Content (Join-Path $VaultStub 'morning-review.md') -Raw) -match 'No scored results') `
                "morning review claims no scored results"
    Assert-True (@(Get-ChildItem "$Root\reports" -Filter '*-RESERVED.md' -ErrorAction SilentlyContinue).Count -eq 0) `
                "the reserved report number was released"

    Write-Host "5. Retry: the same row is picked up again and attempts increments" -ForegroundColor Cyan
    # The trap this guards: `attempts` must be threaded from the listing in
    # memory. Re-deriving it from the file after the in-progress write reads back
    # the same number every time, so the budget never advances and the job
    # retries forever.
    pwsh -NoProfile -File "$Root\run-nightly.ps1" -EvalOnly -MaxJobs 1 | Out-Null
    $retryExit = $LASTEXITCODE
    $row2 = (Get-Content $PipelineFile -Encoding utf8 | Where-Object { $_ -match [regex]::Escape($url) })
    Write-Host "    pipeline row : $row2" -ForegroundColor DarkGray
    Assert-True ($retryExit -eq 1) "retry run also exited 1 (got $retryExit)"
    Assert-True ($row2 -match '<!-- attempts:2 -->') "attempts advanced 1 -> 2, budget is not stuck"

    Write-Host "6. Retry budget exhausted: the row is no longer actionable" -ForegroundColor Cyan
    $listed = node lib/pipeline-state.mjs --file "$PipelineFile" --list --limit 10 | Out-String
    Assert-True ($listed -notmatch [regex]::Escape($url)) "row past the retry budget is not listed again"

    pwsh -NoProfile -File "$Root\run-nightly.ps1" -EvalOnly -MaxJobs 1 | Out-Null
    Assert-True ($LASTEXITCODE -eq 0) "a run with nothing actionable exits 0 (got $LASTEXITCODE)"
    Assert-True (@(Get-Content $decisionsFile -Encoding utf8).Count -eq 2) `
                "no third decision was appended — the exhausted row was not re-evaluated"

    Write-Host "7. Success path: an honest worker is recorded as completed" -ForegroundColor Cyan
    # Without this, the suite would only prove the script can fail. Trace one job
    # all the way: listed -> in-progress -> dispatched -> verified -> decision
    # appended -> marked done -> reconciled -> merged.
    $okUrl = 'https://x.test/j/smoke-ok'
    Add-Content $PipelineFile "- [ ] $okUrl | StubCo | Senior Security PM" -Encoding utf8
    $env:CAREEROPS_WORKER_CMD    = $GoodWorker
    $env:CAREEROPS_SMOKE_ROOT    = $Root
    $env:CAREEROPS_SMOKE_SCRATCH = $Scratch

    pwsh -NoProfile -File "$Root\run-nightly.ps1" -EvalOnly -MaxJobs 1 | Out-Null
    $okExit = $LASTEXITCODE

    $okRow = (Get-Content $PipelineFile -Encoding utf8 | Where-Object { $_ -match [regex]::Escape($okUrl) })
    $decisions2 = @(Get-Content $decisionsFile -Encoding utf8)
    $review = Join-Path $VaultStub 'morning-review.md'

    Write-Host "    pipeline row : $okRow" -ForegroundColor DarkGray
    Write-Host "    decision[2]  : $($decisions2[2])" -ForegroundColor DarkGray

    Assert-True ($okExit -eq 0) "successful run exited 0 (got $okExit)"
    Assert-True ($okRow -match '^\- \[x\]') "pipeline row drained to done '- [x]'"
    Assert-True ($decisions2.Count -eq 3) "a third decision line was appended (got $($decisions2.Count))"
    Assert-True ($decisions2[2] -match '"status":"completed"') "the decision records status=completed"
    Assert-True ($decisions2[2] -match '"score":4.2') "the decision carries the verified score"
    Assert-True ((Get-Content $review -Raw) -match 'StubCo') "morning review lists the completed role"
    Assert-True ((Get-Content $Tracker -Raw) -match [regex]::Escape($okUrl) -or
                 (Get-Content $Tracker -Raw) -match 'StubCo') "merge-tracker wrote the row into applications.md"
    Assert-True (@(Get-ChildItem "$Root\reports" -Filter '*-RESERVED.md' -ErrorAction SilentlyContinue).Count -eq 0) `
                "no reservation sentinel left behind"

    # Worker wiring (2026-10-02). run-nightly.ps1 is fork-local, so the merge
    # guard (check-fork-invariants.mjs) does not cover it; this does. The deny
    # list closes inherited user-level allows for context-mode's code-execution
    # tools; the notes stop the worker Reading a fake JD path and attempting
    # shell writes it is not permitted.
    $argv   = @(Get-Content "$Scratch\last-argv.txt" -Encoding utf8)
    $prompt = Get-Content "$Scratch\last-prompt.md" -Raw -Encoding utf8
    $di = [array]::IndexOf($argv, '--disallowedTools')
    Assert-True ($di -ge 0) "the worker is launched with --disallowedTools"
    $denied = if ($di -ge 0) { @($argv[$di + 1] -split ',') } else { @() }
    foreach ($tool in 'ctx_execute', 'ctx_execute_file', 'ctx_batch_execute') {
        Assert-True ($denied -contains "mcp__plugin_context-mode_context-mode__$tool") "the deny list names $tool"
    }
    Assert-True ($argv -contains '--permission-mode' -and $argv -contains 'dontAsk') "the worker still runs dontAsk"
    Assert-True ($prompt -match '## Nightly worker notes') "the resolved prompt carries the nightly worker notes"
    Assert-True ($prompt -notmatch 'not-pre-downloaded\.md') "the resolved prompt names no fake JD path"
    Assert-True (($argv -join ' ') -notmatch 'not-pre-downloaded\.md') "the user message names no fake JD path"

    Write-Host "7b. A quiet run still refreshes the morning review" -ForegroundColor Cyan
    # The failure this guards is silence, not a crash. The vault-output block
    # skipped the write entirely when a run evaluated nothing ("No results to
    # write"), so morning-review.md kept displaying an EARLIER run's hits. A
    # nightly that had stopped firing and a nightly that simply found nothing
    # produced byte-identical evidence in the one artifact a human opens.
    #
    # Deliberately placed after scenario 7, while the review still lists StubCo:
    # asserting "the quiet run's review does not mention StubCo" is only
    # meaningful if StubCo is in there to begin with. Run before it, this test
    # would pass against the bug.
    $quietBefore = (Get-Item $review).LastWriteTime
    Assert-True ((Get-Content $review -Raw) -match 'StubCo') `
                "precondition: the review lists StubCo before the quiet run"

    # Nothing is actionable now: $url is past its retry budget and $okUrl drained
    # to done, so this run evaluates zero jobs.
    pwsh -NoProfile -File "$Root\run-nightly.ps1" -EvalOnly -MaxJobs 1 | Out-Null
    $quietExit = $LASTEXITCODE
    $quietText = if (Test-Path $review) { Get-Content $review -Raw -Encoding utf8 } else { '' }

    Assert-True ($quietExit -eq 0) "the quiet run exited 0 (got $quietExit)"
    Assert-True (Test-Path $review) "the quiet run still produced a morning review"
    Assert-True ((Get-Item $review).LastWriteTime -gt $quietBefore) `
                "the review was rewritten by the quiet run, not left from an earlier one"
    Assert-True ($quietText -notmatch 'StubCo') `
                "the quiet run's review no longer shows the previous run's role"
    Assert-True ($quietText -match '0 top result') `
                "the quiet run's review states it found nothing this run"

    Write-Host "8. Orchestrator error: a job is never left stranded in-progress" -ForegroundColor Cyan
    # If the worker binary is missing, PowerShell throws before any verdict
    # exists. The row must still end failed, not parked in-progress where
    # listActionable would never look at it again.
    $errUrl = 'https://x.test/j/smoke-err'
    Add-Content $PipelineFile "- [ ] $errUrl | StubCo | Senior Security PM" -Encoding utf8
    $env:CAREEROPS_WORKER_CMD = Join-Path $Scratch 'no-such-worker-xyz.ps1'
    pwsh -NoProfile -File "$Root\run-nightly.ps1" -EvalOnly -MaxJobs 1 | Out-Null
    $errExit = $LASTEXITCODE
    $errRow = (Get-Content $PipelineFile -Encoding utf8 | Where-Object { $_ -match [regex]::Escape($errUrl) })
    Write-Host "    pipeline row : $errRow" -ForegroundColor DarkGray
    Assert-True ($errExit -eq 1) "run with a missing worker exited 1 (got $errExit)"
    Assert-True ($errRow -match '^\- \[!\]') "row ended failed, not stranded in-progress"
    Assert-True ((Get-Content $NeedsAttn -Raw) -match [regex]::Escape($errUrl)) "the error was recorded in needs-attention"
    Assert-True (@(Get-ChildItem "$Root\reports" -Filter '*-RESERVED.md' -ErrorAction SilentlyContinue).Count -eq 0) `
                "reservation released even on the error path"

    Write-Host "9. Crash recovery: a row left in-progress is reaped and retried" -ForegroundColor Cyan
    $crashUrl = 'https://x.test/j/smoke-crash'
    Add-Content $PipelineFile "- [ ] $crashUrl | StubCo | Senior Security PM" -Encoding utf8
    # Simulate a run that died between the two marker writes.
    node lib/pipeline-state.mjs --file "$PipelineFile" --url $crashUrl --state in-progress | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "could not stage the in-progress row" }

    $env:CAREEROPS_WORKER_CMD = $GoodWorker
    pwsh -NoProfile -File "$Root\run-nightly.ps1" -EvalOnly -MaxJobs 5 | Out-Null
    $crashRow = (Get-Content $PipelineFile -Encoding utf8 | Where-Object { $_ -match [regex]::Escape($crashUrl) })
    Write-Host "    pipeline row : $crashRow" -ForegroundColor DarkGray
    Assert-True ($crashRow -notmatch '^\- \[~\]') "the stranded row did not stay in-progress"
    Assert-True ((Get-Content $NeedsAttn -Raw) -match 'crash-recovery') "the reaper logged a crash-recovery row"
    Assert-True ($crashRow -match '^\- \[x\]') "the reaped row was retried and completed"

    Write-Host "10. Mixed batch: some verified, some dead -> exit 2, not exit 1" -ForegroundColor Cyan
    # The realistic nightly shape. Roughly a third of scanned URLs go stale, so
    # a run of "most completed, some dead" is CORRECT and must be
    # distinguishable from a broken run, or the owner learns to ignore the gate.
    $goodUrl = 'https://x.test/j/mixed-good'
    $deadUrl = 'https://x.test/j/mixed-dead'
    Add-Content $PipelineFile "- [ ] $goodUrl | StubCo | Senior Security PM" -Encoding utf8
    Add-Content $PipelineFile "- [ ] $deadUrl | StubCo | Senior Security PM" -Encoding utf8
    $env:CAREEROPS_WORKER_CMD = $MixedWorker
    pwsh -NoProfile -File "$Root\run-nightly.ps1" -EvalOnly -MaxJobs 5 | Out-Null
    $mixedExit = $LASTEXITCODE
    $goodRow = (Get-Content $PipelineFile -Encoding utf8 | Where-Object { $_ -match [regex]::Escape($goodUrl) })
    $deadRow = (Get-Content $PipelineFile -Encoding utf8 | Where-Object { $_ -match [regex]::Escape($deadUrl) })
    Write-Host "    good row     : $goodRow" -ForegroundColor DarkGray
    Write-Host "    dead row     : $deadRow" -ForegroundColor DarkGray
    Assert-True ($mixedExit -eq 2) "partial batch exited 2, not 1 (got $mixedExit)"
    Assert-True ($goodRow -match '^\- \[x\]') "the live posting drained to done"
    Assert-True ($deadRow -match '^\- \[!\]') "the dead posting is recorded failed"
    Assert-True ((Get-Content $NeedsAttn -Raw) -match [regex]::Escape($deadUrl)) "the dead posting is in needs-attention"

    Write-Host "11. Reservation is released when the in-progress marker fails" -ForegroundColor Cyan
    # Regression guard: the report number is reserved before the marker write.
    # If that write fails (queue/run divergence), Set-PipelineState exits, and
    # PowerShell runs finally on exit — so the sentinel must still be released.
    # A leaked reports/NNN-RESERVED.md would fail verify-pipeline's stale-sentinel
    # check on EVERY subsequent run, since nothing calls --gc.
    $lockUrl = 'https://x.test/j/marker-fail'
    Add-Content $PipelineFile "- [ ] $lockUrl | StubCo | Senior Security PM" -Encoding utf8
    $env:CAREEROPS_WORKER_CMD = $GoodWorker
    Set-ItemProperty -Path $PipelineFile -Name IsReadOnly -Value $true
    try {
        pwsh -NoProfile -File "$Root\run-nightly.ps1" -EvalOnly -MaxJobs 1 | Out-Null
        $lockExit = $LASTEXITCODE
    } finally {
        Set-ItemProperty -Path $PipelineFile -Name IsReadOnly -Value $false
    }
    $sentinels = @(Get-ChildItem "$Root\reports" -Filter '*-RESERVED.md' -ErrorAction SilentlyContinue)
    Write-Host "    exit=$lockExit sentinels=$($sentinels.Count)" -ForegroundColor DarkGray
    Assert-True ($lockExit -eq 1) "an unwritable pipeline is fatal (got $lockExit)"
    Assert-True ($sentinels.Count -eq 0) "no reservation sentinel leaked on the marker-failure path"

    Write-Host "12. Reaper leaves alone rows owned by a live process" -ForegroundColor Cyan
    # The PID lock is soft: the operator is told to delete it to override, and
    # the stale-lock branch removes it on PID reuse. If a second instance starts
    # while a first is live, reaping the first run's rows would dispatch the same
    # URL to a second PAID worker and let two runs fight over the marker.
    $ownedUrl = 'https://x.test/j/owned-by-live'
    Add-Content $PipelineFile "- [ ] $ownedUrl | StubCo | Senior Security PM" -Encoding utf8
    node lib/pipeline-state.mjs --file "$PipelineFile" --url $ownedUrl --state in-progress | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "could not stage the owned in-progress row" }
    # $PID here is this test process, which stays alive for the whole child run.
    @{ $ownedUrl = @{ pid = $PID; started = 'smoke' } } | ConvertTo-Json -Depth 5 |
        Set-Content $InflightFile -Encoding utf8

    $env:CAREEROPS_WORKER_CMD = $GoodWorker
    pwsh -NoProfile -File "$Root\run-nightly.ps1" -EvalOnly -MaxJobs 5 > "$Scratch\owned.log" 2>&1
    $ownedExit = $LASTEXITCODE
    $ownedRow = (Get-Content $PipelineFile -Encoding utf8 | Where-Object { $_ -match [regex]::Escape($ownedUrl) })
    Write-Host "    pipeline row : $ownedRow" -ForegroundColor DarkGray
    Assert-True ($ownedRow -match '^\- \[~\]') "row owned by a live PID stayed in-progress, not reaped"
    Assert-True ((Get-Content "$Scratch\owned.log" -Raw) -match 'another live run owns it') `
                "the skip was logged"
    Assert-True ($ownedExit -eq 0) "nothing else was actionable, so the run exited 0 (got $ownedExit)"
    Assert-True ((Get-Content $NeedsAttn -Raw) -notmatch [regex]::Escape($ownedUrl)) `
                "no crash-recovery row was written for the live-owned job"

    Write-Host "13. Digest send fails during a partial batch: exit 1, but the partial-batch state is still logged" -ForegroundColor Cyan
    # Regression guard for two review findings caught only by static trace:
    #   - a digest failure must exit 1, not be silently swallowed or folded
    #     into the exit-2 "normal dead postings" case
    #   - a digest failure must NOT suppress the PARTIAL log line — both
    #     problems (dead postings AND an unnotified operator) must be on
    #     record for this run, even though only one exit code is returned.
    $goodUrl2 = 'https://x.test/j/digestfail-good'
    $deadUrl2 = 'https://x.test/j/digestfail-dead'
    Add-Content $PipelineFile "- [ ] $goodUrl2 | StubCo | Senior Security PM" -Encoding utf8
    Add-Content $PipelineFile "- [ ] $deadUrl2 | StubCo | Senior Security PM" -Encoding utf8
    # Reset the digest cursor before this scenario. Scenarios 7/9/10/12 above
    # ran within the same wall-clock minute and each advanced the cursor on
    # their own successful (stubbed) send, since $RunTimestamp is minute-
    # granularity. Without this reset, this scenario's freshly-evaluated
    # decision can share that same evaluated_at, get filtered out by the
    # <= cursor comparison as "already digested," and never reach the send
    # path at all — which would silently defeat this scenario's whole point
    # (proving what happens when a send is actually attempted and fails).
    Remove-Item (Join-Path $VaultStub 'digest-cursor.json') -Force -ErrorAction SilentlyContinue
    $env:CAREEROPS_WORKER_CMD         = $MixedWorker
    $env:CAREEROPS_DIGEST_PREFIX_ARGS = "[$($DigestFailStub | ConvertTo-Json)]"
    pwsh -NoProfile -File "$Root\run-nightly.ps1" -EvalOnly -MaxJobs 5 > "$Scratch\digestfail.log" 2>&1
    $digestFailExit = $LASTEXITCODE
    $digestFailLog  = Get-Content "$Scratch\digestfail.log" -Raw
    $goodRow2 = (Get-Content $PipelineFile -Encoding utf8 | Where-Object { $_ -match [regex]::Escape($goodUrl2) })
    $deadRow2 = (Get-Content $PipelineFile -Encoding utf8 | Where-Object { $_ -match [regex]::Escape($deadUrl2) })
    Write-Host "    exit=$digestFailExit  good row: $goodRow2" -ForegroundColor DarkGray
    Assert-True ($digestFailExit -eq 1) "digest failure during a partial batch exits 1, not 2 (got $digestFailExit)"
    Assert-True ($digestFailLog -match 'Digest send failed') "the digest failure itself was logged"
    Assert-True ($digestFailLog -match 'PARTIAL') "the partial-batch state was still logged, not dropped, despite the digest failure"
    Assert-True ($goodRow2 -match '^\- \[x\]') "the live posting still drained to done despite the digest failure"
    Assert-True ($deadRow2 -match '^\- \[!\]') "the dead posting is still recorded failed despite the digest failure"
    Assert-True ((Get-Content $NeedsAttn -Raw) -match 'digest-send') "the digest failure landed a digest-send row in needs-attention"

    # Restore the success stub so nothing downstream (if scenarios are ever
    # reordered/added after this one) inherits a failing digest by accident.
    $env:CAREEROPS_DIGEST_PREFIX_ARGS = "[$($DigestStub | ConvertTo-Json)]"

    Write-Host "14. An unusable pipeline row is skipped, not fatal — the rest of the queue still drains" -ForegroundColor Cyan
    # modes/pipeline.md documents `local:jds/foo.md` as a legitimate hand-added
    # entry. The row parses, so it used to be listed and dispatched — and then
    # Set-PipelineState threw ("cannot set state for unparseable url"), which
    # aborted the WHOLE batch with exit 1. The row was never marked, so it was
    # selected first again the next night: one hand-pasted line wedged the
    # nightly forever and leaked an inflight entry every run. It is deliberately
    # added FIRST here so it also proves there is no head-of-line blocking.
    $badRowUrl = 'local:jds/hand-pasted.md'
    $okUrl3    = 'https://x.test/j/unusable-neighbour'
    Add-Content $PipelineFile "- [ ] $badRowUrl | HandPasted | PM" -Encoding utf8
    Add-Content $PipelineFile "- [ ] $okUrl3 | StubCo | Senior Security PM" -Encoding utf8
    $env:CAREEROPS_WORKER_CMD = $GoodWorker
    # Same cursor reset as scenario 13, for the same minute-granularity reason.
    Remove-Item (Join-Path $VaultStub 'digest-cursor.json') -Force -ErrorAction SilentlyContinue
    pwsh -NoProfile -File "$Root\run-nightly.ps1" -EvalOnly -MaxJobs 5 > "$Scratch\unusable.log" 2>&1
    $unusableExit = $LASTEXITCODE
    $unusableLog  = Get-Content "$Scratch\unusable.log" -Raw
    $badRow  = (Get-Content $PipelineFile -Encoding utf8 | Where-Object { $_ -match [regex]::Escape($badRowUrl) })
    $okRow3  = (Get-Content $PipelineFile -Encoding utf8 | Where-Object { $_ -match [regex]::Escape($okUrl3) })
    Write-Host "    exit=$unusableExit  bad row: $badRow" -ForegroundColor DarkGray
    Write-Host "    good row     : $okRow3" -ForegroundColor DarkGray
    Assert-True ($unusableExit -eq 0) "one unusable row does not fail the run (got $unusableExit)"
    Assert-True ($okRow3 -match '^\- \[x\]') "the usable neighbour still drained to done"
    Assert-True ($badRow -match '^\- \[ \]') "the unusable row is left untouched — it cannot be marked at all"
    Assert-True ($unusableLog -match 'Unusable pipeline row') "the skip was logged"
    Assert-True ((Get-Content $NeedsAttn -Raw) -match 'pipeline-parse') "a pipeline-parse needs-attention row was written"
    Assert-True ((Get-Content $NeedsAttn -Raw) -match [regex]::Escape($badRowUrl)) "the needs-attention row names the unusable entry"
    # The old failure leaked an inflight entry per run (Set-Inflight ran, then
    # Set-PipelineState threw before Clear-Inflight could).
    $inflightAfter = if (Test-Path $InflightFile) { Get-Content $InflightFile -Raw } else { '' }
    Assert-True ($inflightAfter -notmatch [regex]::Escape($badRowUrl)) "no inflight entry was leaked for the unusable row"

    Write-Host "15. needs-attention timestamps are a single format" -ForegroundColor Cyan
    # run-nightly.ps1, digest.mjs and merge-tracker.mjs all append to this table.
    # Two of the three used toISOString(); the orchestrator used
    # 'yyyy-MM-dd HH:mm', so the same table interleaved two formats. This
    # needs-attention.md is a fresh temp file created only by this run, so
    # every row in it (not just the ones matching these patterns) originates
    # from this suite — the filter below is just belt-and-suspenders.
    $naRows = @(Get-Content $NeedsAttn -Encoding utf8 |
        Where-Object { $_ -match '^\| ' -and ($_ -match 'x\.test' -or $_ -match [regex]::Escape($badRowUrl)) })
    Assert-True ($naRows.Count -gt 0) "there are needs-attention rows to check (got $($naRows.Count))"
    $badStamps = @($naRows | Where-Object { $_ -notmatch '^\| \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}' })
    Assert-True ($badStamps.Count -eq 0) "every needs-attention timestamp is ISO-8601 (got $($badStamps.Count) that are not: $($badStamps -join ' // '))"
}
finally {
    Remove-Item Env:\CAREEROPS_WORKER_CMD          -ErrorAction SilentlyContinue
    Remove-Item Env:\CAREEROPS_VAULT_DIR           -ErrorAction SilentlyContinue
    Remove-Item Env:\CAREEROPS_DATA_DIR            -ErrorAction SilentlyContinue
    Remove-Item Env:\CAREEROPS_SMOKE_ROOT          -ErrorAction SilentlyContinue
    Remove-Item Env:\CAREEROPS_SMOKE_SCRATCH       -ErrorAction SilentlyContinue
    Remove-Item Env:\CAREEROPS_DIGEST_CMD          -ErrorAction SilentlyContinue
    Remove-Item Env:\CAREEROPS_DIGEST_PREFIX_ARGS  -ErrorAction SilentlyContinue
    if (Test-Path $PipelineFile) { Set-ItemProperty -Path $PipelineFile -Name IsReadOnly -Value $false -ErrorAction SilentlyContinue }
    Remove-Item $InflightFile -Force -ErrorAction SilentlyContinue
    # Defence in depth: restore the real files even though isolation via
    # CAREEROPS_DATA_DIR should mean nothing touched them this run.
    Set-Content $RealPipelineFile -Value $pipelineBackup -NoNewline -Encoding utf8
    Set-Content $RealTracker      -Value $trackerBackup  -NoNewline -Encoding utf8
    if ($null -ne $needsBackup) { Set-Content $RealNeedsAttn -Value $needsBackup -NoNewline -Encoding utf8 }
    else { Remove-Item $RealNeedsAttn -Force -ErrorAction SilentlyContinue }
    # Sweep by pattern rather than by a snapshot taken mid-run: later scenarios
    # create artifacts too, and a snapshot only catches the ones that existed
    # when it was taken.
    Get-ChildItem "$Root\reports" -Filter '*-stubco-*.md' -ErrorAction SilentlyContinue |
        Remove-Item -Force -ErrorAction SilentlyContinue
    Get-ChildItem "$Root\reports" -Filter '*-RESERVED.md' -ErrorAction SilentlyContinue |
        Remove-Item -Force -ErrorAction SilentlyContinue
    # merge-tracker moves consumed TSVs into merged/, so clean both locations.
    foreach ($dir in @("$Root\batch\tracker-additions", "$Root\batch\tracker-additions\merged")) {
        Get-ChildItem $dir -Filter '*-nightly-*.tsv' -ErrorAction SilentlyContinue |
            Remove-Item -Force -ErrorAction SilentlyContinue
    }
    Get-ChildItem "$Root\batch\logs" -Filter '*-nightly-*.log' -ErrorAction SilentlyContinue |
        Remove-Item -Force -ErrorAction SilentlyContinue
    Remove-Item $Scratch -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "SMOKE OK" -ForegroundColor Green
