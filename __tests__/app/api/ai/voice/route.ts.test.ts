import fs from 'fs';
import path from 'path';

test('file exists: app/api/ai/voice/route.ts', () => {
  const p = path.join(process.cwd(), 'app/api/ai/voice/route.ts');
  expect(fs.existsSync(p)).toBe(true);
});
