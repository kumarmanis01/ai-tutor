import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

// Use local AI rules plugin by path (FlatCompat will load it)

const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    ignores: ['node_modules/**', '.next/**', 'out/**', 'build/**', 'next-env.d.ts', 'eslint-rules/tests/tmp/**'],
  },
  // Project-specific rule overrides to reduce noisy errors in the landing
  // components (these are intentional content strings and occasional `any`
  // usages in the marketing UI). Tweak later if you prefer stricter linting.
  {
    rules: {
      'react/no-unescaped-entities': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      // Enforce routing logs through centralized logger
      'no-console': ['error'],
    },
  },
  // Allow console usage inside the logger implementation only
  {
    files: ['lib/logger.ts'],
    rules: {
      'no-console': 'off',
    },
  },
  // Allow console in local utility scripts
  {
    files: ['scripts/**', 'bin/**', 'tools/**', 'scripts/**/*.js', 'scripts/**/*.ts', 'lib/*.runtime.js', 'lib/*.cjs'],
    // Allow console usage and legacy require in scripts, CLIs and small tooling shims.
    // This preserves strict `no-console` for app code while permitting developer
    // scripts and runtime shims to use console.* for straightforward output.
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  // (removed lib/logger.js override — logger is provided by `lib/logger.ts`)
  // AI architecture plugin is available in `eslint-rules/` for review.
  // Allow commonjs requires and console usage inside eslint-rules (tests and helpers)
  {
    files: ['eslint-rules/**'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      'no-console': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      // Turn off the ai-guards rule for the rule definitions themselves
      'ai-guards/no-string-filters': 'off',
    }
  },
  // Plugin: AI pipeline guardrails removed
];

// Load local ESLint rules (CommonJS) and register the no-string-filters rule
const require = createRequire(import.meta.url);
const logger = { warn: (...args) => console.warn(...args) };
try {
  const noStringFiltersRule = require('./eslint-rules/no-string-filters.cjs');
  // Wrap the rule into a plugin shape expected by ESLint
  const aiGuardsPlugin = { rules: { 'no-string-filters': noStringFiltersRule } };
  eslintConfig.push({
    plugins: { 'ai-guards': aiGuardsPlugin },
    rules: { 'ai-guards/no-string-filters': 'error' },
  });
} catch (e) {
  // If local rule cannot be loaded, don't fail start; warn during lint runs
  logger.warn('Could not load local ESLint rule ai-guards/no-string-filters:', e && e.message);
}

export default eslintConfig;
