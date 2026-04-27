# Evaluator Staging Deploy

This document explains how to deploy the Alert Evaluator to the `staging` cluster and how the repository CI can create the required Kubernetes Secret.

Secrets required (set these as GitHub repo secrets for the workflow):

- `KUBE_CONFIG_DATA` (base64-encoded kubeconfig)
- `DATABASE_URL`
- `REDIS_URL`
- `OPS_EMAIL`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`
- `PUSHGATEWAY_URL` (optional)

Workflow included: `.github/workflows/deploy-evaluator-staging.yml`

How it works:

- The workflow decodes `KUBE_CONFIG_DATA` into a kubeconfig, creates/updates a Kubernetes Secret named `evaluator-secrets-staging` in namespace `staging` using the repo secrets, then runs `helm upgrade --install` with `deployment/helm/evaluator-chart/values-staging.yaml`.
- `values-staging.yaml` is written to prefer process env or the secret; the Helm chart template consumes the secret when `secrets.secretName` is set.

To run from your machine (if you prefer local apply):

```bash
# apply the manifest I added (stringData) as-is
kubectl apply -f deployment/helm/evaluator-chart/secrets/evaluator-secrets-staging.yaml

# then deploy Helm
helm upgrade --install evaluator deployment/helm/evaluator-chart -n staging -f deployment/helm/evaluator-chart/values-staging.yaml
```

Notes:
- Using the GitHub Actions workflow is recommended for reproducibility and automation. It avoids sharing kubeconfig locally.
- For GitOps safety, consider migrating to ExternalSecrets/SealedSecrets/Vault as a next step.

Automating secret creation from local env files
------------------------------------------------

If you want to avoid adding secrets via the GitHub UI, use the helper scripts to push secrets from your local `.env`/`.env.local` into GitHub repo secrets using the `gh` CLI:

- Bash: `scripts/set-github-secrets.sh --repo owner/repo --kubeconfig /path/to/kubeconfig`
- PowerShell: `scripts\set-github-secrets.ps1 -Repo owner/repo -KubeconfigPath C:\path\to\kubeconfig`

Requirements:
- `gh` CLI installed and authenticated with a user that has `repo` admin permissions.
- Your `.env` and `.env.local` present at the repo root with the required variables.

The script will:
- Read `.env` and `.env.local` (local wins) for the variable names listed in the "Secrets required" section.
- Set them as repository secrets in the specified repo.
- Base64-encode and set `KUBE_CONFIG_DATA` when `--kubeconfig` is provided so the deploy workflow can decode it.

After running the script, trigger the Actions workflow `Deploy Evaluator to Staging`.
