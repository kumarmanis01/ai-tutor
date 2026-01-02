describe('import hooks/useContinueLearning.ts', () => {
  it('imports without throwing', async () => {
    await expect(async () => {
      await import('../../hooks/useContinueLearning.ts');
    }).not.toThrow();
  });
});
