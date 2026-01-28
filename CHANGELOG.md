# Changelog

## Unreleased

- chore(prompts): centralize prompt templates under `prompts/` and integrate templates into worker services
  - Added: `prompts/base_context.md`, `prompts/chapters.md`, `prompts/topics.md`, `prompts/notes.md`, `prompts/questions.*.md`, `prompts/quality_control.md`, `prompts/additional_examples.md`, `prompts/prompt_config.json`
  - Integrated prompt templates into `worker/services/*Worker.ts` (syllabus, notes, questions) with placeholder substitution and fallbacks
  - Added smoke script `scripts/smoke-render.cjs` to validate template rendering
  - Added unit tests under `tests/unit/prompts/` to validate templates and `prompt_config.json`
  - Fixed lint warnings related to unused variables
