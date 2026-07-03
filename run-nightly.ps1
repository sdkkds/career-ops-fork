<#
.SYNOPSIS
  Nightly career-ops orchestrator: scan portals -> evaluate new jobs -> write vault output.

.PARAMETER ScanOnly   Run scan only, skip evaluation.
.PARAMETER EvalOnly   Skip scan; evaluate first -MaxJobs pending items in pipeline.md.
.PARAMETER MaxJobs    Max new jobs to evaluate per run (default: 10).
.PARAMETER DryRun     Print what would run without calling claude.
#>
param(
    [switch]$ScanOnly,
    [switch]$EvalOnly,
    [int]$MaxJobs   = 10,
    [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Paths
$ProjectDir    = "D:\sunja\projects\consulting\career-ops"
$VaultDir      = "D:\sunja\projects\personal\Fortress of Solitude\career-ops"
$Date          = (Get-Date).ToString("yyyy-MM-dd")
$RunTimestamp  = (Get-Date).ToString("yyyy-MM-dd HH:mm")
$LogDir        = "$ProjectDir\batch\logs"
$ReportsDir    = "$ProjectDir\reports"
$BatchPrompt   = "$ProjectDir\batch\batch-prompt.md"
$PipelineFile  = "$ProjectDir\data\pipeline.md"
$ScanSysFile   = "$ProjectDir\modes\scan.md"
$MorningReview = "$VaultDir\morning-review.md"
$DecisionsLog  = "$VaultDir\decisions.jsonl"
$LockFile      = "$ProjectDir\batch\.nightly.pid"
$RunLog        = "$LogDir\nightly-$Date.log"

# Setup
New-Item -ItemType Directory -Force -Path $VaultDir | Out-Null
New-Item -ItemType Directory -Force -Path $LogDir   | Out-Null

function Write-Log {
    param([string]$Msg, [string]$Color = 'White')
    $line = "[$RunTimestamp] $Msg"
    Write-Host $line -ForegroundColor $Color
    $line | Out-File $RunLog -Encoding utf8 -Append
}

# Lock
if (Test-Path $LockFile) {
    $oldPid  = Get-Content $LockFile -Raw
    $running = Get-Process -Id ([int]$oldPid.Trim()) -ErrorAction SilentlyContinue
    if ($running) {
        Write-Error "run-nightly already running (PID $oldPid). Remove $LockFile to override."
        exit 1
    }
    Write-Warning "Stale lock (PID $oldPid). Removing."
    Remove-Item $LockFile -Force
}
$PID | Out-File $LockFile -Encoding utf8

try {

# Track highest report number across current run to avoid duplicates
$script:RunMaxReport = -1

function Get-NextReportNum {
    if ($script:RunMaxReport -lt 0) {
        $script:RunMaxReport = 0
        if (Test-Path $ReportsDir) {
            Get-ChildItem $ReportsDir -Filter "*.md" | ForEach-Object {
                if ($_.Name -match '^(\d+)') {
                    $n = [int]$Matches[1]
                    if ($n -gt $script:RunMaxReport) { $script:RunMaxReport = $n }
                }
            }
        }
    }
    $script:RunMaxReport++
    return $script:RunMaxReport.ToString("000")
}

function Resolve-BatchPrompt {
    param([string]$Url, [string]$JdFile, [string]$ReportNum, [string]$Dt, [string]$Id)
    $c = Get-Content $BatchPrompt -Raw -Encoding utf8
    $c = $c.Replace('{{URL}}',        $Url)
    $c = $c.Replace('{{JD_FILE}}',    $JdFile)
    $c = $c.Replace('{{REPORT_NUM}}', $ReportNum)
    $c = $c.Replace('{{DATE}}',       $Dt)
    $c = $c.Replace('{{ID}}',         $Id)
    return $c
}

function Parse-JobLine {
    param([string]$Line)
    $raw   = $Line -replace '^\- \[ \] ', ''
    $parts = $raw -split ' \| ', 3
    return [PSCustomObject]@{
        Url     = $parts[0].Trim()
        Company = if ($parts.Count -gt 1) { $parts[1].Trim() } else { 'Unknown' }
        Title   = if ($parts.Count -gt 2) { $parts[2].Trim() } else { 'Unknown Role' }
    }
}

function Extract-JsonResult {
    param([string]$LogContent)
    # Worker prints a JSON block at the end of stdout (batch-prompt.md Paso 6)
    $lastOpen  = $LogContent.LastIndexOf('{')
    $lastClose = $LogContent.LastIndexOf('}')
    if ($lastOpen -ne -1 -and $lastClose -gt $lastOpen) {
        $jsonStr = $LogContent.Substring($lastOpen, $lastClose - $lastOpen + 1)
        try { return $jsonStr | ConvertFrom-Json } catch {}
    }
    return $null
}

# ---- SCAN ----

$newLines = @()

if (-not $EvalOnly) {
    Write-Log "=== SCAN phase ===" 'Cyan'
    $scanLog = "$LogDir\scan-$Date.log"

    $before = @()
    if (Test-Path $PipelineFile) {
        $before = @((Get-Content $PipelineFile -Encoding utf8) | Where-Object { $_ -match '^\- \[ \]' })
    }

    if ($DryRun) {
        Write-Log "[DRY RUN] Would run: claude --print (scan)" 'Yellow'
    } else {
        $scanMsg = "Today is $Date. Project directory: $ProjectDir. Execute the full portal scan as described in your system instructions. Report how many new jobs were added to data/pipeline.md."
        Push-Location $ProjectDir
        try {
            # ==================== SCAN SAFETY GATE + SCOPING (P0, 2026-07-03) ====================
            # SCAN drives the Playwright MCP over UNTRUSTED job portals. It previously ran
            # --dangerously-skip-permissions (full tool access - the P0). Two changes:
            #
            #   1. INTERLOCK: scan REFUSES to run unless CAREEROPS_ALLOW_SCAN=1 is set explicitly.
            #      This is defense-in-depth on top of the scheduled task being Disabled: two
            #      independent locks (task Disabled AND this gate) instead of relying on one.
            #      Re-enabling the task alone will NOT fire a scan.
            #
            #   2. SCOPED command (pre-staged, ACTIVE below): replaces skip-permissions with an
            #      allowlist + dontAsk, no Bash. UNVERIFIED HEADLESS - the dontAsk / project-MCP
            #      trust behavior for the Playwright MCP has not been tested end-to-end. The
            #      --dangerously-skip-permissions fallback is kept commented out below.
            #
            # REACTIVATION CHECKLIST (do these when you resume career-ops for real usage):
            #   [ ] $env:CAREEROPS_ALLOW_SCAN = '1'
            #   [ ] run: .\run-nightly.ps1 -ScanOnly   (watch for MCP permission prompts / hangs)
            #   [ ] confirm new jobs land in data/pipeline.md and no unexpected tool calls occur
            #   [ ] once verified, DELETE the commented skip-permissions fallback block below
            #   [ ] bundle with the correctness-spec rewrite (tracker frozen / drain / filter leak)
            # Tracking: wiki/meta/2026-07-03-portfolio-fix-matrix.md (career-ops P0).
            # ====================================================================================
            if ($env:CAREEROPS_ALLOW_SCAN -ne '1') {
                throw "SCAN blocked: unverified headless scan path (P0 residual). Set CAREEROPS_ALLOW_SCAN=1 to run scan, after reading the SCAN SAFETY GATE in run-nightly.ps1."
            }

            # --- Scoped scan (pre-staged; VERIFY headless before trusting) ---
            & claude --print `
                --allowedTools "Read,Write,Edit,WebFetch,WebSearch,mcp__playwright" `
                --permission-mode dontAsk `
                --append-system-prompt-file $ScanSysFile `
                $scanMsg `
                | Out-File $scanLog -Encoding utf8
            $scanExit = $LASTEXITCODE

            # --- FALLBACK: full tool access over UNTRUSTED portals. UNSAFE. Do NOT uncomment
            #     unless the scoped command above fails AND you accept the risk. Delete once the
            #     scoped scan is verified working headless. ---
            # & claude --print `
            #     --dangerously-skip-permissions `
            #     --append-system-prompt-file $ScanSysFile `
            #     $scanMsg `
            #     | Out-File $scanLog -Encoding utf8
            # $scanExit = $LASTEXITCODE
        } finally {
            Pop-Location
        }
        if ($scanExit -ne 0) {
            Write-Log "WARN: Scan exited $scanExit. See $scanLog" 'Yellow'
        } else {
            Write-Log "Scan complete. Log: $scanLog" 'Green'
        }
    }

    $after = @()
    if (Test-Path $PipelineFile) {
        $after = @((Get-Content $PipelineFile -Encoding utf8) | Where-Object { $_ -match '^\- \[ \]' })
    }

    $newLines = @($after | Where-Object { $before -notcontains $_ })
    Write-Log "$($newLines.Count) new job(s) added by scan."
}

if ($ScanOnly) {
    Write-Log "ScanOnly - done."
    exit 0
}

if ($EvalOnly) {
    if (Test-Path $PipelineFile) {
        $allPending = @((Get-Content $PipelineFile -Encoding utf8) | Where-Object { $_ -match '^\- \[ \]' })
        $newLines   = @($allPending | Select-Object -First $MaxJobs)
    }
    Write-Log "EvalOnly: $($newLines.Count) pending job(s) to evaluate."
}

if ($newLines.Count -gt $MaxJobs) {
    Write-Log "Capping at $MaxJobs (of $($newLines.Count) new)."
    $newLines = @($newLines | Select-Object -First $MaxJobs)
}

# ---- EVALUATE ----

$results = [System.Collections.Generic.List[PSObject]]::new()

Write-Log "=== EVALUATE phase ($($newLines.Count) jobs) ===" 'Cyan'

$idx = 0
foreach ($line in $newLines) {
    $idx++
    $job       = Parse-JobLine $line
    $reportNum = Get-NextReportNum
    $id        = "nightly-$Date-$idx"
    $jdFile    = "$ProjectDir\jds\not-pre-downloaded.md"

    $resolvedPath = "$ProjectDir\batch\.resolved-nightly-$idx.md"
    $logFile      = "$LogDir\$reportNum-nightly-$idx.log"

    Write-Log "  [$idx/$($newLines.Count)] $($job.Company) - $($job.Title)  (report $reportNum)"

    if ($DryRun) {
        Write-Log "  [DRY RUN] Would evaluate: $($job.Url)" 'Yellow'
        continue
    }

    $resolved = Resolve-BatchPrompt $job.Url $jdFile $reportNum $Date $id
    $resolved | Out-File $resolvedPath -Encoding utf8

    $userMsg = "Procesa esta oferta de empleo. Ejecuta el pipeline completo: evaluacion A-G + report .md + PDF + tracker line. URL: $($job.Url) JD file: $jdFile Report number: $reportNum Date: $Date Batch ID: $id"

    Push-Location $ProjectDir
    try {
        & claude --print `
            --allowedTools "Read,Write,Glob,Grep,WebFetch,WebSearch,Bash(node generate-pdf.mjs *)" `
            --permission-mode dontAsk `
            --append-system-prompt-file $resolvedPath `
            $userMsg `
            | Out-File $logFile -Encoding utf8
        $evalExit = $LASTEXITCODE
    } finally {
        Pop-Location
    }

    Remove-Item $resolvedPath -Force -ErrorAction SilentlyContinue

    $logContent = if (Test-Path $logFile) { Get-Content $logFile -Raw -Encoding utf8 } else { '' }
    $parsed     = Extract-JsonResult $logContent

    if ($null -ne $parsed) {
        $r = $parsed
    } else {
        $errMsg = if ($evalExit -ne 0) { "exit $evalExit - JSON not found in output" } else { $null }
        $r = [PSCustomObject]@{
            status     = if ($evalExit -eq 0) { 'completed' } else { 'failed' }
            id         = $id
            report_num = $reportNum
            company    = $job.Company
            role       = $job.Title
            score      = $null
            legitimacy = $null
            pdf        = $null
            report     = $null
            error      = $errMsg
        }
    }

    $r | Add-Member -NotePropertyName url          -NotePropertyValue $job.Url      -Force
    $r | Add-Member -NotePropertyName evaluated_at -NotePropertyValue $RunTimestamp -Force

    $results.Add($r)

    $statusTag = if ($r.status -eq 'completed') { 'OK  ' } else { 'FAIL' }
    $scoreTag  = if ($null -ne $r.score) { "$($r.score)/5" } else { '?' }
    Write-Log "    $statusTag  score=$scoreTag  log=$logFile"
}

# ---- VAULT OUTPUT ----

Write-Log "=== VAULT OUTPUT ===" 'Cyan'

if ($results.Count -eq 0 -and -not $DryRun) {
    Write-Log "No results to write."
} else {

    foreach ($r in $results) {
        ($r | ConvertTo-Json -Compress -Depth 5) | Out-File $DecisionsLog -Encoding utf8 -Append
    }
    Write-Log "decisions.jsonl: +$($results.Count) entries -> $DecisionsLog" 'Green'

    $top5 = @($results |
        Where-Object { $_.status -eq 'completed' -and $null -ne $_.score } |
        Sort-Object { [double]$_.score } -Descending |
        Select-Object -First 5)

    $md  = "# Morning Review - $RunTimestamp`n`n"
    $md += "$($top5.Count) top result(s) from last night's scan"
    if ($results.Count -gt 0) { $md += " (evaluated $($results.Count))" }
    $md += ".`n`n---`n`n"

    $rank = 0
    foreach ($r in $top5) {
        $rank++
        $legPart    = if ($r.legitimacy) { " - $($r.legitimacy)" } else { '' }
        $reportPart = if ($r.report)     { " - [Report]($($r.report))" } else { '' }
        $md += "## $rank. $($r.company) - $($r.role)`n`n"
        $md += "**Score:** $($r.score)/5$legPart$reportPart`n"
        $md += "**URL:** $($r.url)`n`n---`n`n"
    }

    if ($top5.Count -eq 0) {
        $md += "_No scored results this run. Check batch/logs/ for details._`n"
    }

    $md | Out-File $MorningReview -Encoding utf8
    Write-Log "Morning review -> $MorningReview" 'Green'
}

} finally {
    Remove-Item $LockFile -Force -ErrorAction SilentlyContinue
}

Write-Log "=== Done ===" 'Green'
