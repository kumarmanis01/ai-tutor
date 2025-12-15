/**
 * ai-architecture/no-prisma-in-ui
 * Forbids importing Prisma or server-side prisma client in UI / app files.
 */
module.exports = {
  meta: { type: 'problem', docs: { description: 'Disallow prisma imports in UI client components' }, schema: [] },
  create(context) {
    const filename = context.getFilename() || ''
    const uiZone = filename.includes('/app/') || filename.includes('\\app\\') || filename.includes('/components/') || filename.includes('\\components\\')
    if (!uiZone) return {}

    // track whether this file is a client component ("use client")
    let isClient = false

    return {
      Program(node) {
        const sourceText = context.getSourceCode().getText(node)
        isClient = /["']use client["']/.test(sourceText)
      },
      ImportDeclaration(node) {
        if (!isClient) return
        const src = node.source && node.source.value
        if (!src) return
        if (String(src).includes('@prisma/client') || String(src).includes('/lib/prisma') || String(src).includes('@/lib/prisma')) {
          context.report({ node, message: 'Prisma imports are forbidden in UI client components. Use server APIs/workers.' })
        }
      },
      CallExpression(node) {
        if (!isClient) return
        if (node.callee && node.callee.name === 'require' && node.arguments && node.arguments[0]) {
          const arg = node.arguments[0]
          if (arg.type === 'Literal' && (String(arg.value).includes('@prisma/client') || String(arg.value).includes('/lib/prisma') || String(arg.value).includes('@/lib/prisma'))) {
            context.report({ node, message: 'Prisma requires are forbidden in UI client components. Use server APIs/workers.' })
          }
        }
      }
    }
  }
}
