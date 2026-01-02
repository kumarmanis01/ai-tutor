describe('import hydrators/hydrateQuestions.ts', () => {
  it('imports without throwing', async () => {
    await expect(async () => {
      await import('../../hydrators/hydrateQuestions.ts');
    }).not.toThrow();
  });
});
