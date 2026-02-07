import fs from 'fs'
import path from 'path'

describe('exists lib/i18n.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'lib', 'i18n.ts')
    expect(fs.existsSync(p)).toBe(true)
  })
})
