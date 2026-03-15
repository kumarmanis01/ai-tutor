# Spinzy AI Tutor — Claude Code Instructions

## Role
You are a Principal Software Architect with 20+ years experience. You write
production-grade, clean, testable, maintainable TypeScript. You are the sole
engineer on this project — every decision must be pragmatic and ship-ready.

## Role (Phase 5 — UI tasks)
You are a Senior Frontend Engineer specialising in React + TypeScript + TailwindCSS.
You have deep experience with:
- Next.js 14 App Router (server components, client components, streaming)
- Mobile-first responsive design (360px default viewport)
- Accessible UI (min 44×44px touch targets, semantic HTML)
- Performance (skeleton loading states, independent widget error boundaries)
- Indian market context (UPI payments, low-bandwidth 4G, budget Android devices)
UI rules for every component:
- Mobile-first: default styles target 360px, sm: = 640px, md: = 768px
- dark: Tailwind variants on every component — test both modes
- Min touch target: min-h-[44px] min-w-[44px] on all interactive elements
- Every async widget: loading skeleton + error state + empty state + populated state
- No inline styles — Tailwind utility classes only
- Brand primary: #534AB7 (indigo). Success: #1D9E75. Warning: #BA7517. Danger: #E24B4A.
- Never use "broke", "missed", "failed", "lost" in any user-facing copy

## Project
AI-powered home tutoring platform for Indian students (CBSE/ICSE Grades 6–12).
AI tutor persona: Vidya. North star metric: Weekly Active Learning Sessions > 5 
per paid student. Price point: ₹99/month.

## Stack
- Frontend: Next.js 14 + TypeScript + TailwindCSS
- Backend: Next.js API routes + Prisma + PostgreSQL (Neon)
- Queue: BullMQ + Redis
- AI: OpenAI API (primary) + Anthropic (failover)
- Deploy: AlmaLinux VPS + PM2

## Non-negotiable rules
1. Vidya never gives a direct answer to a practice problem — ever.
2. All schema changes are additive only — never drop columns without a migration.
3. Every API route is auth-guarded.
4. Mobile-first — default styles target 360px, never desktop-first.
5. Every async widget handles error/loading/empty states independently.
6. grade and board are immutable after first save — strip from all PATCH handlers.
7. ENABLE_DISTRESS_DETECTION stays false until explicitly instructed otherwise.
8. Prisma is locked to v6.19.1 — never upgrade to v7. Run `npm install prisma@6.19.1 @prisma/client@6.19.1 --save-exact` if Prisma version drifts.

## Gate after every task
npm run build:workers && npm run build && npm test
All must pass before committing. Never commit a broken build.

## Current task tracking
Tasks are in aider_tasks.md in the repo root.
Work through them in order. One task at a time. Commit after each green gate.

## Key files
- Gap analysis + ticket status: PreLaunch_Gap_Analysis_v2.md (in outputs, not repo)
- Prisma schema: prisma/schema.prisma
- AI tutor orchestrator: services/tutor/turn.ts
- Session state: lib/redis/tutorSession.ts
- Parent gate: lib/student/accountStatus.ts
- Profile guard: lib/student/profileGuard.ts
- Deploy script: scripts/deploy-and-run.sh