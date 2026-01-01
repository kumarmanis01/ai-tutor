<#
Interactive script to set evaluator secrets in GitHub Actions (and optionally Vercel).
Usage: run in repo root in PowerShell:
  powershell -ExecutionPolicy Bypass -File .\scripts\set-evaluator-secrets.ps1

It will prompt for each secret, explain where to get it, and call `gh secret set`.
If you use Vercel, the script will print `vercel` commands to run (it will not run them automatically).
#>

function Set-SecretIfProvided($name, $value) {
    if ([string]::IsNullOrWhiteSpace($value)) {
        Write-Host "Skipping $name (no value provided)" -ForegroundColor Yellow
        return
    }
    try {
        gh secret set $name --body $value | Out-Null
        gh secret set $name --body $value | Out-Null
        Write-Host ("Set GitHub Actions secret: {0}" -f $name) -ForegroundColor Green
        Write-Host "Failed to set GitHub secret $name: $_" -ForegroundColor Red
        Write-Host ("Failed to set GitHub secret {0}: {1}" -f $name, $_) -ForegroundColor Red
}

Write-Host "This script will help you add the evaluator secrets to GitHub Actions." -ForegroundColor Cyan
Write-Host "If you use Vercel, you'll also get suggested `vercel env` commands to run locally or in Vercel UI." -ForegroundColor Cyan

# Helper to prompt with explanation
function Prompt-ForSecret($key, $explain, $example) {
    Write-Host "`n$key" -ForegroundColor White
    Write-Host "  $explain" -ForegroundColor DarkGray
    if ($example) { Write-Host "  Example: $example" -ForegroundColor DarkGray }
    $val = Read-Host "Enter value for $key (or press Enter to skip)"
    return $val
}

# 1) STAGING_PUSHGATEWAY_URL
$stagingPush = Prompt-ForSecret `
    "STAGING_PUSHGATEWAY_URL" `
    "Pushgateway endpoint for staging where the evaluator will push runtime metrics. If you don't run Pushgateway, skip this." `
    "http://<HOST_OR_IP>:9091"
Set-SecretIfProvided -name 'STAGING_PUSHGATEWAY_URL' -value $stagingPush

# 2) PUSHGATEWAY_URL (production)
$pushProd = Prompt-ForSecret `
    "PUSHGATEWAY_URL" `
    "Production Pushgateway endpoint (optional). If not ready, leave blank and set later." `
    "https://pushgateway.example.org:9091"
Set-SecretIfProvided -name 'PUSHGATEWAY_URL' -value $pushProd

# 3) REDIS_URL
$redis = Prompt-ForSecret `
    "REDIS_URL" `
    "Redis connection string for rate-limiter/deduper. Use a managed Redis provider or your VM/cluster private IP. For no auth use redis://<HOST>:6379/0" `
    "redis://:PASSWORD@redis.example.org:6379/0"
Set-SecretIfProvided -name 'REDIS_URL' -value $redis

# 4) DATABASE_URL
$db = Prompt-ForSecret `
    "DATABASE_URL" `
    "Postgres connection string used by Prisma/evaluator. For staging you can use a managed DB connection string. For PR dry-run the CI provides an ephemeral Postgres; setting this enables integration tests against your staging DB." `
    "postgresql://USER:PASSWORD@db.example.org:5432/ai_tutor?sslmode=require"
Set-SecretIfProvided -name 'DATABASE_URL' -value $db

# 5) OPS_EMAIL
$ops = Prompt-ForSecret `
    "OPS_EMAIL" `
    "Operations on-call email used by the evaluator Email sink. Provide a monitored mailbox (e.g., ops@your-domain.com)." `
    "ops@your-domain.com"
Set-SecretIfProvided -name 'OPS_EMAIL' -value $ops

# 6) SLACK_WEBHOOK (optional)
$slack = Prompt-ForSecret `
    "SLACK_WEBHOOK" `
    "Incoming Slack webhook URL (optional). If you don't use Slack, skip this." `
    "https://hooks.slack.com/services/T00000/B00000/XXXXXXXXXXXXXXXX"
Set-SecretIfProvided -name 'SLACK_WEBHOOK' -value $slack

# 7) PAGER_WEBHOOK (optional)
$pager = Prompt-ForSecret `
    "PAGER_WEBHOOK" `
    "Webhook URL for pager/incidents (optional). If using PagerDuty/opsgenie, provide their inbound webhook URL." `
    "https://hooks.pager.example.org/services/XXXXXXXX"
Set-SecretIfProvided -name 'PAGER_WEBHOOK' -value $pager

Write-Host "`nAll provided secrets attempted to be set in GitHub Actions." -ForegroundColor Green

# Vercel guidance
Write-Host "`nIf you deploy to Vercel, you should also add these environment variables there for runtime (Vercel UI or CLI)." -ForegroundColor Cyan
Write-Host "Suggested Vercel CLI commands (run locally after `vercel login`):" -ForegroundColor White
if (-not [string]::IsNullOrWhiteSpace($stagingPush)) { Write-Host "vercel env add STAGING_PUSHGATEWAY_URL production --value '$stagingPush'" }
if (-not [string]::IsNullOrWhiteSpace($pushProd)) { Write-Host "vercel env add PUSHGATEWAY_URL production --value '$pushProd'" }
if (-not [string]::IsNullOrWhiteSpace($redis)) { Write-Host "vercel env add REDIS_URL production --value '$redis'" }
if (-not [string]::IsNullOrWhiteSpace($db)) { Write-Host "vercel env add DATABASE_URL production --value '$db'" }
if (-not [string]::IsNullOrWhiteSpace($ops)) { Write-Host "vercel env add OPS_EMAIL production --value '$ops'" }
if (-not [string]::IsNullOrWhiteSpace($slack)) { Write-Host "vercel env add SLACK_WEBHOOK production --value '$slack'" }
if (-not [string]::IsNullOrWhiteSpace($pager)) { Write-Host "vercel env add PAGER_WEBHOOK production --value '$pager'" }

Write-Host "`nNotes:" -ForegroundColor Yellow
Write-Host "- GitHub Actions secrets are used by CI workflows; Vercel env vars are used at runtime in your deployed app." -ForegroundColor DarkGray
Write-Host "- Pushgateway must be reachable from where the evaluator runs (GitHub Actions or your staging cluster). If it's on a private network, either expose it to Actions or use a self-hosted runner." -ForegroundColor DarkGray
Write-Host "- For quick staging, you can run Pushgateway + Redis on a small VM using Docker Compose." -ForegroundColor DarkGray

Write-Host "`nScript complete." -ForegroundColor Green

# End of script
