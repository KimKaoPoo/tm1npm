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
                // Simulate server issuing a session cookie so stripping Authorization is safe
                (svc as any).sessionCookies.set('TM1SessionId', 'from-server');

                await svc.connect();

                expect(instance.defaults.headers.common['Authorization']).toBeUndefined();
                expect(svc.isLoggedIn()).toBe(true);
            });

            test('connect preserves Authorization when no session cookie was issued (Bearer-only mode)', async () => {
                const { svc, instance } = makeSvc({ accessToken: 'bearer-xyz' });
                instance.defaults.headers.common['Authorization'] = 'Bearer bearer-xyz';
                instance.get.mockResolvedValue(createMockResponse({ value: 'Server1' }));

                await svc.connect();

                expect(instance.defaults.headers.common['Authorization']).toBe('Bearer bearer-xyz');
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

        describe('Interceptor flow', () => {
            // Exercises the response interceptor that RestService installs during construction
            // via axios.defaults. Captured at test time from the real interceptor-install call.
            let capturedResponseSuccess: (r: any) => any;
            let capturedResponseError: (e: any) => Promise<any>;
            let capturedRequest: (c: any) => any;
            let realSvc: RestService;
            let realInstance: any;

            beforeEach(() => {
                capturedRequest = (c: any) => c;
                capturedResponseSuccess = (r: any) => r;
                capturedResponseError = async (e: any) => Promise.reject(e);
                realInstance = {
                    get: jest.fn(),
                    post: jest.fn(),
                    defaults: { headers: { common: {} as Record<string, string> } },
                    interceptors: {
                        request: { use: jest.fn((fn: any) => { capturedRequest = fn; }) },
                        response: { use: jest.fn((success: any, err: any) => {
                            capturedResponseSuccess = success;
                            capturedResponseError = err;
                        })}
                    }
                };
                mockedAxios.create.mockReturnValue(realInstance);
                // Make axiosInstance callable as a function for retry replay
                const callable: any = jest.fn();
                Object.assign(callable, realInstance);
                mockedAxios.create.mockReturnValue(callable);
                realInstance = callable;
                realSvc = new RestService({ baseUrl: 'http://x/api/v1', user: 'a', password: 'b' });
            });

            test('response interceptor captures Set-Cookie on success', () => {
                capturedResponseSuccess({
                    headers: { 'set-cookie': ['TM1SessionId=captured; Path=/'] },
                    data: {}, status: 200
                });
                expect((realSvc as any).sessionCookies.get('TM1SessionId')).toBe('captured');
            });

            test('response interceptor captures Set-Cookie on error responses too', async () => {
                // Use a 403 (not a retryable 5xx, not a 401 re-auth trigger) so it falls through
                // to the throw path without being replayed by the retry logic
                await expect(capturedResponseError({
                    response: { status: 403, statusText: 'Forbidden', data: {}, headers: { 'set-cookie': ['paSession=fromErr; Path=/'] } },
                    config: { headers: {} },
                    message: 'Forbidden'
                })).rejects.toBeDefined();
                expect((realSvc as any).sessionCookies.get('paSession')).toBe('fromErr');
            });

            test('request interceptor writes Cookie header from the store', () => {
                (realSvc as any).sessionCookies.set('TM1SessionId', 'outbound');
                const out = capturedRequest({ headers: {} });
                expect(out.headers['Cookie']).toBe('TM1SessionId=outbound');
            });

            test('401 triggers reAuth and replays the request with fresh Cookie, no stale Authorization', async () => {
                (realSvc as any).isConnected = true;
                (realSvc as any).sessionCookies.set('TM1SessionId', 'expired');
                // reAuthenticate() calls disconnect() + connect(); mock both network calls to succeed
                realInstance.post.mockResolvedValue(createMockResponse({}, 204));
                realInstance.get.mockResolvedValue(createMockResponse({ value: 'Server1' }));
                // Simulate new server-issued cookie during connect's probe by seeding directly —
                // the real interceptor would capture it from set-cookie, but we short-circuit here
                const reAuthSpy = jest.spyOn(realSvc as any, 'reAuthenticate').mockImplementation(async () => {
                    (realSvc as any).sessionCookies.clear();
                    (realSvc as any).sessionCookies.set('TM1SessionId', 'fresh');
                });
                // axios instance is callable — replay returns a sentinel
                const replayed = createMockResponse({ ok: true }, 200);
                (realInstance as unknown as jest.Mock).mockResolvedValue(replayed);

                const originalRequest: any = {
                    headers: { 'Cookie': 'TM1SessionId=expired', 'authorization': 'Basic lowercase' },
                    url: '/SomeEndpoint',
                };
                const result = await capturedResponseError({
                    response: { status: 401, headers: {} },
                    config: originalRequest,
                    message: 'Unauthorized',
                });

                expect(reAuthSpy).toHaveBeenCalledTimes(1);
                expect(originalRequest._retry).toBe(true);
                expect(originalRequest.headers['Cookie']).toBeUndefined();
                // Case-insensitive delete caught the lowercase variant
                expect(originalRequest.headers['authorization']).toBeUndefined();
                expect(result).toBe(replayed);
            });

            test('401 on tm1.Close does not recurse into reAuthenticate (isConnected guard)', async () => {
                (realSvc as any).isConnected = false;
                const reAuthSpy = jest.spyOn(realSvc as any, 'reAuthenticate');
                await expect(capturedResponseError({
                    response: { status: 401, statusText: 'Unauthorized', data: {}, headers: {} },
                    config: { headers: {} },
                    message: 'Unauthorized',
                })).rejects.toBeDefined();
                expect(reAuthSpy).not.toHaveBeenCalled();
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

        test('should preserve TM1 11 IBM Cloud baseUrl shape verbatim', () => {
            new RestService({
                baseUrl: 'https://mycompany.planning-analytics.ibmcloud.com/tm1/api/tm1/'
            });
            expect(lastBaseURL()).toBe('https://mycompany.planning-analytics.ibmcloud.com/tm1/api/tm1');
        });

        test('should preserve TM1 12 PaaS baseUrl shape (trailing slash normalized)', () => {
            new RestService({
                baseUrl: 'https://us-east-1.planninganalytics.saas.ibm.com/api/T1/v0/tm1/DB1/'
            });
            expect(lastBaseURL()).toBe('https://us-east-1.planninganalytics.saas.ibm.com/api/T1/v0/tm1/DB1');
        });

        test('should preserve TM1 12 access-token baseUrl shape verbatim', () => {
            new RestService({
                baseUrl: 'https://pa12.dev.net/api/INST/v0/tm1/DB1'
            });
            expect(lastBaseURL()).toBe('https://pa12.dev.net/api/INST/v0/tm1/DB1');
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

        test('should let v12 signals win over baseUrl (tm1py parity)', () => {
            const svc = new RestService({
                baseUrl: 'http://ignored/api/v1',
                address: 'pa.ibm.com',
                tenant: 'T1',
                database: 'DB1',
                iamUrl: 'https://iam.cloud.ibm.com',
                ssl: true
            });
            expect(lastBaseURL()).toBe('https://pa.ibm.com/api/T1/v0/tm1/DB1');
            expect((svc as any).resolveRoots().authRoot).toBe('https://pa.ibm.com/api/T1/v0/tm1/DB1/Configuration/ProductVersion/$value');
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
        test('should accept new non-topology config fields without error', () => {
            // iamUrl/paUrl/tenant/instance/database are topology signals (tested per-topology above);
            // this asserts the remaining auth/network fields are accepted as config surface.
            expect(() => new RestService({
                baseUrl: 'http://x/api/v1',
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

        test('should forward credentials from proxy URL to proxy.auth', () => {
            new RestService({
                baseUrl: 'http://x/api/v1',
                proxies: { https: 'https://u%40dom:p%40ss@proxy.example.com:8443' }
            });
            const cfg = firstCreateArg();
            expect(cfg.proxy).toEqual({
                host: 'proxy.example.com',
                port: 8443,
                protocol: 'https',
                auth: { username: 'u@dom', password: 'p@ss' }
            });
        });

        test('should not set proxy.auth when proxy URL has no credentials', () => {
            new RestService({
                baseUrl: 'http://x/api/v1',
                proxies: { https: 'https://proxy.example.com:8443' }
            });
            const cfg = firstCreateArg();
            expect(cfg.proxy.auth).toBeUndefined();
        });

        test('should pass sslContext through as httpsAgent', () => {
            const httpsMod = require('https');
            const agent = new httpsMod.Agent();
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

    describe('Session cookie seeding by topology', () => {
        test('should seed TM1SessionId cookie for v11 topology', () => {
            const svc = new RestService({ address: 'host', ssl: true, sessionId: 'abc' });
            expect((svc as any).sessionCookies.get('TM1SessionId')).toBe('abc');
            expect((svc as any).sessionCookies.get('paSession')).toBeUndefined();
        });

        test('should seed paSession cookie for IBM Cloud topology', () => {
            const svc = new RestService({
                address: 'pa.ibm.com',
                tenant: 'T1',
                database: 'DB1',
                iamUrl: 'https://iam',
                ssl: true,
                sessionId: 'abc'
            });
            expect((svc as any).sessionCookies.get('paSession')).toBe('abc');
            expect((svc as any).sessionCookies.get('TM1SessionId')).toBeUndefined();
        });

        test('should seed paSession cookie for S2S topology', () => {
            const svc = new RestService({
                address: 'h',
                instance: 'INST',
                database: 'DB',
                ssl: true,
                sessionId: 'xyz'
            });
            expect((svc as any).sessionCookies.get('paSession')).toBe('xyz');
        });

        test('should seed paSession cookie for PA Proxy topology', () => {
            const svc = new RestService({
                address: 'h',
                database: 'DB',
                user: 'u',
                paUrl: 'https://pa',
                ssl: true,
                sessionId: 'pp'
            });
            expect((svc as any).sessionCookies.get('paSession')).toBe('pp');
        });

        test('should seed TM1SessionId cookie for baseUrl override', () => {
            const svc = new RestService({ baseUrl: 'http://x/api/v1', sessionId: 'ff' });
            expect((svc as any).sessionCookies.get('TM1SessionId')).toBe('ff');
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

        test('should throw when S2S auth runs on v11-style baseUrl topology without authUrl', async () => {
            const svc = new RestService({
                baseUrl: 'http://x/api/v1',
                applicationClientId: 'id',
                applicationClientSecret: 'secret'
            });
            await expect((svc as any).setupServiceToServiceAuthentication()).rejects.toThrow(
                /'authUrl' is required for Service-to-Service authentication on v11 topology/
            );
        });

        test('should not throw when S2S auth runs on v12 Databases baseUrl with authUrl', async () => {
            const svc = new RestService({
                baseUrl: "http://x/api/v1/Databases('DB')",
                authUrl: 'http://x/auth',
                applicationClientId: 'id',
                applicationClientSecret: 'secret'
            });
            // Will reject with network-level error when trying to POST, but NOT the guard error.
            await expect((svc as any).setupServiceToServiceAuthentication())
                .rejects.not.toThrow(/'authUrl' is required/);
        });
    });
});