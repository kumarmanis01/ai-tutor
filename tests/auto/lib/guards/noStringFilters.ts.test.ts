import fs from 'fs';

describe('exists lib/guards/noStringFilters.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\lib\\guards\\noStringFilters.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
