describe('import hydrators/hydrateSyllabus.ts', () => {
  it('imports without throwing', async () => {
    await expect(async () => {
      await import('../../hydrators/hydrateSyllabus.ts');
    }).not.toThrow();
  });
});
