import fs from 'fs';

describe('exists scripts/drop_topics.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\scripts\\drop_topics.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
