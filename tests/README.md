# TM1npm Test Scripts

This directory contains organized standalone test scripts for tm1npm functionality.

## Directory Structure

### 🔌 Connection Tests (`connection/`)
- `test-connection.ts` - Comprehensive TM1 connection testing
- `simple-connection-test.ts` - Basic TM1 connectivity verification  
- `minimal-connection-test.ts` - Minimal REST API connection test

### 🔒 Security Tests (`security/`)
- `security-test.ts` - Authentication, authorization, and vulnerability tests

### ⚡ Performance Tests (`performance/`)
- `performance-test.ts` - Response time, memory usage, and scalability tests

### 🎯 Edge Cases Tests (`edge-cases/`)
- `edge-cases-test.ts` - Boundary conditions and unusual input tests

### 🔗 Integration Tests (`integration/`)
- `working-test.ts` - Comprehensive TM1 functionality test

## Environment Configuration

All tests use environment variables from `.env` file:
```
TM1_ADDRESS=localhost
TM1_PORT=8879
TM1_USER=admin
TM1_PASSWORD=your_password_here
TM1_SSL=false
```

## Running Tests

### Individual Test Categories
```bash
npm run test:connection    # Connection tests
npm run test:simple        # Simple connection test
npm run test:minimal       # Minimal connection test
npm run test:working       # Integration test
npm run test:security      # Security tests
npm run test:performance   # Performance tests
npm run test:edge-cases    # Edge cases tests
```

### All Tests
```bash
npm run test:all          # Run all test suites including Jest unit tests
```

## Security Notes

- No hardcoded passwords - all credentials come from environment variables
- Tests will fail gracefully if TM1_PASSWORD is not set
- Production deployments should use secure credential management