/** Jest config for integration tests only — mocks all external deps, no live DB/network */
module.exports = {
  preset: 'ts-jest',
  // setupFiles runs before any test module is loaded, before setupFilesAfterEnv.
  // This forces NODE_ENV=test even when the deploy script has exported NODE_ENV=production
  // from .env.production into the shell before invoking jest.
  setupFiles: ['<rootDir>/tests/setup/forceTestNodeEnv.cjs'],
  testEnvironment: 'node',
  testMatch: ['**/tests/integration/**/*.test.ts'],
  // alert-evaluator.test.ts is a standalone script (IIFE), not a Jest suite
  // hydrateAll-e2e and homeEngine.scenarios.withSeed require a live DATABASE_URL + seed script
  testPathIgnorePatterns: [
    'tests/integration/alert-evaluator.test.ts',
    'tests/integration/hydrateAll-e2e.test.ts',
    'tests/integration/homeEngine.scenarios.withSeed.test.ts',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  moduleNameMapper: {
    '^@/lib/(.*)\\.js$': '<rootDir>/lib/$1.ts',
    '^@/lib/(.*)$': '<rootDir>/lib/$1',
    '^@/(.*)\\.js$': '<rootDir>/src/$1.ts',
    // Fallback: handle relative lib imports (../lib/foo.js) and Windows backslashes
    '^[\\/\\.\\w\-]*(?:\\\|/)?lib(?:\\|/)(.*)\\.js$': '<rootDir>/lib/$1.ts',
    '^[\\/\\.\\w\-]*(?:\\\|/)?lib(?:\\|/)(.*)$': ['<rootDir>/lib/$1.ts', '<rootDir>/lib/$1/index.ts'],
    '^@/(.*)$': ['<rootDir>/src/$1', '<rootDir>/$1'],
  },
  moduleDirectories: ['node_modules', '<rootDir>'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  setupFilesAfterEnv: [
    '<rootDir>/tests/setup/normalizePaths.cjs',
    '<rootDir>/tests/setup/normalizePaths.ts',
    '<rootDir>/tests/setup/prismaEnsureColumns.ts',
    '<rootDir>/tests/setup/loggerTeardown.ts',
  ],
  forceExit: true,
};
