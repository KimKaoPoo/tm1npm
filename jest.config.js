module.exports = {
  // Test environment
  preset: 'ts-jest',
  testEnvironment: 'node',

  // Test files and roots
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/tests/**/*.test.ts',
    '**/tests/**/*.spec.ts'
  ],
  // Exclude integration tests that require real TM1 server connections
  testPathIgnorePatterns: [
    '/node_modules/',
    '.*connection\\.test\\.ts$',         // Exclude connection tests
    '.*integration.*\\.test\\.ts$',      // Exclude ALL integration tests  
    '.*performance\\.test\\.ts$',        // May require connection
    'integrationTests.test.ts'           // Legacy pattern
  ],

  // TypeScript configuration
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: 'tsconfig.json'
    }]
  },

  // Module resolution
  moduleFileExtensions: ['ts', 'js', 'json'],
  
  // Coverage configuration
  collectCoverage: false, // Disable by default to avoid compilation errors
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/tests/**/*'
  ],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/tests/',
    '/dist/'
  ],
  coverageReporters: [
    'text',
    'lcov',
    'html'
  ],

  // Test timeout (optimized for faster execution)
  testTimeout: 15000,

  // Performance optimizations
  maxWorkers: 1,            // Use single worker to avoid circular reference issues
  workerIdleMemoryLimit: '512MB',
  
  // Reduce verbose output for faster execution
  verbose: false,
  silent: false,

  // Error handling
  errorOnDeprecated: true,
  detectOpenHandles: false,  // Disable to avoid hanging processes
  forceExit: true,          // Force exit to avoid hanging processes

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/src/tests/setup.ts']
};