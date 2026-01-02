import fs from 'fs';
import path from 'path';

test('file exists: app/api/learn/progress/[courseId]/route.ts', () => {
  const p = path.join(process.cwd(), 'app/api/learn/progress/[courseId]/route.ts');
  expect(fs.existsSync(p)).toBe(true);
});
