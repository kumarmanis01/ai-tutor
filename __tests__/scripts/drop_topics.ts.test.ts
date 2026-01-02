import fs from 'fs';
import path from 'path';

test('file exists: scripts/drop_topics.ts', () => {
  const p = path.join(process.cwd(), 'scripts/drop_topics.ts');
  expect(fs.existsSync(p)).toBe(true);
});
