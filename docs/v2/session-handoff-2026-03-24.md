# Spinzy Academy -- Session Handoff
# Date: 2026-03-24
# Start next chat by sharing this file + docs/v2/02-architecture.md
---
## Project Identity
- Product: Spinzy Academy -- AI home tutor "Vidya" for Indian K-12 students (CBSE/ICSE Gr 6-12)
- Domain: https://spinzyacademy.com
- VPS: gnosiva@srv1232455  |  App: /home/gnosiva/apps/content-engine/ai-tutor/
- Stack: Next.js 16 + TypeScript + Prisma 6.19.1 + Neon PostgreSQL + Redis + BullMQ + PM2
- PM2 processes: ai-tutor-web | content-engine-worker | ai-tutor-scheduler
- Deploy: ./scripts/deploy-and-run.sh
- Branch: claude/session-handoff-docs-AWVZW (merge to master, then pull on VPS)
---
## Critical Rules (always follow these)
### SQL on VPS
ALWAYS: bash scripts/db-exec.sh "SELECT ..."
NEVER:  npx prisma db execute --stdin <<< "..."

### Bash indirect expansion
ALWAYS: val=$(eval echo "\$$var")
NEVER:  ${!var}  -- breaks on AlmaLinux bash

### Smart quotes
Pre-commit hook auto-fixes. If deploy fails: python3 scripts/fix-smart-quotes.py
NEVER use Unicode curly quotes in .ts/.tsx/.cjs files

### Prisma enum imports
ALWAYS: import { AdminActionType } from '@prisma/client'
NEVER:  import type { AdminActionType } from '@prisma/client'

### SubjectDef schema
- FK column: "classId"  (NOT "classLevelId")
- Relation name: "class"  (NOT "classLevel")
- To join: include: { class: { include: { board: true } } }
- ALWAYS filter SubjectDef by grade + board when resolving slugs
- NEVER query SubjectDef by slug alone -- returns Grade 1 row (inserted first)

### Content pipeline order
1. NCERT scraper FIRST (populates CurriculumChunk)
2. HydrateAll SECOND (SyllabusWorker reads chunks for correct chapters)
Never run HydrateAll without NCERT content -- generates hallucinated chapters

### Prisma version
LOCKED at 6.19.1 -- never upgrade to v7
If drift: npm install prisma@6.19.1 @prisma/client@6.19.1 --save-exact

### grade and board
Immutable after first save -- strip from all PATCH handlers
Comment: // grade/board immutable after first save -- strip from all PATCH handlers

### Environment flags (DO NOT CHANGE)
ENABLE_DISTRESS_DETECTION=false  -- flip only after on-call process defined
NEXT_PUBLIC_CONSENT_LIVE=false   -- flip only after lawyer approves ConsentGate.tsx copy
ROLLOUT_PERCENTAGE=5             -- V2 feature rollout percentage

---
## Production State (as of 2026-03-24)
- Site: LIVE at spinzyacademy.com
- Google OAuth: working
- Migrations: 24 applied (all up to date on Neon)
- Tests: 1222 passing
- PM2: all 3 processes online, restart count 0
- Scheduler jobs: hydrationReconciler, weeklyParent, readinessPrecompute,
                  costReport, dailyMaintenance, markIgnored, cleanup

---
## Completed This Session
- ProfileCompletionGate: full V2 rewrite -- inline multi-step form (no redirect)
  purple Vidya header, board radio cards, 52px grade grid, 2-col language cards,
  subject chips with mandatory lock, conditional parent email (DPDP age < 13),
  pre-populated from DB via initialValues prop, skip to first missing step,
  router.refresh() after save so gate unmounts when isProfileComplete() = true
- StudentProfileData: added age + parentEmail fields
- Admin system metrics: replaced SWR client component with server component
  using systemHealth() + Prisma queries -- no more "Loading forever"
  Added AI Telemetry section (cost this month, avg cost/session, cache hit rate)
- Diagnostic loading copy: removed subject name ("getting your personalised content ready")
- Recent jobs enrichment: GET /api/admin/hydrateAll now enriches board/grade/subject
  from SubjectDef.class join when denormalized fields are null
- Recent jobs progress: shows Ch/Notes/Q breakdown below overall progress bar

---
## Pending Bugs (fix in order)
B4 MEDIUM: Doubts tab 404
   Fix: create app/(student)/doubts/page.tsx showing DoubtKb for student

B5 MEDIUM: HydrateAll generates wrong chapters (hallucinated, not NCERT)
   Fix: SyllabusWorker reads CurriculumChunk for chapter names
   Prerequisite: NCERT scraper must run first (IngestRunLog is empty)

---
## Pending VPS Actions
- Redis: verify running (redis-cli ping must return PONG)
  If down: sudo systemctl start redis && sudo systemctl enable redis
  Then: redis-cli CONFIG SET maxmemory-policy noeviction
- HydrateAll: trigger for CBSE Grade 10 Maths + Science from admin UI
  ONLY after NCERT scraper has run (otherwise hallucinated chapters)
- NCERT scraper: trigger from /admin/content Coverage page for Grade 10 Maths + Science
- Resend: add RESEND_API_KEY to .env.production + verify spinzyacademy.com domain in Resend
- Deploy: git pull on VPS then ./scripts/deploy-and-run.sh

---
## Content Pipeline Status
- Taxonomy: seeded (2 boards, 24 ClassLevels, ~52 SubjectDefs)
- NCERT chunks: NOT ingested (IngestRunLog empty) -- run scraper before HydrateAll
- Questions: 0 in Question table, some in GeneratedQuestion
- Diagnostic: shows "Vidya is getting ready" (topicDef count = 0 for most subjects)

---
## Architecture Quick Reference
### Content pipeline
  seed-taxonomy.cjs -> ClassLevel + SubjectDef
  scrape-ncert.ts   -> CurriculumChunk (NCERT PDFs -> pgvector)
  HydrateAll        -> ChapterDef + TopicDef + TopicNote + GeneratedQuestion
  GeneratedQuestion -> Question (lazy promotion on first session)

### Key relations
  SubjectDef.class    -> ClassLevel  (FK: classId)
  ClassLevel.board    -> Board
  ClassLevel.subjects -> SubjectDef[]

### isProfileComplete vs checkProfileCompleteness
  isProfileComplete()        -- checks board/grade/language/subjects only (gate trigger)
  checkProfileCompleteness() -- checks all fields including name/age/parentEmail

### Key files
  lib/ai/tutor/promptAssembly.ts          -- Vidya persona + Socratic prompt
  lib/student/profileGuard.ts             -- isProfileComplete, checkProfileCompleteness
  components/student/ProfileCompletionGate.tsx -- inline V2 profile completion form
  worker/services/syllabusWorker.ts       -- chapter generation
  worker/services/hydrationReconciler.ts  -- cascade orchestration
  scripts/deploy-and-run.sh               -- full deploy with pre-flight gates
  scripts/db-exec.sh                      -- SQL runner (use this, NOT prisma --stdin)
  scripts/fix-smart-quotes.py             -- unicode fixer
  scripts/seed-taxonomy.cjs               -- Board/ClassLevel/SubjectDef seed
  prisma/schema.prisma                    -- source of truth for all models

### Admin panel
  https://spinzyacademy.com/admin
  Key pages: /admin/content-engine/hydrate-all | /admin/content | /admin/users
             /admin/system/metrics | /admin/ai-dashboard
