<#
.SYNOPSIS
  Smoke + forced-failure test for run-nightly.ps1.

.DESCRIPTION
  Two scenarios, both of which actually EXECUTE the orchestrator rather than
  just parsing it:

    1. Dry run against the live pipeline. Proves the script parses, the node
       helpers are reachable, and the reconciliation gate runs.

    2. Forced failure. Puts one URL in the pipeline and points the orchestrator
       at a stub worker that prints prose and exits 0 — the exact shape of the
       old bug, where "exit 0 and some braces somewhere in stdout" was recorded
       as a successful evaluation. The run must refuse to call it a success.

  Safety: this never invokes the real `claude` worker (costs money, hits live
  job boards) and never runs a scan (CAREEROPS_ALLOW_SCAN stays unset, and both
  scenarios pass -EvalOnly). It does not touch the scheduled task.

  Isolation: vault writes are redirected to a temp dir via CAREEROPS_VAULT_DIR,
  and data/pipeline.md + data/needs-attention.md are backed up and restored.
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

Write-Host "2. Node helpers reachable" -ForegroundColor Cyan
node lib/pipeline-state.mjs --file data\pipeline.md --list --limit 1 | Out-Null
if ($LASTEXITCODE -ne 0) { throw "pipeline-state CLI failed" }
node lib/eval-verify.mjs --log nul --root $Root --report x.md --tsv x.tsv --url https://x.test | Out-Null
if ($LASTEXITCODE -ne 1) { throw "eval-verify should exit 1 on an empty log, got $LASTEXITCODE" }
Write-Host "    ok" -ForegroundColor DarkGray

# --- Scratch state so neither scenario pollutes the vault or live data ---
$Scratch      = Join-Path ([IO.Path]::GetTempPath()) "careerops-smoke-$PID"
$VaultStub    = Join-Path $Scratch 'vault'
$StubWorker   = Join-Path $Scratch 'stub-worker.ps1'
$PipelineFile = "$Root\data\pipeline.md"
$NeedsAttn    = "$Root\data\needs-attention.md"
New-Item -ItemType Directory -Force -Path $VaultStub | Out-Null

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

$Tracker        = "$Root\data\applications.md"
$InflightFile   = "$Root\batch\.nightly-inflight.json"
$pipelineBackup = Get-Content $PipelineFile -Raw -Encoding utf8
$trackerBackup  = Get-Content $Tracker -Raw -Encoding utf8
$needsBackup    = if (Test-Path $NeedsAttn) { Get-Content $NeedsAttn -Raw -Encoding utf8 } else { $null }

try {
    Write-Host "3. Dry run, eval only" -ForegroundColor Cyan
    $env:CAREEROPS_VAULT_DIR = $VaultStub
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
    Assert-True (-not (Test-Path (Join-Path $VaultStub 'morning-review.md')) -or
                 (Get-Content (Join-Path $VaultStub 'morning-review.md') -Raw) -match 'No scored results') `
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
    $listed = node lib/pipeline-state.mjs --file data\pipeline.md --list --limit 10 | Out-String
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
    node lib/pipeline-state.mjs --file data\pipeline.md --url $crashUrl --state in-progress | Out-Null
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
    node lib/pipeline-state.mjs --file data\pipeline.md --url $ownedUrl --state in-progress | Out-Null
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
}
finally {
    Remove-Item Env:\CAREEROPS_WORKER_CMD          -ErrorAction SilentlyContinue
    Remove-Item Env:\CAREEROPS_VAULT_DIR           -ErrorAction SilentlyContinue
    Remove-Item Env:\CAREEROPS_SMOKE_ROOT          -ErrorAction SilentlyContinue
    Remove-Item Env:\CAREEROPS_SMOKE_SCRATCH       -ErrorAction SilentlyContinue
    Remove-Item Env:\CAREEROPS_DIGEST_CMD          -ErrorAction SilentlyContinue
    Remove-Item Env:\CAREEROPS_DIGEST_PREFIX_ARGS  -ErrorAction SilentlyContinue
    if (Test-Path $PipelineFile) { Set-ItemProperty -Path $PipelineFile -Name IsReadOnly -Value $false -ErrorAction SilentlyContinue }
    Remove-Item $InflightFile -Force -ErrorAction SilentlyContinue
    Set-Content $PipelineFile -Value $pipelineBackup -NoNewline -Encoding utf8
    Set-Content $Tracker      -Value $trackerBackup  -NoNewline -Encoding utf8
    if ($null -ne $needsBackup) { Set-Content $NeedsAttn -Value $needsBackup -NoNewline -Encoding utf8 }
    else { Remove-Item $NeedsAttn -Force -ErrorAction SilentlyContinue }
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
