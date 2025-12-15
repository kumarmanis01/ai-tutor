/**
 * ai-architecture/enforce-prompt-structure
 * Warning: enforce basic prompt formatting rules in workers/callLLM files.
 * - Template literals > 80 chars should include the word JSON
 * - Prompts should be literal template strings (not concatenated)
 */
module.exports = {
  meta: { type: 'suggestion', docs: { description: 'Enforce basic prompt structure in worker prompts' }, schema: [] },
  create(context) {
    const filename = context.getFilename() || ''
    const relevant = filename.includes('/workers/') || filename.includes('lib/callLLM') || filename.includes('\\workers\\')
    if (!relevant) return {}
    return {
      TemplateLiteral(node) {
        // require presence of JSON keyword in prompt-like template literals
        const text = context.getSourceCode().getText(node)
        if (!/\bJSON\b/.test(text)) {
          context.report({ node, message: 'Prompt template literals should mention JSON and instruct JSON-only output.' })
        }
      },
      BinaryExpression(node) {
        // discourage string concatenation for prompts
        if (node.operator === '+' && (node.left.type === 'TemplateLiteral' || node.right.type === 'TemplateLiteral')) {
          context.report({ node, message: 'Avoid concatenating template literals for prompts. Use a single template literal.' })
        }
      }
    }
  }
}
