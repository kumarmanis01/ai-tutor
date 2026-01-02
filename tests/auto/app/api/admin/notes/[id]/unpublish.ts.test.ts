/* eslint-disable @typescript-eslint/no-require-imports */
describe('import app/api/admin/notes/[id]/unpublish.ts', () => {
  it('imports without throwing', async () => {
    const path = require('path')
    const file = path.join(process.cwd(), 'app', 'api', 'admin', 'notes', '[id]', 'unpublish.ts')
    await expect(async () => {
      // Use CommonJS-style require so jest can resolve via ts-jest
       
      require(file)
    }).not.toThrow()
  })
})
