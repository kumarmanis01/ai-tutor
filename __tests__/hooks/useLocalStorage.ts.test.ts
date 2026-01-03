import fs from 'fs';
import path from 'path';

test('file exists: hooks/useLocalStorage.ts', () => {
  const p = path.join(process.cwd(), 'hooks/useLocalStorage.ts');
  expect(fs.existsSync(p)).toBe(true);
});
