import fs from 'fs';
import path from 'path';

test('file exists: lib/guards/noStringFilters.ts', () => {
  const p = path.join(process.cwd(), 'lib/guards/noStringFilters.ts');
  expect(fs.existsSync(p)).toBe(true);
});
