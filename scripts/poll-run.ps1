# Safe poll script for GitHub Actions run
# Usage: powershell -ExecutionPolicy Bypass -File .\scripts\poll-run.ps1

Start-Transcript -Path .\ci-poll-debug.txt -Force

try {
    Write-Host "Paste GitHub PAT when prompted (input will be hidden):"
    $pat = Read-Host -Prompt "Paste GitHub PAT" -AsSecureString
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($pat)
    $plainPat = [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    $env:GITHUB_TOKEN = $plainPat

    $headers = @{ 'User-Agent' = 'ci-checker'; Authorization = "token $env:GITHUB_TOKEN" }

    Write-Host "Validating token..."
    $user = Invoke-RestMethod -Uri https://api.github.com/user -Headers $headers
    Write-Host "Authenticated as: $($user.login)"

    $workflowId = 217001895
    $branch = 'ci/alert-evaluator-node20'

    Write-Host "Fetching latest run for branch $branch..."
    $r = Invoke-RestMethod -Uri "https://api.github.com/repos/kumarmanis01/ai-tutor/actions/workflows/$workflowId/runs?per_page=50" -Headers $headers
    $run = $r.workflow_runs | Where-Object { $_.head_branch -eq $branch } | Sort-Object created_at -Descending | Select-Object -First 1
    if (-not $run) { Write-Host "No run found for branch $branch"; exit 1 }
    Write-Host "Run: $($run.id) status=$($run.status) url=$($run.html_url)"

    $runId = $run.id
    for ($i = 0; $i -lt 300; $i++) {
        Start-Sleep -Seconds 6
        try {
            $status = Invoke-RestMethod -Uri "https://api.github.com/repos/kumarmanis01/ai-tutor/actions/runs/$runId" -Headers $headers
            Write-Host "Run $runId status=$($status.status) conclusion=$($status.conclusion) updated_at=$($status.updated_at)"
            if ($status.status -eq 'completed') { break }
        }
        catch {
            Write-Host "ERROR polling run: $($_.Exception.Message)" -ForegroundColor Yellow
        }
    }

    Write-Host "Downloading logs for run $runId"
    Invoke-RestMethod -Uri "https://api.github.com/repos/kumarmanis01/ai-tutor/actions/runs/$runId/logs" -Headers $headers -OutFile run-$runId-logs.zip
    Expand-Archive -Path run-$runId-logs.zip -DestinationPath .\run-$runId-logs -Force

    Write-Host "Showing Wait/Postgres debug logs (if present):"
    Get-ChildItem -Path .\run-$runId-logs -Recurse -File |
    Where-Object { $_.Name -match 'Debug Postgres connection' -or $_.Name -match 'Wait for Postgres' } |
    ForEach-Object {
        Write-Host "=== $($_.FullName) ==="
        Get-Content $_.FullName -Tail 400 | ForEach-Object { Write-Host $_ }
    }

}
catch {
    Write-Host "Fatal error: $($_.Exception.Message)" -ForegroundColor Red
    $_.Exception | Format-List -Force
}
finally {
    Stop-Transcript
}
