# run-batch.ps1 — fork-local launcher for batch/batch-runner.sh.
#
# Exists for two Windows-specific reasons. Neither is worth patching into
# batch-runner.sh itself: that file is upstream-owned (SYSTEM_PATHS), so a
# local edit there is a merge conflict on every sync (career-ops#2421).
#
# 1. memsearch leaks a watch daemon per headless session.
#    The memsearch plugin's SessionStart hook starts a persistent
#    `memsearch watch` daemon for every session, and `claude -p` is a session
#    -- so each batch worker strands one. Its stop path is a no-op here:
#    stop_watch() sweeps with `pgrep`, which Git for Windows does not ship,
#    and `|| true` swallows the failure. Stranded daemons hold ~1.5 GB each
#    and grow ~1 GB/day (zilliztech/memsearch#658, where the upstream fix is
#    a CLAUDE_CODE_ENTRYPOINT guard in start_watch). MEMSEARCH_NO_WATCH=1 is
#    the plugin's own opt-out -- it sets the same variable when its Stop hook
#    spawns a `claude -p` (hooks/stop.sh). Remove this once the guard ships.
#
# 2. Bare `bash` on the Windows PATH is C:\WINDOWS\system32\bash.exe -- the
#    WSL launcher, not Git Bash. WSL has no Windows PATH, so `claude` and
#    `node` do not resolve there and the run dies in a confusing way. Resolve
#    Git Bash from git.exe's own install instead of trusting PATH order.
#
# Usage: .\run-batch.ps1 [any batch-runner.sh options]
#        .\run-batch.ps1 --dry-run

$ErrorActionPreference = 'Stop'

$git = Get-Command git -ErrorAction SilentlyContinue
if (-not $git) { throw "git not found on PATH - cannot locate Git Bash." }

# git.exe lives in <install>\cmd\git.exe; bash.exe in <install>\bin\bash.exe.
$bash = Join-Path (Split-Path (Split-Path $git.Source -Parent) -Parent) 'bin\bash.exe'
if (-not (Test-Path $bash)) { throw "Git Bash not found at $bash (resolved from $($git.Source))." }

$runner = Join-Path $PSScriptRoot 'batch\batch-runner.sh'
if (-not (Test-Path $runner)) { throw "batch/batch-runner.sh not found at $runner." }

# See header note 1. $env: writes to the PROCESS environment, so it outlives
# this script -- a plain assignment would leave the variable set in the calling
# terminal, and an interactive `claude` launched from that same terminal would
# then skip its watcher too, silently losing real-time indexing. Restore the
# prior value (including "was unset") on the way out.
$hadNoWatch = Test-Path Env:\MEMSEARCH_NO_WATCH
$priorNoWatch = if ($hadNoWatch) { $env:MEMSEARCH_NO_WATCH } else { $null }
$env:MEMSEARCH_NO_WATCH = '1'

Push-Location (Join-Path $PSScriptRoot 'batch')
try {
    & $bash './batch-runner.sh' @args
    $rc = $LASTEXITCODE
} finally {
    Pop-Location
    if ($hadNoWatch) { $env:MEMSEARCH_NO_WATCH = $priorNoWatch }
    else { Remove-Item Env:\MEMSEARCH_NO_WATCH -ErrorAction SilentlyContinue }
}

exit $rc
