import fs from 'fs'
import path from 'path'

describe('exists lib/aiContext.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'lib', 'aiContext.ts')
    expect(fs.existsSync(p)).toBe(true)
  })
})
