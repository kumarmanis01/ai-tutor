# Spinzy AI Home Tutor — Session Handoff

# Date: 2026-03-19

# For: New Claude chat continuation

---

## Project Identity

- **Product:** Spinzy Academy — AI home tutor "Vidya" for Indian K-12 students
- **Domain:** https://spinzyacademy.com (migrated from Vercel to VPS today)
- **VPS:** gnosiva@srv1232455, app path: `/home/gnosiva/apps/content-engine/ai-tutor/`
- **DB:** Neon PostgreSQL (production), pgvector active, 18 migrations applied
- **Stack:** Next.js + TypeScript + Prisma + PostgreSQL + Redis + BullMQ + PM2
- **PM2 processes:** ai-tutor-web (port 3000), content-engine-worker, ai-tutor-scheduler
- **Deploy script:** `./scripts/deploy-and-run.sh`

---

## Current Production State

- Site is LIVE at https://spinzyacademy.com
- Google OAuth working (URIs updated in Google Console)
- Cloudflare: A record → VPS IP, SSL Full (strict)
- PM2 all 3 processes online
- NEXTAUTH_URL=https://spinzyacademy.com in .env.production

---

## THIS SESSION — What Was Done

### 1. Domain Migration (COMPLETE)

- Removed Vercel DNS from Cloudflare
- Added A records pointing to VPS IP for @ and www
- Updated NEXTAUTH_URL in .env.production
- Google OAuth redirect URIs updated
- Removed domain from Vercel dashboard

### 2. Class 1–12 Expansion (COMPLETE — needs deploy)

All changes applied via Claude Code, committed and pushed:

- `components/student/onboarding/ProfileSetupForm.tsx` — grade picker expanded from [6..12] to [1..12], grid-cols-4
- `app/api/user/onboarding/route.ts` — subjects validation now skips if no subjects seeded for grade, case-insensitive matching
- Landing page copy updated in 8 files: all "6–12" → "1–12"
- `app/(public)/landing-page/components/TestimonialsSection.tsx` — testimonial role updated

### 3. ClassLevel DB Seed (PENDING)

Grades 1–5 may be missing from ClassLevel table. Script ready, failed due to env issue.
Run on VPS:

```bash
cd /home/gnosiva/apps/content-engine/ai-tutor
set -a && source .env.production && set +a
cat > /tmp/seed-classes.js << 'SCRIPT'
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function seed() {
  const board = await p.board.findFirst({ where: { slug: 'cbse' } });
  if (!board) {
    const all = await p.board.findMany({ select: { slug: true, name: true } });
    console.log('No cbse board. Found:', JSON.stringify(all));
    return;
  }
  console.log('Board:', board.name, board.id);
  for (let g = 1; g <= 12; g++) {
    const r = await p.classLevel.upsert({
      where: { boardId_grade: { boardId: board.id, grade: g } },
      update: {},
      create: { boardId: board.id, grade: g, slug: 'grade-' + g }
    });
    console.log('Grade', g, r.id);
  }
}
seed().catch(console.error).finally(() => p.$disconnect());
SCRIPT
node /tmp/seed-classes.js
```

### 4. Onboarding 400 Error (PARTIALLY FIXED — needs one more Claude Code fix)

**Root cause confirmed:** POST to `/api/user/onboarding` returns 400 with:

```json
{
  "error": "validation_error",
  "fieldErrors": { "name": "Name is required", "age": "Age is required" }
}
```

**Request payload the form sends:**

```json
{
  "board": "cbse",
  "class_grade": 4,
  "preferred_language": "en",
  "subjects": ["hindi", "english", "mathematics"]
}
```

The form never sends `name` or `age`. The API requires both but shouldn't.

**Fix needed in Claude Code:**

```
/run cat app/api/user/onboarding/route.ts

In app/api/user/onboarding/route.ts make these two fixes:

Fix 1 — name: remove the name required validation entirely.
The user signs in via Google — their name is already in the DB from NextAuth.
Find the line that sets fieldErrors.name = 'Name is required' and remove it.
Only write name to updates if explicitly provided in body AND non-empty. Otherwise leave DB name untouched.

Fix 2 — age: make age completely optional.
Find the line that sets fieldErrors.age = 'Age is required' and remove it.
Age is not collected during onboarding. If absent or null, proceed without error.

Do not change anything else. npm run build must pass. Report exact lines removed/changed.
```

After fix: commit, push, deploy.

### 5. Image Optimizer Still Broken (UNRESOLVED)

- `curl -I http://localhost:3000/logos/icon-192.png` → 200 OK ✅
- `curl -I "http://localhost:3000/_next/image?url=%2Flogos%2Ficon-192.png&w=32&q=75"` → 400 Bad Request ❌
- `localPatterns` added to `next.config.ts` but build not picking it up
- Clean rebuild (`rm -rf .next && npm run build`) needed on VPS
- `next.config.ts` localPatterns config:

```typescript
images: {
  localPatterns: [
    { pathname: '/logos/**' },
    { pathname: '/images/**' },
  ],
  // ... rest of config
}
```

**To fix:** After onboarding fix is deployed, do clean rebuild:

```bash
cd /home/gnosiva/apps/content-engine/ai-tutor
pm2 stop ai-tutor-web
rm -rf .next
npm run build
pm2 start ecosystem.config.cjs --env production
```

Then verify: `curl -I "http://localhost:3000/_next/image?url=%2Flogos%2Ficon-192.png&w=32&q=75"` should return 200.

### 6. SubjectDef Duplicate SQL (PENDING — run on Neon)

```sql
DELETE FROM "SubjectDef" a
USING "SubjectDef" b
WHERE a.id > b.id
  AND a.name = b.name
  AND a."classId" = b."classId";
```

### 7. Favicon (DEFERRED)

- Owl favicon is unrecognisable at 16px
- Recommended fix: SVG letter-based favicon (purple square + white "S")
- Deferred to post-launch

---

## Key File Paths

| Purpose           | Path                                                   |
| ----------------- | ------------------------------------------------------ |
| Onboarding API    | `app/api/user/onboarding/route.ts`                     |
| Subjects API      | `app/api/subjects/for-selection/route.ts`              |
| Grade picker form | `components/student/onboarding/ProfileSetupForm.tsx`   |
| Logo component    | `components/Logo.tsx`                                  |
| Dashboard topbar  | `components/dashboard/DashboardTopbar.tsx`             |
| Next config       | `next.config.ts`                                       |
| PM2 config        | `ecosystem.config.cjs`                                 |
| Deploy script     | `scripts/deploy-and-run.sh`                            |
| Landing hero      | `app/(public)/landing-page/components/HeroSection.tsx` |
| Onboarding layout | `app/(student)/onboarding/`                            |

---

## Pending Action List (Priority Order)

1. **[Claude Code]** Fix onboarding 400 — remove name+age required validation from `app/api/user/onboarding/route.ts`
2. **[Commit+Push+Deploy]** After fix: `git add -A && git commit -m "fix: make name and age optional in onboarding" && git push && ./scripts/deploy-and-run.sh`
3. **[VPS]** Run seed-classes.js to ensure grades 1–12 exist in ClassLevel table
4. **[VPS]** Clean rebuild to fix image optimizer: `rm -rf .next && npm run build && pm2 restart ai-tutor-web`
5. **[Neon SQL]** Run SubjectDef dedup SQL
6. **[Test]** Full onboarding flow end-to-end: register → board → grade (1–12) → medium → subjects → save → dashboard
7. **[Deferred]** Favicon redesign

---

## Architecture Decisions Made

- No Nginx/Apache needed — Next.js + PM2 + Cloudflare is correct setup
- `localPatterns` required in next.config.ts for Next.js image optimizer with local files
- Age field removed from onboarding (was part of dateOfBirth flow, now optional)
- Class range expanded from 6–12 to 1–12 across all UI and landing pages
- SubjectDef dedup done at JS level in API (not DB constraint) because model has no unique(name, classId)

---

## Known Tech Debt

- `StudentConceptState` has no `concept` relation in Prisma schema — workaround in diagnosticGuard.ts uses two-step query
- In-memory circuit breaker in lib/redis.ts (unsafe in PM2 multi-process) — Task 16 in backlog
- Phase12/regenerationWorker integration tests excluded from CI (stale fixtures)
- CONSENT_LIVE=false — DPDP consent UI built but not shown until lawyer reviews copy
- ENABLE_DISTRESS_DETECTION=false — code ready, needs on-call alias defined first

---

## Previous Session Context

Full implementation history in transcripts:

- `/mnt/transcripts/2026-03-17-05-54-53-spinzy-ai-tutor-v2-sprint-complete.txt` — V2 sprint, all 32 tasks
- `/mnt/transcripts/2026-03-18-01-05-31-spinzy-ai-tutor-brand-bugs.txt` — brand assets, bug fixes, this session
- Gap analysis doc: `/mnt/user-data/outputs/PreLaunch_Gap_Analysis_v2.md`
- Aider tasks: `/mnt/user-data/outputs/aider_tasks.md`
- Post-launch backlog: `/mnt/user-data/outputs/post_launch_backlog.md`
