import fs from 'fs'
import path from 'path'

describe('Admin API import policy', () => {
  test('admin API routes must not import generators or executor code', async () => {
    const adminDir = path.join(process.cwd(), 'app', 'api', 'admin')
    function walk(dir: string): string[] {
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      let files: string[] = []
      for (const e of entries) {
        const p = path.join(dir, e.name)
        if (e.isDirectory()) files = files.concat(walk(p))
        else if (e.isFile() && p.endsWith('.ts')) files.push(p)
      }
      return files
    }

    const files = walk(adminDir)
    const forbidden = [/\bexecutor\b/i, /\/generators?\b/i, /\bGenerator\b/i]

    for (const f of files) {
      const src = fs.readFileSync(f, 'utf8')
      for (const rx of forbidden) {
        expect(rx.test(src)).toBe(false)
      }
    }
  })
})
