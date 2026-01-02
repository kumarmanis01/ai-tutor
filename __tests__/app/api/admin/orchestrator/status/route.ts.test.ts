import fs from 'fs';
import path from 'path';

test('file exists: app/api/admin/orchestrator/status/route.ts', () => {
  const p = path.join(process.cwd(), 'app/api/admin/orchestrator/status/route.ts');
  expect(fs.existsSync(p)).toBe(true);
});
