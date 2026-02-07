<#
FILE OBJECTIVE:
 - Reset a local development database by backing up existing Prisma migrations and creating a fresh base migration from the current `prisma/schema.prisma` file.

LINKED UNIT TEST:
 - tests/unit/scripts/reset-and-create-base-migration.spec.ts

COPILOT INSTRUCTIONS FOLLOWED:
 - /docs/COPILOT_GUARDRAILS.md
 - .github/copilot-instructions.md

EDIT LOG:
 - 2026-01-30T00:00:00Z | github-copilot | added file header required by pre-commit hooks

SYNOPSIS
Reset local dev DB, backup existing Prisma migrations, and create a fresh base migration from the current schema.

USAGE
# Ensure `DATABASE_URL` points to a local dev DB (NOT production) before running.
Set-Item -Path Env:DATABASE_URL -Value "postgresql://user:pass@localhost:5432/dbname"
.\scripts\reset-and-create-base-migration.ps1

NOTES
- This script will MOVE the existing `prisma/migrations/` folder to a timestamped backup.
- It will then run `npx prisma migrate dev --name init` to create a new base migration and apply it.
- DO NOT run this against production. This script checks the host portion of DATABASE_URL and prompts confirmation.
#>

param()

function Abort([string]$msg) {
    Write-Host "ABORT: $msg" -ForegroundColor Red
    exit 1
}

# Basic env check
if (-not $env:DATABASE_URL) {
    Abort "DATABASE_URL is not set. Set it to a non-production database and re-run."
}

$databaseUrl = $env:DATABASE_URL
Write-Host "Detected DATABASE_URL: $databaseUrl"

# Simple safety check: warn if host looks like a production host (you can extend this rule)
if ($databaseUrl -match "@.*(prod|production|neon|rds|aws|digitalocean|heroku|neontech)\\b") {
    Write-Host "WARNING: DATABASE_URL contains potential production host keywords." -ForegroundColor Yellow
    $ok = Read-Host "Are you ABSOLUTELY sure you want to proceed? Type 'YES' to continue"
    if ($ok -ne 'YES') { Abort "User declined to proceed" }
}

# Confirm destructive intent
$confirm = Read-Host "This will backup existing migrations and reset the TARGET DB schema. Type 'RESET' to continue"
if ($confirm -ne 'RESET') { Abort "User did not confirm RESET" }

# Backup existing migrations
$timestamp = Get-Date -Format yyyyMMdd_HHmmss
$migrationsDir = Join-Path -Path (Get-Location) -ChildPath "prisma\migrations"
if (Test-Path $migrationsDir) {
    $backupDir = Join-Path -Path (Split-Path $migrationsDir -Parent) -ChildPath ("migrations_backup_$timestamp")
    Write-Host "Moving existing migrations to: $backupDir"
    Move-Item -Path $migrationsDir -Destination $backupDir -Force
}
else {
    Write-Host "No existing migrations folder found; nothing to backup."
}

# Reset DB: Use prisma migrate dev which will create a new migration from schema
Write-Host "Running: npx prisma migrate dev --name init"
$exit = & npm --silent run prisma -- migrate dev --name init
if ($LASTEXITCODE -ne 0) {
    Write-Host "prisma migrate dev failed with exit code $LASTEXITCODE" -ForegroundColor Red
    Write-Host "Check the output above for errors. You can restore the original migrations from the backup folder." -ForegroundColor Yellow
    exit $LASTEXITCODE
}

# Generate Prisma client
Write-Host "Running: npx prisma generate"
$exit2 = & npm --silent --no-warnings run prisma -- generate
if ($LASTEXITCODE -ne 0) {
    Write-Host "prisma generate failed with exit code $LASTEXITCODE" -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host "Success: Created new base migration and generated Prisma client." -ForegroundColor Green
Write-Host "Backed up old migrations (if any) to: $backupDir" -ForegroundColor Cyan
Write-Host "NOTE: run your local test suite now: npm run test (or npm test)" -ForegroundColor Cyan

exit 0
