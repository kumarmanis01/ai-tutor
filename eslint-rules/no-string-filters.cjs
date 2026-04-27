/**
 * ESLint rule: no-string-filters
 * Flags string/template literals that include string-based filters like `?board=` or `subject=`.
 * This is a pragmatic, best-effort rule to prevent accidental client/server code using string filters.
 */
module.exports = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Disallow string-based academic filters (board, subject, grade, class)",
      recommended: false,
    },
    schema: [],
    messages: {
      avoid: "Avoid string-based filters like '{{match}}'. Use canonical IDs (boardId, classId, subjectId) instead.",
    },
  },
  create(context) {
    function checkString(value) {
      if (!value || typeof value !== 'string') return;
      // Match only standalone short param names (e.g. `?board=`) but
      // ignore canonical ID params such as `boardId=` or `subjectId=`.
      const regexes = [
        /(^|\?)board=(?!Id)/i,
        /(^|\?)subject=(?!Id)/i,
        /(^|\?)grade=(?!Id)/i,
        /(^|\?)class=(?!Id)/i,
      ];
      for (const rx of regexes) {
        if (rx.test(String(value))) return rx.source;
      }
      return null;
    }

    return {
      Literal(node) {
        try {
          const val = node.value;
          const m = checkString(val);
          if (m) context.report({ node, messageId: 'avoid', data: { match: m } });
        } catch (_) {}
      },
      TemplateElement(node) {
        try {
          const raw = node.value && node.value.raw;
          const m = checkString(raw);
          if (m) context.report({ node, messageId: 'avoid', data: { match: m } });
        } catch (_) {}
      },
    };
  },
};
