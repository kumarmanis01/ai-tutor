import fs from 'fs';
import path from 'path';

test('file exists: producers/enqueueTopicHydration.ts', () => {
  const p = path.join(process.cwd(), 'producers/enqueueTopicHydration.ts');
  expect(fs.existsSync(p)).toBe(true);
});
