import fs from 'fs';
import path from 'path';

test('file exists: worker/orchestrator.ts', () => {
  const p = path.join(process.cwd(), 'worker/orchestrator.ts');
  expect(fs.existsSync(p)).toBe(true);
});
