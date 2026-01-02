import fs from 'fs';
import path from 'path';

test('file exists: producers/enqueueNoteHydration.ts', () => {
  const p = path.join(process.cwd(), 'producers/enqueueNoteHydration.ts');
  expect(fs.existsSync(p)).toBe(true);
});
