$root = Get-Location
$envFile = Join-Path $root '.env'
if (Test-Path $envFile) {
  Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*([^#=]+)=(.*)$') {
      $name = $matches[1]
      $val = $matches[2].Trim()
      if (($val.StartsWith('"') -and $val.EndsWith('"')) -or ($val.StartsWith("'") -and $val.EndsWith("'"))) { $val = $val.Substring(1,$val.Length-2) }
      Set-Item -Path Env:\$name -Value $val
    }
  }
  Write-Host "Loaded .env into process env"
} else {
  Write-Host ".env not found"
}
# Start dev server
npm run dev
