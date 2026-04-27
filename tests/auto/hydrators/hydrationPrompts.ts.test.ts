/* eslint-disable @typescript-eslint/no-require-imports */
describe('import hydrators/hydrationPrompts.ts', () => {
  it('imports without throwing', () => {
    const path = require('path')
    const file = path.join(process.cwd(), 'hydrators', 'hydrationPrompts.ts')
    expect(() => require(file)).not.toThrow()
  })
})
