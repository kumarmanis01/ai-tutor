/* eslint-disable @typescript-eslint/no-require-imports */
describe('import app/api/billing/utility.ts', () => {
  it('imports without throwing', () => {
    const path = require('path')
    const file = path.join(process.cwd(), 'app', 'api', 'billing', 'utility.ts')
    expect(() => require(file)).not.toThrow()
  })
})
