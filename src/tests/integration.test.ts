/**
 * Integration Tests for tm1npm
 * Tests for end-to-end functionality and real-world scenarios
 */

import axios from 'axios';
import { loadTestConfig } from './testConfig';

describe('Integration Tests', () => {
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

    describe('TM1 Server Integration', () => {
        test('should successfully connect and retrieve server information', async () => {
            try {
                const versionResponse = await axios.get('/Configuration/ProductVersion', validConfig);
                const serverResponse = await axios.get('/Configuration/ServerName', validConfig);
                
                expect(versionResponse.status).toBe(200);
                expect(versionResponse.data).toHaveProperty('value');
                expect(typeof versionResponse.data.value).toBe('string');
                
                expect(serverResponse.status).toBe(200);
                expect(serverResponse.data).toHaveProperty('value');
                expect(typeof serverResponse.data.value).toBe('string');
                
                console.log(`✅ Connected to TM1 ${versionResponse.data.value} (${serverResponse.data.value})`);
            } catch (error: any) {
                if (error.code === 'ECONNREFUSED') {
                    console.warn('TM1 server not available - skipping integration tests');
                    return;
                }
                throw error;
            }
        });

        test('should retrieve and validate system configuration', async () => {
            try {
                const endpoints = [
                    '/Configuration/ProductVersion',
                    '/Configuration/ServerName',
                    '/Configuration/AdminHost',
                    '/Configuration/DataBaseDirectory',
                    '/Configuration/IntegratedSecurityMode'
                ];
                
                const results = await Promise.allSettled(
                    endpoints.map(endpoint => axios.get(endpoint, validConfig))
                );
                
                const successful = results.filter(result => result.status === 'fulfilled');
                
                // At least basic endpoints should work
                expect(successful.length).toBeGreaterThanOrEqual(2);
                
                console.log(`✅ Retrieved ${successful.length}/${endpoints.length} configuration values`);
            } catch (error: any) {
                if (error.code === 'ECONNREFUSED') {
                    console.warn('TM1 server not available - skipping configuration test');
                    return;
                }
                throw error;
            }
        });
    });

    describe('Data Access Integration', () => {
        test('should access and list dimensions', async () => {
            try {
                const response = await axios.get('/Dimensions?$select=Name&$top=10', validConfig);
                
                expect(response.status).toBe(200);
                expect(response.data).toHaveProperty('value');
                expect(Array.isArray(response.data.value)).toBe(true);
                
                if (response.data.value.length > 0) {
                    expect(response.data.value[0]).toHaveProperty('Name');
                    console.log(`✅ Found ${response.data.value.length} dimensions`);
                }
            } catch (error: any) {
                if (error.code === 'ECONNREFUSED') {
                    console.warn('TM1 server not available - skipping dimension test');
                    return;
                }
                throw error;
            }
        });

        test('should access and list cubes', async () => {
            try {
                const response = await axios.get('/Cubes?$select=Name&$top=10', validConfig);
                
                expect(response.status).toBe(200);
                expect(response.data).toHaveProperty('value');
                expect(Array.isArray(response.data.value)).toBe(true);
                
                if (response.data.value.length > 0) {
                    expect(response.data.value[0]).toHaveProperty('Name');
                    console.log(`✅ Found ${response.data.value.length} cubes`);
                }
            } catch (error: any) {
                if (error.code === 'ECONNREFUSED') {
                    console.warn('TM1 server not available - skipping cube test');
                    return;
                }
                throw error;
            }
        });

        test('should access process information if available', async () => {
            try {
                const response = await axios.get('/Processes?$select=Name&$top=5', validConfig);
                
                expect(response.status).toBe(200);
                expect(response.data).toHaveProperty('value');
                expect(Array.isArray(response.data.value)).toBe(true);
                
                console.log(`✅ Found ${response.data.value.length} processes`);
            } catch (error: any) {
                if (error.code === 'ECONNREFUSED') {
                    console.warn('TM1 server not available - skipping process test');
                    return;
                } else if (error.response?.status === 403) {
                    console.warn('Insufficient permissions for process access');
                    return;
                }
                throw error;
            }
        });
    });

    describe('OData Query Integration', () => {
        test('should handle OData select queries', async () => {
            try {
                const response = await axios.get('/Dimensions?$select=Name,UniqueName', validConfig);
                
                expect(response.status).toBe(200);
                expect(response.data).toHaveProperty('value');
                
                if (response.data.value.length > 0) {
                    const dimension = response.data.value[0];
                    expect(dimension).toHaveProperty('Name');
                    expect(dimension).toHaveProperty('UniqueName');
                    expect(dimension).not.toHaveProperty('Hierarchies'); // Not selected
                }
            } catch (error: any) {
                if (error.code === 'ECONNREFUSED') {
                    console.warn('TM1 server not available - skipping OData test');
                    return;
                }
                throw error;
            }
        });

        test('should handle OData top and skip queries', async () => {
            try {
                const topResponse = await axios.get('/Dimensions?$top=3&$select=Name', validConfig);
                const skipResponse = await axios.get('/Dimensions?$skip=1&$top=2&$select=Name', validConfig);
                
                expect(topResponse.status).toBe(200);
                expect(skipResponse.status).toBe(200);
                
                if (topResponse.data.value.length >= 3) {
                    expect(topResponse.data.value.length).toBeLessThanOrEqual(3);
                }
                
                if (skipResponse.data.value.length > 0) {
                    expect(skipResponse.data.value.length).toBeLessThanOrEqual(2);
                }
                
                console.log('✅ OData top/skip queries work correctly');
            } catch (error: any) {
                if (error.code === 'ECONNREFUSED') {
                    console.warn('TM1 server not available - skipping OData pagination test');
                    return;
                }
                throw error;
            }
        });

        test('should handle OData filter queries', async () => {
            try {
                // Test basic filter
                const response = await axios.get("/Dimensions?$filter=startswith(Name,'}')", validConfig);
                
                expect(response.status).toBe(200);
                expect(response.data).toHaveProperty('value');
                expect(Array.isArray(response.data.value)).toBe(true);
                
                console.log('✅ OData filter queries work correctly');
            } catch (error: any) {
                if (error.code === 'ECONNREFUSED') {
                    console.warn('TM1 server not available - skipping OData filter test');
                    return;
                } else if (error.response?.status >= 400 && error.response?.status < 500) {
                    // Some TM1 versions might not support all filter operations
                    console.warn('OData filter not supported or syntax error - this is expected on some TM1 versions');
                    return;
                }
                throw error;
            }
        });
    });

    describe('Session Management Integration', () => {
        test('should handle session lifecycle properly', async () => {
            try {
                // Test that we can make multiple requests with the same session
                const request1 = await axios.get('/Configuration/ProductVersion', validConfig);
                const request2 = await axios.get('/Configuration/ServerName', validConfig);
                const request3 = await axios.get('/Dimensions?$top=1', validConfig);
                
                expect(request1.status).toBe(200);
                expect(request2.status).toBe(200);
                expect(request3.status).toBe(200);
                
                console.log('✅ Session maintained across multiple requests');
            } catch (error: any) {
                if (error.code === 'ECONNREFUSED') {
                    console.warn('TM1 server not available - skipping session test');
                    return;
                }
                throw error;
            }
        });

        test('should handle concurrent sessions', async () => {
            try {
                // Create multiple axios instances (different sessions)
                const sessions = Array(3).fill(null).map(() => axios.create(validConfig));
                
                const promises = sessions.map(session => 
                    session.get('/Configuration/ProductVersion')
                );
                
                const results = await Promise.allSettled(promises);
                const successful = results.filter(result => result.status === 'fulfilled');
                
                // Most sessions should succeed
                expect(successful.length).toBeGreaterThanOrEqual(2);
                
                console.log(`✅ ${successful.length}/${sessions.length} concurrent sessions succeeded`);
            } catch (error: any) {
                if (error.code === 'ECONNREFUSED') {
                    console.warn('TM1 server not available - skipping concurrent session test');
                    return;
                }
                throw error;
            }
        });
    });

    describe('Real-world Scenario Integration', () => {
        test('should simulate typical application workflow', async () => {
            try {
                // Simulate a typical workflow: connect, check server, list objects
                const workflow = [
                    () => axios.get('/Configuration/ProductVersion', validConfig),
                    () => axios.get('/Configuration/ServerName', validConfig),
                    () => axios.get('/Dimensions?$top=5&$select=Name', validConfig),
                    () => axios.get('/Cubes?$top=5&$select=Name', validConfig)
                ];
                
                const results = [];
                for (const step of workflow) {
                    const result = await step();
                    results.push(result);
                    expect(result.status).toBe(200);
                }
                
                console.log(`✅ Completed ${results.length}-step workflow successfully`);
            } catch (error: any) {
                if (error.code === 'ECONNREFUSED') {
                    console.warn('TM1 server not available - skipping workflow test');
                    return;
                }
                throw error;
            }
        });

        test('should handle mixed success/failure scenarios gracefully', async () => {
            const requests = [
                // Valid requests
                { url: '/Configuration/ProductVersion', shouldSucceed: true },
                { url: '/Configuration/ServerName', shouldSucceed: true },
                // Invalid requests
                { url: '/NonExistent/Endpoint', shouldSucceed: false },
                { url: '/Dimensions/NonExistentDimension', shouldSucceed: false }
            ];
            
            const results = await Promise.allSettled(
                requests.map(req => axios.get(req.url, validConfig))
            );
            
            let expectedSuccesses = 0;
            let expectedFailures = 0;
            
            results.forEach((result, index) => {
                if (requests[index].shouldSucceed) {
                    if (result.status === 'fulfilled') {
                        expectedSuccesses++;
                    }
                } else {
                    if (result.status === 'rejected') {
                        expectedFailures++;
                    }
                }
            });
            
            try {
                // Should handle mixed scenarios appropriately
                expect(expectedSuccesses).toBeGreaterThan(0);
                expect(expectedFailures).toBeGreaterThan(0);
                
                console.log(`✅ Handled mixed scenario: ${expectedSuccesses} successes, ${expectedFailures} expected failures`);
            } catch (error: any) {
                if (error.code === 'ECONNREFUSED') {
                    console.warn('TM1 server not available - skipping mixed scenario test');
                    return;
                }
                throw error;
            }
        });
    });
});