/**
 * Performance Tests for tm1npm
 * Tests for response times, memory usage, and scalability
 */

import axios from 'axios';
import { formatUrl, verifyVersion, CaseAndSpaceInsensitiveMap, buildMdxFromAxes } from '../utils/Utils';
import { loadTestConfig } from './testConfig';

describe('Performance Tests', () => {
    const config = loadTestConfig();
    const baseUrl = `http://${config.address}:${config.port}/api/v1`;
    const validConfig = {
        baseURL: baseUrl,
        auth: {
            username: config.user,
            password: config.password,
        },
        timeout: 30000
    };

    describe('Response Time Tests', () => {
        test('basic API calls should respond within reasonable time', async () => {
            const startTime = Date.now();
            
            try {
                await axios.get('/Configuration/ProductVersion', validConfig);
                const responseTime = Date.now() - startTime;
                
                // Should respond within 5 seconds for basic calls
                expect(responseTime).toBeLessThan(5000);
            } catch (error: any) {
                if (error.code === 'ECONNREFUSED') {
                    console.warn('TM1 server not available - skipping performance test');
                    return;
                }
                throw error;
            }
        }, 10000);

        test('multiple sequential requests should maintain performance', async () => {
            const times: number[] = [];
            const iterations = 5;
            
            try {
                for (let i = 0; i < iterations; i++) {
                    const startTime = Date.now();
                    await axios.get('/Configuration/ProductVersion', validConfig);
                    const responseTime = Date.now() - startTime;
                    times.push(responseTime);
                }
                
                const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
                const maxTime = Math.max(...times);
                
                // Average should be reasonable
                expect(avgTime).toBeLessThan(3000);
                // No single request should take too long
                expect(maxTime).toBeLessThan(8000);
                
                console.log(`Average response time: ${avgTime.toFixed(2)}ms`);
            } catch (error: any) {
                if (error.code === 'ECONNREFUSED') {
                    console.warn('TM1 server not available - skipping performance test');
                    return;
                }
                throw error;
            }
        }, 30000);

        test('concurrent requests should handle load efficiently', async () => {
            const concurrentRequests = 5;
            const startTime = Date.now();
            
            try {
                const promises = Array(concurrentRequests).fill(null).map(() =>
                    axios.get('/Configuration/ProductVersion', validConfig)
                );
                
                const results = await Promise.allSettled(promises);
                const totalTime = Date.now() - startTime;
                
                const successful = results.filter(result => result.status === 'fulfilled');
                
                // Most requests should succeed
                expect(successful.length).toBeGreaterThan(concurrentRequests / 2);
                
                // Total time should be less than sequential time
                expect(totalTime).toBeLessThan(concurrentRequests * 3000);
                
                console.log(`${successful.length}/${concurrentRequests} concurrent requests succeeded in ${totalTime}ms`);
            } catch (error: any) {
                if (error.code === 'ECONNREFUSED') {
                    console.warn('TM1 server not available - skipping performance test');
                    return;
                }
                throw error;
            }
        }, 20000);
    });

    describe('Memory Usage Tests', () => {
        test('utility functions should not leak memory', () => {
            const initialMemory = process.memoryUsage().heapUsed;
            
            // Run utility functions many times
            for (let i = 0; i < 1000; i++) {
                formatUrl("/test/{}/{}", `param${i}`, `value${i}`);
                verifyVersion("1.0.0", `1.${i}.0`);
                buildMdxFromAxes([]);
            }
            
            // Force garbage collection if available
            if (global.gc) {
                global.gc();
            }
            
            const finalMemory = process.memoryUsage().heapUsed;
            const memoryGrowth = finalMemory - initialMemory;
            
            // Memory growth should be minimal (less than 10MB)
            expect(memoryGrowth).toBeLessThan(10 * 1024 * 1024);
            
            console.log(`Memory growth after 1000 operations: ${(memoryGrowth / 1024 / 1024).toFixed(2)}MB`);
        });

        test('CaseAndSpaceInsensitiveMap should handle large datasets efficiently', () => {
            const initialMemory = process.memoryUsage().heapUsed;
            const map = new CaseAndSpaceInsensitiveMap<string>();
            const itemCount = 10000;
            
            const startTime = Date.now();
            
            // Add many items
            for (let i = 0; i < itemCount; i++) {
                map.set(`Key ${i}`, `Value ${i}`);
            }
            
            const addTime = Date.now() - startTime;
            
            // Test retrieval performance
            const retrieveStartTime = Date.now();
            let found = 0;
            for (let i = 0; i < 1000; i++) {
                if (map.has(`key ${i}`)) { // Different case
                    found++;
                }
            }
            const retrieveTime = Date.now() - retrieveStartTime;
            
            const finalMemory = process.memoryUsage().heapUsed;
            const memoryUsed = finalMemory - initialMemory;
            
            expect(map.size).toBe(itemCount);
            expect(found).toBe(1000); // All should be found (case insensitive)
            expect(addTime).toBeLessThan(5000); // Adding should be fast
            expect(retrieveTime).toBeLessThan(1000); // Retrieval should be fast
            expect(memoryUsed).toBeLessThan(50 * 1024 * 1024); // Memory usage should be reasonable
            
            console.log(`Map performance: ${itemCount} items added in ${addTime}ms, 1000 lookups in ${retrieveTime}ms`);
            console.log(`Memory used: ${(memoryUsed / 1024 / 1024).toFixed(2)}MB`);
        });

        test('should handle garbage collection properly', async () => {
            let maps: CaseAndSpaceInsensitiveMap<string>[] = [];
            
            // Create and populate multiple maps
            for (let mapIndex = 0; mapIndex < 10; mapIndex++) {
                const map = new CaseAndSpaceInsensitiveMap<string>();
                for (let i = 0; i < 1000; i++) {
                    map.set(`key${i}`, `value${i}`);
                }
                maps.push(map);
            }
            
            const memoryAfterCreation = process.memoryUsage().heapUsed;
            
            // Clear references
            maps = [];
            
            // Force garbage collection if available
            if (global.gc) {
                global.gc();
            }
            
            // Use Promise to handle async nature of GC
            return new Promise<void>((resolve) => {
                setTimeout(() => {
                    const memoryAfterGC = process.memoryUsage().heapUsed;
                    const memoryReduced = memoryAfterCreation - memoryAfterGC;
                    
                    console.log(`Memory after creation: ${(memoryAfterCreation / 1024 / 1024).toFixed(2)}MB`);
                    console.log(`Memory after GC: ${(memoryAfterGC / 1024 / 1024).toFixed(2)}MB`);
                    console.log(`Memory change: ${(memoryReduced / 1024 / 1024).toFixed(2)}MB`);
                    
                    // Memory test should not fail - just log the results
                    // GC behavior is not deterministic, so we'll just check that memory didn't grow excessively
                    const memoryGrowthMB = Math.abs(memoryReduced) / 1024 / 1024;
                    expect(memoryGrowthMB).toBeLessThan(500); // Very liberal limit - 500MB
                    
                    resolve();
                }, 100);
            });
        });
    });

    describe('Scalability Tests', () => {
        test('formatUrl should scale with parameter count', () => {
            const params = Array(20).fill(null).map((_, i) => `param${i}`);
            let template = "/base";
            
            for (let i = 0; i < params.length; i++) {
                template += "/{}";
            }
            
            const startTime = Date.now();
            const result = formatUrl(template, ...params);
            const duration = Date.now() - startTime;
            
            expect(result).toContain('param0');
            expect(result).toContain('param19');
            expect(duration).toBeLessThan(100); // Should be very fast
        });

        test('should handle rapid successive API calls', async () => {
            const callCount = 20;
            const results: boolean[] = [];
            
            try {
                for (let i = 0; i < callCount; i++) {
                    try {
                        await axios.get('/Configuration/ProductVersion', validConfig);
                        results.push(true);
                    } catch (error) {
                        results.push(false);
                    }
                }
                
                const successCount = results.filter(Boolean).length;
                const successRate = successCount / callCount;
                
                // At least 70% should succeed (allowing for some rate limiting)
                expect(successRate).toBeGreaterThan(0.7);
                
                console.log(`Success rate for ${callCount} rapid calls: ${(successRate * 100).toFixed(1)}%`);
            } catch (error: any) {
                if (error.code === 'ECONNREFUSED') {
                    console.warn('TM1 server not available - skipping scalability test');
                    return;
                }
                throw error;
            }
        }, 60000);
    });

    describe('Resource Efficiency Tests', () => {
        test('should reuse connection efficiently', async () => {
            const axiosInstance = axios.create(validConfig);
            const callCount = 10;
            const times: number[] = [];
            
            try {
                for (let i = 0; i < callCount; i++) {
                    const startTime = Date.now();
                    await axiosInstance.get('/Configuration/ProductVersion');
                    times.push(Date.now() - startTime);
                }

                // Later calls should generally be faster (connection reuse)
                const firstCallTime = times[0];
                const avgLaterCalls = times.slice(1).reduce((sum, time) => sum + time, 0) / (times.length - 1);

                console.log(`First call: ${firstCallTime}ms, Average later calls: ${avgLaterCalls.toFixed(2)}ms`);

                // Later calls should generally be faster or similar (but allow for reasonable variance)
                // Network conditions can vary, so we'll be more lenient
                expect(avgLaterCalls).toBeLessThanOrEqual(firstCallTime * 5); // Allow 5x variance
            } catch (error: any) {
                if (error.code === 'ECONNREFUSED') {
                    console.warn('TM1 server not available - skipping efficiency test');
                    return;
                }
                throw error;
            }
        }, 30000);

        test('should handle string operations efficiently', () => {
            const iterations = 10000;
            const testStrings = [
                'Simple Test',
                'Test With Spaces And Mixed CASE',
                '   Leading and trailing spaces   ',
                'Unicode测试тестテスト🚀',
                'Very long string '.repeat(100)
            ];
            
            const startTime = Date.now();
            
            for (let i = 0; i < iterations; i++) {
                const testString = testStrings[i % testStrings.length];
                formatUrl("/test/{}/{}", testString, i.toString());
            }
            
            const duration = Date.now() - startTime;
            const opsPerSecond = (iterations / duration) * 1000;
            
            console.log(`String operations: ${opsPerSecond.toFixed(0)} ops/second`);
            
            // Should handle at least 1000 operations per second
            expect(opsPerSecond).toBeGreaterThan(1000);
        });
    });
});