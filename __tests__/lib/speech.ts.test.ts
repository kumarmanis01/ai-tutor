import fs from 'fs';
import path from 'path';

test('file exists: lib/speech.ts', () => {
  const p = path.join(process.cwd(), 'lib/speech.ts');
  expect(fs.existsSync(p)).toBe(true);
});
