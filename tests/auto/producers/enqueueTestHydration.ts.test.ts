import fs from 'fs';

describe('exists producers/enqueueTestHydration.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\producers\\enqueueTestHydration.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
