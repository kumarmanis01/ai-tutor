'use strict';
// Force NODE_ENV=test for all integration tests regardless of shell environment.
// The deploy script exports .env.production (which may contain NODE_ENV=production)
// before invoking jest. Jest only sets NODE_ENV=test when it is NOT already set,
// so we force it here in setupFiles (runs before any test module is loaded).
process.env.NODE_ENV = 'test';
// Allow LLM calls during unit tests to exercise callLLM analytics/logging paths.
process.env.ALLOW_LLM_CALLS = '1';
