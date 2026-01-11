# Scripts Directory

This folder contains operational scripts used for development and production
maintenance tasks. The most important script for production verification is
`vps-verification.sh`.

## vps-verification.sh

Purpose: run a guided, line-by-line VPS verification checklist that ensures
environment variables, build artifacts, and PM2-managed processes are
configured correctly for production.

Location assumptions:
- The script lives at `scripts/vps-verification.sh`.
- The production environment file `.env.production` must live in the repository
  root (i.e., the parent directory of `scripts/`). The script locates
  `.env.production` relative to itself and will fail if it's missing.

Usage:

- Interactive (recommended):

```bash
cd /path/to/repo
bash scripts/vps-verification.sh
```

- Non-interactive (skip destructive confirmations):

```bash
bash scripts/vps-verification.sh --yes
```

What the script prints:
- Before each command the script prints `---- COMMAND STARTING ----` and the
  command to be executed.
- After the command it prints either `---- COMMAND COMPLETED (exit 0) ----`
  or `---- COMMAND ERROR (exit N) ----` along with the command output.

Important notes:
- The script may perform destructive actions (stop/delete PM2 processes,
  remove `dist`/`node_modules`) when confirmed. Do not run `--yes` on a
  machine you do not intend to modify.
- Ensure `.env.production` contains the required keys: `NODE_ENV`,
  `DATABASE_URL`, and `REDIS_URL`.
- The script expects `pm2` and `node` to be installed on the VPS.

Recommended workflow on a production VPS:
1. Pull latest changes to the branch you trust.
2. Place `.env.production` in the repo root with production values.
3. Run the script interactively and follow the prompts.
# VPS Deploy Scripts

Short notes for the `scripts/` deploy helpers.

- `vps_production_deploy.sh`: non-interactive production deploy. Creates timestamped logs under `tmp/deploy_logs/`. Usage:

  ./scripts/vps_production_deploy.sh /home/gnosiva/apps/content-engine/ai-tutor origin/master /home/gnosiva/apps/content-engine/ai-tutor/.env.production

- `vps_staging_run.sh`: interactive staging dry-run. By default this script looks for `.env.staging` in the repo root (override with the 2nd arg). Creates logs under `tmp/staging_logs/`.

Skipping pre-commit hooks when committing these files:

- To temporarily skip Husky hooks, set `SKIP_HOOKS=1` or use `--no-verify` with `git commit`.

Example (commit without running hooks):

  SKIP_HOOKS=1 git add scripts/* && git commit -m "chore(scripts): add deploy scripts" && git push

Permissions:

- Ensure these scripts are executable on the server: `chmod +x scripts/*.sh`.

Security:

- Do not add production secrets to the repository. Keep `.env.production` on the VPS and protect it with strict filesystem permissions (chmod 600).
