/**
 * ai-architecture/no-ai-in-hydrators
 * Forbids importing `callLLM` or LLM SDKs from files under /hydrators/
 */
module.exports = {
  meta: { type: 'problem', docs: { description: 'Disallow AI calls/imports in hydrators' }, schema: [] },
  create(context) {
    const filename = context.getFilename() || ''
    const relevant = filename.includes('/hydrators/') || filename.includes('\\hydrators\\')
    function isAIImport(src) {
      if (!src || typeof src !== 'string') return false
      // match explicit paths or modules
      const normalized = String(src)
      if (/\bopenai\b/i.test(normalized)) return true
      // explicit callLLM import paths
      if (normalized.endsWith('/callLLM') || /callLLM\.(ts|js)$/.test(normalized) || normalized === 'lib/callLLM' || normalized.endsWith('/lib/callLLM')) return true
      return false
    }
    if (!relevant) return {}
    return {
      ImportDeclaration(node) {
        const src = node.source && node.source.value
        if (isAIImport(src)) context.report({ node, message: 'Hydrators must not import or call AI libraries. Enqueue a job instead.' })
      },
      CallExpression(node) {
        if (node.callee && node.callee.name === 'require' && node.arguments && node.arguments[0]) {
          const arg = node.arguments[0]
          if (arg.type === 'Literal' && isAIImport(arg.value)) {
            context.report({ node, message: 'Hydrators must not require AI libraries. Enqueue a job instead.' })
          }
        }
      }
    }
  }
}
