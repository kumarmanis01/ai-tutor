/**
 * ai-architecture/require-system-setting-helper
 * Enforce using `isSystemSettingEnabled()` helper instead of direct `systemSetting.value` access.
 */
module.exports = {
  meta: { type: 'problem', docs: { description: 'Require isSystemSettingEnabled helper' }, schema: [] },
  create(context) {
    const filename = context.getFilename() || ''
    const relevant = filename.includes('/worker/') || filename.includes('/hydrators/') || filename.includes('\\worker\\') || filename.includes('\\hydrators\\')
    if (!relevant) return {}
    return {
      MemberExpression(node) {
        // report direct access to systemSetting.value
        try {
          if (node.object && node.object.type === 'Identifier' && node.object.name === 'systemSetting' && node.property && ((node.property.type === 'Identifier' && node.property.name === 'value') || (node.property.type === 'Literal' && node.property.value === 'value'))) {
            context.report({ node, message: 'Do not access systemSetting.value directly. Use isSystemSettingEnabled() helper.' })
          }
        } catch (e) {
          // ignore
        }
      }
    }
  }
}
