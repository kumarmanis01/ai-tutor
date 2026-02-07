<#
Run the hydration reconciler in dry-run or real mode.

Usage:
  powershell .\scripts\reconciler-dryrun.ps1 -rootJobId <id> -DryRun
  powershell .\scripts\reconciler-dryrun.ps1 -DryRun:$false

This wrapper calls the TypeScript reconciler via `npx tsx`.
Ensure you run this from the repository root.
#>

param(
  [string]$rootJobId = "",
  [switch]$DryRun
)

if ($rootJobId -ne "") {
  $rootArg = "--rootJobId=$rootJobId"
}
else {
  $rootArg = ""
}

if ($DryRun) {
  $dryArg = "--dryRun=true"
}
else {
  $dryArg = "--dryRun=false"
}

Write-Host "Running hydration-reconciler with: $rootArg $dryArg"

npx tsx scripts/hydration-reconciler.ts $rootArg $dryArg

if ($LASTEXITCODE -ne 0) {
  Write-Host "Reconciler exited with code $LASTEXITCODE" -ForegroundColor Red
  exit $LASTEXITCODE
}
else {
  Write-Host "Reconciler completed" -ForegroundColor Green
}
