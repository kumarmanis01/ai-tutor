<#
Render all Mermaid diagrams in docs/diagrams to PNG using mermaid-cli.

Usage (from repo root):
  powershell .\docs\diagrams\render.ps1

Requires: Node + npx. The project includes `@mermaid-js/mermaid-cli` in devDependencies.
#>

Write-Host "Rendering Mermaid diagrams..."

$files = @(
  "submit-enqueue.mmd",
  "worker-claim-execute.mmd",
  "reconciler-aggregation.mmd"
)

foreach ($f in $files) {
  $input = Join-Path -Path (Join-Path $PSScriptRoot $f) -ChildPath ''
  $output = $f -replace '\.mmd$','.png'
  $outPath = Join-Path $PSScriptRoot $output
  Write-Host "Rendering $f -> $output"
  npx @mermaid-js/mermaid-cli -i (Join-Path $PSScriptRoot $f) -o $outPath
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to render $f (exit $LASTEXITCODE)" -ForegroundColor Red
    exit $LASTEXITCODE
  }
}

Write-Host "Done." -ForegroundColor Green
