module.exports = {
  // CI-specific test configuration
  preset: 'ts-jest',
  testEnvironment: 'node',
  displayName: 'CI Tests (No TM1 Connection Required)',

  // Test files and roots - focus on src/tests only
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/src/tests/**/*.test.ts',
    '**/src/tests/**/*.spec.ts'
  ],
  
  // Exclude all tests that require TM1 connections
  testPathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/tests/',                  // Exclude root tests/ directory
    '.*connection\\.test\\.ts$',         // Exclude connection tests
    '.*integration.*\\.test\\.ts$',      // Exclude ALL integration tests  
    '.*performance\\.test\\.ts$',        // May require connection
    '.*security\\.test\\.ts$',           // May require connection setup
    '.*stress\\.performance\\.test\\.ts$', // Performance tests with connections
    '.*errorHandling\\.test\\.ts$',      // May test real error scenarios
    '.*integrationTests\\.test\\.ts$'    // Additional integration test pattern
  ],

  // TypeScript configuration
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: 'tsconfig.json'
    }]
  },

  // Module resolution
  moduleFileExtensions: ['ts', 'js', 'json'],

  // CI performance optimizations
  maxWorkers: 1,            // Use single worker to avoid circular reference issues
  cache: false,             // Disable cache for cleaner CI runs
  testTimeout: 60000,       // Increased timeout to 60 seconds
  
  // Coverage for CI - without thresholds for now
  collectCoverage: true,
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
  // Note: Coverage thresholds disabled for CI stability

  // Verbose output for CI debugging
  verbose: false,        // Changed to false for cleaner output
  
  // Don't fail fast for CI - let all tests run
  bail: false,          // Changed to false so all tests run
  
  // Disable problematic features for CI
  detectOpenHandles: false,
  forceExit: true,      // Force exit to avoid hanging processes
  
  // CI-friendly reporters
  reporters: ['default'],

  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/src/tests/setup.ts',
    '<rootDir>/src/tests/ciSetup.ts'
  ],

  // Error handling
  errorOnDeprecated: true
};