'/**
 * FILE OBJECTIVE:
 * - Thin compatibility wrapper that re-exports the canonical `GlobalLoaderProvider`
 *   and `useGlobalLoader` hook from `components/UI/loaders` so existing layout
 *   imports (`@/context/GlobalLoaderProvider`) continue to work.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/loaders/FullScreenLoader.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-22T00:00:00Z | copilot | re-export provider from components/UI/loaders to consolidate providers
 */

'use client';

export { GlobalLoaderProvider, useGlobalLoader } from '@/components/UI/loaders';
