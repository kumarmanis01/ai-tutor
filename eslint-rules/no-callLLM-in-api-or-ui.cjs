/**
 * ai-architecture/no-callLLM-in-api-or-ui
 * Forbids importing `callLLM` from API routes or UI components; callLLM must only be used in workers.
 */
module.exports = {
  meta: { type: 'problem', docs: { description: 'Disallow callLLM imports in API routes or UI' }, schema: [] },
  create(context) {
    const filename = context.getFilename() || ''
    const inApiOrUi = filename.includes('/app/') || filename.includes('\\app\\') || filename.includes('/app/api') || filename.includes('\\app\\api\\') || filename.includes('/api/') || filename.includes('\\api\\') || filename.includes('/components/') || filename.includes('\\components\\')
    if (!inApiOrUi) return {}
    return {
      ImportDeclaration(node) {
        const src = node.source && node.source.value
        if (!src) return
        const normalized = String(src)
        if (normalized.includes('callLLM') || normalized.endsWith('/callLLM') || /callLLM\.(ts|js)$/.test(normalized)) {
          context.report({ node, message: 'Importing callLLM in API routes or UI is forbidden. Use workers or server APIs.' })
        }
      },
      CallExpression(node) {
        if (node.callee && node.callee.name === 'require' && node.arguments && node.arguments[0]) {
          const arg = node.arguments[0]
          if (arg.type === 'Literal' && /callLLM/.test(String(arg.value))) {
            context.report({ node, message: 'Requiring callLLM in API routes or UI is forbidden. Use workers or server APIs.' })
          }
        }
      }
    }
  }
}
