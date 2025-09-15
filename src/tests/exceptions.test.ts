/**
 * Exception Classes Tests
 * Comprehensive test suite for TM1 exception classes
 * Target: Improve coverage from 0% to 100% for TM1RestException and TM1TimeoutException
 */

import { TM1Exception } from '../exceptions/TM1Exception';
import { TM1RestException } from '../exceptions/TM1RestException';
import { TM1TimeoutException } from '../exceptions/TM1TimeoutException';

describe('TM1 Exception Classes', () => {

    describe('TM1RestException', () => {
        test('should create TM1RestException with message only', () => {
            const message = 'REST API error occurred';
            const exception = new TM1RestException(message);

            expect(exception).toBeInstanceOf(Error);
            expect(exception).toBeInstanceOf(TM1Exception);
            expect(exception).toBeInstanceOf(TM1RestException);
            expect(exception.message).toBe(message);
            expect(exception.name).toBe('TM1RestException');
            expect(exception.status).toBeUndefined();
            expect(exception.response).toBeUndefined();
        });

        test('should create TM1RestException with message and status', () => {
            const message = 'Unauthorized access';
            const status = 401;
            const exception = new TM1RestException(message, status);

            expect(exception.message).toBe(message);
            expect(exception.name).toBe('TM1RestException');
            expect(exception.status).toBe(status);
            expect(exception.response).toBeUndefined();
        });

        test('should create TM1RestException with message, status, and response', () => {
            const message = 'Bad Request';
            const status = 400;
            const response = {
                error: 'Invalid parameter',
                details: 'Parameter X is required'
            };
            const exception = new TM1RestException(message, status, response);

            expect(exception.message).toBe(message);
            expect(exception.name).toBe('TM1RestException');
            expect(exception.status).toBe(status);
            expect(exception.response).toEqual(response);
        });

        test('should handle status 0 (network error)', () => {
            const message = 'Network connection failed';
            const status = 0;
            const exception = new TM1RestException(message, status);

            expect(exception.status).toBe(0);
            expect(exception.message).toBe(message);
        });

        test('should handle various HTTP status codes', () => {
            const statusCodes = [200, 404, 500, 502, 503];
            
            statusCodes.forEach(status => {
                const exception = new TM1RestException(`HTTP ${status} error`, status);
                expect(exception.status).toBe(status);
                expect(exception.name).toBe('TM1RestException');
            });
        });

        test('should handle complex response objects', () => {
            const complexResponse = {
                error: {
                    code: 'INVALID_OPERATION',
                    message: 'Operation not supported',
                    details: {
                        operation: 'deleteElement',
                        reason: 'Element is in use'
                    }
                },
                timestamp: '2025-01-15T10:30:00Z',
                requestId: 'req-12345'
            };

            const exception = new TM1RestException('Complex error', 422, complexResponse);
            expect(exception.response).toEqual(complexResponse);
            expect(exception.response.error.code).toBe('INVALID_OPERATION');
        });

        test('should be throwable and catchable', () => {
            const message = 'Test exception';
            const status = 500;
            
            expect(() => {
                throw new TM1RestException(message, status);
            }).toThrow(TM1RestException);

            try {
                throw new TM1RestException(message, status);
            } catch (error) {
                expect(error).toBeInstanceOf(TM1RestException);
                expect((error as TM1RestException).status).toBe(status);
            }
        });

        test('should inherit Error properties correctly', () => {
            const exception = new TM1RestException('Test error', 500);
            
            expect(exception.stack).toBeDefined();
            expect(exception.toString()).toContain('TM1RestException');
            expect(exception.toString()).toContain('Test error');
        });
    });

    describe('TM1TimeoutException', () => {
        test('should create TM1TimeoutException with message only', () => {
            const message = 'Operation timed out';
            const exception = new TM1TimeoutException(message);

            expect(exception).toBeInstanceOf(Error);
            expect(exception).toBeInstanceOf(TM1Exception);
            expect(exception).toBeInstanceOf(TM1TimeoutException);
            expect(exception.message).toBe(message);
            expect(exception.name).toBe('TM1TimeoutException');
            expect(exception.timeout).toBe(0); // Default timeout value
        });

        test('should create TM1TimeoutException with message and timeout', () => {
            const message = 'Request timed out after 30 seconds';
            const timeout = 30000; // 30 seconds in ms
            const exception = new TM1TimeoutException(message, timeout);

            expect(exception.message).toBe(message);
            expect(exception.name).toBe('TM1TimeoutException');
            expect(exception.timeout).toBe(timeout);
        });

        test('should handle zero timeout value', () => {
            const message = 'Immediate timeout';
            const timeout = 0;
            const exception = new TM1TimeoutException(message, timeout);

            expect(exception.timeout).toBe(0);
            expect(exception.message).toBe(message);
        });

        test('should handle large timeout values', () => {
            const message = 'Long operation timeout';
            const timeout = 3600000; // 1 hour in ms
            const exception = new TM1TimeoutException(message, timeout);

            expect(exception.timeout).toBe(timeout);
            expect(exception.message).toBe(message);
        });

        test('should handle negative timeout values', () => {
            const message = 'Invalid timeout';
            const timeout = -1000;
            const exception = new TM1TimeoutException(message, timeout);

            expect(exception.timeout).toBe(timeout); // Should accept negative values
            expect(exception.message).toBe(message);
        });

        test('should default to 0 when no timeout provided', () => {
            const exception = new TM1TimeoutException('Default timeout test');
            expect(exception.timeout).toBe(0);
        });

        test('should be throwable and catchable', () => {
            const message = 'Timeout test';
            const timeout = 5000;
            
            expect(() => {
                throw new TM1TimeoutException(message, timeout);
            }).toThrow(TM1TimeoutException);

            try {
                throw new TM1TimeoutException(message, timeout);
            } catch (error) {
                expect(error).toBeInstanceOf(TM1TimeoutException);
                expect((error as TM1TimeoutException).timeout).toBe(timeout);
            }
        });

        test('should inherit Error properties correctly', () => {
            const exception = new TM1TimeoutException('Test timeout', 1000);
            
            expect(exception.stack).toBeDefined();
            expect(exception.toString()).toContain('TM1TimeoutException');
            expect(exception.toString()).toContain('Test timeout');
        });

        test('should handle various timeout scenarios', () => {
            const scenarios = [
                { message: 'Connection timeout', timeout: 5000 },
                { message: 'Read timeout', timeout: 30000 },
                { message: 'Write timeout', timeout: 15000 },
                { message: 'Process timeout', timeout: 300000 }
            ];

            scenarios.forEach(({ message, timeout }) => {
                const exception = new TM1TimeoutException(message, timeout);
                expect(exception.timeout).toBe(timeout);
                expect(exception.message).toBe(message);
                expect(exception.name).toBe('TM1TimeoutException');
            });
        });
    });

    describe('Exception Inheritance and Polymorphism', () => {
        test('should properly inherit from TM1Exception', () => {
            const restException = new TM1RestException('REST error', 500);
            const timeoutException = new TM1TimeoutException('Timeout error', 5000);

            expect(restException).toBeInstanceOf(TM1Exception);
            expect(timeoutException).toBeInstanceOf(TM1Exception);
        });

        test('should properly inherit from Error', () => {
            const restException = new TM1RestException('REST error', 500);
            const timeoutException = new TM1TimeoutException('Timeout error', 5000);

            expect(restException).toBeInstanceOf(Error);
            expect(timeoutException).toBeInstanceOf(Error);
        });

        test('should be distinguishable in catch blocks', () => {
            const testCatch = (exception: Error) => {
                if (exception instanceof TM1RestException) {
                    return 'REST';
                } else if (exception instanceof TM1TimeoutException) {
                    return 'TIMEOUT';
                } else if (exception instanceof TM1Exception) {
                    return 'TM1';
                } else {
                    return 'OTHER';
                }
            };

            expect(testCatch(new TM1RestException('test', 500))).toBe('REST');
            expect(testCatch(new TM1TimeoutException('test', 1000))).toBe('TIMEOUT');
        });

        test('should maintain proper prototype chain', () => {
            const restException = new TM1RestException('test', 500);
            const timeoutException = new TM1TimeoutException('test', 1000);

            expect(Object.getPrototypeOf(restException)).toBe(TM1RestException.prototype);
            expect(Object.getPrototypeOf(timeoutException)).toBe(TM1TimeoutException.prototype);
        });
    });

    describe('Real-world Usage Scenarios', () => {
        test('should handle typical REST API error scenarios', () => {
            // 404 Not Found
            const notFound = new TM1RestException('Cube not found', 404, {
                error: 'CUBE_NOT_FOUND',
                cubeName: 'Sales'
            });
            expect(notFound.status).toBe(404);
            expect(notFound.response.cubeName).toBe('Sales');

            // 401 Unauthorized
            const unauthorized = new TM1RestException('Authentication failed', 401);
            expect(unauthorized.status).toBe(401);

            // 500 Internal Server Error
            const serverError = new TM1RestException('Internal server error', 500, {
                error: 'INTERNAL_ERROR',
                details: 'Database connection failed'
            });
            expect(serverError.status).toBe(500);
            expect(serverError.response.details).toBe('Database connection failed');
        });

        test('should handle typical timeout scenarios', () => {
            // Connection timeout
            const connectionTimeout = new TM1TimeoutException(
                'Connection timeout after 30 seconds',
                30000
            );
            expect(connectionTimeout.timeout).toBe(30000);

            // Process execution timeout
            const processTimeout = new TM1TimeoutException(
                'Process execution exceeded maximum time',
                600000 // 10 minutes
            );
            expect(processTimeout.timeout).toBe(600000);

            // Query timeout
            const queryTimeout = new TM1TimeoutException(
                'MDX query timeout',
                120000 // 2 minutes
            );
            expect(queryTimeout.timeout).toBe(120000);
        });

        test('should support error chaining and context', () => {
            const originalError = new Error('Network failure');
            const restException = new TM1RestException(
                'Failed to connect to TM1 server',
                0,
                { originalError, timestamp: Date.now() }
            );

            expect(restException.response.originalError).toBe(originalError);
            expect(restException.response.timestamp).toBeDefined();
        });
    });
});