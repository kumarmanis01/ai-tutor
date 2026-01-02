describe('import app/api/admin/notes/[id]/unpublish.ts', () => {
  it('imports without throwing', async () => {
    const path = require('path')
    const file = path.join(process.cwd(), 'app', 'api', 'admin', 'notes', '[id]', 'unpublish.ts')
    await expect(() => {
      // Use CommonJS-style require so jest can resolve via ts-jest
      // eslint-disable-next-line global-require,import/no-dynamic-require
      require(file)
    }).not.toThrow()
  })
})
