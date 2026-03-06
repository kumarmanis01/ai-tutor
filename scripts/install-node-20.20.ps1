# Installer script: downloads and runs Node.js 20.20.0 MSI, then updates npm to 10.8.2
$ErrorActionPreference = 'Stop'

$msi = Join-Path $env:TEMP 'node-v20.20.0-x64.msi'
Write-Output "Downloading $msi"
Invoke-WebRequest -Uri 'https://nodejs.org/dist/v20.20.0/node-v20.20.0-x64.msi' -OutFile $msi
Write-Output 'Starting installer (UAC prompt may appear)'
Start-Process msiexec -ArgumentList '/i', $msi, '/passive', '/norestart' -Verb RunAs -Wait
Write-Output 'Installer finished'

try {
  Write-Output 'Verifying installation...'
  $node = & node -v 2>$null
  $npm = & npm -v 2>$null
  Write-Output "node: $node"; Write-Output "npm: $npm"
} catch {
  Write-Output 'node/npm not immediately available in this shell. You may need to start a new terminal.'
}

Write-Output 'Attempting to upgrade npm to 10.8.2 (may require admin)'
try {
  & npm install -g npm@10.8.2 --no-audit --no-fund
  Write-Output "npm now: $(npm -v)"
} catch {
  Write-Output 'Failed to upgrade npm automatically. You can run: npm install -g npm@10.8.2'
}

Write-Output 'Done.'
