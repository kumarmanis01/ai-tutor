/**
 * ESLint rule: no-import-time-redis
 * Disallow creating Redis/BullMQ clients at module scope (top-level).
 * Flags `new IORedis(...)` and `new Queue(...)` (or `Queue(...)`) when used in the module top-level.
 */
module.exports = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow creating Redis or Queue instances at module import time; use lazy-init factories",
      recommended: false,
    },
    schema: [],
    messages: {
      topLevel: "Redis/Queue clients must be lazy-initialized. Do not create them at module scope.",
    },
  },
  create(context) {
    function isTopLevel(node) {
      let p = node.parent;
      while (p) {
        if (p.type === 'Program') return true;
        // If any function/block/etc found, it's not module-top-level
        if (p.type === 'FunctionDeclaration' || p.type === 'FunctionExpression' || p.type === 'ArrowFunctionExpression' || p.type === 'ClassDeclaration') return false;
        p = p.parent;
      }
      return false;
    }

    return {
      NewExpression(node) {
        try {
          const callee = node.callee;
          const name = callee && callee.name;
          if (!name) return;
          if ((name === 'IORedis' || name === 'Queue') && isTopLevel(node)) {
            context.report({ node, messageId: 'topLevel' });
          }
        } catch (_) {}
      },
      CallExpression(node) {
        try {
          const callee = node.callee;
          const name = callee && callee.name;
          // Some code may call Queue(...) without `new` — catch that too
          if ((name === 'Queue') && isTopLevel(node)) {
            context.report({ node, messageId: 'topLevel' });
          }
        } catch (_) {}
      }
    };
  },
};
