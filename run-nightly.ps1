<#
.SYNOPSIS
  Nightly career-ops orchestrator: scan portals -> evaluate new jobs -> write vault output.

.DESCRIPTION
  Correctness rules this script enforces (see .superpowers/sdd/2026-07-26-career-ops-pipeline-correctness):

    * Report numbers come from reserve-report-num.mjs (atomic, under the tracker
      lock). They are NEVER derived from filenames.
    * An eval counts as success only when lib/eval-verify.mjs can prove it from
      artifacts on disk. A worker printing {"status":"completed"} proves nothing.
    * Every job gets a two-phase drain marker in data/pipeline.md (in-progress
      before dispatch, done/failed after the verdict) so the queue actually
      drains and a crash leaves an accurate record.
    * Decisions are appended per eval, not flushed at run end, so a mid-run
      crash loses one line instead of the whole batch.
    * A scan failure is fatal, and the run reconciles counts before exiting.

.PARAMETER ScanOnly   Run scan only, skip evaluation.
.PARAMETER EvalOnly   Skip scan; evaluate up to -MaxJobs actionable items in pipeline.md.
.PARAMETER MaxJobs    Max jobs to evaluate per run (default: 10).
.PARAMETER DryRun     Print what would run without calling the worker or mutating state.

.OUTPUTS
  Exit codes — the scheduled task should distinguish these:

    0  Success. Every dispatched eval was artifact-verified, or there was
       nothing actionable to do.

    2  Partial batch. At least one eval was verified AND at least one was not.
       This is the normal outcome when some postings have gone dead: roughly a
       third of scanned URLs go stale within weeks, so a run of 7 completed and
       3 dead postings is a CORRECT run, not a broken one. Every unverified job
       is already durably recorded (pipeline row '- [!]' with its attempt count,
       a needs-attention row, and a decision line), so this code means "look at
       needs-attention when convenient", not "something is broken".

    1  Failure. The run itself is untrustworthy: a failed scan, a lost decision,
       missing TSVs, merge-tracker or verify-pipeline errors, a report number
       that could not be reserved, a pipeline marker that could not be written,
       or a batch where NOTHING completed despite jobs being dispatched.

  Conflating 2 with 1 is how gates get disabled: a scheduler that reports
  failure every single night trains the owner to ignore it.

.NOTES
  Test-only environment overrides (never set these in the scheduled task):
    CAREEROPS_WORKER_CMD  Command run instead of `claude` for evaluation. Lets
                          tests/nightly-smoke.ps1 drive a stub worker so the
                          forced-failure path can be exercised without spending
                          money or hitting live job boards.
    CAREEROPS_VAULT_DIR   Redirects vault output (decisions.jsonl,
                          morning-review.md) so tests do not pollute the vault.
    CAREEROPS_DATA_DIR    Redirects pipeline.md, applications.md (via
                          CAREER_OPS_TRACKER, propagated to merge-tracker.mjs /
                          verify-pipeline.mjs / reserve-report-num.mjs) and
                          needs-attention.md, so tests do not touch the user's
                          real ~176-row queue / 11-row tracker. Defaults to
                          $ProjectDir\data — byte-identical to the pre-override
                          paths when unset.
    CAREEROPS_ALLOW_SCAN  Required to be '1' before scan will run. See the SCAN
                          SAFETY GATE block below. This one is a safety
                          interlock, not a test hook.
#>
param(
    [switch]$ScanOnly,
    [switch]$EvalOnly,
    [int]$MaxJobs   = 10,
    [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Pinned deliberately. When this is $true, any native command exiting non-zero
# throws under $ErrorActionPreference='Stop' — which would turn eval-verify's
# intentional exit-1-on-failed-verdict into a run-killing exception and discard
# the reasons. Every node call below checks $LASTEXITCODE explicitly instead.
$PSNativeCommandUseErrorActionPreference = $false

# Paths
$ProjectDir    = "D:\sunja\projects\consulting\career-ops"
$VaultDir      = if ($env:CAREEROPS_VAULT_DIR) { $env:CAREEROPS_VAULT_DIR }
                 else { "D:\sunja\projects\personal\Fortress of Solitude\career-ops" }
# Redirects every live-data path this script touches (pipeline.md,
# applications.md, needs-attention.md). Defaults to the project's real data
# dir — must stay byte-identical to the pre-override paths when unset, since
# this is the user's live pipeline.
$DataDir       = if ($env:CAREEROPS_DATA_DIR) { $env:CAREEROPS_DATA_DIR }
                 else { "$ProjectDir\data" }
$Date          = (Get-Date).ToString("yyyy-MM-dd")
$RunTimestamp  = (Get-Date).ToString("yyyy-MM-dd HH:mm")
# needs-attention.md is written by three producers (this script, digest.mjs and
# merge-tracker.mjs). The other two use JS `toISOString()`, so this one matches
# them rather than interleaving a second format into the same table. Kept
# separate from $RunTimestamp on purpose: that value is also the decisions.jsonl
# `evaluated_at` the digest cursor compares against, and reformatting it would
# change the digest window semantics.
$RunTimestampIso = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
$LogDir        = "$ProjectDir\batch\logs"
$ReportsDir    = "$ProjectDir\reports"
$TsvDir        = "$ProjectDir\batch\tracker-additions"
$BatchPrompt   = "$ProjectDir\batch\batch-prompt.md"
$PipelineFile  = "$DataDir\pipeline.md"
$NeedsAttnFile = "$DataDir\needs-attention.md"
$TrackerFile   = "$DataDir\applications.md"
$ScanSysFile   = "$ProjectDir\modes\scan.md"
$MorningReview = "$VaultDir\morning-review.md"
$DecisionsLog  = "$VaultDir\decisions.jsonl"
$DigestCursor  = "$VaultDir\digest-cursor.json"
$LockFile      = "$ProjectDir\batch\.nightly.pid"
$InflightFile  = "$ProjectDir\batch\.nightly-inflight.json"
$RunLog        = "$LogDir\nightly-$Date.log"

# Worker command. Defaults to the real thing; overridable only for tests.
$WorkerCmd     = if ($env:CAREEROPS_WORKER_CMD) { $env:CAREEROPS_WORKER_CMD } else { 'claude' }

# Setup
New-Item -ItemType Directory -Force -Path $VaultDir | Out-Null
New-Item -ItemType Directory -Force -Path $LogDir   | Out-Null
New-Item -ItemType Directory -Force -Path $DataDir  | Out-Null

# Every node helper this script shells out to (reserve-report-num.mjs,
# merge-tracker.mjs, verify-pipeline.mjs) resolves the tracker path itself
# via resolveTrackerPath()/CAREER_OPS_TRACKER rather than taking it as a CLI
# arg. Setting it here for this process's environment propagates $DataDir to
# every child `node` invocation below, so a redirected data dir reaches them
# too — otherwise a test pointing CAREEROPS_DATA_DIR at a temp dir would still
# merge into and verify the user's real data/applications.md. When
# CAREEROPS_DATA_DIR is unset this resolves to the same
# data\applications.md path those scripts would have picked by default, so
# real runs are unaffected.
$env:CAREER_OPS_TRACKER = $TrackerFile
# Report files themselves are never redirected by CAREEROPS_DATA_DIR (they stay
# under $ProjectDir\reports even during isolated test runs) — only merge-tracker.mjs's
# link math needs telling, so a redirected tracker still computes report links
# that resolve against the real reports/ dir instead of 404ing relative to a
# temp data dir. See CAREER_OPS_REPORTS_ROOT in merge-tracker.mjs.
$env:CAREER_OPS_REPORTS_ROOT = $ProjectDir

function Write-Log {
    param([string]$Msg, [string]$Color = 'White')
    $line = "[$RunTimestamp] $Msg"
    Write-Host $line -ForegroundColor $Color
    $line | Out-File $RunLog -Encoding utf8 -Append
}

# Set-StrictMode makes `$obj.missing` a terminating error. Worker-shaped JSON is
# untrusted and routinely missing fields, so never dot into it directly.
function Get-Prop {
    param($Obj, [string]$Name)
    if ($null -eq $Obj) { return $null }
    $prop = $Obj.PSObject.Properties[$Name]
    if ($null -eq $prop) { return $null }
    return $prop.Value
}

if ($MaxJobs -lt 1) {
    Write-Error "-MaxJobs must be at least 1 (got $MaxJobs)."
    exit 1
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

# Every node helper below is invoked with a repo-relative script path, so the
# whole run must happen with the project as the working directory.
Push-Location $ProjectDir

try {

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

# Two-phase drain marker. A failure here means the queue and the run have
# diverged (the URL we dispatched is not the URL in the file) — that is never
# something to warn past, so it aborts the run.
function Set-PipelineState {
    param([string]$Url, [string]$State, [int]$Attempts = -1)
    if ($Attempts -ge 0) {
        & node lib/pipeline-state.mjs --file $PipelineFile --url $Url --state $State --attempts $Attempts | Out-Null
    } else {
        & node lib/pipeline-state.mjs --file $PipelineFile --url $Url --state $State | Out-Null
    }
    if ($LASTEXITCODE -ne 0) {
        Write-Log "FATAL: could not mark '$Url' as '$State' in $PipelineFile (exit $LASTEXITCODE). The queue and this run have diverged." 'Red'
        exit 1
    }
}

# ---- IN-FLIGHT OWNERSHIP ----
#
# Records which PID owns each in-progress row. The PID lock is a SOFT lock: the
# operator is told to "Remove $LockFile to override", and the stale-lock branch
# deletes it whenever Get-Process finds nothing for the recorded PID — which
# also fires on PID reuse. So a second instance CAN start while a first is live.
# Without ownership the reaper would then mark the first run's rows failed,
# re-list them, and dispatch the same URL to a second paid worker while the
# first run is still running. Mirrors gcStaleReportReservations' processIsAlive
# check in reserve-report-num.mjs.
#
# Residual risk, same as upstream: a dead PID reused by an unrelated process
# reads as alive, which is the safe direction (skip rather than double-dispatch).

function Get-Inflight {
    if (-not (Test-Path $InflightFile)) { return @{} }
    $map = @{}
    try {
        $raw = Get-Content $InflightFile -Raw -Encoding utf8
        if ([string]::IsNullOrWhiteSpace($raw)) { return $map }
        foreach ($p in ($raw | ConvertFrom-Json).PSObject.Properties) { $map[$p.Name] = $p.Value }
    } catch {
        Write-Log "WARN: could not read $InflightFile ($($_.Exception.Message)); treating all in-progress rows as unowned." 'Yellow'
        return @{}
    }
    return $map
}

function Save-Inflight {
    param($Map)
    ($Map | ConvertTo-Json -Depth 5) | Set-Content $InflightFile -Encoding utf8
}

function Set-Inflight {
    param([string]$Url)
    $map = Get-Inflight
    $map[$Url] = @{ pid = $PID; started = $RunTimestamp }
    Save-Inflight $map
}

function Clear-Inflight {
    param([string]$Url)
    $map = Get-Inflight
    if ($map.ContainsKey($Url)) { $map.Remove($Url); Save-Inflight $map }
}

# $true when another LIVE process claims this row.
function Test-InflightOwnedByOther {
    param($Map, [string]$Url)
    if (-not $Map.ContainsKey($Url)) { return $false }
    $ownerPid = Get-Prop $Map[$Url] 'pid'
    if ($null -eq $ownerPid) { return $false }
    if ([int]$ownerPid -eq $PID) { return $false }
    return $null -ne (Get-Process -Id ([int]$ownerPid) -ErrorAction SilentlyContinue)
}

function Add-NeedsAttention {
    param([string]$Url, [string]$Stage, [string]$Reason)
    # Passed via env var rather than inline in the -e string: reasons contain
    # quotes, semicolons and URLs, and PowerShell->node quoting mangles them.
    $env:CAREEROPS_NA_JSON = (@{ url = $Url; stage = $Stage; reason = $Reason; at = $RunTimestampIso } | ConvertTo-Json -Compress)
    try {
        & node -e "import('./lib/needs-attention.mjs').then(m => m.appendNeedsAttention(process.argv[1], JSON.parse(process.env.CAREEROPS_NA_JSON)))" $NeedsAttnFile | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Write-Log "ERROR: failed to record needs-attention row for $Url (exit $LASTEXITCODE)." 'Red'
        }
    } finally {
        Remove-Item Env:\CAREEROPS_NA_JSON -ErrorAction SilentlyContinue
    }
}

# Pipeline rows are read ONLY through lib/pipeline-state.mjs. This script must
# never regex data/pipeline.md itself: the module deliberately tolerates '-  [ ]'
# and '-\t[x]' and CRLF, and a private pattern here silently disagrees with it.
# Returns a PSCustomObject with .rows and .unusable, or $null on failure.
function Get-PipelineSelection {
    param([string]$State, [int]$Limit = -1)
    if (-not (Test-Path $PipelineFile)) { return $null }
    if ($State) {
        $json = & node lib/pipeline-state.mjs --file $PipelineFile --list --state $State
    } elseif ($Limit -ge 0) {
        $json = & node lib/pipeline-state.mjs --file $PipelineFile --list --limit $Limit
    } else {
        $json = & node lib/pipeline-state.mjs --file $PipelineFile --list
    }
    if ($LASTEXITCODE -ne 0) { return $null }
    return (($json | Out-String) | ConvertFrom-Json)
}

# Every pending row's URL, unusable ones included — the scan delta counts rows
# added, and a scan that added a malformed row still added a row.
function Get-PipelineUrls {
    param([string]$State)
    $sel = Get-PipelineSelection -State $State
    if ($null -eq $sel) {
        Write-Log "WARN: could not list '$State' rows from $PipelineFile; the scan delta count may be wrong." 'Yellow'
        return @()
    }
    return @(@($sel.rows) + @($sel.unusable) | ForEach-Object { $_.url })
}

# One needs-attention row per pipeline entry that can never be dispatched (a
# `local:jds/foo.md` row, a typo'd URL). Marking is impossible for these, so
# treating them as fatal would abort the whole batch and leave them unmarked —
# selected first again the next night, forever. Skip them, record them, continue.
function Report-UnusablePipelineRows {
    param($Selection, [string]$Phase)
    if ($null -eq $Selection) { return }
    foreach ($bad in @($Selection.unusable)) {
        Write-Log "Unusable pipeline row (not a http(s) URL) — skipped: $($bad.url)" 'Yellow'
        if (-not $DryRun) {
            Add-NeedsAttention -Url $bad.url -Stage 'pipeline-parse' `
                -Reason "pipeline row is not a usable http(s) URL, so it can never be dispatched or marked ($Phase); fix or remove the row by hand"
        }
    }
}

# ---- SCAN ----

if (-not $EvalOnly) {
    Write-Log "=== SCAN phase ===" 'Cyan'
    $scanLog = "$LogDir\scan-$Date.log"

    # Counted through the module, not a local regex: '^\- \[ \]' misses the
    # '-  [ ]' and '-\t[ ]' rows the module accepts, so the delta under-reported.
    $before = @(Get-PipelineUrls -State 'pending')

    if ($DryRun) {
        Write-Log "[DRY RUN] Would run: claude --print (scan)" 'Yellow'
    } else {
        $scanMsg = "Today is $Date. Project directory: $ProjectDir. Execute the full portal scan as described in your system instructions. Report how many new jobs were added to data/pipeline.md."
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

        # A failed scan means the queue is not what this run assumes it is.
        # Continuing would evaluate a stale pipeline and report success.
        if ($scanExit -ne 0) {
            Write-Log "FATAL: scan exited $scanExit. See $scanLog" 'Red'
            Add-NeedsAttention -Url '(scan)' -Stage 'scan' -Reason "scan exited $scanExit; see $scanLog"
            exit 1
        }
        Write-Log "Scan complete. Log: $scanLog" 'Green'
    }

    $after = @(Get-PipelineUrls -State 'pending')
    Write-Log "$(@($after | Where-Object { $before -notcontains $_ }).Count) new job(s) added by scan."
}

if ($ScanOnly) {
    Write-Log "ScanOnly - done."
    exit 0
}

# ---- SELECT WORK ----
#
# The actionable list is state-aware: pending rows plus failed rows still inside
# the retry budget, and never rows already done / in-progress / expired. Rows are
# parsed by lib/pipeline-state.mjs, never by PowerShell string splitting — they
# carry 1/3/4/5 positional columns plus labeled `posted:` / `trust:` / `note:`
# segments that naive splitting gets wrong.

# Reap rows stranded in-progress by a previous crashed run. listActionable skips
# in-progress deliberately (it means "a run owns this"), so without this step a
# crash between the two marker writes would park the job forever.
#
# The PID lock does NOT guarantee we are alone (see IN-FLIGHT OWNERSHIP above:
# the operator may delete the lock, and the stale-lock branch removes it on PID
# reuse). So reap only rows whose owning PID is gone. Reaping a row owned by a
# live run would double-dispatch a paid worker and corrupt the queue.
$staleSel = Get-PipelineSelection -State 'in-progress'
if ($null -eq $staleSel) {
    Write-Log "FATAL: could not list in-progress jobs from $PipelineFile." 'Red'
    exit 1
}
Report-UnusablePipelineRows -Selection $staleSel -Phase 'crash-recovery'
$inflight = Get-Inflight
foreach ($stale in @($staleSel.rows)) {
    if (Test-InflightOwnedByOther -Map $inflight -Url $stale.url) {
        Write-Log "Leaving in-progress row alone — another live run owns it: $($stale.url)" 'Yellow'
        continue
    }
    if ($DryRun) {
        Write-Log "  [DRY RUN] Would recover job stranded in-progress: $($stale.url)" 'Yellow'
        continue
    }
    Write-Log "Recovering job stranded in-progress by an earlier run: $($stale.url)" 'Yellow'
    Set-PipelineState -Url $stale.url -State 'failed' -Attempts ([int]$stale.attempts + 1)
    Clear-Inflight -Url $stale.url
    Add-NeedsAttention -Url $stale.url -Stage 'crash-recovery' -Reason 'left in-progress by a run that did not finish'
}

$listSel = Get-PipelineSelection -Limit $MaxJobs
if ($null -eq $listSel) {
    Write-Log "FATAL: could not list actionable jobs from $PipelineFile." 'Red'
    exit 1
}
Report-UnusablePipelineRows -Selection $listSel -Phase 'dispatch'
$jobs = @($listSel.rows)
Write-Log "$($jobs.Count) actionable job(s) (pending + retryable failures)."

# ---- EVALUATE ----

$results = [System.Collections.Generic.List[PSObject]]::new()

# Reconciliation baseline: decisions.jsonl is append-only, so the delta over the
# run is exact. Comparing the running total instead would pass trivially.
$decisionsBefore = if (Test-Path $DecisionsLog) { @(Get-Content $DecisionsLog).Count } else { 0 }

Write-Log "=== EVALUATE phase ($($jobs.Count) jobs) ===" 'Cyan'

$idx = 0
foreach ($job in $jobs) {
    $idx++
    $jobUrl = $job.url
    $id     = "nightly-$Date-$idx"
    $jdFile = "$ProjectDir\jds\not-pre-downloaded.md"

    Write-Log "  [$idx/$($jobs.Count)] $($job.company) - $($job.title)  ($jobUrl)"

    if ($DryRun) {
        Write-Log "  [DRY RUN] Would evaluate: $jobUrl" 'Yellow'
        continue
    }

    # Race-safe: reserve-report-num.mjs claims the number under the tracker lock
    # with O_CREAT|O_EXCL, so parallel workers cannot collide and overwrite each
    # other's report files. Never derive the number from filenames.
    # It prints a bare zero-padded id ("042\n") on stdout — not JSON — and drops
    # a reports/NNN-RESERVED.md sentinel that we must release below.
    $reportNum = (& node reserve-report-num.mjs | Out-String).Trim()
    if ($LASTEXITCODE -ne 0 -or $reportNum -notmatch '^\d{3,}$') {
        Write-Log "FATAL: could not reserve a report number (exit $LASTEXITCODE, output '$reportNum')." 'Red'
        exit 1
    }

    $resolvedPath = "$ProjectDir\batch\.resolved-nightly-$idx.md"
    $logFile      = "$LogDir\$reportNum-nightly-$idx.log"

    $r = $null
    try {
        # Phase 1 of the drain marker: recorded BEFORE dispatch, so a crash
        # mid-eval leaves the row as in-progress rather than looking pending
        # forever. This sits INSIDE the try: Set-PipelineState exits on a
        # divergent queue, and PowerShell runs finally on exit, so the
        # reservation sentinel is released on that path too. Reserving outside
        # this block would leak reports/NNN-RESERVED.md, and since nothing calls
        # --gc, verify-pipeline's stale-sentinel check would then fail every
        # subsequent run until someone cleaned up by hand.
        Set-Inflight -Url $jobUrl
        Set-PipelineState -Url $jobUrl -State 'in-progress'

        $resolved = Resolve-BatchPrompt $jobUrl $jdFile $reportNum $Date $id
        $resolved | Out-File $resolvedPath -Encoding utf8

        $userMsg = "Procesa esta oferta de empleo. Ejecuta el pipeline completo: evaluacion A-G + report .md + PDF + tracker line. URL: $jobUrl JD file: $jdFile Report number: $reportNum Date: $Date Batch ID: $id"

        & $WorkerCmd --print `
            --allowedTools "Read,Write,Glob,Grep,WebFetch,WebSearch,Bash(node generate-pdf.mjs *)" `
            --permission-mode dontAsk `
            --append-system-prompt-file $resolvedPath `
            $userMsg `
            | Out-File $logFile -Encoding utf8
        $evalExit = $LASTEXITCODE

        Remove-Item $resolvedPath -Force -ErrorAction SilentlyContinue

        # Bind verification to the number we reserved. The worker chooses the
        # company slug, so we discover the report by its reserved-number prefix
        # rather than trusting a path the worker reports. A report written under
        # any other number is not found, and the eval fails closed.
        $found = @(Get-ChildItem $ReportsDir -Filter "$reportNum-*.md" -ErrorAction SilentlyContinue |
                   Where-Object { $_.Name -ne "$reportNum-RESERVED.md" })
        if ($found.Count -gt 0) {
            $reportRel = "reports/$($found[0].Name)"
        } else {
            $slug = ($job.company -replace '[^a-zA-Z0-9]+', '-').Trim('-').ToLower()
            if (-not $slug) { $slug = 'unknown' }
            $reportRel = "reports/$reportNum-$slug-$Date.md"   # expected path, for the failure message
        }
        $tsvRel = "batch/tracker-additions/$reportNum-$id.tsv"

        # The success definition lives in lib/eval-verify.mjs and is enforced
        # against files on disk. It also owns the sentinel parsing — this script
        # must never look for the sentinel strings itself.
        $verdict = $null
        $verdictRaw = ''
        try {
            $verdictRaw = (& node lib/eval-verify.mjs `
                --log $logFile --root $ProjectDir `
                --report $reportRel --tsv $tsvRel --url $jobUrl | Out-String)
            $verdict = $verdictRaw | ConvertFrom-Json
        } catch {
            $verdict = $null
        }

        if ($null -eq $verdict) {
            # Verifier itself failed. Fail closed and keep going; the run still
            # exits non-zero via the unverified-eval gate below.
            $status  = 'failed'
            $reasons = "eval-verify produced no usable verdict (worker exit $evalExit): $($verdictRaw.Trim())"
            $value   = $null
        } else {
            $status  = Get-Prop $verdict 'status'
            $value   = Get-Prop $verdict 'value'
            $rs      = Get-Prop $verdict 'reasons'
            $reasons = if ($rs) { ($rs -join '; ') } else { $null }
        }

        $r = [PSCustomObject]@{
            status       = $status
            id           = $id
            report_num   = $reportNum
            url          = $jobUrl
            company      = if ($value) { Get-Prop $value 'company' }    else { $job.company }
            role         = if ($value) { Get-Prop $value 'role' }       else { $job.title }
            score        = if ($value) { Get-Prop $value 'score' }      else { $null }
            legitimacy   = if ($value) { Get-Prop $value 'legitimacy' } else { $null }
            pdf          = if ($value) { Get-Prop $value 'pdf' }        else { $null }
            report       = if ($found.Count -gt 0) { $reportRel } else { $null }
            error        = $reasons
            evaluated_at = $RunTimestamp
        }

    } catch {
        # An orchestrator-side error (worker binary missing, disk full, bad
        # prompt template) must still produce a verdict. Otherwise the row stays
        # in-progress and the job is stranded until the reaper above finds it.
        $r = [PSCustomObject]@{
            status       = 'failed'
            id           = $id
            report_num   = $reportNum
            url          = $jobUrl
            company      = $job.company
            role         = $job.title
            score        = $null
            legitimacy   = $null
            pdf          = $null
            report       = $null
            error        = "orchestrator error during eval: $($_.Exception.Message)"
            evaluated_at = $RunTimestamp
        }
    } finally {
        # Always drop the reservation sentinel. On success the real report file
        # now occupies the number; on failure the number is free to reuse.
        # The release takes the tracker lock (60s timeout) — a timeout or a
        # mismatch fails silently and strands the sentinel, which surfaces much
        # later as a verify-pipeline error pointing nowhere near the cause.
        & node reserve-report-num.mjs --release $reportNum | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Write-Log "WARN: could not release report reservation $reportNum (exit $LASTEXITCODE). reports/$reportNum-RESERVED.md may be stranded; run 'node reserve-report-num.mjs --gc'." 'Yellow'
        }
        Remove-Item $resolvedPath -Force -ErrorAction SilentlyContinue
    }

    # Single tail for both the verdict path and the orchestrator-error path, so
    # "every dispatched job is recorded and re-marked exactly once" is one code
    # path rather than an invariant duplicated across branches.
    $results.Add($r)

    # Append per eval: a mid-run crash then loses one line, not the whole batch.
    ($r | ConvertTo-Json -Compress -Depth 5) | Out-File $DecisionsLog -Encoding utf8 -Append

    # Phase 2 of the drain marker. `attempts` is threaded from the listing in
    # memory and incremented here. Re-reading it from the file after the
    # in-progress write is the trap that silently resets the retry budget.
    if ($r.status -eq 'completed') {
        Set-PipelineState -Url $jobUrl -State 'done'
    } else {
        Set-PipelineState -Url $jobUrl -State 'failed' -Attempts ([int]$job.attempts + 1)
        Add-NeedsAttention -Url $jobUrl -Stage 'eval' -Reason $r.error
    }
    # The row now has a terminal marker; this run no longer owns it.
    Clear-Inflight -Url $jobUrl

    $statusTag = if ($r.status -eq 'completed') { 'OK  ' } else { 'FAIL' }
    $scoreTag  = if ($null -ne $r.score) { "$($r.score)/5" } else { '?' }
    Write-Log "    $statusTag  score=$scoreTag  log=$logFile"
    if ($r.status -ne 'completed') { Write-Log "          reason: $($r.error)" 'Yellow' }
}

# ---- VAULT OUTPUT ----

Write-Log "=== VAULT OUTPUT ===" 'Cyan'

if ($DryRun) {
    Write-Log "[DRY RUN] Skipping vault output."
} elseif ($results.Count -eq 0) {
    Write-Log "No results to write."
} else {
    Write-Log "decisions.jsonl: +$($results.Count) entries -> $DecisionsLog" 'Green'

    $top5 = @($results |
        Where-Object { $_.status -eq 'completed' -and $null -ne $_.score } |
        Sort-Object { [double]$_.score } -Descending |
        Select-Object -First 5)

    $md  = "# Morning Review - $RunTimestamp`n`n"
    $md += "$($top5.Count) top result(s) from last night's scan"
    $md += " (evaluated $($results.Count))"
    $md += ".`n`n---`n`n"

    $rank = 0
    foreach ($t in $top5) {
        $rank++
        $legPart    = if ($t.legitimacy) { " - $($t.legitimacy)" } else { '' }
        $reportPart = if ($t.report)     { " - [Report]($($t.report))" } else { '' }
        $md += "## $rank. $($t.company) - $($t.role)`n`n"
        $md += "**Score:** $($t.score)/5$legPart$reportPart`n"
        $md += "**URL:** $($t.url)`n`n---`n`n"
    }

    if ($top5.Count -eq 0) {
        $md += "_No scored results this run. Check batch/logs/ for details._`n"
    }

    $md | Out-File $MorningReview -Encoding utf8
    Write-Log "Morning review -> $MorningReview" 'Green'
}

# ---- COUNT RECONCILIATION ----
#
# "Works once" is not done: a batch job ends by proving processed == expected.
# A gap here is a failure, not a footnote.

$evaluated = $results.Count
$completed = @($results | Where-Object { $_.status -eq 'completed' }).Count
$reportsNow = @(Get-ChildItem $ReportsDir -Filter '*.md' -ErrorAction SilentlyContinue |
                Where-Object { $_.Name -notlike '*-RESERVED.md' }).Count
$tsvsNow = @(Get-ChildItem $TsvDir -Filter '*.tsv' -ErrorAction SilentlyContinue).Count
$decisionsNow = if (Test-Path $DecisionsLog) { @(Get-Content $DecisionsLog).Count } else { 0 }
$decisionsAdded = $decisionsNow - $decisionsBefore

Write-Log "RECONCILE evaluated=$evaluated completed=$completed decisions_added=$decisionsAdded tsvs_pending=$tsvsNow reports_total=$reportsNow decisions_total=$decisionsNow"

if ($DryRun) {
    Write-Log "[DRY RUN] Skipping merge/verify."
    Write-Log "=== Done ===" 'Green'
    exit 0
}

if ($decisionsAdded -lt $evaluated) {
    Write-Log "FATAL: $evaluated evals but only $decisionsAdded decision line(s) appended — decisions were lost." 'Red'
    exit 1
}
if ($tsvsNow -lt $completed) {
    Write-Log "FATAL: $completed completed eval(s) but only $tsvsNow TSV(s) — tracker rows will be missing." 'Red'
    exit 1
}

& node merge-tracker.mjs
if ($LASTEXITCODE -ne 0) { Write-Log "FATAL: merge-tracker failed." 'Red'; exit 1 }

& node verify-pipeline.mjs
$verifyExit = $LASTEXITCODE
if ($verifyExit -ne 0) {
    Write-Log "verify-pipeline reported errors — see data/needs-attention.md" 'Red'
    Add-NeedsAttention -Url '(pipeline)' -Stage 'verify-pipeline' -Reason "verify-pipeline exit=$verifyExit"
    exit 1
}

# ---- DIGEST ----
#
# Placed after verify-pipeline succeeds (so digest only ever reads a tracker
# state that has already been reconciled) and before the partial/clean exit
# branching below (so it runs whether tonight ends up exit 0 or exit 2 —
# both are "the run is trustworthy", which is the only precondition digest
# needs). Reads $DecisionsLog directly since that is where evaluations are
# actually appended (see EVALUATE phase above) — NOT data/decisions.jsonl,
# which is an empty placeholder in the project dir; passing the wrong path
# here would make digest silently select nothing every night.
#
# --cursor persists the timestamp of the newest decision digest.mjs has
# successfully digested, alongside decisions.jsonl in the vault. That is the
# real selection boundary from the second run onward; --since $RunTimestamp
# is used only as the bootstrap fallback before a cursor file exists, so the
# very first run does not dump the entire history. Without a persisted
# cursor, using $RunTimestamp every run would either (a) miss decisions from
# a crashed prior run that never got digested, or (b) if reused across runs,
# re-email the entire history forever, since decisions.jsonl is append-only
# and never pruned.
#
# A send (or read) failure is treated the same as any other exit-1 condition
# on this script: it means a human needs to look. It is NOT folded into
# exit 2 (reserved for the normal, low-urgency case of dead postings) because
# an unnotified result is not a normal outcome — the operator could otherwise
# miss a good match for weeks while believing they'd have heard about it.
#
# The digest outcome is captured but NOT acted on immediately: the
# partial/clean branching below must still run and log its own state (dead
# postings vs. clean night) even when digest failed, so that information is
# not silently dropped for this run. $digestExit overrides the exit code at
# the very end instead.
& node digest.mjs --file $DecisionsLog --needs-attention $NeedsAttnFile --cursor $DigestCursor --since $RunTimestamp
$digestExit = $LASTEXITCODE
if ($digestExit -ne 0) {
    Write-Log "Digest send failed — see $NeedsAttnFile" 'Red'
}

# Reconciliation passed and the tracker merged. An unverified eval must never
# read as a clean success — but "some postings were dead" is not the same event
# as "this run is broken", and giving them the same exit code trains the owner
# to ignore both. See the exit-code contract in the header.
$unverified = $evaluated - $completed
if ($unverified -gt 0) {
    if ($completed -eq 0) {
        # Nothing at all worked. That is a broken run, not a stale-posting run.
        Write-Log "FATAL: all $evaluated eval(s) failed — nothing completed. See $NeedsAttnFile" 'Red'
        exit 1
    }
    Write-Log "PARTIAL: $completed of $evaluated eval(s) verified; $unverified could not be — see $NeedsAttnFile" 'Yellow'
    if ($digestExit -ne 0) {
        Write-Log "=== Done (partial batch AND digest failed — both need attention) ===" 'Red'
        exit 1
    }
    Write-Log "=== Done (partial) ===" 'Yellow'
    exit 2
}

if ($digestExit -ne 0) {
    Write-Log "=== Done (digest failed) ===" 'Red'
    exit 1
}

Write-Log "=== Done ===" 'Green'
exit 0

} finally {
    Pop-Location
    Remove-Item $LockFile -Force -ErrorAction SilentlyContinue
}
