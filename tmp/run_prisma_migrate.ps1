Set-Location 'D:\projects\ai-tutor'
$env:DATABASE_URL = 'postgresql://postgres:pass@postgres:5432/ai_dev'
$env:REDIS_URL = 'redis://redis:6379'
Write-Output "DATABASE_URL=$env:DATABASE_URL"
Write-Output "REDIS_URL=$env:REDIS_URL"

Write-Output "--- prisma migrate status ---"
npx prisma migrate status --schema=prisma/schema.prisma
if ($LASTEXITCODE -ne 0) { Write-Error "migrate status failed with code $LASTEXITCODE"; exit $LASTEXITCODE }

Write-Output "--- prisma migrate deploy ---"
npx prisma migrate deploy --schema=prisma/schema.prisma
if ($LASTEXITCODE -ne 0) { Write-Error "migrate deploy failed with code $LASTEXITCODE"; exit $LASTEXITCODE }

Write-Output "--- prisma generate ---"
npx prisma generate
if ($LASTEXITCODE -ne 0) { Write-Error "prisma generate failed with code $LASTEXITCODE"; exit $LASTEXITCODE }

Write-Output "All Prisma steps completed."
