param(
  [string]$PostgresImage = 'ankane/pgvector:latest',
  [string]$ContainerName = 'doubtkb-perf-db',
  [string]$DBUser = 'perf',
  [string]$DBPass = 'perfpass',
  [string]$DBName = 'perfdb',
  [int]$HostPort = 55432
)

Write-Host "Starting temporary Postgres (pgvector) container: $ContainerName" -ForegroundColor Cyan
docker run --name $ContainerName -e POSTGRES_USER=$DBUser -e POSTGRES_PASSWORD=$DBPass -e POSTGRES_DB=$DBName -p $HostPort:5432 -d $PostgresImage | Out-Null

Write-Host 'Waiting for Postgres to become ready...' -ForegroundColor Cyan
for ($i = 0; $i -lt 60; $i++) {
  try {
    $out = docker exec $ContainerName pg_isready -U $DBUser -d $DBName 2>$null
    if ($LASTEXITCODE -eq 0) { break }
  } catch {}
  Start-Sleep -Seconds 1
}

$env:DATABASE_URL = "postgresql://$DBUser:$DBPass@127.0.0.1:$HostPort/$DBName"
Write-Host "DATABASE_URL set to $env:DATABASE_URL" -ForegroundColor Green

Write-Host 'Generating Prisma client...' -ForegroundColor Cyan
npx prisma generate

Write-Host 'Applying migrations (deploy)...' -ForegroundColor Cyan
npx prisma migrate deploy

Write-Host 'Running DoubtKb perf benchmark...' -ForegroundColor Cyan
npm run perf:doubtkb

Write-Host 'Benchmark finished — cleaning up container' -ForegroundColor Cyan
docker rm -f $ContainerName | Out-Null
Write-Host 'Cleanup done.' -ForegroundColor Green
