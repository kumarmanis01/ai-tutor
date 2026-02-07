import fs from 'fs'
import path from 'path'

describe('exists lib/hydrationConstants.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'lib', 'hydrationConstants.ts')
    expect(fs.existsSync(p)).toBe(true)
  })
})
