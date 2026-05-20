/**
 * FILE OBJECTIVE:
 * - ESLint rule: ban direct prisma.analyticsEvent.create / createMany calls outside the three
 *   canonical allowed files. All other code must route through emitServerAnalyticsEvent().
 *
 * ALLOWED FILES (these write to the DB intentionally):
 *   - lib/analytics/server.ts           — the DB fallback inside the central emitter
 *   - worker/services/analyticsIngestWorker.ts — the final BullMQ consumer
 *   - app/api/analytics/event/route.ts  — the client batch ingestion endpoint
 *
 * LINKED UNIT TEST:
 * - tests/unit/eslint-rules/no-direct-analytics-create.test.cjs
 *
 * EDIT LOG:
 * - 2026-05-20T00:00:00Z | copilot | created to enforce central analytics emitter policy
 */

'use strict';

const ALLOWED_SUFFIXES = [
  'lib/analytics/server.ts',
  'worker/services/analyticsIngestWorker.ts',
  'app/api/analytics/event/route.ts',
];

/** Normalize path separators so Windows paths compare correctly. */
function normalizePath(p) {
  return p ? p.replace(/\\/g, '/') : '';
}

function isAllowedFile(filename) {
  const normalized = normalizePath(filename);
  return ALLOWED_SUFFIXES.some((suffix) => normalized.endsWith(suffix));
}

/**
 * Returns true when the CallExpression node represents
 * prisma.analyticsEvent.create(...) or prisma.analyticsEvent.createMany(...)
 */
function isAnalyticsDirectCall(node) {
  try {
    const callee = node.callee;
    if (!callee || callee.type !== 'MemberExpression') return false;
    const method = callee.property && callee.property.name;
    if (method !== 'create' && method !== 'createMany') return false;

    const obj = callee.object;
    if (!obj || obj.type !== 'MemberExpression') return false;
    if (!obj.property || obj.property.name !== 'analyticsEvent') return false;

    const root = obj.object;
    if (!root) return false;
    // Handle both `prisma.analyticsEvent.create` and `db.analyticsEvent.create`
    // but only flag when the root identifier matches known prisma client names.
    const rootName = root.type === 'Identifier' ? root.name : null;
    return rootName === 'prisma' || rootName === 'db';
  } catch (_) {
    return false;
  }
}

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow direct prisma.analyticsEvent.create/createMany calls outside the central analytics emitter. ' +
        'Use emitServerAnalyticsEvent() from @/lib/analytics/server instead.',
      recommended: false,
    },
    schema: [],
    messages: {
      noDirectCreate:
        "Direct prisma.analyticsEvent.{{ method }}() is forbidden here. " +
        "Use emitServerAnalyticsEvent() from '@/lib/analytics/server' — it handles queue enqueuing and DB fallback. " +
        "Allowed only in: lib/analytics/server.ts, worker/services/analyticsIngestWorker.ts, app/api/analytics/event/route.ts.",
    },
  },
  create(context) {
    const filename = context.getFilename ? context.getFilename() : (context.filename ?? '');
    if (isAllowedFile(filename)) return {};

    return {
      CallExpression(node) {
        if (isAnalyticsDirectCall(node)) {
          const method =
            node.callee &&
            node.callee.property &&
            node.callee.property.name;
          context.report({
            node,
            messageId: 'noDirectCreate',
            data: { method: method || 'create' },
          });
        }
      },
    };
  },
};
