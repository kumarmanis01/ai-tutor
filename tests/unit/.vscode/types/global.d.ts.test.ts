import fs from 'fs'
import path from 'path'

describe('.vscode/types/global.d.ts', () => {
	test('file exists', () => {
		const p = path.join(process.cwd(), '.vscode', 'types', 'global.d.ts')
		expect(fs.existsSync(p)).toBe(true)
	})
})

