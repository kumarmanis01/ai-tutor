<!-- AI CONTENT ENGINE — FULL PHASE MAP
## Phase-wise Delivery Milestones

Foundation (Phases 0–5) → Reliability, observability, alerting, automation  
Value Creation (Phases 6–9) → Syllabus, lessons, AI-generated content, publishing

---

### Phase 0 — Principles & Constraints (Milestone)
Goal: Establish non‑negotiable engineering constraints.
Deliverables:
- Principles doc (deterministic, observable, idempotent, human-override)
- Telemetry & alert philosophy
- Retry/dedupe/rate-limit rules
Artifacts:
- principles.md, telemetry-standards.md
Success criteria:
- Team alignment on safety & cost constraints

---

### Phase 1 — Content Domain & Identity (Milestone)
Goal: Define the content surface and persona.
Deliverables:
- Domain taxonomy
- Persona + tone guide
- Learner profiles & levels
Artifacts:
- domain.json, persona.md, learner_levels.ts
Success criteria:
- Clear, versioned contract for generated content

---

### Phase 2 — Knowledge Graph & Concept Model (Milestone)
Goal: Represent subject matter as a navigable graph.
Deliverables:
- Concept model (concept, dependency, objective, assessment signals)
- DB/graph schema + example data
Artifacts:
- concept table, prerequisite table, learning_objectives
Success criteria:
- Topology supports prerequisite queries & curriculum planning

---

### Phase 3 — Syllabus Generation Engine (Milestone)
Goal: Produce deterministic syllabi per user/cohort.
Deliverables:
- Syllabus schema (Course → Module → Lesson → Objectives)
- Generation engine (topological sort, pacing rules, milestones)
- Validation rules (no orphans, prerequisite checks)
Artifacts:
- syllabus JSON output, admin UI scaffolding
Success criteria:
- Able to generate a validated syllabus from graph + user inputs

---

### Phase 4 — Content Generation Engine (Milestone)
Goal: Generate structured lesson artifacts from syllabus.
Deliverables:
- Prompt templates & rubrics per lesson type
- Job types for Lesson, Example, Exercise, Quiz
- Versioned content model (soft deletes, approval required)
Artifacts:
- Lesson object shape, generation job specs
Success criteria:
- Repeatable, reviewable content outputs matching syllabus contracts

---

### Phase 5 — Observability, Safety & Alerting (Milestone) — CURRENT
Goal: Make the engine safe, observable and ops-ready.
Deliverables:
- Telemetry samplers & time-bucketed metrics
- System metrics UI and TelemetrySample table
- Watchdogs (read-only) and formal AlertRules
- AlertRouter with Slack/Email/Webhook sinks, dedupe & rate-limit
- CI tests, dry-run evaluators, advisory lock usage
Artifacts:
- Alert rules, Runbooks, Docker/Helm deploy config
Success criteria:
- Automated detection + notification, tested dry-run, deployable ops artifacts

---

### Phase 6 — Learner Interaction Loop / AI Syllabus Engine (Milestone)
Goal: Turn syllabus into learner-facing assignments and signals.
Deliverables:
- Learner telemetry schema (completion, time, accuracy)
- Interaction events and storage
- Syllabus UI for admins (create/edit, metadata for prompts)
Artifacts:
- learning.event.* metrics, syllabus admin pages
Success criteria:
- Structured telemetry feeds usable for adaptation logic

---

### Phase 7 — AI Content Generation (Milestone)
Goal: Scale AI jobs to generate full lesson suites with review.
Deliverables:
- Job orchestration (ExecutionJob enums, atomic locks)
- AI job implementations (lesson, examples, assessments) with audit logs
- Human review workflow & approval gating
Artifacts:
- AIContentLog, versioned content, review UI
Success criteria:
- End-to-end generation + review without direct LLM calls from UI/API

---

### Phase 8 — Review, Feedback & Iteration (Milestone)
Goal: Close quality loop to improve content over time.
Deliverables:
- Feedback capture (ratings, confusion markers, re-reads)
- Content scoring & reranking
- Regeneration triggers & templates improvement pipeline
Artifacts:
- Content scoring system, feedback dashboards
Success criteria:
- Measurable improvement cycle tied to content versions

---

### Phase 9 — Distribution Engine (Milestone)
Goal: Publish content to learners across channels.
Deliverables:
- Channel integrations (Web, Email drip, WhatsApp/Telegram, LMS)
- Export formats (HTML, PDF, LMS packages)
- Scheduling (timezone-aware) and rate-control
Artifacts:
- Distribution API, scheduler, channel connectors
Success criteria:
- Reliable delivery and analytics per channel

---

### Phase 10 — Monetization & Access Control (Milestone)
Goal: Enable sustainable access and product controls.
Deliverables:
- Billing models (subs, bundles, pay-per-assessment)
- Feature gating, premium flags, rate caps
Artifacts:
- Access control policies, billing integration
Success criteria:
- Enforced access tiers and safe rate limiting

---

### Phase 11 — Autonomous Optimization (Endgame Milestone)
Goal: Use telemetry & outcomes to optimize engine automatically.
Deliverables:
- Optimization pipelines (syllabi, prompts, pacing)
- Cost & outcome optimization loops
- Guarded autonomous actions with runbooks & human-in-loop gates
Artifacts:
- Autonomy playbooks, optimization metrics
Success criteria:
- Controlled, validated improvements driven by signals

---

Timeline & Priorities
- Immediate: Finish Phase 5 (ops readiness) and ship runbooks.
- Near-term (sprints 1–3): Phase 6 (syllabus), Phase 7 (safe content generation).
- Mid-term (sprints 4–6): Phases 8–9 (feedback + distribution).
- Long-term: Phases 10–11 (monetization + guarded autonomy).

Key engineering invariants (always):
- Job-based execution, enums for statuses, soft deletes only, audit logs for admin actions, no direct LLM calls from UI/API, immutable job records, dry-run support for alert rules.
### Phase 0 — Objectives, Outcomes & Success Criteria
- Objectives: Lock down engineering constraints (determinism, idempotency, human override), define telemetry & alerting philosophy, and codify retry/dedupe/rate-limit rules.
- Outcomes: Approved principles & runbooks, telemetry sampling spec, and documented retry/dedupe policy.
- Success criteria: Team sign-off on principles.md; telemetry targets & sampling validated in staging; automated alerts firing in dry-run tests.

### Phase 1 — Objectives, Outcomes & Success Criteria
- Objectives: Define the content domain, persona, and learner segmentation to drive prompt contracts and schemas.
- Outcomes: Versioned domain taxonomy, tone/persona guide, learner-level mapping and example mappings to content types.
- Success criteria: Contract tests that validate content generation inputs against domain.json; persona acceptance by product and content leads.

### Phase 2 — Objectives, Outcomes & Success Criteria
- Objectives: Model knowledge as a graph enabling prerequisite resolution and curriculum planning.
- Outcomes: Graph schema, example dataset, queries for dependency resolution and objective extraction.
- Success criteria: Topology queries return correct prerequisite chains; automated validation rejects orphaned concepts.

### Phase 3 — Objectives, Outcomes & Success Criteria
- Objectives: Build deterministic syllabus generator with pacing and validation rules.
- Outcomes: Syllabus schema, generator implementation, and validation suite (no orphans, prerequisite enforcement).
- Success criteria: Generated syllabi pass schema & prerequisite validators; reproducible outputs given same inputs and version.

### Phase 4 — Objectives, Outcomes & Success Criteria
- Objectives: Produce structured lesson artifacts via versioned, reviewable jobs and templates.
- Outcomes: Prompt templates & rubrics, job type definitions, content versioning and soft-delete model.
- Success criteria: Generation jobs produce schema-compliant lesson objects; all outputs are versioned and require approval before visibility.

### Phase 5 — Objectives, Outcomes & Success Criteria
- Objectives: Harden observability, safety controls, and ops tooling for production readiness.
- Outcomes: TelemetrySample table, AlertRules and AlertRouter, CI dry-run tests, and runbooks for incident response.
- Success criteria: Alerts trigger on simulated failures; runbooks validate remediation; CI dry-runs block unsafe changes.

### Phase 6 — Objectives, Outcomes & Success Criteria
- Objectives: Instrument learner interactions and expose admin controls for syllabus metadata and prompts.
- Outcomes: Interaction event schema, telemetry pipelines, and admin UIs for syllabus metadata.
- Success criteria: End-to-end telemetry flow from learner event to dashboard; admins can update syllabus metadata with audit logs.

### Phase 7 — Objectives, Outcomes & Success Criteria
- Objectives: Scale AI job orchestration with immutable ExecutionJob records, audit logs, and human review gating.
- Outcomes: ExecutionJob enums, worker orchestration patterns, AIContentLog per generation, and review workflows.
- Success criteria: No direct LLM calls from UI/API; every AI call generates AIContentLog; review gating prevents unapproved content publication.

### Phase 8 — Objectives, Outcomes & Success Criteria
- Objectives: Capture feedback, score content, and enable iterative template improvements.
- Outcomes: Feedback capture schema, content scoring pipeline, dashboards for quality signals, regeneration triggers.
- Success criteria: Feedback correlates to content versions; scoring drives prioritized regeneration candidates; measurable quality uplift in trials.

### Phase 9 — Objectives, Outcomes & Success Criteria
- Objectives: Deliver content reliably across channels with scheduling, rate-control and observability.
- Outcomes: Channel connectors, export formats, scheduler with timezone awareness and rate limits.
- Success criteria: Successful scheduled deliveries in multiple channels; delivery metrics and retries tracked with audit logs.

### Phase 10 — Objectives, Outcomes & Success Criteria
- Objectives: Implement access controls, billing models and enforce feature gating safely.
- Outcomes: Access policy engine, billing integration, premium flags and rate caps per tier.
- Success criteria: Access tiers enforced in APIs and UI; billing events reconciled; rate-limit violations produce observable alerts.

### Phase 11 — Objectives, Outcomes & Success Criteria
- Objectives: Build guarded optimization loops that use telemetry to improve syllabi, prompts and costs with human-in-loop controls.
- Outcomes: Optimization pipelines, autonomy playbooks, safe rollout & rollback procedures, metric-driven gates.
- Success criteria: Controlled experiments show cost/outcome improvements; automated actions have explicit human approval paths and runbook coverage.