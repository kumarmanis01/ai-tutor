<!--
FILE OBJECTIVE:
- Record the authoritative Production Kill List and tasks to harden the dist verifier.

LINKED UNIT TEST:
- tests/unit/docs/production_kill_list.spec.ts

COPILOT INSTRUCTIONS FOLLOWED:
- .github/copilot-instructions.md
- docs/COPILOT_GUARDRAILS.md

EDIT LOG:
- 2026-01-07T20:50:00Z | copilot-agent | created TODO file and committed build hardening edits
-->

# PRODUCTION KILL LIST (Action TODO)

This file records the authoritative kill list for production workers and actionable TODOs
to ensure `dist/` never contains forbidden artifacts.

Scope (Non-Negotiable)
- Production workers may ONLY live under: `worker/**`

Forbidden directories (must never appear in `dist`)
- /workers
- /scripts
- /queues
- /deployment
- /deploy
- /infra
- /helm
- /tmp
- /.github
- /.husky
- /prisma
- /hooks
- /hydrators
- /prompts
- /producers
- /regeneration
- /backup*

Forbidden packages (must not appear in compiled JS)
- dotenv
- ts-node
- tsconfig-paths
- nodemon
- concurrently
- cross-env
- eslint*
- jest*
- @types/*

Forbidden import patterns in `app/worker/**`
- `import 'dotenv'` or `import 'dotenv/config'`
- `import 'ts-node/register'`
- `import 'tsconfig-paths/register'`
- `import from 'worker/*'`, `import from 'workers/*'`, `import from 'scripts/*'`, `import from 'queues/*'`

Forbidden file types in `dist`
- *.ts, *.tsx
- *.map
- *.md
- *.sql
- *.yaml, *.yml
- *.env*
- *.tsbuildinfo

Forbidden side-effects at import time
- Connecting to Redis/DB
- Starting timers or workers
- Reading env without validation

Allowed exceptions
- `lib/redis.ts` (must not connect on import)
- `lib/logger.ts` (pure)
- `lib/jobs/*` (called by worker)

CI / Verify tasks (TODO list)
1. Harden `scripts/verify-dist.cjs` to check:
   - Forbidden directory paths under `dist/`
   - Forbidden file extensions in `dist/`
   - Extended forbidden package tokens (see list above)
   - Forbidden import patterns via simple regex scan
2. Add a CI workflow that runs `npm run build` and fails on verifier exit != 0
3. Document the Production Lock policy in `docs/` and notify maintainers
4. Add a developer checklist for promoting files into production

Who should act: maintainer/architect. If a fix requires touching forbidden areas, STOP and ASK.

-- END TODO --
