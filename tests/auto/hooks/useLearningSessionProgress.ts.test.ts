/* eslint-disable @typescript-eslint/no-require-imports */
describe('import hooks/useLearningSessionProgress.ts', () => {
  it('imports without throwing', () => {
    const path = require('path')
    const file = path.join(process.cwd(), 'hooks', 'useLearningSessionProgress.ts')
    expect(() => require(file)).not.toThrow()
  })
})
