/* eslint-disable @typescript-eslint/no-require-imports */
describe('import hooks/useParentMode.ts', () => {
  it('imports without throwing', () => {
    const path = require('path')
    const file = path.join(process.cwd(), 'hooks', 'useParentMode.ts')
    expect(() => require(file)).not.toThrow()
  })
})
