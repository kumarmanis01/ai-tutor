import fs from 'fs';
import path from 'path';

test('file exists: lib/callLLM.ts', () => {
  const p = path.join(process.cwd(), 'lib/callLLM.ts');
  expect(fs.existsSync(p)).toBe(true);
});
