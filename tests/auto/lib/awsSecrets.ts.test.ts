import fs from 'fs'
import path from 'path'

describe('exists lib/awsSecrets.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'lib', 'awsSecrets.ts')
    expect(fs.existsSync(p)).toBe(true)
  })
})
