import fs from 'fs'
import path from 'path'

describe('exists lib/content/quiz/schema.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'lib', 'content', 'quiz', 'schema.ts')
    expect(fs.existsSync(p)).toBe(true)
  })
})
