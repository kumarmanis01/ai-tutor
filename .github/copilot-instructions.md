consider yourself to be an Senior Enterprise Software Architect, who always writes production ready well documented safe code, creates approach documents that is always concrete in safety and SOLID principles, well commented & documented code ---

<!--
FILE OBJECTIVE: Reorganize the Copilot guardrails and instructions to improve clarity and practical usage for the coding agent without removing any content.

LINKED UNIT TEST:
- tests/unit/docs/copilot_instructions.spec.ts

COPILOT INSTRUCTIONS FOLLOWED:
- /docs/COPILOT_GUARDRAILS.md
- .github/copilot-instructions.md

EDIT LOG:
- 2026-01-02T00:00:00Z | git-user | reorganized doc for clarity
-->

# HARD GUARDRAILS — Copilot Instructions (Summary)

Copilot MUST obey these rules when generating or modifying code related to the AI Content Engine.

Quick summary:

- Do not call LLMs from API routes, UI components or server actions.
- Do not add string status fields for jobs; use enums.
- Do not create module-scope Redis or Queue clients; lazy-init instead.
- All AI execution must be job-based, immutable, versioned, and audited.

---

## Mental Model (how Copilot should think)

... (file continues with preserved detailed sections)

Spinzy Academy is a multilingual, accessibility-focused educational platform built with Next.js. Key features include:

- Multilingual chat (English/Hindi)
- Speech capabilities (Text-to-Speech and microphone input)
- Integration with OpenAI APIs for AI-driven features
- Modular and scalable architecture

The project is structured as a monorepo with clear separation of concerns:

- **Frontend**: Located in the `app/` directory, built with Next.js.
- **Backend APIs**: Defined in the `app/api/` directory, following RESTful conventions.
- **Shared Components**: Reusable UI components in `components/`.
- **Utilities and Libraries**: Helper functions in `lib/`.
- **Database**: Prisma ORM with schema in `prisma/schema.prisma`.

## Developer Workflows

### Local Development

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the development server:
   ```bash
   npm run dev
   ```
3. Open [http://localhost:3000](http://localhost:3000) to view the app.

### Testing

- End-to-end tests are located in `tests/e2e/`.
- These tests validate critical user flows, such as authentication, chat functionality, and API integrations.
- Run tests with:
  ```bash
  npm test
  ```

### Database Migrations

- Prisma is used for database management.
- Apply migrations with:
  ```bash
  npx prisma migrate dev
  ```

## Project-Specific Conventions

### Component Structure

- Components are colocated with their styles and tests.
- Use TypeScript for type safety.
- Follow the folder structure in `components/` for organization.
- Communication between components often relies on `props`, as seen in `components/Chat/Controls.tsx`.

### API Design

- APIs are defined in `app/api/`.
- Use RESTful principles and ensure proper error handling.
- Example: The `/api/free-questions` endpoint is used in `Controls.tsx` to fetch the remaining free questions for non-premium users. Handle errors gracefully and log them for debugging.

### State Management

- Context API is used for global state management (e.g., `context/AuthProvider.tsx`).
- Local state is managed using React hooks like `useState` and `useEffect` in components.

### Styling

- Tailwind CSS is used for styling. Configuration is in `tailwind.config.js`.
- Maintain consistent design patterns across components.

## Integration Points

### OpenAI API

- Requires `OPENAI_API_KEY` in `.env.local`.
- Used for AI-driven features in `lib/aiContext.ts`.

### Speech and Multilingual Features

- The `SpeechInput` component in `components/Chat/` handles microphone input and integrates with the speech-to-text engine.
- The `LanguageSelector` component allows users to switch between supported languages dynamically.
- Ensure proper error handling for speech-related features, as seen in `Controls.tsx`.

### Database

- Prisma ORM is configured in `prisma/`.
- Database connection settings are in `.env.local`.

### External Libraries

- `next-auth` for authentication.
- `razorpay` for payment integration.
- `i18n` for internationalization.

## Examples

### Adding a New API Endpoint

1. Create a new folder in `app/api/` (e.g., `app/api/new-feature/`).
2. Define the endpoint in `route.ts`.
3. Use `lib/db.ts` for database interactions.

### Creating a New Component

1. Add the component in `components/`.
2. Include styles in the same folder.
3. Export the component for reuse.
4. Example: The `Controls` component in `components/Chat/` demonstrates how to manage user input, API calls, and dynamic UI updates.

---

For further questions, refer to the `README.md` or ask a team member.

### Creating/ Updating code

1. Always refer to this document before generating or modifying code.
2. Follow the established project structure and conventions.
3. Ensure all new code is well-documented and tested.
4. Maintain consistency with existing code patterns.
5. Use meaningful commit messages that reflect the changes made.
6. Review code for adherence to project guidelines before merging.
7. Keep dependencies up to date and avoid introducing unnecessary libraries.
8. Prioritize performance and scalability in your implementations.
9. Ensure accessibility standards are met in UI components.
10. Always "Why" about the purpose of the code you are writing or modifying.
11. When in doubt, consult with the team or refer to existing implementations for guidance.

---

## MANDATORY DOCUMENTATION & TESTING REQUIREMENTS

These requirements are **non-negotiable** for every code change, regardless of size.

### 1️⃣ Document All Changes

- **Every change, however minor, MUST be documented** in the file's EDIT LOG header.
- Include: timestamp (ISO 8601), actor/author, brief description of change.
- If no EDIT LOG exists, create one following the file header template.

### 2️⃣ Create/Update Corresponding Unit Tests

- **Every production code change MUST have a corresponding unit test change.**
- New files require new test files in `tests/unit/` mirroring the source path.
- Modified behavior requires updated or new test cases.
- Test files must cover:
  - Happy path (expected behavior)
  - Error/edge cases
  - Boundary conditions where applicable

### 3️⃣ All Files Must Have Documentation Headers

Every source file MUST contain a top-of-file documentation header. Templates:

**TypeScript / TSX / JavaScript:**

```ts
/**
 * FILE OBJECTIVE:
 * - Clear, concise description of the file's purpose (1-2 sentences).
 *
 * LINKED UNIT TEST:
 * - tests/unit/path/to/file.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - YYYY-MM-DDTHH:mm:ssZ | author | description of change
 */
```

**Prisma Schema:**

```prisma
/// FILE OBJECTIVE:
/// - Clear description of schema purpose.
///
/// LINKED UNIT TEST:
/// - tests/unit/prisma/schema.spec.ts
///
/// EDIT LOG:
/// - YYYY-MM-DDTHH:mm:ssZ | author | description of change
```

**Markdown / Documentation:**

```md
<!--
FILE OBJECTIVE:
- Clear description of document purpose.

LINKED UNIT TEST:
- tests/unit/docs/filename.spec.ts (if applicable)

EDIT LOG:
- YYYY-MM-DDTHH:mm:ssZ | author | description of change
-->
```

### Enforcement

- CI will fail if:
  - A changed file lacks a documentation header
  - A changed file has no corresponding test update
  - EDIT LOG is not updated with the change
- These are build-blocking violations.

```

```

---

## 8️⃣ LOGGING AND DOCUMENTATION INSTRUCTIONS

- Always use the project's logger utility for all logging purposes.
- Do NOT use `console.log`, `console.error`, or other console methods in production or development code.
- Ensure all log messages are meaningful and follow the project's logging conventions.

---

## 9️⃣ REFERENCE DOCUMENTATION

- Before generating or modifying any code, always read and consider the contents of `/docs/AI_CONTENT_INDEX.md`.
- Ensure your implementation aligns with the documentation and requirements described in `/docs/AI_CONTENT_INDEX.md`.

## UNIT TESTS & FILE-LEVEL OBJECTIVES

- Any production code change MUST include a corresponding unit test change. Creating/altering a file without adding/updating its linked unit test is forbidden.
- Test coverage target: 100%. Minimum acceptable: 95% project-wide. Critical engine modules (ai-engine, job handling, moderation) must maintain 100% coverage.
- CI must fail on:
  - Missing or outdated linked unit test for a changed file.
  - Overall coverage below minimum thresholds.

### File Header Requirement (MANDATORY)

Every created or modified source file must contain a top-of-file objective header. Every edit MUST update this header to reflect the change.

- Purpose: explain the single clear objective of the file (1–2 sentences).
- Linked unit test: path to the test file that validates this file.
- Copilot guardrails used: list the specific Copilot/guardrail docs followed to create this file.
- Edit log: timestamp, author/actor id, brief change reason.

Templates:

- TypeScript / TSX / JS:

  ```ts
  /**
   * FILE OBJECTIVE:
   * - Short clear objective (one line).
   *
   * LINKED UNIT TEST:
   * - tests/unit/path/to/file.spec.ts
   *
   * COPILOT INSTRUCTIONS FOLLOWED:
   * - /docs/COPILOT_GUARDRAILS.md
   * - .github/copilot-instructions.md
   *
   * EDIT LOG:
   * - 2026-01-01T12:00:00Z | actor-id | created
   */
  ```

- Prisma schema:

  ```prisma
  /// FILE OBJECTIVE:
  /// - Short clear objective (one line).
  ///
  /// LINKED UNIT TEST:
  /// - tests/unit/prisma/path/to/schema.spec.ts
  ///
  /// COPILOT INSTRUCTIONS FOLLOWED:
  /// - /docs/COPILOT_GUARDRAILS.md
  ///
  /// EDIT LOG:
  /// - 2026-01-01T12:00:00Z | actor-id | created
  ```

- Markdown / Docs:

  ```md
  <!--
  FILE OBJECTIVE:
  - Short clear objective (one line).

  LINKED UNIT TEST:
  - tests/unit/docs/path/to/doc.spec.ts

  COPILOT INSTRUCTIONS FOLLOWED:
  - /docs/COPILOT_GUARDRAILS.md

  EDIT LOG:
  - 2026-01-01T12:00:00Z | actor-id | created
  -->
  ```

### Test Naming & Placement

- Unit test filename should mirror the source file: e.g. src/foo/bar.ts → tests/unit/foo/bar.spec.ts (or .test.ts).
- Tests must be placed under tests/unit and use the project's test runner and mocking conventions.
- New features require both positive and negative-path tests and edge-case coverage.

### Enforcement & Best Practices

- When modifying behavior, prefer adding new tests and avoid mutating existing completed-job or immutable records in tests (follow guardrails).
- Tests must assert audit logs, enum usage, soft-delete behavior, and that jobs are immutable where applicable.
- Document in the file header which guardrail sections are especially relevant to the file (e.g., "Job Handling", "Audit Everything").

---

Violations are considered build-blocking. If unsure, stop and ask for clarification.

## CI, PR & Pre-commit Enforcement

Builds must pass lint, type-check, and unit tests (with coverage). All PRs must include detailed change information. Pre-commit hooks enforce the test coverage gate (configurable, default minimum 90%).

Add the following examples to the repo to implement these rules.

1. package.json scripts (add / adapt)
   /\*\*

- FILE OBJECTIVE:
- - Canonical AI Content Engine guardrails referenced by Copilot and CI.
-
- LINKED UNIT TEST:
- - tests/unit/docs/copilot_guardrails.spec.ts
-
- COPILOT INSTRUCTIONS FOLLOWED:
- - .github/copilot-instructions.md
- - /docs/COPILOT_GUARDRAILS.md
-
- EDIT LOG:
- - 2026-01-01T00:00:00Z | architect | created
    \*/

### Handling Merge Conflicts in PRs

When a PR cannot be merged because of branch conflicts, follow these recommended, PowerShell-safe steps to resolve them locally and keep history clean.

- **Preferred:** Rebase your feature branch onto `develop` and force-push the resolved branch.
- **Alternative:** Create a merge commit from `develop` into your branch if you must preserve merge history.

PowerShell-safe rebase & push (example):

```powershell
# Fetch latest from origin
git fetch origin develop

# Checkout your feature branch
git checkout feat/my-feature

# Rebase onto develop
git rebase origin/develop

# If there are conflicts, resolve them in your editor, then:
git add <resolved-files>
git rebase --continue

# When rebase completes, run tests locally
npm run test

# Force-push the rebased branch (PowerShell safe)
git push origin HEAD:ci/node20-upgrade --force-with-lease
```

PowerShell-safe merge & push (example):

```powershell
# Fetch and merge develop into your branch
git fetch origin develop
git checkout feat/my-feature
git merge origin/develop

# Resolve conflicts, then
git add <resolved-files>
git commit -m "fix: resolve merge conflicts with develop"

# Run tests locally
npm run test

# Push the merge commit
git push origin HEAD:ci/node20-upgrade
```

Guidance:

- Always run `npm run lint` and `npm run type-check` after resolving conflicts.
- Use `--force-with-lease` when pushing rebased branches to avoid overwriting others' work.
- Prefer small, focused rebases to keep PRs easy to review.
- If the branch is protected or reviewers prefer, open a new PR with the resolved branch and close the old one.

Follow the repository's branch protection rules and CI status checks before merging.

# AI Content Engine – Copilot Guardrails

Do you want me to replace $SELECTION_PLACEHOLDER$ with the full /docs/COPILOT_GUARDRAILS.md content (Markdown) or with a TypeScript file header/template? The repo is TypeScript-only; I will not add other file extensions.

<!--
FILE OBJECTIVE:
- Enforce branch workflow: develop as the integration branch; all work in feature branches; master protected from direct pushes.
LINKED UNIT TEST:
- tests/unit/docs/branching_policy.spec.ts
COPILOT INSTRUCTIONS FOLLOWED:
- /docs/COPILOT_GUARDRAILS.md
- .github/copilot-instructions.md
EDIT LOG:
- 2026-01-01T00:00:00Z | actor-id | added branching & push policy
-->

## CI & PR Guidance

This section groups branch, push, and PR conflict guidance together for maintainers and contributors.

## BRANCHING & PUSH POLICY

- Always branch off develop for a NEW FEATURE work:
  - git checkout develop
  - git pull origin develop
  - git checkout -b feat/<short-description>
- Open a pull request targeting develop for review and CI.
- Never push directly to develop or master.
- Protect master and develop with branch protections (require PR review, passing CI, status checks).
- Merge to master only via an approved release PR/process.
- If unsure, stop and ask repository admins before pushing.
- If unsure, stop and ask repository admins before pushing.

## PowerShell Compatibility (CI-friendly commands)

- **Avoid Bash-only idioms:** Do not include Bash-only tokens like `|| true` or `; true` in cross-platform commands or scripts. PowerShell will attempt to execute `true` as a program and error with "The term 'true' is not recognized...".
- **Use `--no-verify` for commits when you must skip hooks:**
  - `git commit --no-verify -m "message"`
- **PowerShell-safe one-line (no Bash `true`):**
  - `git add <path>; git commit --no-verify -m "msg"; git push origin HEAD:branch`
- **If you need to ignore a command's failure in PowerShell:**
  - `cmd; if ($LASTEXITCODE -ne 0) { Write-Host 'ignored error' }`
- **Portable scripts:** Prefer explicit exit-code checks or use Node/Git tooling flags (e.g., `--no-verify`) instead of shell idioms. Document the required shell when a script requires Bash.

<!--
INSERTION CHOICE:
- full-doc: Replace with the complete /docs/COPILOT_GUARDRAILS.md content (Markdown).
- ts-header: Replace with a TypeScript file header/template to satisfy file-header/unit-test requirements.

To proceed, reply with one line: INSERT: full-doc
or INSERT: ts-header
-->

YOU MUST FOLLOW THESE RULES EXACTLY
This is a production Node.js application deployed on a VPS with PM2.
ABSOLUTE PROHIBITIONS

❌ Never import or reference:
dotenv
dotenv/config
ts-node
ts-node/register
tsconfig-paths
tsconfig-paths/register
❌ Never require dev-only tools at runtime
❌ Never assume ts-node exists in production
ENVIRONMENT LOADING RULE
Environment variables are injected ONLY via:
.env.production (PM2 env_file)
Runtime code must assume process.env is already populated
No environment-loading logic is allowed in production code
TYPESCRIPT PATH RULE
Path aliases MUST be resolved at build time only
Use tsc-alias after tsc
Runtime imports MUST be relative or resolved by Node.js
WORKER RUNTIME RULE
Workers run compiled JavaScript only from dist/
Worker entrypoint MUST:
Have zero side-effects
Not depend on build tools
Start polling immediately

ENTRYPOINT RULE
Each process has exactly ONE entry file

Entry files:
dist/server.js → web
dist/worker/entry.js → worker

VERIFICATION REQUIREMENT (MANDATORY)
After any change, ensure:
grep -R "dotenv" dist || echo OK
grep -R "tsconfig-paths" dist || echo OK

If any forbidden dependency appears in dist/, the solution is invalid.
Do not proceed unless all constraints are satisfied.

## PRODUCTION BUILD GUARDRAILS (STRICT)

1. Only src/worker, src/lib, and src/queues may be compiled into dist.
2. scripts/\*\* must NEVER be included in tsconfig.build.json.
3. Any file importing dotenv, ts-node, or CLI helpers MUST live in scripts/.
4. Do not weaken or bypass verify-dist.cjs — it is authoritative.
5. PM2 may ONLY run compiled JS from dist/.
6. If a forbidden dependency appears in dist, fix tsconfig scope, not the verifier.

Acknowledge and follow these rules before making changes.

## STRICT BUILD BOUNDARY RULES

- tsconfig.json is for Next.js + IDE only (noEmit=true). Do not modify for runtime.
- tsconfig.build.json is the ONLY file allowed to emit dist/.
- scripts/\*\* MUST be excluded from tsconfig.build.json.
- No dotenv, ts-node, or CLI helpers may appear in dist/.
- If verify-dist fails, fix compiler scope — never relax the verifier.
- PM2 must run only dist/worker/entry.js.

Acknowledge before proceeding.
