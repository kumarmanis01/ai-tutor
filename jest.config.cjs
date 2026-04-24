/** Jest config using ts-jest for TypeScript tests */
module.exports = {
  preset: 'ts-jest',
  // Default to Node so DB-related setup (prismaEnsureColumns) runs correctly.
  // UI tests that require a DOM should opt-in via per-file environment or
  // be run under a separate Jest project. Revert: jsdom caused setup to skip.
  testEnvironment: 'node',
  // run only unit tests by default; integration tests are excluded
  testMatch: [
    '**/tests/**/*.test.ts',
    '**/tests/**/*.test.tsx',
    '**/tests/**/*.spec.ts',
    '**/tests/**/*.spec.tsx',
  ],
  testPathIgnorePatterns: [
    '/tests/integration/',
    // phase12 and regenerationWorker DB integration tests re-enabled — they self-skip
    // when DATABASE_URL is absent, so they are safe to run in CI without a live DB.
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  moduleNameMapper: {
    // Avoid mapping generic relative ../lib/* patterns — they clash with node_modules internals.
    // Map project `@/` aliases explicitly. Prefer TypeScript sources for resolvability in tests.
    // For explicit .js or .ts extension imports, strip and resolve as .ts
    '^@/lib/(.*)\\.js$': '<rootDir>/lib/$1.ts',
    '^@/lib/(.*)\\.ts$': '<rootDir>/lib/$1.ts',
    // For extensionless imports: try the .ts file first, then the directory index.
    // This supports both `@/lib/foo` (-> lib/foo.ts) and `@/lib/ai/guardrails` (-> lib/ai/guardrails/index.ts).
    '^@/lib/(.*)$': ['<rootDir>/lib/$1.ts', '<rootDir>/lib/$1/index.ts', '<rootDir>/lib/$1'],
    '^@/(.*)\\.js$': ['<rootDir>/src/$1.ts', '<rootDir>/$1.ts'],
    // NOTE: avoid overly-broad 'lib/' fallback mappings — they accidentally
    // remap node_modules internal paths (e.g. jose/dist/.../lib/*.js).
    // Explicit relative patterns below handle the common cases we need.
      // NOTE: do not map generic relative `../lib/*.js` imports — they
      // accidentally match internal relative imports inside node_modules
      // packages (e.g. openai, jose) and break Jest resolution.
    '^@/components/(.*)$': [
      '<rootDir>/components/$1.tsx',
      '<rootDir>/components/$1.ts',
      '<rootDir>/components/$1/index.tsx',
      '<rootDir>/components/$1/index.ts',
      '<rootDir>/src/components/$1.tsx',
      '<rootDir>/src/components/$1.ts',
      '<rootDir>/src/components/$1/index.tsx',
      '<rootDir>/src/components/$1/index.ts',
    ],
    '^@/(.*)$': [
      '<rootDir>/src/$1.ts',
      '<rootDir>/src/$1.tsx',
      '<rootDir>/src/$1/index.ts',
      '<rootDir>/src/$1/index.tsx',
      '<rootDir>/$1.ts',
      '<rootDir>/$1.tsx',
      '<rootDir>/$1/index.ts',
      '<rootDir>/$1/index.tsx',
    ]
    ,
    '^@prisma/client$': '<rootDir>/tests/mocks/prismaClientMock.ts'
  },
  moduleDirectories: ['node_modules', '<rootDir>'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  setupFiles: ['<rootDir>/tests/setup/forceTestNodeEnv.cjs'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup/redis-monitor.ts', '<rootDir>/tests/setup/jsdomPolyfills.ts', '<rootDir>/tests/setup/normalizePaths.cjs', '<rootDir>/tests/setup/normalizePaths.ts', '<rootDir>/tests/setup/prismaEnsureColumns.ts', '<rootDir>/tests/setup/loggerTeardown.ts'],
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
    }
  }
};
