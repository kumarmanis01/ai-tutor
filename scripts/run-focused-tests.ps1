<#
FILE OBJECTIVE:
- Run focused Jest suites in PowerShell by resolving a local Node runtime explicitly, even when node is not on PATH.

LINKED UNIT TEST:
- __tests__/scripts/run-focused-tests.ps1.test.ts

COPILOT INSTRUCTIONS FOLLOWED:
- .github/copilot-instructions.md

EDIT LOG:
- 2026-05-09T00:00:00Z | copilot | created PowerShell wrapper that auto-resolves node.exe and invokes focused Jest runner
#>

param(
  [string]$Suite = 'proactive',
  [string]$NodePath = '',
  [string[]]$TestFiles = @()
)

Set-StrictMode -Version Latest

function Resolve-NodeRuntime {
  param([string]$ExplicitNodePath)

  if ($ExplicitNodePath -and (Test-Path -LiteralPath $ExplicitNodePath)) {
    return (Resolve-Path -LiteralPath $ExplicitNodePath).Path
  }

  $command = Get-Command node -ErrorAction SilentlyContinue
  if ($command -and $command.Source -and (Test-Path -LiteralPath $command.Source)) {
    return $command.Source
  }

  $candidates = @(
    "$env:ProgramFiles\\nodejs\\node.exe",
    "$env:ProgramFiles(x86)\\nodejs\\node.exe",
    "$env:LOCALAPPDATA\\Programs\\nodejs\\node.exe",
    "$env:USERPROFILE\\scoop\\apps\\nodejs\\current\\node.exe"
  )

  foreach ($candidate in $candidates) {
    if ($candidate -and (Test-Path -LiteralPath $candidate)) {
      return $candidate
    }
  }

  throw 'Unable to locate node.exe. Pass -NodePath "C:\\path\\to\\node.exe".'
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$runner = Join-Path $repoRoot 'scripts\run-focused-tests.cjs'

if (-not (Test-Path -LiteralPath $runner)) {
  throw "Runner script not found at $runner"
}

$nodeExe = Resolve-NodeRuntime -ExplicitNodePath $NodePath

$env:ALLOW_LLM_CALLS = '0'
$env:HYDRATION_PAUSED = '1'
$env:NODE_ENV = 'test'

$arguments = @($runner)
if ($TestFiles.Count -gt 0) {
  $arguments += $TestFiles
} else {
  $arguments += @('--suite', $Suite)
}

Write-Host "[run-focused-tests] node=$nodeExe"
Write-Host "[run-focused-tests] cwd=$repoRoot"

& $nodeExe @arguments
exit $LASTEXITCODE
