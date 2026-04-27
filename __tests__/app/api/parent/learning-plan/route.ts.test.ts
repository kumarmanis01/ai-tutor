import fs from 'fs'
import path from 'path'

test('file exists: app/api/parent/learning-plan/route.ts', () => {
  const p = path.join(process.cwd(), 'app/api/parent/learning-plan/route.ts')
  expect(fs.existsSync(p)).toBe(true)
})
