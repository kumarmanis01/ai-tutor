import fs from 'fs';
import path from 'path';

describe('exists lib/alerts/sinks/webhook.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'lib/alerts/sinks/webhook.ts');
    expect(fs.existsSync(p)).toBe(true);
  });
});
