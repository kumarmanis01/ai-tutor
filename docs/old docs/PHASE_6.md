# Phase 6 — AI Syllabus & Curriculum Engine

## 1️⃣ Phase 6 Design Document

Purpose: Build the AI Syllabus Engine — the brain that converts a learning intent into a structured, reviewable, versioned syllabus.

What Phase 6 builds
- A deterministic syllabus generator that turns high-level inputs into a structured JSON syllabus.
- Human-reviewable and versioned artifacts that are safe to approve before content generation.

This phase answers: “What should the learner learn, in what order, and to what depth?” — it maps the curriculum, it does not create lesson content.

### Why Phase 6 exists
Most AI content systems fail because they:

- Jump directly to content generation
- Produce verbose but unstructured lessons
- Cannot guarantee coverage, progression, or outcomes

Phase 6 introduces:

- Deterministic structure
- Pedagogical sequencing
- Human-reviewable outputs
- AI controllability

### What Phase 6 deliberately excludes

- Video generation
- Slides
- Quizzes (detailed assessments)
- Infra scaling / production Kubernetes
- LMS integrations

Those belong to later phases (7–9).

### Core goals of Phase 6

Goal — Meaning
- **Structured output:** JSON syllabus, not prose
- **Deterministic:** Same input → similar structure
- **Reviewable:** Humans can approve / edit
- **Versioned:** Syllabus is immutable once approved
- **AI-agnostic:** Works with GPT, Claude, etc.

## 2️⃣ Phase 6 Inputs → Outputs

Inputs
- Course title
- Target audience
- Skill level
- Time budget
- Teaching style
- Constraints (exam-focused, project-based, practical, etc.)

Outputs
- Course syllabus JSON
- Modules
- Lessons
- Learning objectives per lesson
- Prerequisites
- Estimated effort per lesson/module
- Assessment hooks (placeholders)

## 3️⃣ Outcomes at end of Phase 6

By the end of Phase 6 you will have:

- ✅ A formal syllabus schema (JSON schema)
- ✅ A syllabus generator prompt contract (clear inputs/outputs)
- ✅ An approved syllabus artifact (versioned)
- ✅ Confidence that content generation (Phase 7) will not drift or omit scope

Only after these outcomes are satisfied do we move to Phase 7.

## 4️⃣ Implementation Notes (practical)

- **Schema:** Define a JSON Schema for `Syllabus` with `modules[]`, `lessons[]`, `objectives[]`, `prerequisites`, `estimates`, and `metadata` (version, createdBy, createdAt).
- **Prompt contract:** Single canonical prompt template for syllabus generation. Include explicit instructions about output structure, length limits, and failure modes.
- **Determinism:** Use sampling temperature low (0.0–0.3) and a deterministic post-processor that validates/normalizes the AI output against the JSON Schema.
- **Review flow:** Produce a `draft` artifact stored in DB (or filesystem) with a review URL and version id. After approval, mark `approved` and make the syllabus immutable.
- **Tests:** Unit tests for the prompt→schema validation; integration tests that run a dry-run with a fixed seed or deterministic mock LLM.

## 5️⃣ Developer Tasks (milestones)

1. Define `Syllabus` JSON Schema and store it at `schemas/syllabus.schema.json`.
2. Add `lib/syllabusGenerator.ts` with a function `generateSyllabus(input): Promise<SyllabusDraft>` that calls the LLM and validates output.
3. Add prompt templates under `prompts/syllabus/` with examples.
4. Add integration tests in `tests/phase6/` using a deterministic LLM mock.
5. Add a minimal UI or CLI to view and approve a draft syllabus (can be simple JSON viewer).

## 6️⃣ Running & Validation (local-first)

- Keep the infra frozen: do not unblock on EKS. Use Docker Compose or local processes to run services.
- CI should run `npm test`, `helm lint`, and `helm template` to validate packaging.
- To validate prompts without external LLM costs, provide a `mock-llm` mode that returns deterministic canned responses.

## 7️⃣ Acceptance Criteria

The Phase 6 deliverable is accepted when:

1. There is a valid `Syllabus` JSON Schema.
2. The `generateSyllabus()` function produces schema-compliant drafts for a variety of inputs (unit tests pass).
3. A human reviewer can inspect and approve a syllabus draft via CLI or UI.
4. The approved syllabus is stored with an immutable version id and metadata.

## 8️⃣ Next Steps (Phase 7 preview)

- After approval of the syllabus, Phase 7 will generate lesson content and assessments according to the approved syllabus.
- Phase 7 will also add content moderation, richer prompt chains, and content chunking for downstream features.

---

Place this file at `docs/PHASE_6.md` and use it as the north star for team work on the Syllabus Engine.
