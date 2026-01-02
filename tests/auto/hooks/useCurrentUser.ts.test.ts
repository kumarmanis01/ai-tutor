/* eslint-disable @typescript-eslint/no-require-imports */
describe('import hooks/useCurrentUser.ts', () => {
  it('imports without throwing', () => {
    const path = require('path')
    const file = path.join(process.cwd(), 'hooks', 'useCurrentUser.ts')
    expect(() => require(file)).not.toThrow()
  })
})
