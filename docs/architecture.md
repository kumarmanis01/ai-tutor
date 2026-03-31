# Spinzy Academy — System Architecture

## Overview
AI-powered home tutor for Indian K–12 students (Grades 1–12).
Replaces private tutors with structured, curriculum-first AI learning.
Target: Tier 2–4 India. Mobile-first. Low-bandwidth tolerant.

## Stack
| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 App Router + TypeScript + TailwindCSS |
| Backend | Next.js API Routes + Prisma 6 |
| Database | Neon PostgreSQL (serverless) + pgvector |
| Queue | BullMQ + Redis |
| Email | Resend (verified domain: send.spinzyacademy.com) |
| AI | OpenAI GPT-4o (content) + GPT-4o-mini (tutor) |
| Auth | NextAuth v4 (Google OAuth) |
| Infra | Single VPS (AlmaLinux) + PM2 + Cloudflare DNS |

## PM2 Processes
- ai-tutor-web (port 3000) — Next.js app
- content-engine-worker — BullMQ job processor
- ai-tutor-scheduler — Cron jobs (reconciler, digests, nudges)

## Core Components

### 1. AI Tutor (Vidya)
- Session-based structured learning
- Phases: Explain -> Hint -> Practice -> Evaluate
- Grounded in TopicNote content (RAG via pgvector)
- Never shows numeric scores to students

### 2. Content Pipeline
```
NCERT scraper -> CurriculumChunk (pgvector RAG)
     |
HydrateAll trigger
     |
SyllabusWorker (Level 0) -> ChapterDef + TopicDef
     | (reconciler, 5-min poll)
NotesWorker (Level 2) -> TopicNote per topic
     | (reconciler)
QuestionsWorker (Level 3) -> GeneratedQuestion (easy/medium/hard)
```

### 3. Diagnostic Engine
- Unlocks when TopicDef count > 0 for subject
- Forward-only MCQ flow (~20 questions)
- Results feed IRT calibration and LearningPlan

### 4. Recommendation Engine
- LearningPlan generated post-diagnostic
- Items ranked by: board weight x mastery gap
- Spaced repetition (SM-18) for revision

### 5. Email System
- Provider: Resend
- From: Spinzy Academy <no-reply@send.spinzyacademy.com>
- Templates: lib/email/templates.ts
- Sender: lib/mailer.ts (sendMail / sendMailSafe)
- Triggers: welcome, parent OTP, weekly digest, distress alert

### 6. Admin Panel
11 sections: Dashboard | Coverage & Hydrate | Content Review |
Jobs | Students | Parents | Learning Analytics | Costs & Usage |
System Health | Safety & Alerts | Notifications

## Data Model (key relationships)
```
Board -> ClassLevel -> SubjectDef
SubjectDef -> ChapterDef -> TopicDef -> TopicNote -> GeneratedQuestion
User (student) -> DiagnosticSession -> LearningPlan -> LearningPlanItem
User -> StructuredSession -> AITutorTurnLog
User -> StudentTopicProgress
ParentStudent -> User (parent) + User (student)
HydrationJob (hierarchyLevel 0/2/3) -> cascade via reconciler
```

## Key Schema Rules
- SubjectDef FK: `classId` (NOT classLevelId)
- SubjectDef relation: `class` (NOT classLevel)
- User.role for students: `'user'` (NOT 'student')
- User.grade: String (parse with parseInt before comparisons)
- User.subjects: String[] lowercase slugs e.g. {mathematics,science}
- ALWAYS filter SubjectDef by class.grade + board.slug
- NEVER query SubjectDef by slug alone (returns Grade 1 row first)
- HydrationJob levels: 0=root, 2=notes, 3=questions

## Key Principles
1. Curriculum-first -- NCERT is ground truth, GPT fills gaps only
2. Deterministic UX -- no streaming surprises, predictable state
3. Never show numeric scores -- mastery shown as rings/bars only
4. DPDP compliance -- age < 13 requires parent verification
5. Fire-and-forget emails -- sendMailSafe never crashes workers
6. Idempotent seeds -- seed-taxonomy.cjs uses upsert, safe to re-run
7. Pre-commit mandatory -- smart quotes fix + tsc + build before commit
