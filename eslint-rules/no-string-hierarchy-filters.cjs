module.exports = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow string-based academic hierarchy filters",
    },
    messages: {
      forbidden:
        "Use canonical ID fields (boardId, classId, subjectId, topicId) instead of string hierarchy fields.",
    },
    schema: [],
  },
  create(context) {
    const bannedKeys = [
      "board",
      "grade",
      "class",
      "subject",
      "topic",
      "slug",
    ];

    return {
      Property(node) {
        if (
          bannedKeys.includes(node.key?.name) &&
          node.parent?.type === "ObjectExpression"
        ) {
          context.report({
            node,
            messageId: "forbidden",
          });
        }
      },
    };
  },
};
