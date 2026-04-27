import fs from 'fs'
import path from 'path'

describe('exists lib/callLLM.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'lib', 'callLLM.ts')
    expect(fs.existsSync(p)).toBe(true)
  })
})
