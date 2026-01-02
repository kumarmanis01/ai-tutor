/* eslint-disable @typescript-eslint/no-require-imports */
describe('import hooks/useContinueLearning.ts', () => {
  it('imports without throwing', () => {
    const path = require('path')
    const file = path.join(process.cwd(), 'hooks', 'useContinueLearning.ts')
    expect(() => require(file)).not.toThrow()
  })
})
