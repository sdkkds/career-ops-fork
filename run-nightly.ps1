<#
.SYNOPSIS
  Nightly career-ops orchestrator: scan portals -> evaluate new jobs -> write vault output.

.DESCRIPTION
  Correctness rules this script enforces (spec: D:\sunja\docs\career-ops\2026-07-26-career-ops-pipeline-correctness-rev2.md;
  per-task build reports in the gitignored .superpowers/sdd/2026-07-26-career-ops-pipeline-correctness):

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

.NOTES
  Do not launch this through a pipe (`... | Out-String`). Proven 2026-08-04: a
  piped launcher returns when the last process holding the inherited stdout
  handle dies, not when this script exits. `claude --print` starts MCP servers
  that Windows does not reparent when it exits, so they outlive the run holding
  that handle and the launcher looks hung for hours. This script exits correctly
  -- the tracer shows it reaching `finally: lock removed` every time. Launch via
  run-nightly-hc.ps1, Task Scheduler (console, no pipe), or Start-Process with
  -RedirectStandardOutput.

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
    CAREEROPS_SCAN_CMD    Runtime used instead of `node` for `scan.mjs`. Lets a
                          test drive a stub that exits 0 without appending to
                          scan-runs.tsv, exercising the "scan claimed success but
                          never ran" path.
    CAREEROPS_VAULT_DIR   Redirects vault output (decisions.jsonl,
                          morning-review.md) so tests do not pollute the vault.
    CAREEROPS_DATA_DIR    Redirects pipeline.md, applications.md (via
                          CAREER_OPS_TRACKER, propagated to merge-tracker.mjs /
                          verify-pipeline.mjs / reserve-report-num.mjs) and
                          needs-attention.md, so tests do not touch the user's
                          real ~176-row queue / 11-row tracker. Defaults to
                          $ProjectDir\data — byte-identical to the pre-override
                          paths when unset.
    CAREEROPS_LOG_DIR     Redirects batch\logs (run log, trace log, scan log,
                          per-eval worker logs). Added 2026-10-03: without it
                          every smoke run appended stub output to the real
                          nightly-<date>.log. Defaults to $ProjectDir\batch\logs.
  Removed 2026-08-01: CAREEROPS_ALLOW_SCAN. It gated an LLM+Playwright scan over
  untrusted portals. Scan is now `node scan.mjs` — no LLM, no browser, no shell in
  the untrusted-content path — so the risk the interlock existed for is gone. See
  the SCAN block for why the gated path was removed rather than fixed.
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
# Real wall-clock start, for Write-Trace's elapsed column. Deliberately NOT
# reusing $RunTimestamp: that one is minute-resolution and doubles as the
# decisions.jsonl / digest-cursor comparison value, so it must not be re-derived.
$ScriptStart   = Get-Date
# needs-attention.md is written by three producers (this script, digest.mjs and
# merge-tracker.mjs). The other two use JS `toISOString()`, so this one matches
# them rather than interleaving a second format into the same table. Kept
# separate from $RunTimestamp on purpose: that value is also the decisions.jsonl
# `evaluated_at` the digest cursor compares against, and reformatting it would
# change the digest window semantics.
$RunTimestampIso = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
$LogDir        = if ($env:CAREEROPS_LOG_DIR) { $env:CAREEROPS_LOG_DIR }
                 else { "$ProjectDir\batch\logs" }
$ReportsDir    = "$ProjectDir\reports"
$TsvDir        = "$ProjectDir\batch\tracker-additions"
$BatchPrompt   = "$ProjectDir\batch\batch-prompt.md"
$PipelineFile  = "$DataDir\pipeline.md"
$NeedsAttnFile = "$DataDir\needs-attention.md"
$TrackerFile   = "$DataDir\applications.md"
$MorningReview = "$VaultDir\morning-review.md"
$DecisionsLog  = "$VaultDir\decisions.jsonl"
$DigestCursor  = "$VaultDir\digest-cursor.json"
$LockFile      = "$ProjectDir\batch\.nightly.pid"
$InflightFile  = "$ProjectDir\batch\.nightly-inflight.json"
$RunLog        = "$LogDir\nightly-$Date.log"

# Worker command. Defaults to the real thing; overridable only for tests.
$WorkerCmd     = if ($env:CAREEROPS_WORKER_CMD) { $env:CAREEROPS_WORKER_CMD } else { 'claude' }

# Scan runtime, same convention as $WorkerCmd: `& $ScanCmd scan.mjs`. A stub that
# exits 0 without appending to scan-runs.tsv is how the "exited 0 but never ran"
# path gets exercised -- the exact shape of the 2026-08-01 silent failure.
$ScanCmd       = if ($env:CAREEROPS_SCAN_CMD) { $env:CAREEROPS_SCAN_CMD } else { 'node' }

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
# The memsearch plugin's SessionStart hook (session-start.sh -> start_watch)
# launches a persistent `memsearch watch` daemon for every session, headless
# ones included. Its stop path is a no-op on this platform: stop_watch() sweeps
# with `pgrep`, which Git Bash does not ship, and the failure is swallowed by
# `|| true`. Each `claude --print` below would therefore strand a daemon that
# outlives the run at ~1.5 GB, growing ~1 GB/day, until Windows starts failing
# allocations for everything else (three of them cost a Claude session on
# 2026-08-12, 5s after a Resource-Exhaustion-Detector event).
#
# The plugin sets this exact variable when it spawns a headless claude itself
# (hooks/stop.sh:147) — same reasoning, same mechanism, so this is the
# supported way to opt out rather than a workaround.
$env:MEMSEARCH_NO_WATCH = '1'

function Write-Log {
    param([string]$Msg, [string]$Color = 'White')
    $line = "[$RunTimestamp] $Msg"
    Write-Host $line -ForegroundColor $Color
    $line | Out-File $RunLog -Encoding utf8 -Append
}

# Exit-path tracer (2026-07-30). Write-Log stamps every line with
# $RunTimestamp -- fixed at run start -- so the run log cannot say WHEN a step
# happened. That is fine for reading a night's outcome and useless for finding
# where a run stopped: the 2026-07-29 hang produced a log whose every line read
# 21:28, while the artifacts on disk showed the work finishing at 21:38 and the
# process staying alive until 07:45.
#
# This writes wall-clock time, elapsed seconds, and the live descendant count to
# a separate trace file. Descendants matter because the eval worker is
# `claude --print`, which starts MCP servers of its own; a grandchild that
# outlives the run while holding an inherited stdout handle is a known way for a
# script to finish its work and still not exit. Appends and swallows its own
# errors -- a tracer must never be the reason a run fails.
$TraceLog = "$LogDir\nightly-trace-$Date.log"

# Descendants seen at any point in the run: PID -> creation time. Creation time
# is stored because Windows recycles PIDs, and a recycled PID would otherwise
# read as "our grandchild is still alive" forever.
$script:TraceSeen = @{}

# Counting direct children only (ParentProcessId=$PID) was blind to the exact
# thing this tracer exists to catch (proven 2026-08-04). `claude --print` starts
# MCP servers as ITS children, so they are our grandchildren; when claude exits,
# Windows does NOT reparent them — their ParentProcessId keeps pointing at a dead
# PID, so they fall out of any walk rooted at us while still holding the stdout
# handle they inherited. The 2026-08-04 run logged children=0 on every line and
# still pinned its launcher open for 3h24m.
#
# So count three things, not one:
#   children — direct children, what the old tracer reported
#   tree     — every live descendant reachable by walking ParentProcessId down
#   orphans  — processes we saw in the tree earlier that are still alive but no
#              longer reachable from us. These are the dangerous ones: invisible
#              to a tree walk, still capable of holding an inherited handle.
function Get-TraceDescendants {
    $all = Get-CimInstance Win32_Process -ErrorAction Stop
    $byParent = @{}
    foreach ($p in $all) {
        $key = [string]$p.ParentProcessId
        if (-not $byParent.ContainsKey($key)) { $byParent[$key] = @() }
        $byParent[$key] += $p
    }
    # Breadth-first from us. $seenPids guards against a recycled PID forming a
    # cycle in the parent map and spinning this forever.
    $tree     = @()
    $seenPids = @{ "$PID" = $true }
    $queue    = @([string]$PID)
    while ($queue.Count -gt 0) {
        $current = $queue[0]
        $queue   = @($queue | Select-Object -Skip 1)
        foreach ($child in @($byParent[$current])) {
            if ($null -eq $child) { continue }
            $cpid = [string]$child.ProcessId
            if ($seenPids.ContainsKey($cpid)) { continue }
            $seenPids[$cpid] = $true
            $tree += $child
            $queue += $cpid
        }
    }
    return @{ All = $all; Tree = $tree }
}

function Write-Trace {
    param([string]$Stage)
    try {
        $children = -1
        $treeCount = -1
        $orphans = -1
        $traceErr = ''
        try {
            $snap = Get-TraceDescendants
            $tree = $snap.Tree
            $treeCount = @($tree).Count
            $children  = @($tree | Where-Object { [string]$_.ParentProcessId -eq [string]$PID }).Count

            # Remember everything currently reachable, with its creation time.
            foreach ($p in $tree) { $script:TraceSeen["$($p.ProcessId)"] = $p.CreationDate }

            # Anything remembered, still running with the SAME creation time, and
            # no longer in the tree, is an orphaned descendant.
            $liveNow = @{}
            foreach ($p in $snap.All) { $liveNow["$($p.ProcessId)"] = $p.CreationDate }
            $inTree = @{}
            foreach ($p in $tree) { $inTree["$($p.ProcessId)"] = $true }
            $orphans = 0
            foreach ($key in @($script:TraceSeen.Keys)) {
                if ($inTree.ContainsKey($key)) { continue }
                if (-not $liveNow.ContainsKey($key)) { continue }
                if ($liveNow[$key] -ne $script:TraceSeen[$key]) { continue }  # PID reused
                $orphans++
            }
        } catch {
            # Absorbed on purpose: a diagnostic must never end the run. But not
            # discarded — the -1 sentinels above say the counts are unavailable,
            # and this says why, which the bare `catch {}` threw away. A tracer
            # that silently stops tracing is the failure it exists to detect.
            $traceErr = ($_.Exception.Message -replace '\s+', ' ').Trim()
        }
        $elapsed = [math]::Round(((Get-Date) - $ScriptStart).TotalSeconds, 1)
        $errPart = if ($traceErr) { "  trace-error=$traceErr" } else { '' }
        "{0}  +{1,8}s  pid={2}  children={3}  tree={4}  orphans={5}  {6}{7}" -f `
            (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $elapsed, $PID, $children, $treeCount, $orphans, $Stage, $errPart |
            Out-File $TraceLog -Encoding utf8 -Append -ErrorAction Stop
    } catch {
        # The trace log itself is unwritable, so it cannot carry the report of
        # its own failure. Fall back to the run log; if that is gone too, the
        # console is the last sink. Still absorbed — tracing must not end the
        # run — but no longer silent.
        $why = ($_.Exception.Message -replace '\s+', ' ').Trim()
        try   { Write-Log "TRACE UNAVAILABLE ($Stage): $why" 'DarkYellow' }
        catch { Write-Host "[trace] TRACE UNAVAILABLE ($Stage): $why" -ForegroundColor DarkYellow }
    }
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

# ---- FORK INVARIANTS ----
# Backstop for the local divergences an upstream merge can silently undo. Runs
# here, before the lock and before any worker, for two reasons:
#
#   1. One of the invariants IS the worker's permission scoping. If a merge has
#      restored --dangerously-skip-permissions, this run would hand untrusted job
#      postings to a worker with no allowlist. That must not proceed unattended.
#   2. This is the only trigger that needs no per-clone setup. A pre-push hook
#      lives in .git/ and dies with a fresh clone; a post-merge hook does not fire
#      at all when a merge stops on conflicts, which every real upstream sync
#      here does. The nightly runs daily on the machine that matters, so drift
#      surfaces within 24h even if every hook is missing.
#
# Exit 1, not 2: 2 means "partial batch, some postings died", which is normal.
# A violated invariant means the checkout itself is not trustworthy.
$invariantScript = Join-Path $PSScriptRoot 'check-fork-invariants.mjs'
if (Test-Path $invariantScript) {
    $invariantOut = & node $invariantScript 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Log "FATAL: fork invariant violated — refusing to run. An upstream merge has likely undone a local guarantee." 'Red'
        foreach ($line in $invariantOut) { Write-Log "  $line" 'Red' }
        exit 1
    }
    Write-Log "Fork invariants OK."
    # CHECK 3 (batch-tailor.mjs) warns rather than failing, so its output arrives
    # on a zero exit. Without this loop the script's stdout was discarded on
    # success and every warning it emits would be invisible here — a guard that
    # nothing reads is decoration. Narrow to WARN lines so the OK line is not
    # duplicated into the log.
    foreach ($line in $invariantOut) {
        if ("$line" -match '^\s*WARN:') { Write-Log "  $line" 'Yellow' }
    }
} else {
    # Absent is a real signal, not a shrug: the file is fork-local and declared in
    # config/local-paths.txt, so its absence means a checkout that is not this fork.
    Write-Log "WARN: check-fork-invariants.mjs not found at $invariantScript — fork guarantees unverified this run." 'Yellow'
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
        # ============ SCAN: deterministic, no LLM, no browser (rewritten 2026-08-01) ============
        # This used to be `claude --print` driving the Playwright MCP over UNTRUSTED job
        # portals, which is why it carried a P0 interlock (CAREEROPS_ALLOW_SCAN) and a
        # scoped allowlist marked UNVERIFIED HEADLESS. Verifying it settled the question
        # the other way: the scoped allowlist (Read,Write,Edit,WebFetch,WebSearch,
        # mcp__playwright) has no shell, so the worker could not run `node scan.mjs` --
        # the one thing scan mode exists to do. It reported "Blocked. Both shells denied"
        # in prose, exited 0, and this script logged "Scan complete / 0 new jobs" and
        # carried on. Non-functional AND silent.
        #
        # scan.mjs is the zero-token scanner (Greenhouse/Ashby/Lever/Workday APIs). Calling
        # it directly removes the LLM, the browser, and the shell from the untrusted-content
        # path entirely, so the P0 the interlock guarded no longer exists and the interlock
        # is gone with it. Deterministic wrapper fetches, deterministic code decides.
        #
        # SCOPE NOTE: portals.yml still lists ~30 companies no zero-token provider handles
        # (CrowdStrike, Palo Alto, Tenable, ...). scan.mjs prints them as a WebSearch
        # handoff list and does NOT fetch them. That is a real gap, but not a regression:
        # the LLM path never once scanned them successfully. Handle them with a watched
        # `/career-ops scan` when you want them, not from an unattended 6am job.
        # =======================================================================================
        $runsFile   = "$ProjectDir\data\scan-runs.tsv"
        $runsBefore = 0
        if (Test-Path $runsFile) { $runsBefore = @(Get-Content $runsFile | Where-Object { $_.Trim() }).Count }

        & $ScanCmd scan.mjs *>&1 | Tee-Object -FilePath $scanLog | Out-Null
        $scanExit = $LASTEXITCODE

        # A failed scan means the queue is not what this run assumes it is.
        # Continuing would evaluate a stale pipeline and report success.
        if ($scanExit -ne 0) {
            Write-Log "FATAL: scan exited $scanExit. See $scanLog" 'Red'
            Add-NeedsAttention -Url '(scan)' -Stage 'scan' -Reason "scan exited $scanExit; see $scanLog"
            exit 1
        }

        # Exit 0 is not evidence. The blocked LLM scan exited 0 having done nothing, and
        # "0 new jobs" is indistinguishable from a working scan on a quiet night -- which
        # is exactly how this went unnoticed. scan.mjs appends one row per run to
        # scan-runs.tsv with its own status, so require that row to exist and say
        # 'completed'. A scan that cannot prove it ran is a failed scan.
        $runsAfter = 0
        if (Test-Path $runsFile) { $runsAfter = @(Get-Content $runsFile | Where-Object { $_.Trim() }).Count }
        if ($runsAfter -le $runsBefore) {
            Write-Log "FATAL: scan exited 0 but appended no row to data/scan-runs.tsv -- it did not run. See $scanLog" 'Red'
            Add-NeedsAttention -Url '(scan)' -Stage 'scan' -Reason "scan produced no scan-runs.tsv row despite exit 0; see $scanLog"
            exit 1
        }
        $lastRun    = (Get-Content $runsFile | Where-Object { $_.Trim() })[-1]
        $runStatus  = ($lastRun -split "`t")[1]
        if ($runStatus -ne 'completed') {
            Write-Log "FATAL: scan recorded status '$runStatus' (expected 'completed'). See $scanLog" 'Red'
            Add-NeedsAttention -Url '(scan)' -Stage 'scan' -Reason "scan-runs.tsv status '$runStatus'; see $scanLog"
            exit 1
        }
        Write-Log "Scan complete (scan-runs.tsv status=$runStatus). Log: $scanLog" 'Green'
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

# Fetch the WHOLE actionable queue, rank it, and only then apply -MaxJobs.
# Selecting first and ranking second would just reorder the same N rows and
# change nothing about which roles get evaluated. lib/pipeline-state.mjs
# defaults --limit to 10, so the ceiling has to be passed explicitly.
$listSel = Get-PipelineSelection -Limit 100000
if ($null -eq $listSel) {
    Write-Log "FATAL: could not list actionable jobs from $PipelineFile." 'Red'
    exit 1
}
Report-UnusablePipelineRows -Selection $listSel -Phase 'dispatch'

# Rank by security > AI/ML > neither, stable within a tier so queue order still
# decides among equals. Order only: nothing is dropped, so a low-tier row still
# evaluates on a later night. See lib/prioritise-queue.mjs for why.
$allRows = @($listSel.rows)
$ranked = $null
if ($allRows.Count -gt 0) {
    $ranked = ($listSel | ConvertTo-Json -Depth 10 -Compress) | & node lib/prioritise-queue.mjs
    if ($LASTEXITCODE -ne 0 -or -not $ranked) {
        # Degrade to queue order rather than failing the run: the prioritiser is
        # an optimisation, and a night of FIFO evaluation is a far better outcome
        # than no evaluation at all. Loud, because silently unranked is exactly
        # the "looks fine, quietly worse" failure this session spent hours on.
        Write-Log "WARN: prioritiser failed (exit $LASTEXITCODE) — falling back to queue order." 'Yellow'
        $jobs = @($allRows | Select-Object -First $MaxJobs)
    } else {
        $jobs = @((($ranked | Out-String) | ConvertFrom-Json).rows | Select-Object -First $MaxJobs)
    }
} else {
    $jobs = @()
}

$tierName = @{ 2 = 'security'; 1 = 'ai/ml'; 0 = 'neither' }
Write-Log "$($allRows.Count) actionable job(s) (pending + retryable failures); dispatching $($jobs.Count)."
foreach ($j in $jobs) {
    $t = if ($null -ne (Get-Prop $j 'tier')) { $tierName[[int](Get-Prop $j 'tier')] } else { 'unranked' }
    Write-Log "  queued [$t] $($j.company) - $($j.title)"
}

# ---- EVALUATE ----

$results = [System.Collections.Generic.List[PSObject]]::new()

# Reconciliation baseline: decisions.jsonl is append-only, so the delta over the
# run is exact. Comparing the running total instead would pass trivially.
$decisionsBefore = if (Test-Path $DecisionsLog) { @(Get-Content $DecisionsLog).Count } else { 0 }

# Code-running tools granted by the user-level settings the worker inherits.
# Keep in sync with batch-tailor.mjs (guarded there by check-fork-invariants.mjs).
$WorkerDeniedTools = @(
    'mcp__plugin_context-mode_context-mode__ctx_execute',
    'mcp__plugin_context-mode_context-mode__ctx_execute_file',
    'mcp__plugin_context-mode_context-mode__ctx_batch_execute'
) -join ','

# Appended to every resolved worker prompt. Each line answers an error class
# measured over 31 nightly runs (2026-08-31..10-02): 26 failed Reads of the old
# sentinel JD path, 4 failed Reads of absent optional inputs, and 36 dontAsk
# denials -- every one a shell attempt to write a file that then succeeded via
# Write. None lost work; each cost a round trip.
$NightlyWorkerNotes = @'


---

## Nightly worker notes (appended by run-nightly.ps1)

- **No JD file exists for this job.** Skip Step 1, item 1 and fetch the JD from the URL directly.
- `article-digest.md` and `llms.txt` are optional and may be absent. Confirm a path with Glob before reading it; never Read a path you have not confirmed.
- **Your only shell access is `node generate-pdf.mjs`, through the Bash tool.** Every other Bash or PowerShell command is denied. Write the tracker TSV and the CV HTML with the Write tool (it writes tab characters exactly). To change a file you already wrote, rewrite it with Write.
'@

Write-Log "=== EVALUATE phase ($($jobs.Count) jobs) ===" 'Cyan'

$idx = 0
foreach ($job in $jobs) {
    $idx++
    $jobUrl = $job.url
    $id     = "nightly-$Date-$idx"
    # The nightly never pre-downloads a JD. This used to be a sentinel PATH
    # (jds\not-pre-downloaded.md) that looked real, so the worker Read it, failed,
    # and only then fell back to WebFetch: 26 of 31 runs, 2026-08-31..10-02. Say
    # "none" in words; $NightlyWorkerNotes tells the worker to skip straight to the URL.
    $jdFile = 'none (not pre-downloaded -- skip to fetching the URL)'

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
    # Named by $id (nightly-<date>-<idx>), not by slot. Report numbers are reused
    # after a failed eval (the reservation is released), so "<num>-nightly-<idx>"
    # collided across nights and a later run overwrote an earlier failure's log.
    $logFile      = "$LogDir\$reportNum-$id.log"

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

        # batch/batch-prompt.md is upstream-maintained and already far diverged,
        # so the nightly-specific guidance is appended here, in a fork-local file,
        # rather than edited into it.
        $resolved = (Resolve-BatchPrompt $jobUrl $jdFile $reportNum $Date $id) + $NightlyWorkerNotes
        $resolved | Out-File $resolvedPath -Encoding utf8

        $userMsg = "Procesa esta oferta de empleo. Ejecuta el pipeline completo: evaluacion A-G + report .md + PDF + tracker line. URL: $jobUrl JD file: $jdFile Report number: $reportNum Date: $Date Batch ID: $id"

        # --disallowedTools: the worker inherits ~/.claude/settings.json, whose
        # allow list grants context-mode's code-execution tools. --allowedTools
        # only ADDS permissions, so under dontAsk a worker reading an untrusted
        # posting could still run arbitrary code through them. Proven 2026-10-02:
        # a Read-only dontAsk worker ran ctx_execute (RESULT=42); with this flag
        # the tool does not exist ("No such tool available").
        & $WorkerCmd --print `
            --allowedTools "Read,Write,Glob,Grep,WebFetch,WebSearch,Bash(node generate-pdf.mjs *)" `
            --disallowedTools $WorkerDeniedTools `
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
    # A run that evaluated nothing still refreshes the artifact. Skipping the
    # write is what let morning-review.md keep displaying an EARLIER run's
    # hits: a nightly that had stopped firing and a nightly that simply found
    # nothing left byte-identical evidence in the one file a human opens. With
    # the write unconditional, a stale timestamp in the heading can only mean
    # the job did not run.
    #
    # decisions.jsonl is deliberately untouched here — there are no decisions
    # to append, and it is the append-only history that this rendered view is
    # derived from.
    Write-Log "No results to write — refreshing the morning review as a quiet run."
    $md  = "# Morning Review - $RunTimestamp`n`n"
    $md += "0 top result(s) from last night's scan (evaluated 0).`n`n---`n`n"
    $md += "_Nothing actionable this run._`n`n"
    $md += "_This file is rewritten on every run, including quiet ones. "
    $md += "If the heading above is not today, the nightly did not run._`n"
    $md | Out-File $MorningReview -Encoding utf8
    Write-Log "Morning review -> $MorningReview" 'Green'
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

Write-Trace 'tail: before merge-tracker'
& node merge-tracker.mjs
if ($LASTEXITCODE -ne 0) { Write-Log "FATAL: merge-tracker failed." 'Red'; exit 1 }
Write-Trace 'tail: merge-tracker returned'

& node verify-pipeline.mjs
$verifyExit = $LASTEXITCODE
Write-Trace "tail: verify-pipeline returned exit=$verifyExit"
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
Write-Trace 'tail: before digest.mjs'
& node digest.mjs --file $DecisionsLog --needs-attention $NeedsAttnFile --cursor $DigestCursor --since $RunTimestamp
$digestExit = $LASTEXITCODE
Write-Trace "tail: digest.mjs returned exit=$digestExit"
if ($digestExit -ne 0) {
    Write-Log "Digest send failed — see $NeedsAttnFile" 'Red'
}

# Reconciliation passed and the tracker merged. An unverified eval must never
# read as a clean success — but "some postings were dead" is not the same event
# as "this run is broken", and giving them the same exit code trains the owner
# to ignore both. See the exit-code contract in the header.
$unverified = $evaluated - $completed
Write-Trace "tail: exit branching (evaluated=$evaluated completed=$completed digestExit=$digestExit)"
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
Write-Trace 'tail: about to exit 0'
exit 0

} catch {
    # A terminating error -- a `throw`, a Set-StrictMode violation, any cmdlet
    # failing under $ErrorActionPreference='Stop' -- otherwise reaches stderr
    # only. The scheduled task redirects nothing, so stderr is discarded: the
    # run log kept whatever line it had last written and simply stopped, with no
    # reason and no '=== Done ==='. On disk a failed run and a hung run were
    # indistinguishable, which is how three consecutive mornings of "SCAN
    # blocked: unverified headless scan path" read as a stall instead of a
    # config gap (2026-07-30..08-01, every run dead at +3s).
    #
    # Not a rethrow: rethrowing writes the same record to the same unread
    # stderr and still exits 1. Logging it here is the only way the reason
    # reaches a file the owner actually reads the next morning.
    $err = $_
    try {
        Write-Log "FATAL: run aborted -- $($err.Exception.Message)" 'Red'
        $inv = $err.InvocationInfo
        if ($inv) {
            $src  = if ($inv.ScriptName) { $inv.ScriptName } else { '<unknown>' }
            $stmt = if ($inv.Line) { $inv.Line.Trim() } else { '' }
            Write-Log "       at ${src}:$($inv.ScriptLineNumber)  $stmt" 'Red'
        }
    } catch {
        # Write-Log itself failed (unwritable log dir, full disk). Console is the
        # last resort -- never let the error reporter swallow the error.
        Write-Error "FATAL: run aborted -- $($err.Exception.Message)"
    }
    Write-Trace "fatal: $($err.Exception.Message)"
    exit 1
} finally {
    # Traced individually: `exit` inside a try runs this block first, so a
    # process that has logged "about to exit" and never dies is stuck HERE, and
    # the child count says whether a surviving grandchild is holding it open.
    Write-Trace 'finally: entered'
    Pop-Location
    Write-Trace 'finally: Pop-Location done'
    Remove-Item $LockFile -Force -ErrorAction SilentlyContinue
    Write-Trace 'finally: lock removed -- process should now exit'
}
