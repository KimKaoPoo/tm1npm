/**
 * RestService Tests for tm1npm
 * Comprehensive tests for TM1 REST API operations with proper mocking
 */

import { RestService } from '../services/RestService';
import axios, { AxiosResponse } from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Helper function to create mock AxiosResponse
const createMockResponse = (data: any, status: number = 200): AxiosResponse => ({
    data,
    status,
    statusText: status === 200 ? 'OK' : status === 201 ? 'Created' : status === 204 ? 'No Content' : 'Error',
    headers: {},
    config: {} as any
});

describe('RestService Tests', () => {
    let restService: RestService;

    beforeEach(() => {
        // Clear all mocks
        jest.clearAllMocks();
        
        // Mock axios.create
        const mockAxiosInstance = {
            get: jest.fn(),
            post: jest.fn(),
            patch: jest.fn(),
            delete: jest.fn(),
            put: jest.fn(),
            interceptors: {
                request: { use: jest.fn() },
                response: { use: jest.fn() }
            }
        };

        mockedAxios.create.mockReturnValue(mockAxiosInstance as any);
        
        const config = {
            baseUrl: 'http://localhost:8879/api/v1',
            user: 'admin',
            password: 'password',
            timeout: 30000
        };
        
        restService = new RestService(config);
    });

    describe('Basic HTTP Operations', () => {
        test('should handle GET requests', async () => {
            const mockResponse = createMockResponse({ value: '11.8.0' });
            (restService as any).axiosInstance.get.mockResolvedValue(mockResponse);

            const response = await restService.get('/Configuration/ProductVersion');
            
            expect(response.status).toBe(200);
            expect(response.data.value).toBe('11.8.0');
        });

        test('should handle POST requests', async () => {
            const mockResponse = createMockResponse({}, 201);
            (restService as any).axiosInstance.post.mockResolvedValue(mockResponse);

            const response = await restService.post('/test', { data: 'test' });
            
            expect(response.status).toBe(201);
        });

        test('should handle PATCH requests', async () => {
            const mockResponse = createMockResponse({}, 200);
            (restService as any).axiosInstance.patch.mockResolvedValue(mockResponse);

            const response = await restService.patch('/test', { data: 'updated' });
            
            expect(response.status).toBe(200);
        });

        test('should handle DELETE requests', async () => {
            const mockResponse = createMockResponse({}, 204);
            (restService as any).axiosInstance.delete.mockResolvedValue(mockResponse);

            const response = await restService.delete('/test');
            
            expect(response.status).toBe(204);
        });

        test('should handle PUT requests', async () => {
            const mockResponse = createMockResponse({}, 200);
            (restService as any).axiosInstance.put.mockResolvedValue(mockResponse);

            const response = await restService.put('/test', { data: 'test' });
            
            expect(response.status).toBe(200);
        });
    });

    describe('Configuration and Setup', () => {
        test('should build base URL correctly', () => {
            expect(restService).toBeDefined();
            expect((restService as any).config.baseUrl).toContain('localhost:8879');
        });

        test('should set timeout correctly', () => {
            expect((restService as any).config.timeout).toBe(30000);
        });

        test('should handle authentication config', () => {
            expect((restService as any).config.user).toBe('admin');
            expect((restService as any).config.password).toBe('password');
        });
    });

    describe('Session Management', () => {
        test('should handle session ID', () => {
            restService.setSandbox('TestSandbox');
            expect(restService.getSandbox()).toBe('TestSandbox');
        });

        test('should check login status', () => {
            // Initially not logged in
            expect(restService.isLoggedIn()).toBe(false);
        });
    });

    describe('Error Handling', () => {
        test('should handle network errors', async () => {
            const networkError = new Error('Network Error');
            (restService as any).axiosInstance.get.mockRejectedValue(networkError);

            await expect(restService.get('/test')).rejects.toThrow('Network Error');
        });

        test('should handle HTTP errors', async () => {
            const httpError = {
                response: {
                    status: 404,
                    statusText: 'Not Found',
                    data: { error: 'Resource not found' }
                }
            };
            (restService as any).axiosInstance.get.mockRejectedValue(httpError);

            await expect(restService.get('/nonexistent')).rejects.toMatchObject(httpError);
        });

        test('should handle timeout errors', async () => {
            const timeoutError = {
                code: 'ECONNABORTED',
                message: 'timeout of 30000ms exceeded'
            };
            (restService as any).axiosInstance.get.mockRejectedValue(timeoutError);

            await expect(restService.get('/slow-endpoint')).rejects.toMatchObject(timeoutError);
        });
    });

    describe('API Metadata', () => {
        test('should get API metadata', async () => {
            const mockResponse = createMockResponse({ 
                version: '1.0',
                capabilities: ['read', 'write'] 
            });
            (restService as any).axiosInstance.get.mockResolvedValue(mockResponse);

            const metadata = await restService.getApiMetadata();
            
            expect(metadata.version).toBe('1.0');
            expect(metadata.capabilities).toEqual(['read', 'write']);
        });
    });

    describe('RestService Integration', () => {
        test('should handle complex request scenarios', async () => {
            // Mock a sequence of operations
            const getMockResponse = createMockResponse({ id: 'test123' });
            const postMockResponse = createMockResponse({}, 201);
            const patchMockResponse = createMockResponse({}, 200);
            const deleteMockResponse = createMockResponse({}, 204);

            (restService as any).axiosInstance.get
                .mockResolvedValueOnce(getMockResponse);
            (restService as any).axiosInstance.post
                .mockResolvedValueOnce(postMockResponse);
            (restService as any).axiosInstance.patch
                .mockResolvedValueOnce(patchMockResponse);
            (restService as any).axiosInstance.delete
                .mockResolvedValueOnce(deleteMockResponse);

            // Execute sequence
            const getResponse = await restService.get('/test');
            expect(getResponse.data.id).toBe('test123');

            const postResponse = await restService.post('/test', { name: 'test' });
            expect(postResponse.status).toBe(201);

            const patchResponse = await restService.patch('/test', { name: 'updated' });
            expect(patchResponse.status).toBe(200);

            const deleteResponse = await restService.delete('/test');
            expect(deleteResponse.status).toBe(204);
        });

        test('should maintain consistency across operations', async () => {
            const mockResponse = createMockResponse({ consistent: true });
            (restService as any).axiosInstance.get.mockResolvedValue(mockResponse);

            const response1 = await restService.get('/test');
            const response2 = await restService.get('/test');

            expect(response1.data).toEqual(response2.data);
        });
    });
});

describe('RestService URL topology dispatch', () => {
    let mockAxiosInstance: any;

    beforeEach(() => {
        jest.clearAllMocks();
        mockAxiosInstance = {
            get: jest.fn(),
            post: jest.fn(),
            patch: jest.fn(),
            delete: jest.fn(),
            put: jest.fn(),
            interceptors: {
                request: { use: jest.fn() },
                response: { use: jest.fn() }
            },
            defaults: { headers: { common: {} } }
        };
        mockedAxios.create.mockReturnValue(mockAxiosInstance as any);
    });

    const firstCreateArg = (): any => mockedAxios.create.mock.calls[0][0];
    const lastBaseURL = (): string => firstCreateArg().baseURL;

    describe('v11 pattern', () => {
        test('should build v11 URL with ssl=true and default port', () => {
            const svc = new RestService({ address: 'host', ssl: true });
            expect(lastBaseURL()).toBe('https://host:8001/api/v1');
            expect((svc as any).resolveRoots().authRoot).toBe('https://host:8001/api/v1/Configuration/ProductVersion/$value');
        });

        test('should build v11 URL with ssl=false and explicit port', () => {
            new RestService({ address: 'host', port: 9000, ssl: false });
            expect(lastBaseURL()).toBe('http://host:9000/api/v1');
        });

        test('should default address to localhost when omitted', () => {
            new RestService({ ssl: false, port: 8001 });
            expect(lastBaseURL()).toBe('http://localhost:8001/api/v1');
        });
    });

    describe('baseUrl override', () => {
        test('should use baseUrl verbatim when it ends with /api/v1', () => {
            const svc = new RestService({ baseUrl: 'http://x/api/v1' });
            expect(lastBaseURL()).toBe('http://x/api/v1');
            expect((svc as any).resolveRoots().authRoot).toBe('http://x/api/v1/Configuration/ProductVersion/$value');
        });

        test('should append /api/v1 when baseUrl lacks it', () => {
            new RestService({ baseUrl: 'http://x' });
            expect(lastBaseURL()).toBe('http://x/api/v1');
        });

        test('should resolve Databases() baseUrl when authUrl provided', () => {
            const svc = new RestService({
                baseUrl: "http://x/api/v1/Databases('DB')",
                authUrl: 'http://x/auth'
            });
            expect(lastBaseURL()).toBe("http://x/api/v1/Databases('DB')");
            expect((svc as any).resolveRoots().authRoot).toBe('http://x/auth');
        });

        test('should throw for Databases() baseUrl without authUrl', () => {
            expect(() => new RestService({
                baseUrl: "http://x/api/v1/Databases('DB')"
            })).toThrow(/Auth_url missing/);
        });

        test('should throw when baseUrl and address both provided', () => {
            expect(() => new RestService({
                baseUrl: 'http://x/api/v1',
                address: 'y'
            })).toThrow(/Base URL and Address/);
        });
    });

    describe('IBM Cloud pattern', () => {
        test('should build IBM Cloud URL when iamUrl provided', () => {
            const svc = new RestService({
                address: 'pa.ibm.com',
                tenant: 'T1',
                database: 'DB1',
                iamUrl: 'https://iam.cloud.ibm.com',
                ssl: true,
                apiKey: 'k'
            });
            expect(lastBaseURL()).toBe('https://pa.ibm.com/api/T1/v0/tm1/DB1');
            expect((svc as any).resolveRoots().authRoot).toBe('https://pa.ibm.com/api/T1/v0/tm1/DB1/Configuration/ProductVersion/$value');
        });

        test('should throw when IBM Cloud missing tenant', () => {
            expect(() => new RestService({
                address: 'pa.ibm.com',
                database: 'DB1',
                iamUrl: 'https://iam',
                ssl: true
            })).toThrow(/tenant.*database|address.*tenant/);
        });

        test('should throw when IBM Cloud ssl=false', () => {
            expect(() => new RestService({
                address: 'pa.ibm.com',
                tenant: 'T1',
                database: 'DB1',
                iamUrl: 'https://iam',
                ssl: false
            })).toThrow(/ssl.*must be true/);
        });
    });

    describe('PA Proxy pattern', () => {
        test('should build PA Proxy URL with https', () => {
            const svc = new RestService({
                address: 'h',
                database: 'DB',
                user: 'u',
                paUrl: 'https://pa',
                ssl: true
            });
            expect(lastBaseURL()).toBe('https://h/tm1/DB/api/v1');
            expect((svc as any).resolveRoots().authRoot).toBe('https://h/login');
        });

        test('should build PA Proxy URL with http', () => {
            new RestService({
                address: 'h',
                database: 'DB',
                user: 'u',
                paUrl: 'http://pa',
                ssl: false
            });
            expect(lastBaseURL()).toBe('http://h/tm1/DB/api/v1');
        });

        test('should throw when PA Proxy missing database', () => {
            expect(() => new RestService({
                address: 'h',
                user: 'u',
                paUrl: 'https://pa',
                ssl: true
            })).toThrow(/'address'.*'database'.*must be provided/);
        });
    });

    describe('S2S pattern', () => {
        test('should build S2S URL with port and ssl', () => {
            const svc = new RestService({
                address: 'h',
                port: 443,
                instance: 'INST',
                database: 'DB',
                ssl: true
            });
            expect(lastBaseURL()).toBe("https://h:443/INST/api/v1/Databases('DB')");
            expect((svc as any).resolveRoots().authRoot).toBe('https://h:443/INST/auth/v1/session');
        });

        test('should build S2S URL without port', () => {
            new RestService({
                address: 'h',
                instance: 'INST',
                database: 'DB',
                ssl: true
            });
            expect(lastBaseURL()).toBe("https://h/INST/api/v1/Databases('DB')");
        });

        test('should default to localhost when address is empty', () => {
            new RestService({
                address: '',
                instance: 'I',
                database: 'D',
                ssl: false
            });
            expect(lastBaseURL()).toBe("http://localhost/I/api/v1/Databases('D')");
        });

        test('should throw S2S without instance', () => {
            expect(() => new RestService({
                address: 'h',
                instance: 'INST',
                ssl: true
            })).toThrow(/instance.*database|instance.*required|database.*required/i);
        });
    });

    describe('Config pass-through and axios wiring', () => {
        test('should accept all new config fields without error', () => {
            expect(() => new RestService({
                baseUrl: 'http://x/api/v1',
                iamUrl: 'https://iam',
                paUrl: 'https://pa',
                cpdUrl: 'https://cpd',
                gateway: 'https://gw',
                integratedLogin: true,
                integratedLoginDomain: '.',
                integratedLoginService: 'HTTP',
                integratedLoginHost: 'host',
                integratedLoginDelegate: false,
                user: 'admin',
                password: 'pw'
            })).not.toThrow();
        });

        test('should pass proxy.https to axios when provided', () => {
            new RestService({
                baseUrl: 'http://x/api/v1',
                proxies: { https: 'https://proxy.example.com:8443' }
            });
            const cfg = firstCreateArg();
            expect(cfg.proxy).toEqual({ host: 'proxy.example.com', port: 8443, protocol: 'https' });
        });

        test('should fall back to proxy.http when https not provided', () => {
            new RestService({
                baseUrl: 'http://x/api/v1',
                proxies: { http: 'http://proxy.example.com:8080' }
            });
            const cfg = firstCreateArg();
            expect(cfg.proxy).toEqual({ host: 'proxy.example.com', port: 8080, protocol: 'http' });
        });

        test('should not set proxy when proxies unset', () => {
            new RestService({ baseUrl: 'http://x/api/v1' });
            const cfg = firstCreateArg();
            expect(cfg.proxy).toBeUndefined();
        });

        test('should pass sslContext through as httpsAgent', () => {
            const https = require('https');
            const agent = new https.Agent();
            new RestService({
                baseUrl: 'http://x/api/v1',
                sslContext: agent
            });
            const cfg = firstCreateArg();
            expect(cfg.httpsAgent).toBe(agent);
        });

        test('should not treat cpdUrl alone as v12 topology signal', () => {
            new RestService({
                address: 'host',
                port: 9000,
                ssl: false,
                cpdUrl: 'https://cpd'
            });
            expect(lastBaseURL()).toBe('http://host:9000/api/v1');
        });

        test('should not treat gateway alone as v12 topology signal', () => {
            new RestService({
                address: 'host',
                port: 9000,
                ssl: false,
                gateway: 'https://gw'
            });
            expect(lastBaseURL()).toBe('http://host:9000/api/v1');
        });
    });

    describe('S2S token endpoint guard', () => {
        test('should throw when S2S auth runs on v11 topology without authUrl', async () => {
            const svc = new RestService({
                address: 'host',
                ssl: true,
                applicationClientId: 'id',
                applicationClientSecret: 'secret'
            });
            await expect((svc as any).setupServiceToServiceAuthentication()).rejects.toThrow(
                /'authUrl' is required for Service-to-Service authentication on v11 topology/
            );
        });
    });
});