/**
 * FILE OBJECTIVE:
 * - Next.js Edge Middleware entry point.
 * - Delegates all logic to proxy.ts so that auth guards, route canonicalization,
 *   and account-status enforcement run on every matched request.
 *
 * WHY THIS FILE EXISTS:
 * - Next.js only picks up middleware from middleware.ts at the project root.
 *   proxy.ts contains the correct logic and config export but was never loaded
 *   because the filename did not match the Next.js convention. This shim
 *   re-exports proxy's handler and matcher config so it becomes live.
 *
 * EDIT LOG:
 * - 2026-06-04 | claude | created: wire proxy.ts into Next.js middleware
 *                          convention to fix auth guards being dead in prod
 */

export { proxy as middleware, config } from './proxy';
