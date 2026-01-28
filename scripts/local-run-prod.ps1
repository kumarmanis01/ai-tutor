<#
Run production worker locally (CAUTION: connects to production DB/Redis).

USAGE (PowerShell):
  # from repo root
  powershell -ExecutionPolicy Bypass -File .\scripts\local-run-prod.ps1

This script does NOT write credentials to disk. It:
- reads `.env.production` to export `DATABASE_URL` and `REDIS_URL` into the session
- sets `HYDRATION_PAUSED=1` by default to avoid unexpected writes
- attempts to start the worker (pm2 if available, otherwise a background npm orchestrator)
- tails logs and provides manual commands to requeue or toggle hydration

Read the top-of-file warnings and confirm you have a backup/snapshot before proceeding.
#>

function Abort([string]$msg) {
  Write-Host "ABORT: $msg" -ForegroundColor Red
  exit 1
}

Write-Host "WARNING: This script will connect to the production database and Redis." -ForegroundColor Yellow
Write-Host "Make a backup or use a staging copy if you are unsure."

$confirm = Read-Host "Type RUN to continue (or anything else to cancel)"
if ($confirm -ne 'RUN') { Abort 'User cancelled' }

$envFile = Join-Path (Split-Path -Parent $PSScriptRoot) '.env.production'
if (-not (Test-Path $envFile)) { Abort "Cannot find $envFile" }

Write-Host "Reading $envFile (values will only be exported into this shell session)"

Get-Content $envFile | ForEach-Object {
  $_ = $_.Trim()
  if ($_ -match '^[#;]') { return }
  if ($_ -match '^\s*$') { return }
  $parts = $_ -split '=',2
  if ($parts.Length -ne 2) { return }
  $key = $parts[0].Trim()
  $val = $parts[1].Trim() -replace '^"|"$',''
  if ($key -in @('DATABASE_URL','REDIS_URL','APP_URL')) {
    Write-Host "Exporting $key to session"
    Set-Item -Path Env:$key -Value $val
  }
}

if (-not $env:DATABASE_URL) { Abort 'DATABASE_URL not set in .env.production or failed to parse' }
if (-not $env:REDIS_URL) { Write-Warning 'REDIS_URL not set; worker may not enqueue jobs' }

# Safety default: pause hydrations to avoid accidental writes.
Write-Host "Setting HYDRATION_PAUSED=1 to avoid writes. You can toggle later." -ForegroundColor Cyan
Set-Item -Path Env:HYDRATION_PAUSED -Value '1'

Write-Host "Choose start method for worker:" -ForegroundColor Green
Write-Host "  1) Start worker with pm2 (preferred if installed)"
Write-Host "  2) Start orchestrator via npm (backgrounded)"
$choice = Read-Host "Enter 1 or 2 (default 1)"
if ($choice -eq '') { $choice = '1' }

function Start-With-PM2() {
  if (-not (Get-Command pm2 -ErrorAction SilentlyContinue)) {
    Write-Warning 'pm2 not found on PATH'
    return $false
  }
  # Prefer compiled dist if present
  $distEntry = Join-Path (Get-Location) 'dist/worker/entry.js'
  if (Test-Path $distEntry) {
    Write-Host "Starting pm2 process from $distEntry"
    pm2 start $distEntry --name content-engine-worker --update-env | Out-Null
  } else {
    Write-Host 'Compiled worker not found; starting orchestrator via pm2 node entry (may use ts-node)' 
    pm2 start npm --name content-engine-worker -- start -- run orchestrator:start --update-env | Out-Null
  }
  Start-Sleep -Seconds 2
  pm2 list
  return $true
}

function Start-With-Npm() {
  # Start the orchestrator script in a new PowerShell background process so current shell remains interactive
  $cmd = 'npm run orchestrator:start'
  Write-Host "Starting: $cmd (background)"
  $proc = Start-Process -FilePath 'powershell' -ArgumentList "-NoProfile -NoExit -Command \"$cmd\"" -PassThru
  Write-Host "Started background process Id=$($proc.Id)"
  return $true
}

$started = $false
if ($choice -eq '1') { $started = Start-With-PM2() }
if (-not $started -and $choice -eq '1') {
  Write-Warning 'Falling back to npm start method'
  $started = Start-With-Npm()
}
if ($choice -eq '2') { $started = Start-With-Npm() }

if (-not $started) { Abort 'Failed to start worker process' }

Write-Host "Worker started. Tail logs or run requeue commands as needed." -ForegroundColor Green
Write-Host "Manual commands you can run in another shell:"
Write-Host "  # Tail pm2 logs (if using pm2)"
Write-Host "  pm2 logs content-engine-worker --lines 200"
Write-Host "  # Requeue pending execution jobs (be cautious)"
Write-Host "  node scripts/requeue-pending.js --limit 10"
Write-Host "  # Run smoke runner that validates requeue behavior"
Write-Host "  node scripts/ci/run-requeue-smoke.js"
Write-Host "  # To allow hydrations to actually run (writes), unset HYDRATION_PAUSED in this shell or pm2 env"
Write-Host "  # (in this shell): Remove-Item Env:HYDRATION_PAUSED"

Write-Host "When finished, cleanup:"
Write-Host "  pm2 stop content-engine-worker && pm2 delete content-engine-worker  # if pm2 used"
Write-Host "  # or stop background PowerShell process by id"

Write-Host "Press Enter to keep this shell open, or type CLEAN to stop and cleanup and exit." -ForegroundColor Yellow
$final = Read-Host
if ($final -eq 'CLEAN') {
  Write-Host 'Cleaning up...'
  if (Get-Command pm2 -ErrorAction SilentlyContinue) {
    pm2 stop content-engine-worker || true
    pm2 delete content-engine-worker || true
  }
  Write-Host 'Unsetting sensitive envs from session'
  Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
  Remove-Item Env:REDIS_URL -ErrorAction SilentlyContinue
  Remove-Item Env:HYDRATION_PAUSED -ErrorAction SilentlyContinue
  Write-Host 'Done. Exiting.'
} else {
  Write-Host 'Session left running. Remember to cleanup when finished.' -ForegroundColor Cyan
}
