import fs from 'fs'
import path from 'path'

describe('exists lib/inputHandlers.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'lib', 'inputHandlers.ts')
    expect(fs.existsSync(p)).toBe(true)
  })
})
