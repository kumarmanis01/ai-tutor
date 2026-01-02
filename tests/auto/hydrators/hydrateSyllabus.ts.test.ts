/* eslint-disable @typescript-eslint/no-require-imports */
describe('import hydrators/hydrateSyllabus.ts', () => {
  it('imports without throwing', () => {
    const path = require('path')
    const file = path.join(process.cwd(), 'hydrators', 'hydrateSyllabus.ts')
    expect(() => require(file)).not.toThrow()
  })
})
