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

    describe('Cookie-based Session Management', () => {
        const makeSvc = (overrides: any = {}) => {
            const instance = {
                get: jest.fn(),
                post: jest.fn(),
                patch: jest.fn(),
                delete: jest.fn(),
                put: jest.fn(),
                defaults: { headers: { common: {} as Record<string, string> } },
                interceptors: {
                    request: { use: jest.fn() },
                    response: { use: jest.fn() }
                }
            };
            mockedAxios.create.mockReturnValue(instance as any);
            const svc = new RestService({
                baseUrl: 'http://localhost:8879/api/v1',
                user: 'admin',
                password: 'password',
                ...overrides
            });
            return { svc, instance };
        };

        describe('parseSetCookieHeaders', () => {
            test('captures TM1SessionId from Set-Cookie array with Domain/Path attributes', () => {
                const { svc } = makeSvc();
                (svc as any).parseSetCookieHeaders(['TM1SessionId=abc123; Path=/; HttpOnly']);
                expect((svc as any).sessionCookies.get('TM1SessionId')).toBe('abc123');
            });

            test('captures paSession (v12) from Set-Cookie', () => {
                const { svc } = makeSvc();
                (svc as any).parseSetCookieHeaders(['paSession=v12xyz; Domain=backend.local; Path=/']);
                expect((svc as any).sessionCookies.get('paSession')).toBe('v12xyz');
            });

            test('accepts single string input', () => {
                const { svc } = makeSvc();
                (svc as any).parseSetCookieHeaders('TM1SessionId=single; Path=/');
                expect((svc as any).sessionCookies.get('TM1SessionId')).toBe('single');
            });

            test('ignores undefined / empty array / malformed input', () => {
                const { svc } = makeSvc();
                (svc as any).parseSetCookieHeaders(undefined);
                (svc as any).parseSetCookieHeaders([]);
                (svc as any).parseSetCookieHeaders(['malformed_no_equals']);
                expect((svc as any).sessionCookies.size).toBe(0);
            });

            test('empty value deletes the stored cookie', () => {
                const { svc } = makeSvc();
                (svc as any).sessionCookies.set('TM1SessionId', 'x');
                (svc as any).parseSetCookieHeaders(['TM1SessionId=; Max-Age=0']);
                expect((svc as any).sessionCookies.has('TM1SessionId')).toBe(false);
            });

            test('ignores non-session cookies', () => {
                const { svc } = makeSvc();
                (svc as any).parseSetCookieHeaders([
                    'BIGipServer=xxx; Path=/',
                    'JSESSIONID=yyy'
                ]);
                expect((svc as any).sessionCookies.size).toBe(0);
            });

            test('cookie with bogus Domain still produces outbound Cookie on next call (reverse-proxy)', () => {
                const { svc } = makeSvc();
                (svc as any).parseSetCookieHeaders([
                    'TM1SessionId=proxied; Domain=internal.backend; Path=/'
                ]);
                const header = (svc as any).buildCookieHeader();
                expect(header).toBe('TM1SessionId=proxied');
                expect(header).not.toContain('Domain');
                expect(header).not.toContain('Path');
            });
        });

        describe('buildCookieHeader', () => {
            test('empty store returns undefined', () => {
                const { svc } = makeSvc();
                expect((svc as any).buildCookieHeader()).toBeUndefined();
            });

            test('serializes multiple cookies as name=value; name=value', () => {
                const { svc } = makeSvc();
                (svc as any).sessionCookies.set('TM1SessionId', 'a');
                (svc as any).sessionCookies.set('paSession', 'b');
                const header = (svc as any).buildCookieHeader() as string;
                const parts = header.split('; ').sort();
                expect(parts).toEqual(['TM1SessionId=a', 'paSession=b'].sort());
            });
        });

        describe('getSessionCookieValue', () => {
            test('TM1SessionId wins over paSession when both are stored', () => {
                const { svc } = makeSvc();
                (svc as any).sessionCookies.set('TM1SessionId', 'v11');
                (svc as any).sessionCookies.set('paSession', 'v12');
                expect((svc as any).getSessionCookieValue()).toBe('v11');
            });

            test('returns paSession when only v12 cookie is stored', () => {
                const { svc } = makeSvc();
                (svc as any).sessionCookies.set('paSession', 'v12-only');
                expect((svc as any).getSessionCookieValue()).toBe('v12-only');
            });
        });

        describe('Constructor seeding', () => {
            test('seeds TM1SessionId when config.sessionId is provided', () => {
                const { svc } = makeSvc({ sessionId: 'seeded-abc' });
                expect((svc as any).sessionCookies.get('TM1SessionId')).toBe('seeded-abc');
                expect(svc.getSessionId()).toBe('seeded-abc');
            });

            test('does not seed when config.sessionId is absent', () => {
                const { svc } = makeSvc();
                expect((svc as any).sessionCookies.size).toBe(0);
            });
        });

        describe('connect / disconnect', () => {
            test('connect removes Authorization from axios defaults after success', async () => {
                const { svc, instance } = makeSvc();
                instance.defaults.headers.common['Authorization'] = 'Basic xxx';
                instance.get.mockResolvedValue(createMockResponse({ value: 'Server1' }));

                await svc.connect();

                expect(instance.defaults.headers.common['Authorization']).toBeUndefined();
                expect(svc.isLoggedIn()).toBe(false);
            });

            test('connect skips setupAuthentication when config.sessionId was provided', async () => {
                const { svc, instance } = makeSvc({ sessionId: 'seed' });
                const authSpy = jest.fn();
                (svc as any).setupAuthentication = authSpy;
                instance.get.mockResolvedValue(createMockResponse({ value: 'Server1' }));

                await svc.connect();

                expect(authSpy).not.toHaveBeenCalled();
                expect(instance.get).toHaveBeenCalledWith('/Configuration/ServerName');
                expect(svc.isLoggedIn()).toBe(true);
            });

            test('connect calls setupAuthentication when no session cookie is seeded', async () => {
                const { svc, instance } = makeSvc();
                const authSpy = jest.fn().mockResolvedValue(undefined);
                (svc as any).setupAuthentication = authSpy;
                instance.get.mockResolvedValue(createMockResponse({ value: 'Server1' }));

                await svc.connect();

                expect(authSpy).toHaveBeenCalledTimes(1);
            });

            test('disconnect clears sessionCookies and flips isLoggedIn to false', async () => {
                const { svc, instance } = makeSvc();
                (svc as any).sessionCookies.set('TM1SessionId', 'abc');
                (svc as any).isConnected = true;
                instance.post.mockResolvedValue(createMockResponse({}, 204));

                await svc.disconnect();

                expect((svc as any).sessionCookies.size).toBe(0);
                expect(svc.isLoggedIn()).toBe(false);
            });
        });

        describe('removeAuthorizationHeader', () => {
            test('deletes Authorization from axios defaults', () => {
                const { svc, instance } = makeSvc();
                instance.defaults.headers.common['Authorization'] = 'Basic xxx';
                (svc as any).removeAuthorizationHeader();
                expect(instance.defaults.headers.common['Authorization']).toBeUndefined();
            });
        });

        describe('isLoggedIn branches', () => {
            test('returns false when not connected', () => {
                const { svc } = makeSvc();
                expect(svc.isLoggedIn()).toBe(false);
            });

            test('returns false when connected but no session cookie', () => {
                const { svc } = makeSvc();
                (svc as any).isConnected = true;
                expect(svc.isLoggedIn()).toBe(false);
            });

            test('returns true when connected AND session cookie present', () => {
                const { svc } = makeSvc();
                (svc as any).isConnected = true;
                (svc as any).sessionCookies.set('TM1SessionId', 'abc');
                expect(svc.isLoggedIn()).toBe(true);
            });
        });
    });
});