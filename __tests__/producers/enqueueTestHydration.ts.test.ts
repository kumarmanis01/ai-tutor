import fs from 'fs';
import path from 'path';

test('file exists: producers/enqueueTestHydration.ts', () => {
  const p = path.join(process.cwd(), 'producers/enqueueTestHydration.ts');
  expect(fs.existsSync(p)).toBe(true);
});
