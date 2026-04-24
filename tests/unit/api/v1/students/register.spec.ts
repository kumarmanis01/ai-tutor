/**
 * FILE OBJECTIVE:
 * - Unit tests for POST /api/v1/students/register (S0.1).
 *
 * LINKED UNIT TEST:
 * - tests/unit/api/v1/students/register.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-24T00:00:00Z | copilot | created placeholder
 * - 2026-04-24T12:00:00Z | copilot | TODO: real tests deferred to next phase
 */

// TODO (next phase): real behavioural tests - adult/minor paths, contact validation, accountStatus enum, explore_token.
describe.skip('POST /api/v1/students/register', () => {
  it.todo('adult registration returns scope:full')
  it.todo('minor registration returns explore_token')
  it.todo('invalid phone returns 400 invalid_phone')
  it.todo('invalid email returns 400 invalid_email')
  it.todo('missing required fields returns 400')
})
