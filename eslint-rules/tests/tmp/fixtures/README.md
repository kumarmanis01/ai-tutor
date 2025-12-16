This folder contains fixtures used by the ESLint custom-rule test harness.

- `valid.js` — example that SHOULD pass the `ai-arch/no-llm-outside-callLLM` rule by using the approved `lib/callLLM` wrapper.
- `invalid.js` — example that SHOULD fail the rule by importing the OpenAI SDK directly.

For clarity, two additional descriptive copies are provided:
- `uses-callLLM.js` — same as `valid.js` but with a clearer name.
- `uses-openai-directly.js` — same as `invalid.js` but with a clearer name.

Do NOT remove `valid.js` or `invalid.js` unless you also update the test harness.

These fixtures are intentionally minimal; they exist only to exercise the rule.
