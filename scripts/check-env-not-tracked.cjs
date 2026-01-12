const { execSync } = require('child_process')

try {
  // exit 0 if not tracked, non-zero if tracked
  execSync('git ls-files --error-unmatch .env.production', { stdio: 'ignore' })
  console.error('.env.production IS tracked in git. Remove it from the index and rotate secrets.')
  process.exit(2)
} catch (e) {
  // git ls-files returns non-zero when not tracked — success
  process.exit(0)
}
