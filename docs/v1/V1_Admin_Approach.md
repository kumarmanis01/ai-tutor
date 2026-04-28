AI HOME TUTOR PLATFORM
Admin Actor
Approach Document — Current Implementation (v1 Snapshot)

Actor: Admin  
Document Version: 1.0-v1-snapshot  
Scope: Platform operations, content ops, and AI quality management as they exist today  
Stack: Node.js + TS + Prisma + Neon + BullMQ + Redis, admin via Prisma Studio / SQL / CLI

---

1. Overview

In v1, the Admin role is heavily shaped by the **AI Content Engine** architecture:

- Content hydration pipelines driven by BullMQ workers.
- `AIContentLog`, `HydrationJob`, `ExecutionJob`, and related schemas for AI workloads.
- Multiple internal architecture docs under `Docs/AI_*` guiding execution and guardrails.

Admin operations are performed primarily via:

- Prisma Studio and Neon SQL console.
- Command-line scripts and worker tools (e.g. ingestion, requeueing jobs).

There is **no dedicated admin UI** beyond the generic DB tools, which is aligned with the v2 MVP principle of deferring internal tooling until scale requires it.

---

1.1 Admin Roles (v1 reality)

| Role                          | Responsibilities                                                             | Access Level                                         |
| ----------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------- |
| Founder / Product Admin       | Business metrics, subscription and growth decisions, user escalations        | Full DB + infra access (informal)                    |
| Content / Tech Admin          | Curriculum ingestion, question bank and notes generation, monitoring AI logs | Access to content / jobs / AI logs schemas           |
| AI Quality Analyst (implicit) | Inspect AI outputs via AIContentLog and tests, debug failures                | Read-only over AI logs, some job control via scripts |

---

2. Content Operations (v1)

F-ADM-V1-001 — AI Content Engine & Hydration

- Key schemas:
  - `HydrationJob`, `ExecutionJob`, `AIContentLog`, `GeneratedTest`, `GeneratedQuestion`, `TopicDef`, `ChapterDef` etc.
- Key components:
  - `worker/bootstrap.ts` and `worker/processors/contentWorker.ts` start BullMQ workers for content hydration and test assembly.
  - Outbox pattern and queues (`CONTENT_HYDRATION_QUEUE`, etc.) for reliable delivery.
  - `lib/callLLM.ts` as a central gateway to LLMs with cost logging and retries.

Principles (implemented in v1):

- **APIs/UI never call LLMs directly** — all AI execution happens in workers.
- Every LLM call is logged to `AIContentLog` with model, promptType, cost, and contextual metadata.
- Jobs have statuses, retries, and dead-letter handling (`OutboxDeadLetter`).

Status: **Implemented** (mature for content generation use cases).

---

3. Taxonomy & Curriculum (v1)

F-ADM-V1-002 — Curriculum Hierarchy & Ingestion

- Hierarchical schema exists:
  - Boards → ClassLevels → SubjectDef → ChapterDef → TopicDef (per AI Content Engine docs).
- Ingestion pipeline:
  - CLI/worker jobs ingest PDFs, chunk them, tag with board/subject/chapter/topic, and generate embeddings into pgvector.
- Preconditions:
  - Concepts and taxonomy are seeded via SQL / migration scripts before ingestion.

Status: **Implemented (partial)** — structure is present and actively used; some v2-specific fields (e.g. irt_b per concept, full prerequisite/related links) may be missing or incomplete.

---

4. Question Bank & Tests (v1)

F-ADM-V1-003 — Question Bank Management

- AI-generated questions and tests:
  - `GeneratedTest` / `GeneratedQuestion` tables hold generated questions for topics/chapters.
  - Questions include structured fields (stem, answer, options, etc.) according to schema.
- Quality gates:
  - Schema validation and some basic checks occur at generation time.
  - AIContentLog can be queried to inspect problematic generations.
- Quarantine:
  - The explicit “3 flags → QUARANTINED” rule from v2 is not fully implemented end-to-end, but the schema and worker patterns could support it.

Status: **Implemented (partial)** — strong content engine, but not all v2 admin workflows (flagging, health reports) are wired.

---

5. AI Quality & Safety Monitoring (v1)

F-ADM-V1-010 — AI Quality & Sampling

- AI content quality:
  - Admins can query `AIContentLog` by promptType/model/subject to review generations.
  - There are internal docs specifying guardrails for content quality and moderation.
- Tutor quality:
  - Tutoring session transcripts are not yet captured into a unified `session_turns` schema suitable for daily random sampling.
  - Quality review for tutoring is ad-hoc (looking at specific issues), not systematic sampling.

Status: **Implemented (for content)**, **not implemented (for tutoring flow)**.

---

6. LLM Cost & System Observability (v1)

F-ADM-V1-012 — LLM Cost Monitoring

- `AIContentLog` records:
  - Model, tokens in/out, costUsd, promptType, context fields.
- `SystemMetricSample` and related telemetry tables track:
  - Worker health, queue depth, error counts, and other system stats.
- Reporting:
  - Admins can run queries to see daily costs, per-model usage, and job stats.
  - Alerting is mostly manual (via queries and dashboards), not automated notifications.

Status: **Implemented (partial)** — strong logging; automated anomaly detection/alerts are not fully realised.

---

7. Safety & Hallucination Handling (v1)

F-ADM-V1-013 — Safety & Hallucination Review

- Safety-focused measures:
  - Input profanity guards for student chat (`checkProfanity`).
  - Off-topic handling in prompt builders for some AI flows.
- Hallucination and safety events:
  - No dedicated `safety_event` table or low-groundedness event logging as described in v2.
  - Safety/hallucination review is performed by spot-checking outputs or user feedback, not via a dedicated pipeline.

Status: **Implemented at a basic level**; v2’s explicit safety event pipeline is not present.
