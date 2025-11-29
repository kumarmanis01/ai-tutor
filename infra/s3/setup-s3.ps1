<#
Interactive helper to apply S3 infra using AWS CLI.
Run in PowerShell after `aws configure` is done locally.

It will:
- create the bucket (if it doesn't exist)
- apply CORS and lifecycle configs
#>

param(
    [Parameter(Mandatory = $true)] [string] $Bucket,
    [Parameter(Mandatory = $true)] [string] $Region
)

Write-Host "S3 setup helper - bucket: $Bucket region: $Region"

function Confirm-Run($msg) {
    $resp = Read-Host "$msg (y/n)"
    return $resp -match '^[yY]'
}

if (Confirm-Run "Create bucket $Bucket in $Region if it does not exist?") {
    if ($Region -eq 'us-east-1') {
        aws s3api create-bucket --bucket $Bucket --region $Region
    }
    else {
        aws s3api create-bucket --bucket $Bucket --region $Region --create-bucket-configuration LocationConstraint=$Region
    }
}

if (Confirm-Run "Apply CORS from infra/s3/s3-cors.json?") {
    aws s3api put-bucket-cors --bucket $Bucket --cors-configuration file://infra/s3/s3-cors.json
}

if (Confirm-Run "Apply lifecycle from infra/s3/s3-lifecycle.json?") {
    aws s3api put-bucket-lifecycle-configuration --bucket $Bucket --lifecycle-configuration file://infra/s3/s3-lifecycle.json
}

Write-Host "Next: edit infra/s3/policy.json to replace <BUCKET> with $Bucket, then run:"
Write-Host "  aws iam create-policy --policy-name ai-tutor-s3-presign-policy --policy-document file://infra/s3/policy.json"

Write-Host "If you want, create an IAM user for presigning and attach the policy. Keep keys safe and add them to .env.local"
