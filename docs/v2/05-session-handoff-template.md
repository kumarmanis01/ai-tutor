# Spinzy Academy — Session Handoff Template

**Last updated: 2026-03-23**

Copy this template at the start of every new Claude session to give the model full context.
Fill in every section — blank sections will cause the model to ask clarifying questions.

---

```markdown
# Spinzy Academy — Session Handoff
# Date: YYYY-MM-DD

## Project Identity

- Product: Spinzy Academy — AI home tutor "Vidya" for Indian K-12 students
- Domain: https://spinzyacademy.com
- Stack: Next.js 16 (App Router) + TypeScript + TailwindCSS + Prisma 6.19.1 + PostgreSQL (Neon) + BullMQ + Redis
- VPS: AlmaLinux, path /home/gnosiva/apps/content-engine/ai-tutor/
- PM2: 3 processes — ai-tutor-web, content-engine-worker, ai-tutor-scheduler
- Deploy: ./scripts/deploy-and-run.sh
- Docs: docs/v2/ (architecture, data model, content pipeline)
- Task list: aider_tasks.md (work through in strict order, one task at a time)

Key rules:
- Vidya NEVER gives a direct answer to a practice problem. Guiding questions only.
- Prisma is locked to v6.19.1. Never upgrade.
- grade and board are immutable after first save. Strip from every PATCH handler.
- ENABLE_DISTRESS_DETECTION stays false until on-call process defined.
- NEXT_PUBLIC_CONSENT_LIVE stays false until lawyer approves.
- Gate between every task: npm run build:workers && npm run build && npm test

## Current Branch

[branch name, e.g. claude/feature-name-XXXXX]

## What Was Done This Session

- [commit hash] message
- [commit hash] message
- [commit hash] message

## Pending — Next Session Priority Order

| # | Task | File/Location | Blocked by |
|---|------|---------------|------------|
| 1 | [task description] | [file path] | — |
| 2 | [task description] | [file path] | #1 |

## Known Bugs

| # | Bug | File | Priority |
|---|-----|------|----------|
| 1 | [description] | [file:line] | P0/P1/P2 |

## Production State

- PM2 status: [all online / which process is down]
- Last deploy: [YYYY-MM-DD]
- Last migration: [migration name] (migration #N)
- Pending migration: [migration name, if any] — run: npx prisma migrate deploy
- Content hydrated: [e.g. CBSE Grade 10 Science + Maths seeded, others pending]
- Active users: [count or "none yet"]
- Neon DB: [project name / connection string host]

## Feature Flags (current VPS values)

ROLLOUT_PERCENTAGE=
ENABLE_AI_TUTOR=
ENABLE_SESSION_ENGINE=
ENABLE_DISTRESS_DETECTION=       # must stay false
NEXT_PUBLIC_CONSENT_LIVE=        # must stay false
LLM_MODE=
LLM_SAFE_MODE=

## Content Pipeline State

- Taxonomy seeded: [yes/no — node scripts/seed-taxonomy.cjs]
- NCERT RAG corpus: [which grade/subjects ingested, or "none"]
- HydrationJobs last run: [date + which subjects]
- TopicDef count (CBSE Gr10 Science): [number or "unknown"]
- TopicDef count (CBSE Gr10 Maths): [number or "unknown"]

## Test State

- Total tests passing: [e.g. 1208]
- Known pre-existing failures: [e.g. 4 tests in prom-client/bintrees (unrelated to our code)]
- npm run build: [passing / failing — Bus error on this VPS is pre-existing platform issue]

## Open Questions / Decisions Needed

1. [question]
2. [question]
```

---

## How to Use This Template

1. At the **end** of every session, fill in this template and save it as a comment in the final commit message, or paste it as the first message of the next Claude conversation.

2. At the **start** of every session, paste the filled template as your first message. Do not ask Claude to read CLAUDE.md separately — this template contains the essential context.

3. The **Pending tasks table** must be in priority order. Claude works on task #1 first and does not jump to #2 without explicit instruction.

4. The **Known Bugs table** distinguishes bugs from tasks. Bugs are unexpected regressions; tasks are planned work.

5. **Never omit the Feature Flags section.** Claude must know the current rollout state before making any changes to gated code paths.

---

## Example Filled Handoff

```markdown
# Spinzy Academy — Session Handoff
# Date: 2026-03-23

## Project Identity
[standard block as above]

## Current Branch
claude/audit-hydrate-all-pipeline-R14hP

## What Was Done This Session
- d55bbc5 refactor: schema audit — drop 14 dead models, add DiagnosticSession, add 3 indexes, fix ghost refs
- 39c31c8 fix: make name and age optional in onboarding API
- f5f2eaa fix: complete env var coverage in ecosystem.config.cjs + deploy guard + dotenv in seed

## Pending — Next Session Priority Order
| # | Task | File/Location | Blocked by |
|---|------|---------------|------------|
| 1 | Run schema migration on VPS | npx prisma migrate dev --name schema_audit_cleanup | Deploy access |
| 2 | Task 23: SubjectReadinessCard V2 | components/student/dashboard/SubjectReadinessCard.tsx | — |

## Known Bugs
| # | Bug | File | Priority |
|---|-----|------|----------|
| 1 | Bus error on next build (pre-existing platform issue) | VPS only | P2 |

## Production State
- PM2 status: all 3 online, restart count 0
- Last deploy: 2026-03-15
- Last migration: 20260315_add_diagnostic_session (migration #24)
- Pending migration: schema_audit_cleanup — run on VPS after this branch merges
- Content hydrated: none (fresh DB, taxonomy seeded only)
- Active users: 0

## Feature Flags (current VPS values)
ROLLOUT_PERCENTAGE=5
ENABLE_AI_TUTOR=true
ENABLE_SESSION_ENGINE=false
ENABLE_DISTRESS_DETECTION=false
NEXT_PUBLIC_CONSENT_LIVE=false
LLM_MODE=real
LLM_SAFE_MODE=true

## Content Pipeline State
- Taxonomy seeded: yes (seed-taxonomy.cjs run)
- NCERT RAG corpus: none
- HydrationJobs last run: never
- TopicDef count (CBSE Gr10 Science): 0 (not hydrated)
- TopicDef count (CBSE Gr10 Maths): 0 (not hydrated)

## Test State
- Total tests passing: 1208
- Known pre-existing failures: 4 tests in prom-client/bintrees (bintrees CJS issue, unrelated)
- npm run build: workers pass, next build Bus error (pre-existing VPS platform issue)

## Open Questions / Decisions Needed
1. Should we seed ICSE alongside CBSE in the first hydration run, or CBSE-only for MVP?
```
