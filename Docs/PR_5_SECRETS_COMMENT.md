Secrets required by the Alert Evaluator CI / staging deployment

Add these repository secrets in: Settings → Secrets and variables → Actions

Exact secret names (copy-paste):
- STAGING_PUSHGATEWAY_URL
- PUSHGATEWAY_URL
- REDIS_URL
- DATABASE_URL
- OPS_EMAIL
- SLACK_WEBHOOK (optional — you said you don't use Slack)
- PAGER_WEBHOOK (optional)

Minimal recommended to enable real alerts (email-only):
- DATABASE_URL = <postgresql://USER:PASSWORD@HOST:5432/ai_tutor?sslmode=require>
- OPS_EMAIL = ops@your-domain.com

Optional (enable Prometheus Pushgateway integration / Redis-backed rate-limiter):
- PUSHGATEWAY_URL = <https://pushgateway.staging.example.org:9091>
- REDIS_URL = <redis://:PASSWORD@redis.example.org:6379/0>

Set secrets via GitHub UI or CLI. Example using `gh` (run locally; replace <> values):

gh secret set DATABASE_URL --body "<postgresql://USER:PASSWORD@HOST:5432/ai_tutor?sslmode=require>"
gh secret set OPS_EMAIL --body "ops@your-domain.com"
# Optional
gh secret set PUSHGATEWAY_URL --body "<https://pushgateway.staging.example.org:9091>"
gh secret set REDIS_URL --body "<redis://:PASSWORD@redis.example.org:6379/0>"

Notes and guidance
- You do NOT need Slack. If you do not provide `SLACK_WEBHOOK`, skip it — the evaluator will use `OPS_EMAIL` for notifications when set.
- For PR dry-run CI the workflow provides an ephemeral Postgres service; setting `DATABASE_URL` enables integration tests against your staging DB.
- Do NOT paste real secrets into PR comments or public chat; run the `gh secret set` commands locally or add via GitHub UI.

If you'd like, I can also copy this as a comment on PR #5 for reviewers. Proceed?