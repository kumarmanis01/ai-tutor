import { PROMPT_EVAL_FIXTURES, assembleFixturePrompt } from './_shared/promptEvalFixtures';

describe('Prompt Eval (deterministic, no LLM)', () => {
  for (const fixture of PROMPT_EVAL_FIXTURES) {
    describe(fixture.name, () => {
      const prompt = assembleFixturePrompt(fixture);

      for (const a of fixture.assertions) {
        test(a.description, () => {
          expect(a.assert(prompt)).toBe(true);
        });
      }
    });
  }
});
