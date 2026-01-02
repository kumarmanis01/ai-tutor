import fs from 'fs';
import path from 'path';

test('file exists: lib/ai-engine/types.ts', () => {
  const p = path.join(process.cwd(), 'lib/ai-engine/types.ts');
  expect(fs.existsSync(p)).toBe(true);
});
