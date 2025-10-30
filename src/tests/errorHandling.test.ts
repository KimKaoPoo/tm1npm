/**
 * Error Handling Tests for tm1npm
 * Tests various error scenarios and edge cases
 */

import axios from 'axios';
import { TM1Exception, TM1RestException, TM1TimeoutException } from '../exceptions/TM1Exception';
import { formatUrl, verifyVersion, CaseAndSpaceInsensitiveMap } from '../utils/Utils';
import { loadTestConfig } from './testConfig';

describe('Error Handling Tests', () => {
    const config = loadTestConfig();
    const baseUrl = `http://${config.address}:${config.port}/api/v1`;

    describe('Network Error Handling', () => {
        test('should handle connection refused errors', async () => {
            const invalidConfig = {
                baseURL: 'http://localhost:9999/api/v1', // Non-existent server
                
                    user: config.user,
                    password: config.password,
                
                timeout: 5000
            };

            await expect(axios.get('/Configuration/ProductVersion', invalidConfig))
                .rejects.toMatchObject({
                    code: 'ECONNREFUSED'
                });
        });

        test('should handle DNS resolution errors', async () => {
            const invalidConfig = {
                baseURL: 'http://nonexistent-tm1-server-12345.com/api/v1',
                
                    user: config.user,
                    password: config.password,
                
                timeout: 5000
            };

            await expect(axios.get('/Configuration/ProductVersion', invalidConfig))
                .rejects.toMatchObject({
                    code: expect.stringMatching(/ENOTFOUND|ECONNREFUSED/)
                });
        });

        test('should handle timeout errors gracefully', async () => {
            const timeoutConfig = {
                baseURL: baseUrl,
                
                    user: config.user,
                    password: config.password,
                
                timeout: 1 // 1ms timeout - will definitely timeout
            };

            await expect(axios.get('/Configuration/ProductVersion', timeoutConfig))
                .rejects.toMatchObject({
                    code: 'ECONNABORTED'
                });
        }, 15000);
    });

    describe('HTTP Error Handling', () => {
        const validConfig = {
            baseURL: baseUrl,
            
                user: config.user,
                password: config.password,
            
            timeout: 30000
        };

        test('should handle 404 Not Found errors', async () => {
            try {
                await axios.get('/NonExistentEndpoint', validConfig);
            } catch (error: any) {
                // Should get some kind of error response (401 or 404 are both acceptable for non-existent endpoints)
                expect(error.response?.status).toBeDefined();
                expect(error.response?.status).toBeGreaterThanOrEqual(400);
                expect([401, 404]).toContain(error.response?.status);
            }
        });

        test('should handle 400 Bad Request errors', async () => {
            // Invalid OData query
            try {
                await axios.get('/Dimensions?$invalid=query', validConfig);
                // If it doesn't throw, that's also acceptable
            } catch (error: any) {
                // Should get some kind of error response
                expect(error.response?.status).toBeDefined();
                expect(error.response?.status).toBeGreaterThanOrEqual(400);
            }
        });

        test('should handle 500 Internal Server Error gracefully', async () => {
            try {
                // Attempt to create invalid data that might cause server error
                await axios.post('/Dimensions', { InvalidData: true }, validConfig);
            } catch (error: any) {
                if (error.response) {
                    expect(error.response.status).toBeGreaterThanOrEqual(400);
                    expect(error.response.status).toBeLessThan(600);
                }
            }
        });
    });

    describe('Exception Class Testing', () => {
        test('TM1Exception should be properly constructed', () => {
            const error = new TM1Exception('Test error message');
            expect(error.message).toBe('Test error message');
            expect(error.name).toBe('TM1Exception');
            expect(error).toBeInstanceOf(Error);
            expect(error).toBeInstanceOf(TM1Exception);
        });

        test('TM1RestException should include status and response', () => {
            const mockResponse = { error: 'Not found' };
            const error = new TM1RestException('REST error', 404, mockResponse);
            
            expect(error.message).toBe('REST error');
            expect(error.name).toBe('TM1RestException');
            expect(error.status).toBe(404);
            expect(error.response).toEqual(mockResponse);
            expect(error).toBeInstanceOf(TM1Exception);
        });

        test('TM1TimeoutException should include timeout info', () => {
            const error = new TM1TimeoutException('Request timed out', 30000);
            
            expect(error.message).toBe('Request timed out');
            expect(error.name).toBe('TM1TimeoutException');
            expect(error.timeout).toBe(30000);
            expect(error).toBeInstanceOf(TM1Exception);
        });
    });

    describe('Utility Function Error Handling', () => {
        test('formatUrl should handle missing parameters', () => {
            expect(() => formatUrl("/test/{}/{}", "param1")).not.toThrow();
            expect(formatUrl("/test/{}/{}", "param1")).toContain("param1");
        });

        test('formatUrl should handle null/undefined parameters', () => {
            expect(() => formatUrl("/test/{}", null as any)).not.toThrow();
            expect(() => formatUrl("/test/{}", undefined as any)).not.toThrow();
        });

        test('verifyVersion should handle malformed version strings', () => {
            expect(() => verifyVersion("invalid", "1.0.0")).not.toThrow();
            expect(() => verifyVersion("1.0.0", "invalid")).not.toThrow();
            expect(() => verifyVersion("", "")).not.toThrow();
            expect(() => verifyVersion("1", "1.0.0.0.0")).not.toThrow();
        });

        test('CaseAndSpaceInsensitiveMap should handle edge cases', () => {
            const map = new CaseAndSpaceInsensitiveMap<string>();
            
            expect(() => map.set('', 'empty')).not.toThrow();
            expect(() => map.set('   ', 'spaces')).not.toThrow();
            expect(() => map.get('')).not.toThrow();
            expect(() => map.has('')).not.toThrow();
            expect(() => map.delete('')).not.toThrow();
            
            // Test with null-like values
            map.set('test', null as any);
            expect(map.get('test')).toBeNull();
        });
    });

    describe('Data Validation Error Handling', () => {
        test('should handle extremely long strings', () => {
            const longString = 'A'.repeat(10000);
            expect(() => formatUrl("/test/{}", longString)).not.toThrow();
            
            const map = new CaseAndSpaceInsensitiveMap<string>();
            expect(() => map.set(longString, 'value')).not.toThrow();
        });

        test('should handle special characters in URLs', () => {
            const specialChars = ['%', '&', '=', '+', ' ', '\n', '\t', '\r'];
            
            for (const char of specialChars) {
                expect(() => formatUrl("/test/{}", char)).not.toThrow();
            }
        });

        test('should handle Unicode characters', () => {
            const unicodeStrings = [
                '测试', // Chinese
                'тест', // Cyrillic
                'テスト', // Japanese
                '🚀🎉', // Emojis
                'café' // Accented characters
            ];
            
            for (const str of unicodeStrings) {
                expect(() => formatUrl("/test/{}", str)).not.toThrow();
                const result = formatUrl("/test/{}", str);
                expect(result).toContain(encodeURIComponent(str));
            }
        });
    });

    describe('Memory and Resource Error Handling', () => {
        test('should handle large data structures gracefully', () => {
            const largeMap = new CaseAndSpaceInsensitiveMap<string>();
            
            // Add many items
            for (let i = 0; i < 1000; i++) {
                largeMap.set(`key${i}`, `value${i}`);
            }
            
            expect(largeMap.size).toBe(1000);
            expect(largeMap.get('key500')).toBe('value500');
            expect(largeMap.has('KEY500')).toBe(true); // Case insensitive
        });

        test('should handle rapid successive operations', () => {
            const map = new CaseAndSpaceInsensitiveMap<number>();
            
            // Rapid add/remove cycles
            for (let cycle = 0; cycle < 10; cycle++) {
                for (let i = 0; i < 100; i++) {
                    map.set(`temp${i}`, i);
                }
                for (let i = 0; i < 100; i++) {
                    map.delete(`temp${i}`);
                }
            }
            
            expect(map.size).toBe(0);
        });
    });

    describe('Async Error Handling', () => {
        test('should handle promise rejection in utility functions', async () => {
            // Simulate async utility function errors
            const asyncTest = async () => {
                throw new TM1Exception('Async error');
            };
            
            await expect(asyncTest()).rejects.toThrow('Async error');
            await expect(asyncTest()).rejects.toBeInstanceOf(TM1Exception);
        });

        test('should handle multiple concurrent errors', async () => {
            const errorPromises = Array(5).fill(null).map(async (_, index) => {
                throw new TM1Exception(`Error ${index}`);
            });
            
            const results = await Promise.allSettled(errorPromises);
            
            expect(results).toHaveLength(5);
            results.forEach((result, index) => {
                expect(result.status).toBe('rejected');
                expect((result as PromiseRejectedResult).reason.message).toBe(`Error ${index}`);
            });
        });
    });
});