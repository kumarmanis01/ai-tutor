Phase 5(E) — Evaluator: Metrics, Dry-run CI, Deploy

This PR collects Phase 5(E) work for the Alert Evaluator integration, observability and deployment.

Summary of changes:
- CI: `ci-evaluator-build-test.yml` — bundle + run dry-run integration on PRs, upload bundle artifact
- CI: `ci-push-metrics.yml` — run on successful build workflow to push metrics to staging Pushgateway when `STAGING_PUSHGATEWAY_URL` secret exists
- CI: `ci-evaluator-image.yml` — build bundle and publish Docker image to GHCR
- Dockerfile: `Dockerfile.evaluator` — runtime Dockerfile for evaluator bundle
- Helm: `deployment/helm/evaluator-chart/` — minimal chart with probes + metrics service
- Metrics: `app/api/metrics/route.ts` — optional Next.js metrics scrape endpoint
- Prometheus rules: `deployment/prometheus/alerter_rules.yml`
- Docs: `docs/DEV_COMMANDS.md`, `docs/SECRET_RUNBOOK.md`
- Added cross-platform `scripts/git-commit-wrapper.js` to avoid PowerShell `true` errors

Phase 5(E) checklist — done vs pending
- [x] Dry-run wiring: evaluator supports `EVALUATOR_DRY_RUN` + `RUN_ONCE`
- [x] Dry-run integration test (skips when no `DATABASE_URL`)
- [x] Bundle evaluator with `esbuild` and add CI bundling
- [x] Add metrics endpoint `/api/metrics`
- [x] Add Pushgateway helper and CI push workflow (conditional on secret)
- [x] Add Prometheus rules for evaluator
- [x] Add Docker image CI and runtime Dockerfile
- [x] Add Helm chart skeleton for k8s deployment
- [x] Add developer commands and secrets runbook

Pending (requires infra / repo ops):
- [ ] Add repo secrets: `STAGING_PUSHGATEWAY_URL`, `PUSHGATEWAY_URL`, `REDIS_URL`, `OPS_EMAIL`, `SLACK_WEBHOOK`, `PAGER_WEBHOOK` (and optional `DATABASE_URL` for staging)
- [ ] Provision staging Pushgateway and Redis (or provide endpoints)
- [ ] Add CI job to publish Docker image tag on merge to `master` and image promotion workflow
- [ ] Deploy Helm chart to a staging cluster and validate metrics scraping + alerts
- [ ] Add E2E job to test real sinks against staging infra

Staging run (non-dry-run)

To run the evaluator in staging (real sinks) without Pushgateway, add the following repository secrets first:

- `OPS_EMAIL` — recipient for operational alerts
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` — SMTP credentials for sending email
- `REDIS_URL` — Redis (Upstash or other) for rate-limiter/dedupe
- (optional) `DATABASE_URL` — if you want the evaluator to use an external DB instead of the CI Postgres service

Then manually dispatch the evaluator build/test workflow with `EVALUATOR_DRY_RUN=0` and `RUN_ONCE=1`:

```bash
# from your local clone
git fetch origin
# run against the branch containing the evaluator changes
gh workflow run ci-evaluator-build-test.yml --ref ci/evaluator-integration-scripts -f evaluator_dry_run=0 -f run_once=1

# view logs:
gh run list --workflow=ci-evaluator-build-test.yml
gh run view <run-id> --log
```

The workflow supports both `pull_request` runs (defaults to dry-run) and manual `workflow_dispatch` runs (use the inputs to override). If SMTP/OPS_EMAIL are missing the evaluator will log sink errors but will not spam recipients.

Notes:
- CI workflows default to an isolated Postgres service for PR validation; secrets enable staging integration.
- The approach favors build artifacts (bundle + container image) for reproducible deploys and avoids runtime ts-node/ESM loader fragility.

Merge checklist for reviewers:
- Confirm CI workflows run and pass on PR
- Confirm no secrets are leaked in changes
- Approve or request changes

