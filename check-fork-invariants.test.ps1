# Mutation suite for check-fork-invariants.mjs (fork-local, sdkkds).
#
#   pwsh ./check-fork-invariants.test.ps1
#
# Every assertion in CHECK 3 is exercised in BOTH directions: it must fire on the
# defect and stay quiet on the negation. A guard that has never been shown to
# fail is not a guard, and this suite exists because a mutation run caught a real
# false negative during development -- the fact-gate assertion matched a
# neighbouring COMMENT that named verify-cv-facts.mjs, so deleting the actual
# allowlist entry left the check green. Both comment-immunity cases below encode
# that bug so a future refactor cannot reintroduce it.
#
# The suite works on a scratch copy and never mutates the real tree.

$ErrorActionPreference = 'Stop'
$src = $PSScriptRoot
$t   = Join-Path ([System.IO.Path]::GetTempPath()) "fork-invariants-test-$PID"

function New-Fixture {
    if (Test-Path $t) { Remove-Item $t -Recurse -Force }
    New-Item -ItemType Directory (Join-Path $t 'batch') -Force | Out-Null
    Copy-Item (Join-Path $src 'check-fork-invariants.mjs') $t
    Copy-Item (Join-Path $src 'batch-tailor.mjs') $t
    Copy-Item (Join-Path $src 'batch\batch-runner.sh') (Join-Path $t 'batch')
    Copy-Item (Join-Path $src '.gitattributes') $t
}
function Invoke-Check {
    $out = & node (Join-Path $t 'check-fork-invariants.mjs') 2>&1
    [PSCustomObject]@{ Exit = $LASTEXITCODE; Text = ($out -join "`n") }
}
function Get-Tailor { Get-Content (Join-Path $t 'batch-tailor.mjs') -Raw }
function Set-Tailor([string]$new) { Set-Content (Join-Path $t 'batch-tailor.mjs') $new -NoNewline -Encoding utf8 }

$r = @()
function Add-Case($case, $want, $x, $ok) {
    $script:r += [PSCustomObject]@{ Case = $case; Want = $want; Exit = $x.Exit; Pass = $ok }
}

New-Fixture
$x = Invoke-Check
Add-Case 'current tree (scoped)' 'exit 0' $x ($x.Exit -eq 0)

New-Fixture
Set-Tailor ((Get-Tailor) -replace "'--permission-mode', 'dontAsk',", "'--dangerously-skip-permissions',")
$x = Invoke-Check
Add-Case 'flag restored by merge' 'exit 1' $x ($x.Exit -eq 1 -and $x.Text -match 'dangerously-skip-permissions')

New-Fixture
Set-Tailor ((Get-Tailor) -replace "'--permission-mode', 'dontAsk',", "")
$x = Invoke-Check
Add-Case '--permission-mode dropped' 'exit 1' $x ($x.Exit -eq 1 -and $x.Text -match 'permission-mode')

New-Fixture
Set-Tailor ((Get-Tailor) -replace "'--allowedTools', allowedTools,", "")
$x = Invoke-Check
Add-Case '--allowedTools dropped' 'exit 1' $x ($x.Exit -eq 1 -and $x.Text -match 'allowedTools')

New-Fixture
Set-Tailor ((Get-Tailor) -replace "'Bash\(node verify-cv-facts\.mjs \*\)',", "")
$x = Invoke-Check
Add-Case 'fact gate removed' 'exit 1' $x ($x.Exit -eq 1 -and $x.Text -match 'verify-cv-facts')

# The false negative a mutation run exposed: entry gone, comment still says it.
New-Fixture
Set-Tailor ((Get-Tailor) -replace "'Bash\(node verify-cv-facts\.mjs \*\)',", "// verify-cv-facts.mjs used to be listed here")
$x = Invoke-Check
Add-Case 'fact gate ONLY in a comment' 'exit 1' $x ($x.Exit -eq 1 -and $x.Text -match 'verify-cv-facts')

# The mirror: the flag named in a comment inside the argv array must not fire.
New-Fixture
Set-Tailor ((Get-Tailor) -replace "'--permission-mode', 'dontAsk',", "// upstream uses --dangerously-skip-permissions here`r`n    '--permission-mode', 'dontAsk',")
$x = Invoke-Check
Add-Case 'flag in comment INSIDE argv' 'exit 0' $x ($x.Exit -eq 0)

New-Fixture
Set-Tailor ((Get-Tailor) -replace 'claudeArgs = \[', 'workerArgv = [')
$x = Invoke-Check
Add-Case 'argv array renamed' 'exit 1' $x ($x.Exit -eq 1 -and $x.Text -match 'could not find the worker argv array')

New-Fixture
Set-Tailor ((Get-Tailor) -replace 'allowedTools = \[', 'toolAllowList = [')
$x = Invoke-Check
Add-Case 'allowlist array renamed' 'exit 1' $x ($x.Exit -eq 1 -and $x.Text -match 'could not find the allowlist array')

New-Fixture
Remove-Item (Join-Path $t 'batch-tailor.mjs')
$x = Invoke-Check
Add-Case 'batch-tailor.mjs deleted' 'exit 1' $x ($x.Exit -eq 1 -and $x.Text -match 'is missing')

New-Fixture
$f = Join-Path $t 'batch\batch-runner.sh'
Set-Content $f ((Get-Content $f -Raw) -replace '--permission-mode dontAsk', '--dangerously-skip-permissions') -NoNewline -Encoding utf8
$x = Invoke-Check
Add-Case 'CHECK 1 still fatal' 'exit 1' $x ($x.Exit -eq 1 -and $x.Text -match 'batch-runner')

$r | Format-Table -AutoSize
$failed = @($r | Where-Object { -not $_.Pass }).Count
if ($failed -eq 0) { "PASS: $($r.Count)/$($r.Count) cases" } else { "FAIL: $failed of $($r.Count) cases" }
if (Test-Path $t) { Remove-Item $t -Recurse -Force }
exit $failed
