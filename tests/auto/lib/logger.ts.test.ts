import fs from 'fs'
import path from 'path'

describe('exists lib/logger.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'lib', 'logger.ts')
    expect(fs.existsSync(p)).toBe(true)
  })
})
