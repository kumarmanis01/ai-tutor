import fs from 'fs';
import path from 'path';

test('file exists: lib/exporters/pdf.ts', () => {
  const p = path.join(process.cwd(), 'lib/exporters/pdf.ts');
  expect(fs.existsSync(p)).toBe(true);
});
