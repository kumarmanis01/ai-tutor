/**
 * ai-architecture/no-llm-outside-callLLM
 * Forbids importing LLM SDKs except in the central `lib/callLLM` module.
 */
module.exports = {
  meta: { type: 'problem', docs: { description: 'Disallow LLM SDK imports outside lib/callLLM' }, schema: [] },
  create(context) {
    const filename = context.getFilename() || ''
    function isAllowedFile() {
      // Allow only the canonical file path ending with lib/callLLM.js or lib/callLLM.ts
      return /[\\\/]lib[\\\/]callLLM\.(ts|js)$/.test(filename)
    }
    function isLLMSource(src) {
      if (!src || typeof src !== 'string') return false
      return /(^openai$|openai|@openai|openai-edge|openai-client)/i.test(src)
    }
    return {
      ImportDeclaration(node) {
        const src = node.source && node.source.value
        if (isLLMSource(src) && !isAllowedFile()) {
          context.report({ node, message: 'LLM SDK imports are only allowed in lib/callLLM.' })
        }
      },
      CallExpression(node) {
        if (node.callee && node.callee.name === 'require' && node.arguments && node.arguments[0]) {
          const arg = node.arguments[0]
          if (arg.type === 'Literal' && isLLMSource(arg.value) && !isAllowedFile()) {
            context.report({ node, message: 'LLM SDK requires are only allowed in lib/callLLM.' })
          }
        }
      }
    }
  }
}
