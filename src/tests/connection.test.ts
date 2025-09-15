/**
 * Connection tests for TM1 instance
 * These tests verify that the TM1 instance is accessible
 */

import axios from 'axios';
import { loadTestConfig } from './testConfig';

describe('TM1 Connection Tests', () => {
    const config = loadTestConfig();
    const baseUrl = `http://${config.address}:${config.port}/api/v1`;

    test('TM1 server should be accessible', async () => {
        try {
            const response = await axios.get(`${baseUrl}/Configuration/ProductVersion`, {
                auth: {
                    username: config.user,
                    password: config.password,
                },
                timeout: 30000
            });

            expect(response.status).toBe(200);
            expect(response.data).toHaveProperty('value');
            expect(typeof response.data.value).toBe('string');
            console.log(`✅ TM1 Version: ${response.data.value}`);
        } catch (error: any) {
            if (error.code === 'ECONNREFUSED') {
                console.log('⚠️ TM1 server not available - skipping connection tests');
                return; // Skip test if server not available
            }
            throw error;
        }
    }, 60000); // 60 second timeout

    test('TM1 server name should be accessible', async () => {
        try {
            const response = await axios.get(`${baseUrl}/Configuration/ServerName`, {
                auth: {
                    username: config.user,
                    password: config.password,
                },
                timeout: 30000
            });

            expect(response.status).toBe(200);
            expect(response.data).toHaveProperty('value');
            expect(typeof response.data.value).toBe('string');
            console.log(`✅ Server Name: ${response.data.value}`);
        } catch (error: any) {
            if (error.code === 'ECONNREFUSED') {
                console.log('⚠️ TM1 server not available - skipping connection tests');
                return;
            }
            throw error;
        }
    }, 60000); // 60 second timeout

    test('Basic REST API endpoints should be accessible', async () => {
        try {
            const endpoints = [
                '/Cubes?$top=1&$select=Name',
                '/Dimensions?$top=1&$select=Name',
                '/Processes?$top=1&$select=Name'
            ];

            for (const endpoint of endpoints) {
                const response = await axios.get(`${baseUrl}${endpoint}`, {
                    auth: {
                        username: config.user,
                        password: config.password,
                    },
                    timeout: 30000
                });

                expect(response.status).toBe(200);
                expect(response.data).toHaveProperty('value');
                expect(Array.isArray(response.data.value)).toBe(true);
            }

            console.log('✅ All basic REST API endpoints accessible');
        } catch (error: any) {
            if (error.code === 'ECONNREFUSED') {
                console.log('⚠️ TM1 server not available - skipping connection tests');
                return;
            }
            throw error;
        }
    }, 60000); // 60 second timeout
});