param(
  [string]$DatabaseUrl = 'postgresql://postgres:asdf1234@localhost:5432/spinzy_dev',
  [string]$RedisUrl = 'redis://127.0.0.1:6379'
)

# Set environment
$env:DATABASE_URL = $DatabaseUrl
$env:REDIS_URL = $RedisUrl

Write-Host "[run-migrate-and-tests] DATABASE_URL=$env:DATABASE_URL"
Write-Host "[run-migrate-and-tests] REDIS_URL=$env:REDIS_URL"

# Run prisma generate via robust wrapper
Write-Host "[run-migrate-and-tests] Running prisma generate (wrapper)"
node scripts/prisma-generate-with-retry.cjs
if ($LASTEXITCODE -ne 0) {
  Write-Error "prisma generate failed with exit code $LASTEXITCODE"
  exit $LASTEXITCODE
}

# Apply migrations non-interactively
Write-Host "[run-migrate-and-tests] Applying migrations (prisma migrate deploy)"
node ./node_modules/prisma/build/index.js migrate deploy
if ($LASTEXITCODE -ne 0) {
  Write-Error "prisma migrate deploy failed with exit code $LASTEXITCODE"
  exit $LASTEXITCODE
}

Write-Host "[run-migrate-and-tests] Migrations applied successfully"

# Run tests
Write-Host "[run-migrate-and-tests] Running test suite (npm test)"
# Use npm test so package.json pretest runs (prisma generate wrapper)
npm test --silent

exit $LASTEXITCODE
