import fs from 'fs';
import path from 'path';

test('file exists: .vscode/types/global.d.ts', () => {
  const p = path.join(process.cwd(), '.vscode/types/global.d.ts');
  expect(fs.existsSync(p)).toBe(true);
});
