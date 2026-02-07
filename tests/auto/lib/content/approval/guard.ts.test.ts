import fs from 'fs'
import path from 'path'

describe('exists lib/content/approval/guard.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'lib', 'content', 'approval', 'guard.ts')
    expect(fs.existsSync(p)).toBe(true)
  })
})
