<!--
FILE OBJECTIVE:
- Canonical engineering practices document for the Spinzy AI Tutor project.
  Covers code style, Prisma schema conventions, error handling, naming, commenting,
  and code-review expectations. This is the source of truth for all developers
  and AI pair programmers working on this codebase.

LINKED UNIT TEST:
- tests/unit/docs/engineering_practices.spec.ts

COPILOT INSTRUCTIONS FOLLOWED:
- /docs/COPILOT_GUARDRAILS.md
- .github/copilot-instructions.md

EDIT LOG:
- 2026-04-18T00:00:00Z | copilot | initial creation — Principal Staff Engineer baseline
- 2026-04-18T12:00:00Z | copilot | add §9 Production Readiness (lint, type-check, tests, coverage, CI gates); strengthen AI linkage preamble
-->

# Spinzy AI Tutor — Engineering Practices

> **This document is the source of truth for all code written in this project.**
> Every developer (human or AI pair programmer) MUST read and follow these practices
> before submitting code for review or pushing to any branch.
>
> Violations are code-review blockers, not suggestions.

> **For AI pair programmers (GitHub Copilot, Claude):**
> This file is explicitly referenced in both `.github/copilot-instructions.md` and `CLAUDE.md`
> as the primary source of truth. Before generating or modifying **any** code, load and apply
> the rules in this document. The file header template in §8 must appear in every file you touch,
> and `COPILOT INSTRUCTIONS FOLLOWED` must list `/docs/ENGINEERING_PRACTICES.md`.

---

## Table of Contents

1. [General Code Writing Practices](#1-general-code-writing-practices)
2. [Prisma Schema Practices](#2-prisma-schema-practices)
3. [Error Handling & Try-Catch Guidance](#3-error-handling--try-catch-guidance)
4. [Variables, Functions & File Organisation](#4-variables-functions--file-organisation)
5. [Naming Conventions](#5-naming-conventions)
6. [Comments in Code](#6-comments-in-code)
7. [Code Review Checklist](#7-code-review-checklist)
8. [File Header Template](#8-file-header-template)
9. [Production Readiness Gates](#9-production-readiness-gates)

---

## 1. General Code Writing Practices

### 1.1 TypeScript Strictness

- **Strict mode is non-negotiable.** `tsconfig.json` has `"strict": true`. Never disable it.
- No `any` unless absolutely unavoidable. Every `any` MUST have an inline comment explaining why it cannot be typed precisely.
- Prefer `unknown` over `any` for values whose shape is truly unknown; narrow with type guards before use.
- Never use `as SomeType` to silence a type error — fix the root cause.
- Use `satisfies` instead of `as` when you want to verify shape without widening the inferred type.

```ts
// BAD — silences a real type gap
const user = data as User;

// GOOD — narrow properly
if (!isUser(data)) throw new Error('Invalid user shape');
const user = data; // TypeScript now knows it is User
```

### 1.2 Immutability First

- Prefer `const` over `let`. Use `let` only when reassignment is genuinely required.
- Treat function arguments as read-only. Never mutate input parameters.
- Use `Readonly<T>` and `ReadonlyArray<T>` for data passed across module boundaries.

### 1.3 Pure Functions & Side-Effect Isolation

- Keep business logic in pure functions (no I/O, no DB, no Redis).
- Push side effects (DB writes, queue pushes, external calls) to the outermost layer — API route handlers, workers, or service entry points.
- A function that queries the DB AND transforms data is doing two jobs — split it.

### 1.4 Function Length

- **Maximum 60 lines per function.** If you are approaching this limit, extract a well-named helper.
- A function that requires a comment at the top describing its multiple phases should be split.

### 1.5 Module Imports

- No circular imports — ever. Use dependency inversion if you hit a circular dependency.
- No barrel files (`index.ts`) that re-export everything from a folder — they make tree-shaking and refactoring harder.
- Import order (enforced by ESLint): Node built-ins → third-party → `@/` path aliases → relative imports.
- Use `import type` for type-only imports to keep runtime bundles lean — except for Prisma enums (see §2.4).

### 1.6 Async Patterns

- Every `async` function must have explicit error handling (try/catch or `.catch()`). No silent promise rejections.
- Never `await` inside a loop when parallel execution is possible — use `Promise.all`.
- Always set a timeout on external calls (OpenAI, Redis, DB). Do not trust remote services to respond promptly.
- Return types of async functions must be explicitly declared: `async function foo(): Promise<Bar>`.

```ts
// BAD — sequential, slow, unhandled rejection possible
for (const id of ids) {
  const record = await db.topic.findUnique({ where: { id } });
  results.push(record);
}

// GOOD — parallel, explicit type
const results = await Promise.all(
  ids.map((id) => db.topic.findUnique({ where: { id }, select: { id: true, name: true } }))
);
```

### 1.7 No Console — Use the Logger

Never use `console.log`, `console.error`, `console.warn`, or any other `console.*` method in production code.
Use the structured logger exclusively:

```ts
import { logger } from '@/lib/logger';

logger.info('subscription.created', { userId, planId });
logger.warn('payment.retry', { orderId, attempt });
logger.error('openai.timeout', { error: err.message, userId });
```

Logger shape: `{ timestamp, level, event, context }` — the `event` is a `domain.action` dot-separated key; `context` is a plain object with all relevant, **non-PII** metadata.

### 1.8 Security Baselines (OWASP)

- Never trust client-sent `userId` — always use `session.user.id`.
- Validate all API inputs with Zod schemas before touching the database.
- Never include raw error messages or stack traces in API responses.
- Sanitize all output that may contain user-generated content before rendering.
- Rate-limit sensitive endpoints (OTP, payment, login) — use the shared rate-limiter middleware.
- Never log PII: names, phone numbers, email addresses, Aadhaar, payment card details.

---

## 2. Prisma Schema Practices

### 2.1 Schema Is Additive Only

- **Never drop a column** without an explicit, approved migration task.
- **Never rename a column** — create a new column, migrate data in a separate task, then remove the old column in a third task.
- `grade` and `board` on `User` are **immutable after first save**. Strip them from every PATCH handler unconditionally.

### 2.2 Model Naming

- **Models**: PascalCase singular nouns — `User`, `LearningSession`, `PaymentOrder`.
- **Fields**: camelCase — `createdAt`, `userId`, `isActive`.
- **Enums**: PascalCase for the type, SCREAMING_SNAKE_CASE for values.

```prisma
enum SubscriptionStatus {
  ACTIVE
  CANCELLED
  EXPIRED
  TRIAL
}
```

### 2.3 Required vs Optional Fields

- New columns added to existing tables **must** have a `@default` or be `?` (nullable).
  Deploying a non-nullable column with no default to a table with existing rows will crash migrations.
- Use `DateTime?` for audit timestamps (`deletedAt`, `verifiedAt`) — null means the event has not occurred.
- Never use `String` for status/type columns that have a finite set of values — use an enum.

### 2.4 Enum Import Rule

- **Never use `import type` for Prisma enums.** Prisma generates enums as runtime values.
  `import type` strips them at compile time and causes runtime `undefined` errors.

```ts
// BAD
import type { SubscriptionStatus } from '@prisma/client';

// GOOD
import { SubscriptionStatus } from '@prisma/client';
```

### 2.5 Query Discipline

- **Always `select` only the fields you need.** Never `findMany` / `findUnique` without a `select` or `include` clause when touching large models like `User`.
- Never `findMany` without a `where` filter on a high-cardinality table — always paginate with `take` / `skip` (default page size: 20).
- For soft-deletes, always filter `deletedAt: null` unless the query explicitly needs deleted records.
- Wrap related writes in a `prisma.$transaction` to maintain data consistency.

```ts
// BAD — fetches every field on a large model
const user = await prisma.user.findUnique({ where: { id } });

// GOOD — minimal projection
const user = await prisma.user.findUnique({
  where: { id },
  select: { id: true, name: true, grade: true, board: true },
});
```

### 2.6 Relation Field Symmetry

- Every `@relation` must have a matching back-relation field on the related model.
  Missing back-relations cause runtime Prisma validation errors.
- Declare `onDelete` / `onUpdate` behaviour explicitly for all FK relations.

### 2.7 Index Strategy

- Add `@@index` for any field used in a `where` clause that is not already `@unique` or the primary key.
- Composite indexes must list the most-selective field first.
- Document the query that motivated each index in a schema comment above the index.

```prisma
// Supports: findMany({ where: { userId, status } })
@@index([userId, status])
```

### 2.8 Prisma Version Lock

- Prisma is locked to **v6.19.1**. Never upgrade to v7. If version drift occurs:
  ```
  npm install prisma@6.19.1 @prisma/client@6.19.1 --save-exact
  ```

---

## 3. Error Handling & Try-Catch Guidance

### 3.1 The Golden Rule

> **Every async function that can fail must handle that failure explicitly.**
> A function that swallows errors silently is worse than one that crashes loudly.

### 3.2 Catch Scope — Keep It Tight

Wrap only the code that can throw, not an entire function body. This makes it clear what you expect to fail and avoids accidentally hiding bugs in unrelated code.

```ts
// BAD — catches everything, hides bugs in transformData()
async function processOrder(orderId: string): Promise<void> {
  try {
    const order = await fetchOrder(orderId);
    const enriched = transformData(order); // logic bug here gets swallowed
    await saveOrder(enriched);
  } catch (err) {
    logger.error('order.process.failed', { orderId, error: (err as Error).message });
  }
}

// GOOD — each I/O boundary wrapped individually
async function processOrder(orderId: string): Promise<void> {
  let order: Order;
  try {
    order = await fetchOrder(orderId);
  } catch (err) {
    logger.error('order.fetch.failed', { orderId, error: (err as Error).message });
    throw err; // re-throw — caller decides recovery
  }

  const enriched = transformData(order); // pure — let it throw naturally if it breaks

  try {
    await saveOrder(enriched);
  } catch (err) {
    logger.error('order.save.failed', { orderId, error: (err as Error).message });
    throw err;
  }
}
```

### 3.3 Always Type the Caught Error

TypeScript `catch` clause binds `unknown` in strict mode. Always narrow to `Error` before accessing `.message` or `.stack`.

```ts
// BAD
} catch (err) {
  logger.error('something.failed', { error: err.message }); // type error in strict mode
}

// GOOD
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  logger.error('something.failed', { error: message });
}
```

### 3.4 API Route Error Responses

- **Never expose raw error messages or stack traces** in HTTP responses.
- Return a structured error response using the project's helper:

```ts
// Always return this shape for errors
return NextResponse.json(
  { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' },
  { status: 500 }
);
```

- Log the real error server-side with full context before returning the generic response.
- Use specific HTTP status codes: `400` for validation, `401` for unauthenticated, `403` for unauthorised, `404` for not found, `409` for conflict, `429` for rate-limit, `500` for unexpected.

### 3.5 Never Swallow Errors Silently

If you catch an error and do not re-throw or return an error response, you must log it with at least `logger.warn`. An empty `catch {}` block is a code-review blocker.

```ts
// BLOCKER — silent swallow
try {
  await notifySlack(payload);
} catch {}

// CORRECT — log and continue (fire-and-forget side effect)
try {
  await notifySlack(payload);
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  logger.warn('slack.notify.failed', { error: message }); // non-fatal, continue
}
```

### 3.6 BullMQ Worker Error Handling

- Workers must **never** let an unhandled error crash the process — BullMQ moves the job to failed automatically if the processor throws.
- Throw a typed error from the processor with a `reason` property so the retry strategy can make an informed decision.
- Idempotency: every job processor must be safe to run twice with the same job data.

### 3.7 External Service Timeouts

All calls to OpenAI, Redis, and external HTTP services must use a timeout:

```ts
// OpenAI — pass AbortSignal
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 10_000); // 10 s
try {
  const response = await openai.chat.completions.create({ ... }, { signal: controller.signal });
} finally {
  clearTimeout(timeoutId);
}
```

---

## 4. Variables, Functions & File Organisation

### 4.1 Variables

- `const` by default. Only use `let` when the value must change.
- Declare variables at the narrowest possible scope — inside the block that needs them, not at the top of the function.
- Never use implicit globals or rely on variable hoisting. Declare before use.
- Use destructuring to extract the fields you need rather than carrying full objects:

```ts
// BAD — carries full object, unclear which fields are used
function greetUser(user: User): string {
  return `Hello, ${user.name}`;
}

// GOOD — explicit contract
function greetUser({ name }: Pick<User, 'name'>): string {
  return `Hello, ${name}`;
}
```

### 4.2 Functions

- **Single Responsibility**: one function does one thing. If you cannot describe it in one sentence without "and", split it.
- **No side effects in utility functions.** A utility that computes a value should not also write to the DB.
- Avoid boolean flag parameters — they are a sign the function needs to be split:

```ts
// BAD — boolean flag indicates two behaviours
function fetchUser(id: string, withProfile: boolean) { ... }

// GOOD — two clear functions
function fetchUser(id: string): Promise<User> { ... }
function fetchUserWithProfile(id: string): Promise<UserWithProfile> { ... }
```

- Default parameters go last. Never use `undefined` checks on required parameters — let TypeScript enforce presence.

### 4.3 File Organisation

```
app/api/<domain>/route.ts    — HTTP handler only (auth check, parse, delegate, respond)
lib/<domain>/service.ts       — business logic (pure or with injected dependencies)
lib/<domain>/repository.ts    — Prisma queries for the domain
lib/<domain>/types.ts         — domain-specific types and Zod schemas
tests/unit/<domain>/          — mirrors src structure
tests/api/<domain>/           — integration tests for API routes
```

- **API route files (`route.ts`) must contain only**: session check, input parsing, service call, HTTP response. No business logic in routes.
- **Maximum one default export per file.** Assign to a named `const` before exporting:

```ts
// GOOD
const handler = { GET, POST };
export default handler;
```

### 4.4 Unused Variables

- Never leave unused variables in committed code. Either remove them or prefix with `_` to signal intentional non-use:

```ts
const [value, _setValue] = useState(0); // _setValue intentionally unused
```

### 4.5 Magic Numbers & Strings

Extract magic values into named constants at the top of the file or in a dedicated `constants.ts`:

```ts
// BAD
if (user.totalXp > 5000) { ... }

// GOOD
const XP_LEVEL_CAP = 5_000;
if (user.totalXp > XP_LEVEL_CAP) { ... }
```

---

## 5. Naming Conventions

### 5.1 Quick Reference Table

| Construct                     | Convention                                       | Example                                        |
| ----------------------------- | ------------------------------------------------ | ---------------------------------------------- |
| TypeScript file               | `kebab-case.ts`                                  | `difficulty-tuning.ts`                         |
| React component file          | `PascalCase.tsx`                                 | `StreakWidget.tsx`                             |
| Class                         | PascalCase                                       | `ExplanationCache`                             |
| Interface / Type              | PascalCase                                       | `UserProfile`, `ApiResponse<T>`                |
| Enum                          | PascalCase (type), SCREAMING_SNAKE_CASE (values) | `JobStatus.IN_PROGRESS`                        |
| Function                      | `camelCase` verb                                 | `computeReadinessScore()`                      |
| React component               | PascalCase noun                                  | `TopicCard`                                    |
| Variable / param              | `camelCase`                                      | `sessionUserId`                                |
| Boolean variable              | `is` / `has` / `can` prefix                      | `isSubscribed`, `hasCompletedProfile`          |
| Constant (module-level)       | `SCREAMING_SNAKE_CASE`                           | `MAX_RETRY_ATTEMPTS`                           |
| Prisma model                  | PascalCase singular                              | `LearningSession`                              |
| Prisma field                  | `camelCase`                                      | `createdAt`                                    |
| DB column (via Prisma `@map`) | `snake_case`                                     | `@map("created_at")`                           |
| BullMQ queue name             | `kebab-case`                                     | `"ai-explanation-queue"`                       |
| Logger event                  | `domain.action`                                  | `"session.completed"`                          |
| Test file                     | mirrors source + `.spec.ts`                      | `difficulty-tuning.spec.ts`                    |
| Test name                     | `should [behaviour] when [condition]`            | `should return fallback when OpenAI times out` |

### 5.2 Descriptive over Terse

- Never use single-character variable names except for well-understood math (loop index `i`, `j`; coordinate `x`, `y`).
- Avoid abbreviations unless they are universal in the domain (`id`, `url`, `db`, `api`, `req`, `res`).
- Names should not require a comment to explain them. If you feel the urge to add a comment above a variable name, rename the variable instead.

```ts
// BAD
const d = new Date();
const u = await getUser(id);

// GOOD
const requestedAt = new Date();
const sessionUser = await getUser(id);
```

### 5.3 Boolean Naming

Always prefix booleans with a predicate word:

```ts
// BAD
const premium = user.subscriptionStatus === 'active';

// GOOD
const isPremium = user.subscriptionStatus === 'active';
const hasActiveSession = sessions.length > 0;
const canAccessContent = isPremium || freeQuotaRemaining > 0;
```

### 5.4 Avoid Misleading Names

- A function named `getUser` must not modify state. If it modifies state, name it `updateUser`.
- A function named `isValid` must return a `boolean`. Never a `User | null`.
- Async functions that fetch data: use `fetch` prefix for HTTP calls, `get` prefix for DB queries, `load` prefix for cache reads.

---

## 6. Comments in Code

### 6.1 Principle: Code Communicates Intent, Comments Communicate Why

Well-named code needs no comment to explain _what_ it does. Comments exist to explain:

- **Why** a non-obvious decision was made
- **What constraint** forced an unusual pattern
- **What the gotcha** is for the next developer

If a comment describes _what_ the code does and the code is readable, delete the comment.

```ts
// BAD — restates the code
// increment the counter
counter++;

// GOOD — explains the why
// Increment before yield so the first value is 1, not 0 (matches 1-based curriculum grades).
counter++;
```

### 6.2 Required Comment Locations

These locations **must** have a comment, no exceptions:

| Location                                | Required comment                           |
| --------------------------------------- | ------------------------------------------ |
| Every `eslint-disable-next-line`        | Reason + EDIT LOG reference                |
| Every `as SomeType` cast                | Why the type cannot be inferred            |
| Every `any` usage                       | Why it cannot be properly typed            |
| Every `// TODO` (not in committed code) | Blocked by what; link to backlog item      |
| Every `@default` on a schema field      | What the value means in business terms     |
| Every environment feature flag check    | What the flag controls and who can flip it |
| Every `@@index` in Prisma schema        | The query pattern it supports              |

### 6.3 JSDoc for Public API Functions

Every exported function in `lib/` must have a JSDoc block covering:

- A one-line description of what it does
- `@param` for each non-obvious parameter
- `@returns` describing the return value and its meaning
- `@throws` if the function can throw a known, typed error

```ts
/**
 * Computes the current readiness score for a student across all active topics.
 *
 * @param userId - The student's user ID (from session, never client-supplied).
 * @param subjectId - The subject to scope the computation to.
 * @returns A value between 0 and 100 representing overall readiness. Returns 0
 *          if no attempt history exists (not null — callers should not branch on null).
 * @throws {ReadinessComputationError} When the readiness data is corrupt or missing required fields.
 */
export async function computeReadinessScore(userId: string, subjectId: string): Promise<number> { ... }
```

### 6.4 Section Dividers

In longer files (>150 lines), use section divider comments to group logical blocks. Keep them consistent:

```ts
// ─── Types ────────────────────────────────────────────────────────────────────

// ─── Helpers ──────────────────────────────────────────────────────────────────

// ─── Main handler ─────────────────────────────────────────────────────────────
```

### 6.5 What Not to Comment

- Do not add comments that restate the function name or variable name.
- Do not keep commented-out code in committed files. Delete it — git history preserves it.
- Do not add `// TODO` or `// FIXME` in committed code — add the item to `post_launch_backlog.md` instead.
- Do not add comments like `// end of if block` or `// end of function`.

### 6.6 Inline Disable Comments

Every ESLint or TypeScript suppression must have a justification on the same line:

```ts
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma Json type has no better alternative here
const jsonPayload: any = prismaRecord.metadata;
```

---

## 7. Code Review Checklist

Use this checklist before marking a PR ready for review and during review.

### 7.1 Author Pre-Review Checklist

```
□ npm run lint — zero errors and zero warnings
□ npm run type-check (npx tsc --noEmit) — zero errors
□ npm run test — all tests pass, no dropped coverage
□ Every new/changed source file has an updated file header (see §8)
□ EDIT LOG in every changed file is updated
□ No console.* calls — all logging goes through @/lib/logger
□ No magic numbers or strings — all extracted to named constants
□ No any types without inline justification comments
□ No commented-out code
□ No TODO/FIXME — moved to post_launch_backlog.md
□ All new async functions have try/catch with typed error handling
□ All Prisma queries have explicit select (no select *)
□ New schema columns are nullable or have a @default
□ New Prisma enums imported without 'import type'
□ All new API routes are auth-guarded (session check first)
□ All user inputs validated with Zod before DB write
□ Unit tests for every new function (happy path + error path + edge cases)
□ package-lock.json committed alongside package.json if changed
```

### 7.2 Reviewer Checklist

```
□ Does each function do exactly one thing?
□ Are function names accurate — does the function do what its name says?
□ Are all error paths handled? Is any error being swallowed silently?
□ Are Prisma queries selecting only needed fields?
□ Does every new column have a @default or is nullable?
□ Is there a corresponding test file with meaningful test cases?
□ Are test names in "should [behaviour] when [condition]" format?
□ Does the code follow mobile-first Tailwind conventions (for UI changes)?
□ Is the file header present and EDIT LOG updated?
□ Is any PII being logged?
□ Are there any new dependencies that were not explicitly approved?
□ Does any AI-facing code bypass the guardrail stack?
```

### 7.3 Blocking vs Non-Blocking Review Comments

| Category                                                   | Blocking?                          |
| ---------------------------------------------------------- | ---------------------------------- |
| Security (PII logging, unguarded API route, exposed error) | Yes — must fix before merge        |
| Silent error swallow                                       | Yes                                |
| Missing auth guard                                         | Yes                                |
| Missing unit test                                          | Yes                                |
| `any` without justification                                | Yes                                |
| `console.*` in production code                             | Yes                                |
| Missing file header / EDIT LOG                             | Yes                                |
| Naming style inconsistency                                 | No — leave comment, author decides |
| Minor readability improvement                              | No                                 |
| Performance optimisation (non-critical path)               | No                                 |

---

## 8. File Header Template

Every source file (`.ts`, `.tsx`, `.cjs`, `.js`) created or modified must contain this header.
**Update the EDIT LOG on every change — even a one-line fix.**

```ts
/**
 * FILE OBJECTIVE:
 * - One clear sentence describing what this file does.
 *
 * LINKED UNIT TEST:
 * - tests/unit/path/to/this-file.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 * - /docs/ENGINEERING_PRACTICES.md
 *
 * EDIT LOG:
 * - YYYY-MM-DDTHH:mm:ssZ | author-id | description of change
 */
```

For Prisma schema files:

```prisma
/// FILE OBJECTIVE:
/// - One clear sentence describing what this schema defines.
///
/// LINKED UNIT TEST:
/// - tests/unit/prisma/schema.spec.ts
///
/// EDIT LOG:
/// - YYYY-MM-DDTHH:mm:ssZ | author-id | description of change
```

For Markdown / documentation files:

```md
<!--
FILE OBJECTIVE:
- One clear sentence describing this document's purpose.

LINKED UNIT TEST:
- tests/unit/docs/filename.spec.ts (if applicable)

EDIT LOG:
- YYYY-MM-DDTHH:mm:ssZ | author-id | description of change
-->
```

---

---

## 9. Production Readiness Gates

> **The full gate sequence must be green before any commit. No exceptions.**
> "It works on my machine" is not a gate. CI is the gate.

### 9.1 Gate Sequence (run in this exact order)

```powershell
# 1. Smart-quote / Unicode safety check (auto-fixes and re-stages if violations found)
python scripts/fix-smart-quotes.py

# 2. ESLint — zero errors, zero warnings
npm run lint:orig

# 3. TypeScript type-check — zero errors
npm run type-check

# 4. Unit tests with coverage
npm run ci:unit

# 5. Worker build (compiled JS, no forbidden deps in dist/)
npm run build:workers

# 6. Next.js production build
npm run build
```

All six must exit `0` before you run `git commit`. If any step fails, fix it — do not skip.

### 9.2 Lint

| Command               | When to use                                                                                  |
| --------------------- | -------------------------------------------------------------------------------------------- |
| `npm run lint`        | Day-to-day: scopes to `app/`, `components/`, `lib/`, `src/`                                  |
| `npm run lint:orig`   | Pre-commit and CI gate: runs `eslint . --max-warnings=0` (whole repo, no warnings tolerated) |
| `npm run lint:fix`    | Auto-fix safe violations before committing                                                   |
| `npm run lint:quotes` | Check for smart quotes / Unicode chars in source files                                       |

Key ESLint rules enforced:

- `no-console` — use `@/lib/logger` exclusively
- `@typescript-eslint/no-explicit-any` — every `any` needs an inline justification
- `@typescript-eslint/no-unused-vars` — prefix intentional non-use with `_`
- `react/no-children-prop` — children always as JSX children, not a prop
- `@next/next/no-html-link-for-pages` — `Link` from `next/link` for internal routes
- `import/no-anonymous-default-export` — named `const` before `export default`

### 9.3 Type-Check

```powershell
# Standard check (uses tsconfig.json, noEmit)
npm run type-check

# Full strict check (CI-equivalent)
npm run type-check:orig
```

- `strict: true` is set in `tsconfig.json`. It must never be weakened.
- `tsconfig.json` is for Next.js + IDE only (`noEmit: true`). It does **not** emit `dist/`.
- `tsconfig.build.json` is the only config allowed to emit `dist/` (worker build).
- `scripts/` is excluded from `tsconfig.json` scope — type errors there do not block CI but should still be fixed.

### 9.4 Unit Tests

**Location:** `tests/unit/` — mirroring source file paths.

```powershell
# Run unit tests with coverage (CI gate)
npm run ci:unit
# Equivalent: npx tsc --noEmit && jest --coverage --testPathPattern=tests/unit --runInBand
```

**Requirements for every PR:**

- Every new or modified source file must have a corresponding test file update.
- New functions: happy path + at least one error path + boundary/edge case.
- New API routes: auth-missing case + validation-failure case + success case.
- New workers: happy path + error path + idempotency (safe to run twice) test.
- New UI components: renders without crash + loading state + error state.

**Test naming convention:**

```ts
// Format: should [expected behaviour] when [condition]
it('should return 0 when no attempt history exists', () => { ... });
it('should throw ReadinessComputationError when data is corrupt', () => { ... });
```

**What tests must NOT do:**

- Do not call real DB, Redis, or OpenAI in unit tests — mock all I/O.
- Do not test implementation details — test observable behaviour.
- Do not use `any` in test assertions — type the expected values.
- Do not mutate shared mocks between tests — reset in `beforeEach` / `afterEach`.

### 9.5 Integration Tests

**Location:** `tests/integration/` — excluded from the default Jest run.

Integration tests require a live PostgreSQL database and Redis instance. They are:

- Excluded from CI by default (`testPathIgnorePatterns` in `jest.config.cjs`).
- Run manually on the VPS or in a local Docker environment.
- Documented as manual-only — safe to skip in automated CI pipelines.

```powershell
# Run integration tests locally (requires DATABASE_URL and REDIS_URL set)
npx jest --config jest.integration.config.cjs
```

Integration tests must cover:

- Database migration correctness (new columns, defaults, constraints).
- BullMQ job enqueue → worker process → result persistence flow.
- API routes end-to-end (real session, real DB, mocked external APIs).

### 9.6 Coverage Thresholds

Coverage is enforced by `jest.config.cjs`. Current **minimum** thresholds:

| Metric     | Global minimum | Critical modules |
| ---------- | -------------- | ---------------- |
| Branches   | 60%            | 100%             |
| Functions  | 50%            | 100%             |
| Lines      | 60%            | 100%             |
| Statements | 60%            | 100%             |

**Critical modules** (must maintain 100% coverage):

- `lib/ai/` — all AI guardrail, prompt, and orchestration code
- `lib/jobs/` — all BullMQ job processors
- `lib/moderation/` — content safety and hallucination detection
- `lib/personalization/` — difficulty tuning and readiness scoring

> **Target for new code: 100%.** The global minimums represent legacy debt.
> Never write new code that pulls coverage below the current threshold — CI will fail.
> Never lower the thresholds to make CI pass — raise the tests instead.

### 9.7 Smart Quote & Unicode Safety

The pre-commit hook runs `python scripts/fix-smart-quotes.py` automatically and re-stages the file.
Do not wait for the hook — write correct ASCII from the start:

| Wrong (Unicode)               | Correct (ASCII) |
| ----------------------------- | --------------- |
| `'` `'` (smart single quotes) | `'`             |
| `"` `"` (smart double quotes) | `"`             |
| `–` (en dash)                 | `-`             |
| `—` (em dash)                 | `--`            |
| `…` (ellipsis)                | `...`           |

Strings containing apostrophes must use template literals or double-quotes — never escaped single-quotes:

```ts
// BAD
const msg = "It's not working";

// GOOD
const msg = `It's not working`;
const msg2 = "It's not working";
```

### 9.8 Build Verification (Worker)

After any change to `src/worker/`, `src/lib/`, or `src/queues/`:

```powershell
npm run build:workers
```

Then verify no forbidden dependencies leaked into `dist/`:

```powershell
# Must print nothing (no matches = clean)
Get-ChildItem -Recurse dist | Select-String -Pattern 'dotenv' | Select-Object -First 5
Get-ChildItem -Recurse dist | Select-String -Pattern 'tsconfig-paths' | Select-Object -First 5
```

If either command returns output, the build is invalid. Fix the `tsconfig.build.json` scope — never relax `verify-dist.cjs`.

### 9.9 Pre-commit Hook Summary

Husky runs these automatically on every `git commit`:

1. `python scripts/fix-smart-quotes.py` — auto-fixes and re-stages Unicode violations.
2. `npx tsc --noEmit --project tsconfig.json` — type-check must pass.

These are the **minimum** automated gates. The full §9.1 sequence is your responsibility before committing.

### 9.10 CI Gate Summary

The CI pipeline (GitHub Actions) blocks merges on:

| Check                              | Command                   | Fail = block merge? |
| ---------------------------------- | ------------------------- | ------------------- |
| Smart quote check                  | `npm run lint:quotes`     | Yes                 |
| ESLint (zero warnings)             | `npm run lint:orig`       | Yes                 |
| Type-check                         | `npm run type-check:orig` | Yes                 |
| Unit tests + coverage              | `npm run ci:unit`         | Yes                 |
| Worker build                       | `npm run build:workers`   | Yes                 |
| Next.js build                      | `npm run build`           | Yes                 |
| Missing unit test for changed file | CI lint rule              | Yes                 |
| Missing EDIT LOG update            | CI lint rule              | Yes                 |

---

## Enforcement

- The Husky pre-commit hook enforces smart-quote cleanup and type-check on every commit.
- CI enforces the full gate sequence in §9.10. No merge proceeds until all checks are green.
- PRs without a linked unit test update for every changed production file are auto-rejected.
- A PR where any changed file is missing an updated EDIT LOG will be returned to the author without review.
- Coverage thresholds in `jest.config.cjs` are authoritative — lower them only with a written justification in the PR.

---

_Last updated: 2026-04-18 by Principal Staff Engineer — Spinzy AI Tutor_
