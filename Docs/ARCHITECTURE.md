# Spinzy Academy — System Architecture

This document provides a high-level overview of the Spinzy Academy platform architecture, including the AI content generation engine, core modules, and data flow.

## 1. System Overview

- **Frontend**: Next.js app in `app/`
- **Backend APIs**: RESTful endpoints in `app/api/`
- **AI Content Engine**: Modular, batch-driven, and versioned
- **Database**: PostgreSQL via Prisma ORM
- **Queues/Workers**: BullMQ for background jobs

## 2. Canonical Folder Structure

```
/prisma
  └─ schema.prisma
/app
  ├─ lib/
  ├─ queues/
  ├─ workers/
  ├─ hydraters/
  ├─ producers/
  ├─ scripts/
  ├─ api/
  ├─ admin/
  └─ ...
```

## 3. Data Flow & Content Generation

- All AI content generation goes through `lib/callLLM.ts` (single source of truth)
- Content is always versioned, starts as draft, and requires admin approval
- Rollbacks are row-level and non-destructive
- Personalization is layered, never mutates core curriculum

## 4. Key Integration Points

- OpenAI API (via `callLLM.ts`)
- BullMQ (queues/workers)
- Prisma/Postgres (data models)

## 5. Reference
- See `copilot-instructions.md` for AI agent rules
- See `WORKFLOWS.md` for developer workflows
- See `prisma/schema.prisma` for data models
