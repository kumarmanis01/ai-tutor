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

```bash
docker compose up -d

:: Windows CMD examples (set env where needed)
set DATABASE_URL=postgresql://spinzy:spinzy@localhost:6543/spinzy
set SHADOW_DATABASE_URL=postgresql://spinzy:spinzy@localhost:6544/spinzy_shadow

npm run db:kill-node
npm run db:generate
npm run db:migrate
```

- For production, keep `DATABASE_URL` pointed at your managed Postgres and set `SHADOW_DATABASE_URL` to an isolated database (separate Neon branch/DB). Apply with:

```bash
npm run db:deploy
```

Tips:
- If Windows locks Prisma DLLs, run `npm run db:kill-node` and retry.
- Use `npm run db:reset:dev` only against local dev DB; never against production.

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
