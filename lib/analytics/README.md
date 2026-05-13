<!--
FILE OBJECTIVE:
- Documentation for the analytics event registry and the process to add a new analytics event safely.

LINKED UNIT TEST:
- tests/unit/lib/analytics/events.test.ts

COPILOT INSTRUCTIONS FOLLOWED:
- /docs/ENGINEERING_PRACTICES.md
- .github/copilot-instructions.md

EDIT LOG:
- 2026-05-12T00:00:00Z | copilot | document analytics event registry usage and new event workflow
-->

# Analytics Event Registry

This folder contains the canonical analytics event constants used across student, parent, and admin flows.

## Source Of Truth

- `lib/analytics/events.ts`

Do not hardcode event strings in components, API routes, workers, or jobs.
Always import from `ANALYTICS_EVENTS`.

## Event Groups

- Student events: `ANALYTICS_EVENTS.STUDENT.*`
- Parent events: `ANALYTICS_EVENTS.PARENT.*`
- Admin events: `ANALYTICS_EVENTS.ADMIN.*`

## How To Add A New Analytics Event

1. Add the event constant in the correct group in `lib/analytics/events.ts`.
2. Add a short comment in code where it is emitted if context is not obvious.
3. If the event can be emitted by client code, ensure the ingestion allowlist includes it:
   - `app/api/analytics/event/route.ts`
4. Emit the event from the relevant call site by importing `ANALYTICS_EVENTS`.
5. Add or update tests:
   - `tests/unit/lib/analytics/events.test.ts`
   - Any route/component test that validates emission/allowlist behavior.
6. If this event is used in aggregation, update the worker logic:
   - `worker/services/analyticsAggregator.ts`

## Rules

- Keep names stable once released.
- Prefer `domain.entity.action` style names.
- Never log PII in analytics metadata.
- Keep server-only events out of client allowlist endpoints.
