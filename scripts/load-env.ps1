<#
.SYNOPSIS
  Dot-source this script to load variables from .env.production into the current PowerShell session.

USAGE
  # In PowerShell, run:
  . .\scripts\load-env.ps1

  After dot-sourcing, environment variables from .env.production are available as $env:VAR
#>
param(
  [string]$EnvFile = ".env.production"
)

function Parse-EnvFile($filePath) {
  $out = @{}
  if (-Not (Test-Path $filePath)) { return $out }
  Get-Content $filePath | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith('#')) { return }
    $idx = $line.IndexOf('=')
    if ($idx -lt 0) { return }
    $key = $line.Substring(0, $idx)
    $val = $line.Substring($idx + 1)
    if (($val.StartsWith('"') -and $val.EndsWith('"')) -or ($val.StartsWith("'") -and $val.EndsWith("'"))) {
      $val = $val.Substring(1, $val.Length - 2)
    }
    $out[$key] = $val
  }
  return $out
}

#$PSScriptRoot may not be available when dot-sourced; resolve relative to current location
$repoRoot = Resolve-Path -Path .
$envPath = Join-Path $repoRoot $EnvFile
$vars = Parse-EnvFile $envPath
if ($vars.Count -eq 0) {
  Write-Host "No .env.production found at $envPath"
} else {
  foreach ($k in $vars.Keys) {
    $v = $vars[$k]
    Set-Item -Path "Env:$k" -Value $v
  }
  Write-Host "Loaded $($vars.Count) variables from $envPath"
}
