import fs from 'fs'
import path from 'path'

describe('exists lib/auth.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'lib', 'auth.ts')
    expect(fs.existsSync(p)).toBe(true)
  })
})
