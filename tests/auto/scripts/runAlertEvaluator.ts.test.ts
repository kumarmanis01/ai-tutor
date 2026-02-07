import fs from 'fs';
import path from 'path';

describe('exists scripts/runAlertEvaluator.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'scripts/runAlertEvaluator.ts');
    expect(fs.existsSync(p)).toBe(true);
  });
});
