/**
 * Rule: require-copilot-lock
 * Enforces presence of the Copilot AI lock header comment in critical directories.
 */
module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Require Copilot AI lock header comment in admin/api/hydrator/worker files',
    },
    schema: [
      {
        type: 'object',
        properties: {
          directories: {
            type: 'array',
            items: { type: 'string' }
          }
        },
        additionalProperties: false
      }
    ],
  },
  create(context) {
    const options = context.options && context.options[0] ? context.options[0] : {}
    const directories = options.directories || ['app/admin', 'app/api', 'workers', 'hydrators']
    const filename = context.getFilename() || ''

    const relevant = directories.some((d) => filename.includes(d))
    if (!relevant) return {}

    return {
      Program(node) {
        const sourceCode = context.getSourceCode()
        const comments = sourceCode.getAllComments().map((c) => c.value).join('\n')
        const ok = /AI CONTENT ENGINE NOTICE|COPILOT RULES|COPILOT_AI_LOCK|AI CONTENT ENGINE/i.test(comments)
        if (!ok) {
          context.report({ node, message: 'Missing Copilot AI lock header comment. Add the AI CONTENT ENGINE NOTICE header per docs/COPILOT_AI_LOCK.md' })
        }
      }
    }
  }
}
