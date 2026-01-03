/* eslint-disable @typescript-eslint/no-require-imports */
describe('import app/api/billing/constants.ts', () => {
  it('imports without throwing', () => {
    const path = require('path')
    const file = path.join(process.cwd(), 'app', 'api', 'billing', 'constants.ts')
    expect(() => require(file)).not.toThrow()
  })
})
