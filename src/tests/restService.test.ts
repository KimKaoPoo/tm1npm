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

        describe('Admin role checks (issue #81)', () => {
            test('ADMIN username fast-path seeds all four caches at construction', () => {
                const { svc, instance } = makeSvc({ user: 'ADMIN' });
                expect(svc.isAdmin).toBe(true);
                expect(svc.isDataAdmin).toBe(true);
                expect(svc.isSecurityAdmin).toBe(true);
                expect(svc.isOpsAdmin).toBe(true);
                expect(instance.get).not.toHaveBeenCalled();
            });

            test('ADMIN fast-path is case-and-space insensitive', () => {
                expect(makeSvc({ user: 'admin' }).svc.isAdmin).toBe(true);
                expect(makeSvc({ user: ' A D M I N ' }).svc.isAdmin).toBe(true);
                expect(makeSvc({ user: 'Admin' }).svc.isAdmin).toBe(true);
            });

            test('sync isAdmin getter returns false before roles loaded', () => {
                const { svc } = makeSvc({ user: 'alice' });
                expect(svc.isAdmin).toBe(false);
                expect(svc.isDataAdmin).toBe(false);
                expect(svc.isSecurityAdmin).toBe(false);
                expect(svc.isOpsAdmin).toBe(false);
            });

            test('is_admin loads roles once then caches across all methods', async () => {
                const { svc, instance } = makeSvc({ user: 'alice' });
                instance.get.mockResolvedValue(createMockResponse({ value: [{ Name: 'ADMIN' }] }));
                expect(await svc.is_admin()).toBe(true);
                expect(await svc.is_data_admin()).toBe(true);
                expect(await svc.is_security_admin()).toBe(true);
                expect(await svc.is_ops_admin()).toBe(true);
                expect(instance.get).toHaveBeenCalledTimes(1);
            });

            test('is_admin matches group name case/space insensitively', async () => {
                const { svc, instance } = makeSvc({ user: 'alice' });
                instance.get.mockResolvedValue(createMockResponse({ value: [{ Name: 'A D M I N' }] }));
                expect(await svc.is_admin()).toBe(true);
                expect(svc.isAdmin).toBe(true);
            });

            test('is_data_admin matches "Data Admin" with spaces', async () => {
                const { svc, instance } = makeSvc({ user: 'alice' });
                instance.get.mockResolvedValue(createMockResponse({ value: [{ Name: 'Data Admin' }] }));
                expect(await svc.is_data_admin()).toBe(true);
                expect(await svc.is_admin()).toBe(false);
            });

            test('is_security_admin maps to SecurityAdmin group only', async () => {
                const { svc, instance } = makeSvc({ user: 'alice' });
                instance.get.mockResolvedValue(createMockResponse({ value: [{ Name: 'SecurityAdmin' }] }));
                expect(await svc.is_security_admin()).toBe(true);
                expect(await svc.is_ops_admin()).toBe(false);
            });

            test('is_ops_admin maps to OperationsAdmin group only', async () => {
                const { svc, instance } = makeSvc({ user: 'alice' });
                instance.get.mockResolvedValue(createMockResponse({ value: [{ Name: 'OperationsAdmin' }] }));
                expect(await svc.is_ops_admin()).toBe(true);
                expect(await svc.is_security_admin()).toBe(false);
            });

            test('concurrent is_*_admin() calls share a single HTTP request', async () => {
                const { svc, instance } = makeSvc({ user: 'alice' });
                instance.get.mockResolvedValue(createMockResponse({ value: [{ Name: 'ADMIN' }] }));
                const [a, b, c, d] = await Promise.all([
                    svc.is_admin(),
                    svc.is_data_admin(),
                    svc.is_security_admin(),
                    svc.is_ops_admin()
                ]);
                expect([a, b, c, d]).toEqual([true, true, true, true]);
                expect(instance.get).toHaveBeenCalledTimes(1);
            });

            test('failed /ActiveUser/Groups returns false transiently without caching', async () => {
                const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
                const { svc, instance } = makeSvc({ user: 'alice' });
                instance.get.mockRejectedValueOnce(new Error('network down'));
                expect(await svc.is_admin()).toBe(false);
                // Cache must NOT be poisoned by the transient failure.
                expect((svc as any)._isAdmin).toBeUndefined();
                expect((svc as any)._rolesLoading).toBeUndefined();

                instance.get.mockResolvedValueOnce(createMockResponse({ value: [{ Name: 'ADMIN' }] }));
                expect(await svc.is_admin()).toBe(true);
                expect(instance.get).toHaveBeenCalledTimes(2);
                warnSpy.mockRestore();
            });
        });

        describe('Static utility methods (issue #81)', () => {
            test('translate_to_boolean handles bool/number/string', () => {
                expect(RestService.translate_to_boolean(true)).toBe(true);
                expect(RestService.translate_to_boolean(false)).toBe(false);
                expect(RestService.translate_to_boolean(1)).toBe(true);
                expect(RestService.translate_to_boolean(0)).toBe(false);
                expect(RestService.translate_to_boolean('true')).toBe(true);
                expect(RestService.translate_to_boolean('True')).toBe(true);
                expect(RestService.translate_to_boolean('FALSE')).toBe(false);
                expect(RestService.translate_to_boolean(' T R U E ')).toBe(true);
                expect(RestService.translate_to_boolean('yes')).toBe(false);
                expect(RestService.translate_to_boolean('')).toBe(false);
            });

            test('translate_to_boolean throws on unsupported types', () => {
                expect(() => RestService.translate_to_boolean({} as any)).toThrow();
                expect(() => RestService.translate_to_boolean(null as any)).toThrow();
                expect(() => RestService.translate_to_boolean(undefined as any)).toThrow();
            });

            test('b64_decode_password round-trips a UTF-8 string', () => {
                const encoded = Buffer.from('s3cr3t', 'utf-8').toString('base64');
                expect(RestService.b64_decode_password(encoded)).toBe('s3cr3t');
                expect(RestService.b64_decode_password('')).toBe('');
            });
        });

        describe('add_compact_json_header (issue #81)', () => {
            test('inserts tm1.compact=v0 at position 1 and returns prior Accept value', () => {
                const { svc, instance } = makeSvc();
                instance.defaults.headers.common['Accept'] = 'application/json;odata.metadata=none,text/plain';
                const prev = svc.add_compact_json_header();
                expect(prev).toBe('application/json;odata.metadata=none,text/plain');
                const after = instance.defaults.headers.common['Accept'] as string;
                expect(after.split(';')[1]).toBe('tm1.compact=v0');
                expect(after).toBe('application/json;tm1.compact=v0;odata.metadata=none,text/plain');
            });

            test('falls back to class HEADERS Accept when axios default is unset', () => {
                const { svc, instance } = makeSvc();
                delete instance.defaults.headers.common['Accept'];
                const prev = svc.add_compact_json_header();
                expect(prev).toContain('application/json');
                expect(instance.defaults.headers.common['Accept']).toContain('tm1.compact=v0');
            });
        });

        describe('Reconnect configuration (issue #81)', () => {
            test('applies tm1py-compatible defaults', () => {
                const { svc } = makeSvc();
                expect((svc as any).reConnectOnSessionTimeout).toBe(true);
                expect((svc as any).reConnectOnRemoteDisconnect).toBe(true);
                expect((svc as any).remoteDisconnectMaxRetries).toBe(5);
                expect((svc as any).remoteDisconnectRetryDelay).toBe(1);
                expect((svc as any).remoteDisconnectMaxDelay).toBe(30);
                expect((svc as any).remoteDisconnectBackoffFactor).toBe(2);
            });

            test('honors custom overrides', () => {
                const { svc } = makeSvc({
                    reConnectOnSessionTimeout: false,
                    reConnectOnRemoteDisconnect: false,
                    remoteDisconnectMaxRetries: 7,
                    remoteDisconnectRetryDelay: 2,
                    remoteDisconnectMaxDelay: 60,
                    remoteDisconnectBackoffFactor: 3
                });
                expect((svc as any).reConnectOnSessionTimeout).toBe(false);
                expect((svc as any).reConnectOnRemoteDisconnect).toBe(false);
                expect((svc as any).remoteDisconnectMaxRetries).toBe(7);
                expect((svc as any).remoteDisconnectRetryDelay).toBe(2);
                expect((svc as any).remoteDisconnectMaxDelay).toBe(60);
                expect((svc as any).remoteDisconnectBackoffFactor).toBe(3);
            });

            test('canRetryRequest honors remoteDisconnectMaxRetries', () => {
                const { svc } = makeSvc({ remoteDisconnectMaxRetries: 1 });
                const cfg: any = {};
                expect((svc as any).canRetryRequest(cfg)).toBe(true);
                cfg._retryCount = 1;
                expect((svc as any).canRetryRequest(cfg)).toBe(false);
            });

            test('retryRequest caps delay at remoteDisconnectMaxDelay', async () => {
                jest.useFakeTimers();
                const { svc, instance } = makeSvc({ remoteDisconnectRetryDelay: 1, remoteDisconnectMaxDelay: 2 });
                const axiosCallable = jest.fn().mockResolvedValue({ data: 'ok' });
                (svc as any).axiosInstance = Object.assign(axiosCallable, instance);
                const cfg: any = { _retryCount: 5 }; // large exponential term triggers the cap
                const promise = (svc as any).retryRequest(cfg);
                // Delay should be capped at 2000ms (remoteDisconnectMaxDelay), not 2^5 * 1000 = 32000ms
                await jest.advanceTimersByTimeAsync(2000);
                await promise;
                expect(cfg._retryCount).toBe(6);
                expect(axiosCallable).toHaveBeenCalledWith(cfg);
                jest.useRealTimers();
            });

            test('retryRequest uses remoteDisconnectBackoffFactor for exponential term', async () => {
                jest.useFakeTimers();
                const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
                // retryDelay=1s, backoffFactor=3, maxDelay=1000s (so cap never engages).
                // On 2nd retry (_retryCount becomes 2), delay = 1000 * 3^(2-1) = 3000ms.
                const { svc, instance } = makeSvc({
                    remoteDisconnectRetryDelay: 1,
                    remoteDisconnectMaxDelay: 1000,
                    remoteDisconnectBackoffFactor: 3
                });
                const axiosCallable = jest.fn().mockResolvedValue({ data: 'ok' });
                (svc as any).axiosInstance = Object.assign(axiosCallable, instance);
                const cfg: any = { _retryCount: 1 };
                const promise = (svc as any).retryRequest(cfg);
                await jest.advanceTimersByTimeAsync(3000);
                await promise;
                // Confirm the delay passed to setTimeout is exactly 3000ms (1000 * 3^1)
                const delays = setTimeoutSpy.mock.calls.map(call => call[1]);
                expect(delays).toContain(3000);
                setTimeoutSpy.mockRestore();
                jest.useRealTimers();
            });
        });
    });
});