describe('import app/api/admin/notes/[id]/approve.ts', () => {
  it('imports without throwing', async () => {
    await expect(async () => {
      await import('../../../../../../app/api/admin/notes/[id]/approve.ts');
    }).not.toThrow();
  });
});
