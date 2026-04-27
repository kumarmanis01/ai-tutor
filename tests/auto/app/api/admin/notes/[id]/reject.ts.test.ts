/* eslint-disable @typescript-eslint/no-require-imports */
describe('import app/api/admin/notes/[id]/reject.ts', () => {
  it('imports without throwing', () => {
    const path = require('path')
    const file = path.join(process.cwd(), 'app', 'api', 'admin', 'notes', '[id]', 'reject.ts')
    expect(() => require(file)).not.toThrow()
  })
})
