/** Jest config for integration tests only — mocks all external deps, no live DB/network */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/integration/**/*.test.ts'],
  // alert-evaluator.test.ts is a standalone script (IIFE), not a Jest suite
  testPathIgnorePatterns: [
    'tests/integration/alert-evaluator.test.ts',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  moduleNameMapper: {
    '^@/lib/(.*)\\.js$': '<rootDir>/lib/$1.ts',
    '^@/lib/(.*)$': '<rootDir>/lib/$1',
    '^@/(.*)\\.js$': '<rootDir>/src/$1.ts',
    '^@/(.*)$': ['<rootDir>/src/$1', '<rootDir>/$1'],
  },
  moduleDirectories: ['node_modules', '<rootDir>'],
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.json',
    },
  },
  setupFilesAfterEnv: [
    '<rootDir>/tests/setup/normalizePaths.cjs',
    '<rootDir>/tests/setup/normalizePaths.ts',
    '<rootDir>/tests/setup/prismaEnsureColumns.ts',
    '<rootDir>/tests/setup/loggerTeardown.ts',
  ],
  forceExit: true,
};
