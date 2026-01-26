import fs from 'fs';
import path from 'path';

const p = path.join(process.cwd(), 'app/api/admin/content-central/route.ts');

test('file exists: app/api/admin/content-central/route.ts', () => {
  expect(fs.existsSync(p)).toBe(true);
});

test('exports GET handler', async () => {
  const mod = await import(p);
  expect(typeof mod.GET).toBe('function');
});
