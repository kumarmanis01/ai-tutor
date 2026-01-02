import fs from 'fs';
import path from 'path';

test('file exists: lib/regeneration/retryService.ts', () => {
  const p = path.join(process.cwd(), 'lib/regeneration/retryService.ts');
  expect(fs.existsSync(p)).toBe(true);
});
