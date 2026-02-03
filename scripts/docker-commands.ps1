# =============================================================================
# AI Tutor - Docker Commands Reference (PowerShell)
# =============================================================================
#
# USAGE:
#   Open PowerShell, cd to project root, then run individual sections:
#     .\scripts\docker-commands.ps1              # Show help
#     .\scripts\docker-commands.ps1 rebuild      # Rebuild & restart all
#     .\scripts\docker-commands.ps1 migrate      # Run prisma migration
#     .\scripts\docker-commands.ps1 status       # Show container status
#
# =============================================================================

# ---------------------------------------------------------------------------
# Environment Variables (local Docker)
# ---------------------------------------------------------------------------
# Inside containers, services connect via Docker network hostnames:
#   DATABASE_URL = postgresql://postgres:pass@postgres:5432/ai_dev
#   REDIS_URL    = redis://redis:6379
#
# From the HOST machine (your laptop), connect via localhost:
#   DATABASE_URL = postgresql://postgres:pass@localhost:5432/ai_dev
#   REDIS_URL    = redis://localhost:6379
# ---------------------------------------------------------------------------

$env:DATABASE_URL = "postgresql://postgres:pass@localhost:5432/ai_dev"
$env:REDIS_URL    = "redis://localhost:6379"

$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $ProjectRoot

function Show-Help {
    Write-Host ""
    Write-Host "=== AI Tutor Docker Commands ===" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  status       - Show running containers"
    Write-Host "  logs [svc]   - Tail logs (web, worker, scheduler, postgres, redis)"
    Write-Host "  migrate      - Create + apply Prisma migration"
    Write-Host "  migrate-only - Create migration file only (no apply)"
    Write-Host "  rebuild      - Rebuild and restart app containers (keeps DB/Redis)"
    Write-Host "  rebuild-all  - Rebuild everything including DB and Redis"
    Write-Host "  up           - Start all containers"
    Write-Host "  down         - Stop all containers"
    Write-Host "  nuke         - Stop all, remove volumes (DELETES DATA)"
    Write-Host "  shell [svc]  - Open shell in container (default: web)"
    Write-Host "  db           - Open psql in postgres container"
    Write-Host "  studio       - Open Prisma Studio (browser)"
    Write-Host "  prune        - Remove dangling Docker images"
    Write-Host ""
}

function Show-Status {
    Write-Host "`n=== Container Status ===" -ForegroundColor Cyan
    docker-compose ps
    Write-Host "`n=== Docker Images ===" -ForegroundColor Cyan
    docker images | Select-String "ai-tutor"
}

function Show-Logs {
    param([string]$Service = "web")
    docker-compose logs -f --tail=100 $Service
}

function Run-Migrate {
    Write-Host "`n=== Creating Prisma Migration ===" -ForegroundColor Yellow
    Write-Host "DATABASE_URL = $env:DATABASE_URL"
    npx prisma migrate dev --name $args[0]
}

function Run-MigrateOnly {
    Write-Host "`n=== Creating Migration File (no apply) ===" -ForegroundColor Yellow
    Write-Host "DATABASE_URL = $env:DATABASE_URL"
    npx prisma migrate dev --create-only --name $args[0]
}

function Run-Rebuild {
    Write-Host "`n=== Rebuilding App Containers ===" -ForegroundColor Yellow
    Write-Host "Step 1/4: Stopping app containers..."
    docker-compose stop web worker scheduler

    Write-Host "Step 2/4: Rebuilding images (no cache)..."
    docker-compose build --no-cache web worker scheduler

    Write-Host "Step 3/4: Starting containers..."
    docker-compose up -d web worker scheduler

    Write-Host "Step 4/4: Waiting for health checks..."
    Start-Sleep -Seconds 10
    docker-compose ps
    Write-Host "`nDone! Web available at http://localhost:3000" -ForegroundColor Green
}

function Run-RebuildAll {
    Write-Host "`n=== Full Rebuild (all services) ===" -ForegroundColor Red
    docker-compose down
    docker-compose build --no-cache
    docker-compose up -d
    Write-Host "`nAll services restarted." -ForegroundColor Green
}

function Start-Services {
    docker-compose up -d
    docker-compose ps
}

function Stop-Services {
    docker-compose down
}

function Nuke-All {
    Write-Host "WARNING: This will delete all data (postgres, redis)!" -ForegroundColor Red
    $confirm = Read-Host "Type 'yes' to confirm"
    if ($confirm -eq "yes") {
        docker-compose down -v
        Write-Host "All containers and volumes removed." -ForegroundColor Yellow
    } else {
        Write-Host "Cancelled."
    }
}

function Open-Shell {
    param([string]$Service = "web")
    docker-compose exec $Service sh
}

function Open-DB {
    docker-compose exec postgres psql -U postgres -d ai_dev
}

function Open-Studio {
    Write-Host "Opening Prisma Studio at http://localhost:5555" -ForegroundColor Cyan
    npx prisma studio
}

function Run-Prune {
    docker image prune -f
    docker builder prune -f
}

# ---------------------------------------------------------------------------
# Main dispatcher
# ---------------------------------------------------------------------------
$Command = if ($args.Count -gt 0) { $args[0] } else { "help" }

switch ($Command) {
    "status"       { Show-Status }
    "logs"         { Show-Logs ($args | Select-Object -Skip 1) }
    "migrate"      { Run-Migrate ($args | Select-Object -Skip 1) }
    "migrate-only" { Run-MigrateOnly ($args | Select-Object -Skip 1) }
    "rebuild"      { Run-Rebuild }
    "rebuild-all"  { Run-RebuildAll }
    "up"           { Start-Services }
    "down"         { Stop-Services }
    "nuke"         { Nuke-All }
    "shell"        { Open-Shell ($args | Select-Object -Skip 1) }
    "db"           { Open-DB }
    "studio"       { Open-Studio }
    "prune"        { Run-Prune }
    default        { Show-Help }
}
