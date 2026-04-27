/* eslint-disable @typescript-eslint/no-require-imports */
describe('import hydrators/assembleTest.ts', () => {
  it('imports without throwing', () => {
    const path = require('path')
    const file = path.join(process.cwd(), 'hydrators', 'assembleTest.ts')
    expect(() => require(file)).not.toThrow()
  })
})
