import fs from 'fs'
import path from 'path'

describe('exists lib/content/lesson/mockLLM.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'lib', 'content', 'lesson', 'mockLLM.ts')
    expect(fs.existsSync(p)).toBe(true)
  })
})
