import fs from 'fs';
import path from 'path';

test('file exists: app/api/admin/analytics/funnel/[courseId]/route.ts', () => {
  const p = path.join(process.cwd(), 'app/api/admin/analytics/funnel/[courseId]/route.ts');
  expect(fs.existsSync(p)).toBe(true);
});
