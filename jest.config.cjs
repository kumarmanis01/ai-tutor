/** Jest config using ts-jest for TypeScript tests */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // run only unit tests by default; integration tests are excluded
  testMatch: ['**/tests/**/*.test.ts'],
  testPathIgnorePatterns: ['/tests/integration/'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  moduleNameMapper: {
    // Avoid mapping generic relative ../lib/* patterns — they clash with node_modules internals.
    // Map project `@/` aliases explicitly.
    '^@/lib/(.*)\\.js$': '<rootDir>/lib/$1.ts',
    '^@/lib/(.*)$': '<rootDir>/lib/$1',
    '^@/(.*)\\.js$': '<rootDir>/src/$1.ts',
    '^@/(.*)$': ['<rootDir>/src/$1', '<rootDir>/$1']
  },
  moduleDirectories: ['node_modules', '<rootDir>'],
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.json',
    },
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup/normalizePaths.cjs', '<rootDir>/tests/setup/normalizePaths.ts', '<rootDir>/tests/setup/prismaEnsureColumns.ts', '<rootDir>/tests/setup/loggerTeardown.ts'],
  // Force exit after tests to avoid intermittent open-handle failures in CI
  // This is a pragmatic fix; ideally open handles should be tracked down.
  forceExit: true,
};
