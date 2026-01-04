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
