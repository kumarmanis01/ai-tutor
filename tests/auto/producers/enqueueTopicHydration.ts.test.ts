import fs from 'fs';

describe('exists producers/enqueueTopicHydration.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\producers\\enqueueTopicHydration.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
