# Spinzy Academy — Session Handoff
# Date: 2026-03-24
# Start next chat by sharing this file + docs/v2/02-architecture.md
---
## Project Identity
- Product: Spinzy Academy — AI home tutor "Vidya" for Indian K-12 students
- Domain: https://spinzyacademy.com
- VPS: gnosiva@srv1232455
- App path: /home/gnosiva/apps/content-engine/ai-tutor/
- Stack: Next.js 16 + TypeScript + Prisma 6 + Neon PostgreSQL + Redis + BullMQ + PM2
- PM2 processes: ai-tutor-web | content-engine-worker | ai-tutor-scheduler
- Deploy: ./scripts/deploy-and-run.sh
- Branch: claude/audit-hydrate-all-pipeline-R14hP
---
## Critical Rules (always follow these)
### SQL on VPS
ALWAYS: bash scripts/db-exec.sh "SELECT ..."
NEVER: npx prisma db execute --stdin <<< "..."
### Bash indirect expansion
ALWAYS: val=$(eval echo "\$$var")
NEVER: ${!var}  -- breaks on AlmaLinux bash
### Smart quotes
Pre-commit hook auto-fixes. If deploy fails: python3 scripts/fix-smart-quotes.py
NEVER use Unicode curly quotes in .ts/.tsx/.cjs files
### Prisma enum imports
ALWAYS: import { AdminActionType } from '@prisma/client'
NEVER: import type { AdminActionType } from '@prisma/client'
### SubjectDef schema
FK column is "classId" NOT "classLevelId" -- confirmed in DB
### User.subjects field
Stores lowercase slugs: {english,mathematics,science}
ALWAYS filter SubjectDef by grade + board when resolving slugs to IDs
NEVER query SubjectDef by slug alone -- returns Grade 1 row (inserted first)
### Content pipeline order
1. NCERT scraper FIRST (populates CurriculumChunk)
2. HydrateAll SECOND (SyllabusWorker reads chunks for correct chapters)
Never run HydrateAll without NCERT content -- generates hallucinated chapters
---
## Production State
- Site: LIVE at spinzyacademy.com
- Google OAuth: working
- Cloudflare: A record -> VPS, SSL Full strict
- Redis: CHECK STATUS -- was down last session (sudo systemctl start redis)
- Migrations: 20 applied including schema_audit_cleanup
- Taxonomy: seeded (2 boards, 24 ClassLevels, ~52 SubjectDefs)
- Content: Grade 6 Science chapters generated (wrong -- see B7)
---
## Pending Bugs (fix in order)
B1 CRITICAL: generate-plan returns Grade 1 SubjectDef for Grade 6 student
   File: app/api/student/onboarding/generate-plan/route.ts
   RCA: slug lookup missing grade+board filter
   Fix: add classLevel.grade + board.slug to WHERE clause
   Also fix: app/api/subjects/for-selection/route.ts (same bug)
B2 CRITICAL: User.subjects has capitalised values {Mathematics,Science}
   Fix: run this SQL on Neon:
   UPDATE "User"
   SET subjects = ARRAY(
     SELECT lower(regexp_replace(unnest(subjects), '\s+', '-', 'g'))
   )
   WHERE subjects IS NOT NULL AND subjects != '{}';
B3 HIGH: deploy-and-run.sh fails with "unbound variable" at line ~291
   Fix: replace ${!var} with: val=$(eval echo "\$$var")
   Also wire: worker cleanup + db-exec.sh creation
B4 HIGH: Redis down -- HydrateAll cascade stops after Level 1 (chapters only)
   Fix on VPS: sudo systemctl start redis && sudo systemctl enable redis
   Then: redis-cli CONFIG SET maxmemory-policy noeviction
B5 HIGH: Wrong NCERT chapters for Grade 6 Science (Grade 8 chapters generated)
   Fix: SyllabusWorker must read CurriculumChunk for chapter names
   But first: run NCERT scraper so CurriculumChunk is populated
B6 MEDIUM: NCERT scraper never ran (IngestRunLog empty)
   Fix: npm install -g tsx on VPS, then trigger from /admin/content Coverage page
   URL table needs updating: Grade 6 Science = fecu1 (Curiosity 2024 book)
B7 MEDIUM: Husky pre-commit not wired -- smart quotes keep recurring
   Fix prompt: written in session, not applied yet
B8 LOW: WorkerLifecycle stale records in admin UI
   Fix: added to deploy script in fix prompt, not applied yet
---
## Pending Actions (not code fixes)
- Resend domain verify: spinzyacademy.com in Resend dashboard + Cloudflare DNS records
- RESEND_API_KEY: add to .env.production on VPS
- SMTP vars: remove EMAIL_SERVER_* from .env.production (replaced by Resend)
- Run SubjectDef dedup SQL if duplicates exist after taxonomy reseed
- Trigger HydrateAll for CBSE Grade 10 Maths + Science (highest priority content)
---
## Architecture Quick Reference
Content pipeline:
  seed-taxonomy.cjs -> ClassLevel + SubjectDef
  scrape-ncert.ts -> CurriculumChunk (NCERT PDFs -> pgvector)
  HydrateAll -> ChapterDef + TopicDef + TopicNote + GeneratedQuestion
  GeneratedQuestion -> Question (lazy promotion on first session)
Key files:
  lib/ai/tutor/promptAssembly.ts -- Teacher Vidya persona
  worker/services/syllabusWorker.ts -- chapter generation
  worker/services/hydrationReconciler.ts -- cascade orchestration
  scripts/deploy-and-run.sh -- full deploy with pre-flight gates
  scripts/db-exec.sh -- SQL runner (use this, not prisma --stdin)
  scripts/fix-smart-quotes.py -- unicode fixer
  scripts/seed-taxonomy.cjs -- Board/ClassLevel/SubjectDef seed
  prisma/schema.prisma -- source of truth for all models
Admin panel: https://spinzyacademy.com/admin
  Key pages: /admin/content-engine/hydrateAll | /admin/content | /admin/users
