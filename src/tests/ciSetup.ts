/**
 * CI-specific test setup
 * Configures tests to run without TM1 server connections
 */

// Mock environment variables for CI
process.env.NODE_ENV = 'test';
process.env.CI = 'true';

// Disable any real TM1 connections in CI
process.env.TM1_DISABLE_REAL_CONNECTIONS = 'true';

// Set mock TM1 configuration
process.env.TM1_ADDRESS = 'localhost';
process.env.TM1_PORT = '8879';
process.env.TM1_USER = 'admin';
process.env.TM1_PASSWORD = 'mock-password';
process.env.TM1_SSL = 'false';

// Global test configuration
beforeAll(() => {
  console.log('🤖 Running in CI mode - TM1 connections disabled');
  console.log('📦 Testing tm1npm unit tests only');
});

export {};