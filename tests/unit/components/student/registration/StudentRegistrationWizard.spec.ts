/**
 * FILE OBJECTIVE:
 * - Unit tests for StudentRegistrationWizard component.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/student/registration/StudentRegistrationWizard.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-24T00:00:00Z | copilot | created placeholder
 * - 2026-04-24T12:00:00Z | copilot | TODO: real tests deferred to next phase
 */

// TODO (next phase): real RTL tests - adult/minor wizard flow, API call, canonical board slugs, error states, onComplete.
describe.skip('StudentRegistrationWizard', () => {
  it.todo('renders role step initially');
  it.todo('advances to age step on student click');
  it.todo('adult flow calls register API and shows success');
  it.todo('sends canonical board slug (CBSE/ICSE/STATE)');
  it.todo('shows error on adult API failure');
  it.todo('minor flow shows parent contact step');
  it.todo('minor flow calls register API with parent_contact');
  it.todo('minor success shows explore link with token');
  it.todo('calls onComplete with SuccessData');
});
