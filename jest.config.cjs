/** Jest config using ts-jest for TypeScript tests */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // run only unit tests by default; integration tests are excluded
  testMatch: ['**/tests/**/*.test.ts'],
  testPathIgnorePatterns: [
    '/tests/integration/',
    // phase12 and regenerationWorker DB integration tests re-enabled — they self-skip
    // when DATABASE_URL is absent, so they are safe to run in CI without a live DB.
  ],
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
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  setupFiles: ['<rootDir>/tests/setup/forceTestNodeEnv.cjs'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup/normalizePaths.cjs', '<rootDir>/tests/setup/normalizePaths.ts', '<rootDir>/tests/setup/prismaEnsureColumns.ts', '<rootDir>/tests/setup/loggerTeardown.ts'],
  // Force exit after tests to avoid intermittent open-handle failures in CI
  // This is a pragmatic fix; ideally open handles should be tracked down.
  forceExit: true,
  // Coverage configuration: enforce minimum coverage for critical modules
  collectCoverage: true,
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['text', 'lcov'],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 50,
      lines: 60,
      statements: 60,
    },
    // Encourage higher coverage for AI and ingestion critical modules
    '<rootDir>/lib/ai/': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    '<rootDir>/lib/ingest/': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    }
  }
};
