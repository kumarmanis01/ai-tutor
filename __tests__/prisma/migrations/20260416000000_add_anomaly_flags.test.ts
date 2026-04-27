import fs from 'fs';
import path from 'path';

test('migration exists: prisma/migrations/20260416000000_add_anomaly_flags/migration.sql', () => {
  const p = path.join(process.cwd(), 'prisma/migrations/20260416000000_add_anomaly_flags/migration.sql');
  expect(fs.existsSync(p)).toBe(true);
});
