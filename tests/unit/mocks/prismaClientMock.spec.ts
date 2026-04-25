import pkg from '@prisma/client';

describe('prismaClientMock test shim', () => {
  it('exports PrismaClient and enum-like values', () => {
    // Basic smoke test ensuring the Jest moduleNameMapper replacement
    // provides the expected symbols used across unit tests.
    expect(pkg).toBeDefined();
    // PrismaClient should be a constructor
    // @ts-ignore
    expect(
      typeof pkg.PrismaClient === 'function' || typeof pkg.PrismaClient === 'object'
    ).toBeTruthy();
    // Known enums we expect in the mock
    // @ts-ignore
    expect(pkg.UserRole).toBeDefined();
    // @ts-ignore
    expect(pkg.ConsentScope).toBeDefined();
  });
});
