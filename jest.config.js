/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: {
          moduleResolution: 'NodeNext',
          module: 'NodeNext',
          target: 'ES2022',
          allowSyntheticDefaultImports: true,
          isolatedModules: true,
          esModuleInterop: true,
        },
      },
    ],
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
  ],
  // Coverage thresholds - currently low as most tests are integration tests
  // that test the tools via the MCP server, not direct unit tests
  coverageThreshold: {
    global: {
      branches: 10,
      functions: 20,
      lines: 10,
      statements: 10
    }
  },
  // Run tests sequentially to avoid conflicts with Strapi API
  maxWorkers: 1,
  testSequencer: '<rootDir>/tests/test-sequencer.js',
  // Force exit after tests complete to avoid hanging
  forceExit: true,
};