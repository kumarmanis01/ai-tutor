## Conversation Threading (December 2025)

- Overview: The chat now supports conversation threading via a `conversationId` (topic).
- Server (`app/api/ask/route.ts`):
	- Accepts `conversationId` in the request. Generates one if missing (`conv_<uuid-like>`).
	- Persists user/assistant messages with `Chat.subject = conversationId` to group turns per topic.
	- Loads recent history filtered by `userId` and `subject` for context-aware follow-ups.
	- Returns `{ conversationId, topic }` so the client reuses the same ID across turns.
- Client (`app/dashboard/components/QuickInputBox.tsx`):
	- Stores `conversationId` in component state.
	- Sends it with `/api/ask` requests and updates it from the server response.
- Database (`prisma/schema.prisma`):
	- Added indexes: `@@index([subject])` and `@@index([userId, subject])` on `Chat` for efficient per-topic queries.
	- Apply with: `npx prisma migrate dev -n add-chat-topic-indexes`.

### Scaling to Multiple Conversations
- Use distinct `conversationId` values per chat/thread (tests, notes, topics, rooms).
- No schema change required immediately; `Chat.subject` acts as the topic key.
- Future migration can introduce a dedicated `Conversation` table and OpenAI Conversations/Responses API, keeping `conversationId` contract intact.

### Suggestion Auto-Submit UX
- Clicking a suggestion now auto-submits the query.
- Guarded: Submission is blocked if images are still uploading; a toast is shown.
- The “Suggestion inserted…” hint is cleared on submit.

### Run & Verify
1. Install deps: `npm install`
2. Migrate DB indexes: `npx prisma migrate dev -n add-chat-topic-indexes`
3. Start dev: `npm run dev`
4. Open chat: ask a question, click a suggestion, then ask a follow-up — the assistant should retain context.

### Notes
- If `OPENAI_API_KEY` is missing, `/api/ask` returns an error.
- Image analysis requires user consent and uses presigned uploads; ensure S3 CORS and env vars are set.
# Spinzy Academy — Phase 2 (MVP)

## Quick start

1. Copy files into project (folder structure above)
2. Add `OPENAI_API_KEY` to `.env.local`
3. Install deps: `npm install`
4. Run locally: `npm run dev`
5. Open http://localhost:3000

## Notes

- Phase 2 provides multilingual chat (English/Hindi), speech (TTS + mic), accessibility, local storage.
- Server-side OpenAI key is required in `.env.local` as `OPENAI_API_KEY`.

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Tests Module

The Tests feature is modular and lives under `components/Test/` with server APIs under `app/api/tests/*`.

- Components:
	- `TestHome`: Composes the entire test journey (Quick Practice, Chapter Tests, Test History, Weekly Challenge) and is rendered inside the Dashboard Tests tab and `/tests` page.
	- `QuickPractice`, `ChapterTests`, `WeeklyChallenge`, `AttemptRunner`, `Scorecard`, `TestHistory` are small, reusable widgets.

- APIs:
	- `POST /api/tests/start` → creates a `TestResult` attempt and persists ordered `AttemptQuestion` rows.
	- `GET /api/tests/questions?attemptId=...` → fetches ordered questions for an attempt.
	- `POST /api/tests/submit` → auto-grades answers, stores `Answer` rows, returns a scorecard.
	- `GET /api/tests/history` → recent attempts for the current user.
	- `GET /api/tests/attempt/:id` → attempt details with per-question breakdown.

- Prisma models:
	- `Question` (bank), `AttemptQuestion` (per-attempt items), `Answer` (user response + score), and back-relation on `TestResult`.

- Setup:
```bash
npx prisma generate
npx prisma migrate dev -n add_test_models
npm i -D ts-node typescript
npx ts-node prisma/seed.ts
```

- Leaderboard:
	- `/api/leaderboard?by=tests&grade=&board=&subject=&period=weekly|all` ranks by best attempt score with optional scope filters.

Note: `lib/aiContext.ts` exports a stub `createAIClient()` used by test generation hooks; replace with your LLM provider for production.

## Stable Prisma Migrations (Permanent)

To avoid destructive resets and flaky shadow DB issues:

- We configured `shadowDatabaseUrl` in `prisma/schema.prisma` to use a dedicated shadow DB via `SHADOW_DATABASE_URL`.
- You can run local Postgres containers for both main and shadow:

Important: The `localhost` URLs below are for local development only (planning and testing). Do not point production `DATABASE_URL` at localhost; use your managed Postgres (e.g., Neon) and run `npx prisma migrate deploy` there.

```bash
docker compose up -d

:: Windows CMD examples (set env where needed)
set DATABASE_URL=postgresql://spinzy:spinzy@localhost:6543/spinzy
set SHADOW_DATABASE_URL=postgresql://spinzy:spinzy@localhost:6544/spinzy_shadow

npm run db:kill-node
npm run db:generate
npm run db:migrate
```

- For production, keep `DATABASE_URL` pointed at your managed Postgres and set `SHADOW_DATABASE_URL` to an isolated database (separate Neon branch/DB).

Example Neon pooled URL (recommended):

```bash
# .env / Vercel environment
DATABASE_URL=postgresql://<user>:<password>@<your-neon-host>/<db>?sslmode=require&pgbouncer=true
```

Windows CMD (escape ampersands with ^):

```cmd
set DATABASE_URL=postgresql://USER:PASSWORD@YOUR-NEON-HOST/DB?sslmode=require^&pgbouncer=true
```

Reminder: Never run `npm run db:reset:dev` or `npx prisma migrate dev` against production; only use `npm run db:deploy`.

Apply with:

```bash
npm run db:deploy
```

Tips:
- If Windows locks Prisma DLLs, run `npm run db:kill-node` and retry.
- Use `npm run db:reset:dev` only against local dev DB; never against production.

### Migration Recovery (Production)
- If a production migration fails and blocks deploys, use `migrate resolve` to recover the state, then re-deploy.
- Example commands:

```bash
# Mark a failed migration as rolled back
npx prisma migrate resolve --rolled-back <migration_name>

# After fixing the migration file, mark it as applied
npx prisma migrate resolve --applied <migration_name>

# Deploy pending migrations
npx prisma migrate deploy
```

- Notes:
	- Keep production migrations minimal and idempotent (use `IF NOT EXISTS` for indexes where possible).
	- Avoid full-schema “init” migrations on an already populated database.

### Copilot Playbook: Resolving Failed Prisma Migrations
- Context: A migration failed due to full-schema SQL on an already populated prod DB, causing `P3009` blocks.
- Steps Copilot used to recover safely:
	- Remove the erroneous full-schema init migration folder to prevent conflicts:
		- `Remove-Item -Recurse -Force prisma\migrations\20251210_init`
	- Edit the failed migration to be minimal and idempotent (indexes only):
		- In `prisma/migrations/20251210075123_add_chat_topic_indexes/migration.sql` keep only:
			- `CREATE INDEX IF NOT EXISTS "Chat_subject_idx" ON "Chat"("subject");`
			- `CREATE INDEX IF NOT EXISTS "Chat_userId_subject_idx" ON "Chat"("userId", "subject");`
	- Clear failed state, then mark applied:
		- `npx prisma migrate resolve --rolled-back 20251210075123_add_chat_topic_indexes`
		- `npx prisma migrate resolve --applied 20251210075123_add_chat_topic_indexes`
	- Verify:
		- `npx prisma migrate status`
	- Deploy if any new migrations exist:
		- `npx prisma migrate deploy`

Tips:
- Prefer `migrate diff` to generate targeted SQL (`--from-schema-datasource` → `--to-schema-datamodel --script`) for incremental, non-destructive changes.
- For Windows CMD, escape `&` in URLs with `^` when setting `DATABASE_URL` inline.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

## VPS Deploy & Run (PM2)

Quick helper steps for deploying on a VPS using the repository `scripts/deploy-and-run.sh` wrapper.

1. Ensure `.env.production` is present on the VPS in the repo root (do NOT commit secrets).
2. Make scripts executable:

```bash
chmod +x scripts/deploy-and-run.sh scripts/run-web.sh scripts/run-worker.sh scripts/ensure-logs.sh scripts/reset-logs.sh
```

3. Run the deploy-and-run script (recommended):

```bash
# default: performs vps-verification (auto), pm2 cleanup, pulls branch, starts ecosystem
./scripts/deploy-and-run.sh --auto --branch feat/worker-production-setup

# skip pm2 cleanup
./scripts/deploy-and-run.sh --no-clean --branch feat/worker-production-setup

# perform pm2 cleanup and kill pm2 daemon
./scripts/deploy-and-run.sh --kill --branch feat/worker-production-setup
```

4. Useful npm helpers (from repo root):

```bash
# Run vps verification (non-interactive)
npm run verify:vps

# Verify dist artifacts
npm run verify:dist

# Check Redis/Bull keys (uses .env.production or environment REDIS_URL)
npm run check-redis-keys
```

5. Inspect PM2 logs if anything crashes:

```bash
pm2 logs ai-tutor-web --lines 200
pm2 logs content-engine-worker --lines 200
```

If you want, add these commands to your deployment automation (Ansible, scripts, CI) but keep `.env.production` populated by your provisioning or secret store (never check it into source control).

Security checklist (enforced by scripts)

- Ensure `.env.production` is present on the server and not committed into git. The repo includes `scripts/ensure-env-perms.sh` which will fail the deploy if the file is tracked in git.
- Set secure permissions on the file so only the deploy user can read it:

```bash
chmod 600 .env.production
chown <deploy-user>:<deploy-user> .env.production
```

- The `deploy-and-run.sh` script invokes `ensure-env-perms.sh` before any PM2 actions. Keep `.env.production` in your deployment secrets store and do not commit it.



## Deployment / Required Environment Variables

The evaluator and application require runtime environment variables in production. Add these to your Vercel project (Preview & Production) via the Vercel UI or CLI.

Minimum required runtime vars for production:

- `DATABASE_URL` — Postgres connection string used by the app and evaluator (e.g. `postgres://user:password@host:5432/dbname`).
- `REDIS_URL` — Redis connection string used by BullMQ and workers (e.g. `rediss://user:pass@host:port`).
- `NEXTAUTH_SECRET` — NextAuth secret used for session signing.
- `OPENAI_API_KEY` — OpenAI API key (if used in production features).

How to add (Vercel UI)
- Project → Settings → Environment Variables → Add variable (key/value) and select Target (Preview/Production/Development).

How to add (Vercel CLI)
Install the Vercel CLI and run the following locally (you will be prompted for each value). Replace placeholder values with your real secrets.

```bash
# login first
vercel login

# Add DATABASE_URL
vercel env add DATABASE_URL production
vercel env add DATABASE_URL preview
vercel env add DATABASE_URL development

# Add REDIS_URL
vercel env add REDIS_URL production
vercel env add REDIS_URL preview
vercel env add REDIS_URL development

# Add NEXTAUTH_SECRET
vercel env add NEXTAUTH_SECRET production
vercel env add NEXTAUTH_SECRET preview
vercel env add NEXTAUTH_SECRET development

# Add OPENAI_API_KEY (if used)
vercel env add OPENAI_API_KEY production
vercel env add OPENAI_API_KEY preview
vercel env add OPENAI_API_KEY development
```

Notes:
- Do not commit secrets to the repository.
- GitHub Actions CI uses its own environment and service containers; it does not automatically add runtime vars to Vercel.


The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Logging

Spinzy Academy uses a centralized logger (`lib/logger.ts`) across server and client.

- Server `LOG_LEVEL`: Controls server log verbosity. Allowed values: `error`, `warn`, `info`, `debug`. Default is `error`.
- Client `NEXT_PUBLIC_DEBUG_MODE`: When `true`, client emits `info`/`debug` logs; when `false`, client still emits `error` logs to ensure visibility.

Add these to your environment (recommended in `.env.local`):

```bash
# .env.local
LOG_LEVEL=warn
NEXT_PUBLIC_DEBUG_MODE=true
```

Use in code:

```ts
import { logger } from '@/lib/logger';

logger.error('Failed to fetch profile', { userId });
logger.warn('Fallback to default config');
logger.info('User onboarded', { step: 'profile-complete' });
logger.debug('Speech settings', { lang, micEnabled });
```

Notes:
- Avoid `console.*`; route all logs through `logger`.
- In production, prefer `LOG_LEVEL=error` and `NEXT_PUBLIC_DEBUG_MODE=false`.

## Alerts (Unified Modal)
- Use the unified alert system to show modal dialogs instead of `alert()`:
	- Emit: `showAlert({ title: 'Heads up', message: 'Something happened', variant: 'warning' })`
	- File: `lib/alerts.ts` (`showAlert`) and `components/UI/AlertModal.tsx` (listener + UI)
	- Global: `AlertModal` is mounted in `app/providers.tsx`.
- This replaces any usage of `window.dispatchEvent` with the named event `app-alert` and a typed payload.

# Spinzy Academy: Setup, Migration, and Staging Guide

## Local Development

1. **Install dependencies:**
   ```cmd
   npm install
   ```
2. **Start the dev server:**
   ```cmd
   npm run dev
   ```
3. **Run type-check and lint:**
   ```cmd
   npm run type-check
   npm run lint
   ```

## Database Migration Workflow

### Safe Migration Principles
- **Never use `prisma migrate reset` or `db push` on production.**
- **Always use incremental migrations:**
  ```cmd
  npx prisma migrate dev --name <change>
  ```
- **Apply migrations to production with:**
  ```cmd
  npx prisma migrate deploy
  ```
- **Backup your production DB before applying migrations.**
- **Test all migrations on staging before production.**

### Staging Environment Setup

1. **Create a separate Neon DB for staging.**
   - Example: `DATABASE_URL_STAGING` in `.env.staging`
2. **Configure your `.env.staging` file:**
   ```env
   DATABASE_URL="postgresql://<user>:<password>@<host>:<port>/<db>?schema=public"
   NEXTAUTH_SECRET=your-staging-secret
   # ...other staging secrets
   ```
3. **Switch to staging config in development:**
   ```cmd
   cp .env.staging .env
   npm run dev
   ```
4. **Apply migrations to staging:**
   ```cmd
   npx prisma migrate deploy
   ```
5. **Seed staging DB:**
   ```cmd
   node prisma/seed.ts
   ```
6. **Test your app thoroughly on staging.**

### Staging Environment Usage

1. Fill in `.env.staging` with your staging DB connection string and secrets.
2. To use staging locally:
   ```cmd
   cp .env.staging .env
   npm install
   npx prisma migrate deploy
   node prisma/seed.ts
   npm run dev
   ```
3. All migrations and seeds will now run against your staging DB.

### Moving to Production

1. **Create a separate Neon DB for production.**
   - Example: `DATABASE_URL_PROD` in `.env.production`
2. **Configure your `.env.production` file:**
   ```env
   DATABASE_URL="postgresql://<user>:<password>@<host>:<port>/<db>?schema=public"
   NEXTAUTH_SECRET=your-prod-secret
   # ...other prod secrets
   ```
3. **Switch to production config:**
   ```cmd
   cp .env.production .env
   npm run build
   npm start
   ```
4. **Apply migrations to production:**
   ```cmd
   npx prisma migrate deploy
   ```
5. **Seed production DB (if needed):**
   ```cmd
   node prisma/seed.ts
   ```

## Best Practices
- **Never run destructive commands on production.**
- **Always test migrations and seeds on staging first.**
- **Keep `.env` files for each environment.**
- **Automate backups before migration.**
- **Review migration SQL for breaking changes.**

## Troubleshooting
- If you see drift or migration errors, resolve them on staging first.
- For complex changes, write custom SQL migrations and test on staging.
- Use `npx prisma migrate resolve --applied <migration_name>` to mark manual migrations as applied.

---

For questions, reach out to the Spinzy Academy team or check the Prisma docs: https://www.prisma.io/docs/
