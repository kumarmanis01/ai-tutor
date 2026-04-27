module.exports = {
  plugins: { 'ai-guards': require('../../index.cjs') },
  rules: {
    'ai-guards/no-import-time-redis': 'error'
  }
}