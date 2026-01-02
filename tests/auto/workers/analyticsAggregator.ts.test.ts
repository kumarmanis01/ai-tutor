import fs from 'fs';

describe('exists workers/analyticsAggregator.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\workers\\analyticsAggregator.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
