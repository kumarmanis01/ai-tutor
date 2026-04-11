import fs from 'fs';
import path from 'path';

test('file exists: worker/services/installmentDunningWorker.ts', () => {
  const p = path.join(process.cwd(), 'worker/services/installmentDunningWorker.ts');
  expect(fs.existsSync(p)).toBe(true);
});
