import fs from 'fs';
import path from 'path';

test('migration exists: prisma/migrations/20260412000000_add_installment_table/migration.sql', () => {
  const p = path.join(process.cwd(), 'prisma/migrations/20260412000000_add_installment_table/migration.sql');
  expect(fs.existsSync(p)).toBe(true);
});
