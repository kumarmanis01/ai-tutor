param(
    [Parameter(Mandatory = $true)] [string] $Repo,
    [Parameter(Mandatory = $false)] [string] $KubeconfigPath
)

function Read-DotEnv($paths) {
    $map = @{}
    foreach ($p in $paths) {
        if (Test-Path $p) {
            Get-Content $p | ForEach-Object {
                if ($_ -match '^[\s]*#') { return }
                if ($_ -match '^[A-Za-z_][A-Za-z0-9_]*=') {
                    $parts = $_ -split '=', 2
                    $k = $parts[0].Trim()
                    $v = $parts[1].Trim()
                    if ($v.StartsWith('"') -and $v.EndsWith('"')) { $v = $v.Trim('"') }
                    if ($v.StartsWith("'") -and $v.EndsWith("'")) { $v = $v.Trim("'") }
                    $map[$k] = $v
                }
            }
        }
    }
    return $map
}

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Error "gh CLI is required. Install from https://cli.github.com/"
    exit 1
}

function Get-EnvValByKeys($keys) {
    foreach ($f in @('.env.local', '.env')) {
        if (Test-Path $f) {
            foreach ($k in $keys) {
                $pattern = "^$k="
                $line = Select-String -Path $f -Pattern $pattern | Select-Object -First 1
                if ($line) {
                    $parts = $line -split '=',2
                    $v = $parts[1].Trim()
                    if ($v.StartsWith('"') -and $v.EndsWith('"')) { $v = $v.Trim('"') }
                    if ($v.StartsWith("'") -and $v.EndsWith("'")) { $v = $v.Trim("'") }
                    return $v
                }
            }
        }
    }
    return $null
}

$mapping = @{
    'DATABASE_URL' = @('DATABASE_URL')
    'REDIS_URL'     = @('REDIS_URL','UPSTASH_REDIS_REST_URL')
    'OPS_EMAIL'     = @('OPS_EMAIL','EMAIL_FROM','EMAIL_SERVER_USER')
    'SMTP_HOST'     = @('SMTP_HOST','EMAIL_SERVER_HOST')
    'SMTP_PORT'     = @('SMTP_PORT','EMAIL_SERVER_PORT')
    'SMTP_USER'     = @('SMTP_USER','EMAIL_SERVER_USER')
    'SMTP_PASS'     = @('SMTP_PASS','EMAIL_SERVER_PASSWORD')
    'SMTP_FROM'     = @('SMTP_FROM','EMAIL_FROM')
    'PUSHGATEWAY_URL' = @('PUSHGATEWAY_URL')
}

foreach ($s in $mapping.Keys) {
    $keys = $mapping[$s]
    $val = Get-EnvValByKeys $keys
    if ($val) {
        Write-Host "Setting secret $s (from $($keys -join ','))"
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($val)
        $base64 = [Convert]::ToBase64String($bytes)
        # Use piping to supply the secret value to gh
        $val | gh secret set $s -R $Repo -b -
    } else {
        Write-Host "Skipping $s (not found among: $($keys -join ', '))"
    }
}

if ($KubeconfigPath) {
    if (-not (Test-Path $KubeconfigPath)) { Write-Error "Kubeconfig path not found: $KubeconfigPath"; exit 1 }
    $b64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($KubeconfigPath))
    Write-Host "Setting KUBE_CONFIG_DATA"
    $p = Start-Process -FilePath gh -ArgumentList 'secret', 'set', 'KUBE_CONFIG_DATA', '-R', $Repo, '-b', '-' -NoNewWindow -PassThru -RedirectStandardInput 'PIPE' -Wait
    $p.StandardInput.Write($b64)
    $p.StandardInput.Close()
}

Write-Host 'Secrets set. Trigger the Deploy Evaluator to Staging workflow in Actions.'
