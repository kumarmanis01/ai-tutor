/* eslint-disable @typescript-eslint/no-require-imports */
describe('import hydrators/hydrateQuestions.ts', () => {
  it('imports without throwing', () => {
    const path = require('path')
    const file = path.join(process.cwd(), 'hydrators', 'hydrateQuestions.ts')
    expect(() => require(file)).not.toThrow()
  })
})
