/* eslint-disable @typescript-eslint/no-require-imports */
describe('import hooks/useStreaksAndGoals.ts', () => {
  it('imports without throwing', () => {
    const path = require('path')
    const file = path.join(process.cwd(), 'hooks', 'useStreaksAndGoals.ts')
    expect(() => require(file)).not.toThrow()
  })
})
