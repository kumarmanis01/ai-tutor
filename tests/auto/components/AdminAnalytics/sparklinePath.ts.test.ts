/* eslint-disable @typescript-eslint/no-require-imports */
describe('import components/AdminAnalytics/sparklinePath.ts', () => {
  it('imports without throwing', () => {
    const path = require('path')
    const file = path.join(process.cwd(), 'components', 'AdminAnalytics', 'sparklinePath.ts')
    expect(() => require(file)).not.toThrow()
  })
})
