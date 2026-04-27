AI HOME TUTOR PLATFORM
AI Tutor / Content Engine (v1)
Approach Document — Current Implementation

Actor: AI Tutor / Content Engine (v1)  
Document Version: 1.0-v1-snapshot  
Scope: How AI is actually used today to generate, explain, and guide  
Stack: AI Content Engine with OpenAI models, BullMQ workers, Redis, Prisma, Next.js API routes

---

1. Overview

In v1, the “AI Tutor” is primarily:
- An **AI Content Engine** (notes, practice questions, tests) with strict worker isolation.
- A **Q&A/chat tutor** exposed via `/api/chat` with subject-specific prompts.
- A newer **structured session shell** that consumes AI-generated content and explanations, but does not yet implement the full v2 7-stage pedagogical engine or per-concept knowledge graph updates.

Design mandate (v1, from internal docs):
- Separate AI content generation from the student-facing APIs.
- Keep LLM calls auditable (`AIContentLog`) and idempotent where possible.
- Use workers + queues as the only place where LLMs are invoked.

---

1.1 Subsystem Map (v1 reality)

Subsystem | Code | Responsibility | Status
--------- | ---- | -------------- | ------
Content Engine | `worker/*`, `lib/ai/prompts/*` | Notes, practice, and test generation | Implemented
AI Tutor Chat | `/api/chat`, `lib/subjectEngines` | Subject chat Q&A tutor with language handling | Implemented
Diagnostic Engine | `services/diagnostic/engine.ts` | Adaptive baseline diagnostic flow | Implemented
Recommendation Engine | `lib/homeEngine/getNextAction.ts` | Deterministic “what to do now” home logic | Implemented
Teaching Engine | (none dedicated) | Tutor behaviour embedded in prompts; no standalone engine | Not implemented as separate module
Knowledge Graph | `StudentTopicProgress`, `StudentTopicMastery` | Per-topic mastery & progress proxies | Implemented (topic-level), not full concept KG
Session State Machine | `StructuredSession` + `SessionPhase` | 5-phase session shell (overview/explanation/practice/test/homework) | Implemented
LLM Router | `lib/callLLM.ts` | Model selection, retries, cost logging, env controls | Implemented
Prompt Assembly | `lib/ai/prompts/promptBuilder.ts` | Schema-based prompts for notes/practice/doubts | Implemented
Safety Layer | `checkProfanity`, off-topic checks in prompts | Basic input guardrails | Implemented in limited form

---

2. Teaching Behaviour (v1)

F-AI-V1-010 — Tutor Behaviour

Characteristics:
- In v1, *teaching behaviour* is largely encoded in:
  - Subject-specific system prompts (e.g., “You are a helpful [subject] tutor…”).
  - Content prompts for notes/practice/doubts with schemas and examples.
- There is no engine enforcing:
  - Exactly one question per response turn.
  - “Never directly answer practice problems” as a hard contract.
  - Explicit “I don’t know” handling paths or prerequisite-remediation flows.

Implications:
- The AI behaves like an enhanced subject tutor/chatbot, not a strict pedagogical state machine.
- It can guide and explain, but does not consistently adhere to the v2 Socratic and no-direct-answer rules.

Status: **Tutor-like behaviour exists via prompts; not formalised or enforced by a dedicated engine.**

---

3. Diagnostics & Assessment (v1)

F-AI-V1-020 — Diagnostic & Assessment Integration

- Diagnostic engine:
  - `DiagnosticEngine` manages adaptive difficulty (simple difficulty bands) and tracks per-skill and per-topic scores.
  - Uses an in-memory session state per diagnostic; not integrated with a persistent 3PL IRT theta model.
- Assessment:
  - AI Content Engine generates practice questions and tests (per-topic/chapters).
  - `TestResult` and related models store scores and raw results.
  - Topic-level mastery and progress tables are updated based on results.

Key gaps vs v2:
- No 3-parameter IRT calibration or theta-based question selection.
- No formal mapping from diagnostics/tests into a Bayesian knowledge graph with variance.

Status: **Diagnostics and assessment flows exist and are functional, but use heuristic models instead of full v2 IRT/KG.**

---

4. Knowledge & Progress Modelling (v1)

F-AI-V1-030 — Knowledge Representation

- v1 models progress at the **topic** level:
  - `StudentTopicMastery`: coarse mastery levels and accuracy per topic.
  - `StudentTopicProgress`: mastery floats, practice counts, lastStudiedAt per topic.
- There is **no**:
  - Per-concept StudentConceptState table with mastery mean + variance + theta.
  - Explicit prerequisite graph driving unlocks and remedial flows.
  - Stability/retention fields for SM-18-style spaced repetition.

Status: **Topic-based progression models are implemented; concept-level Bayesian KG is not.**

---

5. Prompt & Execution Pipeline (v1)

F-AI-V1-040 — Prompt Assembly & Execution

- Prompt builder:
  - `lib/ai/prompts/promptBuilder.ts` composes:
    - Global/system prompts,
    - Notes/practice/doubts-specific prompts,
    - Validation schemas for JSON outputs.
- Execution:
  - `callLLM` is the only gateway for calling LLMs.
  - It implements:
    - Model routing based on promptType,
    - Retries for transient errors,
    - Cost and latency logging to `AIContentLog`.
- Worker enforcement:
  - AI calls are executed from worker processes only (never from API routes directly), following AI Content Engine guardrails.

Status: **Implemented and mature for content generation; the same infrastructure can be reused for a v2 AI Tutor engine.**

---

6. Safety & Guardrails (v1)

F-AI-V1-050 — Safety Layer (Basic)

- Current guardrails:
  - Profanity filtering for student chat (`checkProfanity`).
  - Simple off-topic detection/redirection in doubts prompts.
  - AI Content Engine rules for acceptable content (from internal docs).
- Missing relative to v2:
  - Dedicated safety event logging table (with trigger_type, session_id, offending_turn_id).
  - Automated hallucination/low-groundedness detection and review flows.
  - Emotional distress or jailbreak detection.

Status: **Basic safety measures are present; v2-spec safety/event plumbing is not yet implemented.**

