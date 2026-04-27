/*
Copilot Instructions
Do not add or remove rules from index.cjs without explicit architectural approval
Every rule must enforce a concrete, mechanical invariant
Do not create overlapping rules with ambiguous responsibility
callLLM must remain the only AI execution entry point
Hydrators enqueue only, workers execute only
UI never touches Prisma or AI
*/

module.exports = {
  rules: {
    // LLM isolation
    'no-llm-outside-callLLM': require('./no-llm-outside-callLLM.cjs'),
    'no-callLLM-in-api-or-ui': require('./no-callLLM-in-api-or-ui.cjs'),

    // AI pipeline discipline
    'no-ai-in-hydrators': require('./no-ai-in-hydrators.cjs'),
    'no-any-in-ai-pipeline': require('./no-any-in-ai-pipeline.cjs'),
    'enforce-prompt-structure': require('./enforce-prompt-structure.cjs'),

    // Data safety
    'no-prisma-in-ui': require('./no-prisma-in-ui.cjs'),
    'require-system-setting-helper': require('./require-system-setting-helper.cjs'),

    // Optional — keep only if they enforce real checks
    // 'no-direct-llm': require('./no-direct-llm.cjs'),
    // 'require-copilot-lock': require('./require-copilot-lock.cjs'),
    // Import-time Redis/Queue prevention
    'no-import-time-redis': require('./no-import-time-redis.cjs'),
  },
}
