/* eslint-disable @typescript-eslint/no-require-imports */
describe('import hydrators/hydrateNotes.ts', () => {
  it('imports without throwing', () => {
    const path = require('path')
    const file = path.join(process.cwd(), 'hydrators', 'hydrateNotes.ts')
    expect(() => require(file)).not.toThrow()
  })
})
