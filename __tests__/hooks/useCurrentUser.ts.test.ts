import fs from 'fs';
import path from 'path';

test('file exists: hooks/useCurrentUser.ts', () => {
  const p = path.join(process.cwd(), 'hooks/useCurrentUser.ts');
  expect(fs.existsSync(p)).toBe(true);
});
