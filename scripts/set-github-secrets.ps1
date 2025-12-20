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

function Get-EnvVal($key) {
    foreach ($f in @('.env.local', '.env')) {
        if (Test-Path $f) {
            $line = Select-String -Path $f -Pattern "^$key=" -SimpleMatch -Quiet:$false -AllMatches | Select-Object -First 1
            if ($line) {
                $parts = $line -split '=', 2
                $v = $parts[1].Trim()
                if ($v.StartsWith('"') -and $v.EndsWith('"')) { $v = $v.Trim('"') }
                if ($v.StartsWith("'") -and $v.EndsWith("'")) { $v = $v.Trim("'") }
                return $v
            }
        }
    }
    return $null
}

$secrets = @('DATABASE_URL', 'REDIS_URL', 'OPS_EMAIL', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM', 'PUSHGATEWAY_URL')
foreach ($s in $secrets) {
    $val = Get-EnvVal $s
    if ($val) {
        Write-Host "Setting secret $s"
        $p = Start-Process -FilePath gh -ArgumentList 'secret', 'set', $s, '-R', $Repo, '-b', '-' -NoNewWindow -PassThru -RedirectStandardInput 'PIPE' -Wait
        $p.StandardInput.Write($val)
        $p.StandardInput.Close()
    }
    else {
        Write-Host "Skipping $s (not found)"
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
