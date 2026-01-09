/**
 * ai-architecture/no-any-in-ai-pipeline
 * Disallow `any` types and `@ts-ignore` in AI pipeline folders.
 */
module.exports = {
  meta: { type: 'problem', docs: { description: 'Disallow any types in AI pipeline' }, schema: [] },
  create(context) {
    const filename = context.getFilename() || ''
    const relevant = filename.includes('/worker/') || filename.includes('/hydrators/') || filename.includes('lib/callLLM') || filename.includes('\\worker\\') || filename.includes('\\hydrators\\')
    if (!relevant) return {}
    return {
      TSAnyKeyword(node) {
        context.report({ node, message: 'Using `any` is forbidden in AI pipeline files.' })
      },
      Program(node) {
        const source = context.getSourceCode().getText()
        // detect @ts-ignore or @ts-expect-error but allow a documented escape hatch ALLOW_TS_IGNORE
        const matches = source.match(/@ts-(ignore|expect-error)/g)
        if (matches && !/ALLOW_TS_IGNORE/.test(source)) {
          context.report({ node, message: 'Do not use @ts-ignore or @ts-expect-error in AI pipeline files. Add ALLOW_TS_IGNORE comment to permit if absolutely necessary.' })
        }
      }
    }
  }
}
