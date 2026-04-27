/* eslint-disable @typescript-eslint/no-require-imports */
describe('import hooks/useFeatureGrid.ts', () => {
  it('imports without throwing', () => {
    const path = require('path')
    const file = path.join(process.cwd(), 'hooks', 'useFeatureGrid.ts')
    expect(() => require(file)).not.toThrow()
  })
})
