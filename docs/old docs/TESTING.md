Below is a Copilot-ready instruction you can paste directly into VS Code Chat / Copilot Chat. It is structured to force discipline, iteration, and non-hallucinating behavior, and matches the maturity of your system (Phases 1–16).

✅ Copilot Instruction: Iterative Unit + Integration Test Hardening  
🔒 SYSTEM CONTEXT (READ FIRST – DO NOT SKIP)  
You are working inside an already running production-grade codebase with strict invariants:
- No business logic changes unless explicitly instructed
- No schema changes
- No API behavior changes
- Tests must encode existing behavior, not invent new ones
- Generators / execution planes must never be imported in admin or test layers unless already present
- Follow existing test patterns (Jest + Prisma test DB injection)
- All tests must pass (npm test) before moving to the next file

🎯 GOAL  
Iteratively:
- Add unit tests for each file (one file at a time)
- Integrate those tests into the existing test suite
- Ensure entire test suite remains green
- Do not move ahead unless current iteration is clean

🔁 ITERATION RULE (VERY IMPORTANT)  
Work in strict iterations:
- One file per iteration
- One test file per iteration
- Stop and wait after each iteration for confirmation
- Never batch multiple files

🧭 STEP-BY-STEP INSTRUCTIONS

STEP 1 — Identify Next Untested File  
Scan the repository. Identify exactly ONE source file that:
- Has logic
- Has no corresponding test or insufficient coverage  
Output:
- File path
- File responsibility summary
- Existing invariants or assumptions  
⛔ Do NOT write tests yet  
⛔ Do NOT modify source code

STEP 2 — Design the Unit Test (Before Writing Code)  
For the selected file, identify:
- Public functions / exports
- Inputs and outputs
- Side effects (DB writes, audits, locks, guards)  
List:
- Happy path cases
- Failure/guard cases
- Idempotency / invariant cases (if applicable)  
Output:
- Test cases as bullet points
- Mocking strategy (Prisma, audit logger, time, env)
- Whether test is pure unit or DB-backed  
⛔ No code yet

STEP 3 — Implement Unit Test  
Now write the test:
- Place it under: __tests__/<mirrored_path>/<filename>.test.ts
Follow existing conventions:
- global.TEST_PRISMA
- global.TEST_SESSION
- jest.mock() patterns already in use
- No snapshot tests
- Deterministic assertions only  
Rules:
- No console.log
- No sleeps/timeouts unless already used elsewhere
- Explicit assertions for invariants

STEP 4 — Run & Fix  
Run:
- npm test -- <test-file>  
Fix:
- Typing issues
- Mock mismatches
- Test DB assumptions  
Then run:
- npm test  
Only proceed if:
- ✅ New test passes
- ✅ Full suite is green

STEP 5 — Integrate Into Broader Coverage  
If relevant:
- Add this test file to existing test groups or describe blocks
- Ensure it does not conflict with integration tests
- Ensure naming and grouping follow repo standards

STEP 6 — STOP & WAIT  
Output:
- ✅ File tested
- ✅ Test path
- ✅ Test cases covered
- ✅ Suite status (green)  
Then STOP and wait for confirmation before selecting the next file.

🚫 ABSOLUTE PROHIBITIONS  
Copilot MUST NOT:
- Change production logic
- Add retries, delays, or random data
- Invent new schema fields
- Import generators into admin/tests
- Add E2E tests unless explicitly asked
- Add TODOs instead of tests

🧠 PRIORITY ORDER (FOLLOW THIS)  
When choosing files, prefer this order:
1. Stores / services (stateful logic)
2. Workers / job runners
3. Admin APIs
4. Guards / readers
5. UI helpers (only logic-heavy ones)
6. Pure UI components last

🟢 SUCCESS CRITERIA  
This task is complete only when:
- Every logical file has a unit test OR explicit justification for exclusion
- Entire test suite passes
- No production behavior changed

⏸ CONFIRMATION REQUIRED  
After completing one file, stop and ask: “Shall I proceed to the next file?” Do NOT continue automatically.
