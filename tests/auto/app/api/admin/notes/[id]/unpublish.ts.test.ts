describe('import app/api/admin/notes/[id]/unpublish.ts', () => {
  it('imports without throwing', async () => {
    await expect(async () => {
      await import('../../../../../../app/api/admin/notes/[id]/unpublish.ts');
    }).not.toThrow();
  });
});
