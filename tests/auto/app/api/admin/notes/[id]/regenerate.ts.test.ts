describe('import app/api/admin/notes/[id]/regenerate.ts', () => {
  it('imports without throwing', async () => {
    await expect(async () => {
      await import('../../../../../../app/api/admin/notes/[id]/regenerate.ts');
    }).not.toThrow();
  });
});
