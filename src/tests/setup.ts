/**
 * Jest setup file for tm1npm tests
 */

// Increase timeout for integration tests
jest.setTimeout(30000);

// Setup global test configuration
beforeAll(() => {
    // Suppress console logs during tests unless explicitly needed
    if (!process.env.VERBOSE_TESTS) {
        console.log = jest.fn();
        console.warn = jest.fn();
        console.info = jest.fn();
    }
});

afterAll(() => {
    // Cleanup any global resources if needed
});

// Custom Jest matchers for TM1 responses
expect.extend({
    toBeValidTM1Response(received: any) {
        const pass = received && 
                    typeof received === 'object' &&
                    received.status >= 200 && 
                    received.status < 300;

        if (pass) {
            return {
                message: () => `expected ${received} not to be a valid TM1 response`,
                pass: true,
            };
        } else {
            return {
                message: () => `expected ${received} to be a valid TM1 response`,
                pass: false,
            };
        }
    },
});