module.exports = {
  plugins: { 'ai-arch': require('../../index.cjs') },
  rules: {
    'ai-arch/no-llm-outside-callLLM': 'error'
  }
}