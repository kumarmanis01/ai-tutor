/* eslint-disable @typescript-eslint/no-require-imports */
describe('import hooks/useLocalStorage.ts', () => {
  it('imports without throwing', () => {
    const path = require('path')
    const file = path.join(process.cwd(), 'hooks', 'useLocalStorage.ts')
    expect(() => require(file)).not.toThrow()
  })
})
