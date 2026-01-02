import fs from 'fs';
import path from 'path';

test('file exists: scripts/seed-ai-content.ts', () => {
  const p = path.join(process.cwd(), 'scripts/seed-ai-content.ts');
  expect(fs.existsSync(p)).toBe(true);
});
