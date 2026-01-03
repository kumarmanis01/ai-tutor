import fs from 'fs';
import path from 'path';

test('file exists: worker/k8s-adapter.ts', () => {
  const p = path.join(process.cwd(), 'worker/k8s-adapter.ts');
  expect(fs.existsSync(p)).toBe(true);
});
