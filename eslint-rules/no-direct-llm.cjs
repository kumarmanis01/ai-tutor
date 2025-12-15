/**
 * Rule: no-direct-llm
 * Forbids importing known LLM SDKs (openai, @openai, openai-edge) outside approved server modules.
 */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow direct imports of LLM SDKs outside of the centralized callLLM implementation',
    },
    schema: [],
  },
  create(context) {
    const filename = context.getFilename() || '<unknown>'
    const allowedPathSegments = ['lib/callLLM', 'lib/ai', 'workers', 'scripts']

    function isAllowed() {
      return allowedPathSegments.some((seg) => filename.includes(seg))
    }

    function isLLMSource(source) {
      if (typeof source !== 'string') return false
      return /(^openai$|openai|@openai|openai-edge|openai-client)/i.test(source)
    }

    return {
      ImportDeclaration(node) {
        const src = node.source && node.source.value
        if (isLLMSource(src) && !isAllowed()) {
          context.report({ node, message: 'Direct LLM SDK imports are forbidden. Use the centralized `lib/callLLM` module.' })
        }
      },
      CallExpression(node) {
        // require('openai') style
        if (node.callee && node.callee.name === 'require' && node.arguments && node.arguments[0]) {
          const arg = node.arguments[0]
          if (arg.type === 'Literal' && isLLMSource(arg.value) && !isAllowed()) {
            context.report({ node, message: 'Direct LLM SDK requires are forbidden. Use the centralized `lib/callLLM` module.' })
          }
        }
      }
    }
  }
}
