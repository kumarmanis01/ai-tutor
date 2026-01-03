import fs from 'fs';
import path from 'path';

test('file exists: hooks/useParentMode.ts', () => {
  const p = path.join(process.cwd(), 'hooks/useParentMode.ts');
  expect(fs.existsSync(p)).toBe(true);
});
