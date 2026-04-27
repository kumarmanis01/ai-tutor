# S3 setup files for ai-tutor

This folder contains ready-to-use JSON files and a helper script to configure an S3 bucket for presigned PUT uploads used by the app.

Files:

- `s3-cors.json` — CORS config allowing `PUT/POST/GET` from `http://localhost:3000` and `127.0.0.1:3000`.
- `s3-lifecycle.json` — lifecycle rule to expire objects under `uploads/` after 1 day.
- `policy.json` — IAM policy template for a presign user (replace `<BUCKET>` with your bucket name before creating policy).
- `setup-s3.ps1` — PowerShell helper script to run the AWS CLI commands (interactive, requires AWS CLI v2 configured).

Important: I cannot run AWS CLI commands or create AWS resources from here. Run the commands below locally using `aws configure` with credentials that have permission to create buckets and IAM resources.

Quick commands (PowerShell / cmd examples):

1) Create bucket (example):

```powershell
aws s3api create-bucket --bucket <BUCKET> --region <REGION> --create-bucket-configuration LocationConstraint=<REGION>
```

2) Apply CORS:

```powershell
aws s3api put-bucket-cors --bucket <BUCKET> --cors-configuration file://infra/s3/s3-cors.json
```

3) Apply lifecycle:

```powershell
aws s3api put-bucket-lifecycle-configuration --bucket <BUCKET> --lifecycle-configuration file://infra/s3/s3-lifecycle.json
```

4) Create IAM policy (replace bucket placeholder in `infra/s3/policy.json` first):

```powershell
aws iam create-policy --policy-name ai-tutor-s3-presign-policy --policy-document file://infra/s3/policy.json
```

See `setup-s3.ps1` for an interactive script.

Secrets stored:
- `ai-tutor/presign-user` in AWS Secrets Manager (region `eu-north-1`) contains the presign IAM user's access key JSON. Do NOT commit secrets to the repo; the file `infra/s3/newkey.json` was removed after storing the secret.

Production notes:
- Bucket encryption (SSE-S3) has been enabled for the uploads bucket.
- Public access has been blocked for the uploads bucket.
- Server access logging has been enabled (target bucket: `ai-tutor-logs-spinzyacademy-01`).
