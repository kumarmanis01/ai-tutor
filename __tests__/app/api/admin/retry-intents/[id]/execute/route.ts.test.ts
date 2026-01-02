import fs from 'fs';
import path from 'path';

test('file exists: app/api/admin/retry-intents/[id]/execute/route.ts', () => {
  const p = path.join(process.cwd(), 'app/api/admin/retry-intents/[id]/execute/route.ts');
  expect(fs.existsSync(p)).toBe(true);
});
