<#
PowerShell wrapper to run focused unit tests locally.
Usage: .\scripts\run-local-tests.ps1
#>

Set-StrictMode -Version Latest

if (-not $env:DATABASE_URL) { $env:DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:5432/ai_test' }
if (-not $env:REDIS_URL) { $env:REDIS_URL = 'redis://127.0.0.1:6379' }
$env:ALLOW_LLM_CALLS = '0'
$env:HYDRATION_PAUSED = '1'
$env:NODE_ENV = 'test'

Write-Host "DATABASE_URL=$env:DATABASE_URL"
Write-Host "REDIS_URL=$env:REDIS_URL"

Write-Host 'Running focused unit tests: xp & badges'
npx jest tests/unit/lib/student/xp.test.ts tests/unit/lib/student/badges.test.ts --runInBand --color
