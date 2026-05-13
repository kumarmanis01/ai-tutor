<!--
FILE OBJECTIVE:
- Document the shared question display flow, the single question source, and the moderation path used by practice, homework, and test screens.

LINKED UNIT TEST:
- tests/unit/app/api/student/question/[questionId]/flag/route.spec.ts

COPILOT INSTRUCTIONS FOLLOWED:
- /docs/COPILOT_GUARDRAILS.md
- /docs/ENGINEERING_PRACTICES.md
- .github/copilot-instructions.md

EDIT LOG:
- 2026-05-13T00:00:00Z | copilot | document the unified question shell and flag-driven moderation flow
-->

# Question Display Readme

## Purpose

All student-facing question surfaces now render from a single shared control surface so practice, homework, and test behavior stay consistent. The shared shell owns the prompt, answer input, feedback, and flagging UI, while the content source is resolved centrally before rendering.

## What Renders A Question

The current flow is:

1. Resolve the question content from the shared bank.
2. Pass the normalized question payload into `QuestionInteractionShell`.
3. Let the shell render choices, text input, feedback, and the flag dialog.
4. Submit flags to the moderation route for review.

This keeps the visible interaction model the same across practice, homework, and tests.

## Shared Interaction Shell

`QuestionInteractionShell` is the common component used by the student-facing question phases. It handles:

- Question text and supporting prompt
- Choice rendering or text input
- Graded feedback after submit
- Flagging with a modal dialog and reason mapping

Because the shell owns the interaction, new question UX changes only need to be made once.

## Flagging And Review

The flag dialog exposes the student reasons currently supported by the UI:

- Incorrect
- Duplicate within session
- Wrong answer

The selected reason is translated into moderation metadata before it is stored. When a question is flagged:

- An active question moves into `PENDING_REVIEW` immediately.
- A question already under review can be escalated to `QUARANTINED` after the configured threshold.
- Admin reviewers see the latest flag reason and optional notes in the review queue.

## Admin Review Queue

The admin queue defaults to the moderation states that need attention:

- `PENDING_REVIEW`
- `QUARANTINED`

Admins can approve or reject the question directly from the queue. The moderation action records the previous and next status so the audit trail stays clear.

## Current Result

The display flow is now consistent across the three student-facing screens, and the moderation flow no longer waits for repeated flags before a question enters review. That means a flagged question can be removed from normal delivery quickly while admin review is pending.