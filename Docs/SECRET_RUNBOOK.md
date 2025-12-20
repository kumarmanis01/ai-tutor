# Secrets Runbook — Alert Evaluator

Required repository secrets (GitHub Actions):

- `GITHUB_TOKEN` (provided by GitHub) — used for GHCR pushes.
- `STAGING_PUSHGATEWAY_URL` — staging Pushgateway endpoint (optional). Used by `ci-push-metrics.yml`.
- `PUSHGATEWAY_URL` — production Pushgateway endpoint (optional).
- `REDIS_URL` — Redis instance for rate-limiter/deduper (optional; recommended for production).
- `DATABASE_URL` — Postgres connection string for staging/production (optional for PR CI; recommended for staging).
- `OPS_EMAIL` — operations email for alert notifications (optional).
- `SLACK_WEBHOOK` — Slack webhook URL for notifications (optional).
- `PAGER_WEBHOOK` — Pager/incident webhook (optional).

Provisioning tips:
- For GHCR pushes, `GITHUB_TOKEN` is sufficient when pushing from the same org; enable `packages: write` permission in workflow if required.
- For Pushgateway, run a single instance in staging (k8s or VM) and secure it behind network rules. Provide `STAGING_PUSHGATEWAY_URL` as `https://pushgateway.example.org:9091`.
- For Redis, prefer managed Redis (Elasticache, Memorystore) and restrict access via VPC/peering.
- Store `DATABASE_URL` in a k8s Secret for the Helm chart and reference it in `values.yaml`.

Applying secrets in GitHub:
1. Go to repository Settings → Secrets and variables → Actions → New repository secret.
2. Add `STAGING_PUSHGATEWAY_URL`, `REDIS_URL`, etc.

Security:
- Limit who can update secrets in the repo; use org-level secret policies where available.
- Rotate `PUSHGATEWAY_URL` credentials and Redis credentials periodically.

Runbook snippet (to test):
```bash
# Example: set staging pushgateway secret locally (not in repo)
# In GitHub UI: add STAGING_PUSHGATEWAY_URL=https://pushgateway.staging.example

# Locally test with env override
STAGING_PUSHGATEWAY_URL="https://pushgateway.staging.example" \
DATABASE_URL="postgres://user:pass@host:5432/db" \
RUN_ONCE=1 EVALUATOR_DRY_RUN=1 node build/runAlertEvaluator.js
```
