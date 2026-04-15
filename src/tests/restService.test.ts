import axios, { AxiosResponse } from 'axios';
import { RestService } from '../services/RestService';
import { TM1RestException, TM1TimeoutException } from '../exceptions/TM1Exception';

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

const createMockResponse = (data: any, status = 200, headers: Record<string, any> = {}): AxiosResponse => ({
    data,
    status,
    statusText: status === 200 ? 'OK' : status === 201 ? 'Created' : status === 202 ? 'Accepted' : 'Error',
    headers,
    config: {} as any
});

describe('RestService', () => {
    let restService: RestService;
    let mockAxiosInstance: any;
    let responseErrorHandler: ((error: any) => Promise<any>) | undefined;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.useRealTimers();
        responseErrorHandler = undefined;

        mockAxiosInstance = Object.assign(jest.fn(), {
            get: jest.fn(),
            post: jest.fn(),
            patch: jest.fn(),
            put: jest.fn(),
            delete: jest.fn(),
            request: jest.fn(),
            defaults: { headers: { common: {} } },
            interceptors: {
                request: {
                    use: jest.fn()
                },
                response: {
                    use: jest.fn((onFulfilled: any, onRejected: any) => {
                        responseErrorHandler = onRejected;
                        return 0;
                    })
                }
            }
        });

        mockedAxios.create.mockReturnValue(mockAxiosInstance);

        restService = new RestService({
            baseUrl: 'http://localhost:8879/api/v1',
            user: 'admin',
            password: 'password',
            timeout: 60
        });
    });

    test('routes sync GET requests through the central dispatcher', async () => {
        mockAxiosInstance.request.mockResolvedValue(createMockResponse({ value: '11.8.0' }));

        const response = await restService.get('/Configuration/ProductVersion');

        expect(response.data.value).toBe('11.8.0');
        expect(mockAxiosInstance.request).toHaveBeenCalledWith(
            expect.objectContaining({
                method: 'GET',
                url: '/Configuration/ProductVersion',
                timeout: 60000,
                _idempotent: true
            })
        );
    });

    test('routes async requests with Prefer header and polls /_async endpoint', async () => {
        mockAxiosInstance.request
            .mockResolvedValueOnce(createMockResponse({}, 202, {
                location: "/api/v1/_async('async-001')"
            }))
            .mockResolvedValueOnce(createMockResponse({ done: true }, 200));

        const response = await restService.get('/Threads', { asyncRequestsMode: true });

        expect(response.data.done).toBe(true);
        expect(mockAxiosInstance.request).toHaveBeenNthCalledWith(1,
            expect.objectContaining({
                method: 'GET',
                url: '/Threads',
                headers: expect.objectContaining({
                    Prefer: 'respond-async,wait=55'
                })
            })
        );
        expect(mockAxiosInstance.request).toHaveBeenNthCalledWith(2,
            expect.objectContaining({
                method: 'GET',
                url: "/_async('async-001')"
            })
        );
    });

    test('returns async ID when returnAsyncId is true', async () => {
        mockAxiosInstance.request.mockResolvedValue(
            createMockResponse({}, 202, {
                location: "/api/v1/_async('async-123')"
            })
        );

        const asyncId = await restService.post('/Processes', {}, { returnAsyncId: true });

        expect(asyncId).toBe('async-123');
        expect(mockAxiosInstance.request).toHaveBeenCalledWith(
            expect.objectContaining({
                headers: expect.objectContaining({
                    Prefer: 'respond-async'
                })
            })
        );
    });

    test('uses per-request asyncRequestsMode over the instance default', async () => {
        mockAxiosInstance.request.mockResolvedValue(createMockResponse({ ok: true }));

        await restService.get('/test', { asyncRequestsMode: true });

        expect(mockAxiosInstance.request).toHaveBeenCalledWith(
            expect.objectContaining({
                headers: expect.objectContaining({
                    Prefer: 'respond-async,wait=55'
                })
            })
        );
    });

    test('uses per-request timeout in seconds', async () => {
        mockAxiosInstance.request.mockResolvedValue(createMockResponse({ ok: true }));

        await restService.post('/test', {}, { timeout: 10 });

        expect(mockAxiosInstance.request).toHaveBeenCalledWith(
            expect.objectContaining({
                timeout: 10000
            })
        );
    });

    test('passes responseType and custom headers through to Axios', async () => {
        mockAxiosInstance.request.mockResolvedValue(createMockResponse(Buffer.from('abc')));

        await restService.get('/files/test', {
            responseType: 'arraybuffer',
            headers: {
                'X-Test': 'value'
            }
        });

        expect(mockAxiosInstance.request).toHaveBeenCalledWith(
            expect.objectContaining({
                responseType: 'arraybuffer',
                headers: expect.objectContaining({
                    'X-Test': 'value'
                })
            })
        );
    });

    test('honors explicit idempotent: false on a GET request', async () => {
        mockAxiosInstance.request.mockResolvedValue(createMockResponse({ ok: true }));

        await restService.get('/Configuration/ServerName', { idempotent: false });

        expect(mockAxiosInstance.request).toHaveBeenCalledWith(
            expect.objectContaining({
                _idempotent: false
            })
        );
    });

    test('preserves caller-supplied validateStatus when verifyResponse is false', async () => {
        const callerValidate = jest.fn().mockReturnValue(true);
        mockAxiosInstance.request.mockResolvedValue(createMockResponse({}, 500));

        await restService.get('/bad', {
            verifyResponse: false,
            validateStatus: callerValidate
        });

        expect(mockAxiosInstance.request).toHaveBeenCalledWith(
            expect.objectContaining({
                validateStatus: callerValidate
            })
        );
    });

    test('skips response verification when verifyResponse is false', async () => {
        mockAxiosInstance.request.mockResolvedValue(createMockResponse({ error: 'bad request' }, 400));

        const response = await restService.get('/bad-request', { verifyResponse: false });

        expect(response.status).toBe(400);
        expect(mockAxiosInstance.request).toHaveBeenCalledWith(
            expect.objectContaining({
                validateStatus: expect.any(Function)
            })
        );
    });

    test('throws when async response has no Location header', async () => {
        mockAxiosInstance.request.mockResolvedValue(createMockResponse({}, 202));

        await expect(restService.post('/Processes', {}, { asyncRequestsMode: true }))
            .rejects
            .toThrow(TM1RestException);
    });

    test('returns initial response when async request completes synchronously', async () => {
        mockAxiosInstance.request.mockResolvedValue(createMockResponse({ ok: true }, 200));

        const response = await restService.get('/Threads', { asyncRequestsMode: true });

        expect(response.status).toBe(200);
        expect(mockAxiosInstance.get).not.toHaveBeenCalled();
    });

    test('propagates errors thrown by poll requests', async () => {
        const pollError = new TM1RestException('Internal Server Error', 500);
        mockAxiosInstance.request
            .mockResolvedValueOnce(createMockResponse({}, 202, {
                location: "/api/v1/_async('async-err')"
            }))
            .mockRejectedValueOnce(pollError);

        await expect(restService.get('/Threads', { asyncRequestsMode: true }))
            .rejects.toBe(pollError);
    });

    test('cancels async operation on timeout when cancelAtTimeout is true', async () => {
        jest.useFakeTimers();

        mockAxiosInstance.request.mockImplementation((config: any) => {
            if (config.method === 'GET' && config.url === '/Threads') {
                return Promise.resolve(createMockResponse({}, 202, {
                    location: "/api/v1/_async('async-timeout')"
                }));
            }
            if (config.method === 'DELETE') {
                return Promise.resolve(createMockResponse({}, 204));
            }
            return Promise.resolve(createMockResponse({}, 202));
        });

        const pending = restService.get('/Threads', {
            asyncRequestsMode: true,
            timeout: 0.25,
            cancelAtTimeout: true
        });
        const expectation = expect(pending).rejects.toThrow(TM1TimeoutException);

        await Promise.resolve();
        await jest.advanceTimersByTimeAsync(1000);

        await expectation;
        expect(mockAxiosInstance.request).toHaveBeenCalledWith(
            expect.objectContaining({
                method: 'DELETE',
                url: "/_async('async-timeout')"
            })
        );
    });

    test('retry interceptor does not retry non-idempotent requests', async () => {
        expect(responseErrorHandler).toBeDefined();

        const error = {
            config: { _idempotent: false },
            code: 'ECONNRESET',
            message: 'socket hang up'
        };

        await expect(responseErrorHandler!(error)).rejects.toThrow('socket hang up');
        expect(mockAxiosInstance).not.toHaveBeenCalled();
    });

    test('retry interceptor retries idempotent requests', async () => {
        jest.useFakeTimers();
        expect(responseErrorHandler).toBeDefined();

        mockAxiosInstance.mockResolvedValue(createMockResponse({ ok: true }));

        const error = {
            config: { _idempotent: true, headers: {} },
            code: 'ECONNRESET',
            message: 'socket hang up'
        };

        const retryPromise = responseErrorHandler!(error);
        await jest.advanceTimersByTimeAsync(2000);

        await expect(retryPromise).resolves.toMatchObject({ data: { ok: true } });
        expect(mockAxiosInstance).toHaveBeenCalledWith(
            expect.objectContaining({
                _retryCount: 1
            })
        );
    });

    test('waitTimeGenerator produces capped exponential backoff', () => {
        const generator = (restService as any).waitTimeGenerator(4);
        const waits = Array.from({ length: 7 }, () => generator.next().value);

        expect(waits).toEqual([0.1, 0.2, 0.4, 0.8, 1, 1, 1]);
    });

    test('waitTimeGenerator runs unbounded when timeout is falsy', () => {
        const generator = (restService as any).waitTimeGenerator(0);
        const waits = Array.from({ length: 5 }, () => generator.next().value);

        expect(waits).toEqual([0.1, 0.2, 0.4, 0.8, 1]);
        expect(generator.next().done).toBe(false);
    });

    test('waitTimeGenerator stops once timeout is exceeded', () => {
        const generator = (restService as any).waitTimeGenerator(0.5);
        const waits: number[] = [];

        while (true) {
            const next = generator.next();
            if (next.done) {
                break;
            }
            waits.push(next.value);
        }

        expect(waits).toEqual([0.1, 0.2, 0.4]);
    });

    test('cancel_async_operation uses DELETE against /_async', async () => {
        mockAxiosInstance.request.mockResolvedValue(createMockResponse({}, 204));

        await restService.cancel_async_operation('cancel-001');

        expect(mockAxiosInstance.request).toHaveBeenCalledWith(
            expect.objectContaining({
                method: 'DELETE',
                url: "/_async('cancel-001')"
            })
        );
    });

    test('retrieve_async_response uses /_async and returns full response', async () => {
        mockAxiosInstance.request.mockResolvedValue(createMockResponse({ Status: 'CompletedSuccessfully' }));

        const response = await restService.retrieve_async_response('poll-001');

        expect(response.data.Status).toBe('CompletedSuccessfully');
        expect(mockAxiosInstance.request).toHaveBeenCalledWith(
            expect.objectContaining({
                method: 'GET',
                url: "/_async('poll-001')"
            })
        );
    });

    test('async dispatcher retries on transient 404 from /_async resource not yet materialized', async () => {
        mockAxiosInstance.request
            .mockResolvedValueOnce(createMockResponse({}, 202, {
                location: "/api/v1/_async('async-404')"
            }))
            .mockResolvedValueOnce(createMockResponse({}, 404))
            .mockResolvedValueOnce(createMockResponse({ done: true }, 200));

        const response = await restService.get('/Threads', { asyncRequestsMode: true });

        expect(response.data.done).toBe(true);
        expect(mockAxiosInstance.request).toHaveBeenNthCalledWith(2,
            expect.objectContaining({
                method: 'GET',
                url: "/_async('async-404')",
                validateStatus: expect.any(Function)
            })
        );
    });

    test('async dispatcher throws when poll response carries non-2xx asyncresult header', async () => {
        mockAxiosInstance.request
            .mockResolvedValueOnce(createMockResponse({}, 202, {
                location: "/api/v1/_async('async-fail')"
            }))
            .mockResolvedValueOnce(createMockResponse({}, 200, {
                asyncresult: '500 Internal Server Error'
            }));

        await expect(restService.get('/Threads', { asyncRequestsMode: true }))
            .rejects.toMatchObject({ status: 500 });
    });

    test('wait_for_async_operation throws when asyncresult header encodes non-2xx status', async () => {
        mockAxiosInstance.request.mockResolvedValue(
            createMockResponse({ ok: false }, 200, {
                asyncresult: '500 Internal Server Error'
            })
        );

        await expect(restService.wait_for_async_operation('poll-500', 1))
            .rejects.toMatchObject({ status: 500 });
    });

    test('wait_for_async_operation returns response data', async () => {
        mockAxiosInstance.request.mockResolvedValue(createMockResponse({ Status: 'Completed', Result: 1 }, 200));

        const data = await restService.wait_for_async_operation('poll-002', 1);

        expect(data).toEqual({ Status: 'Completed', Result: 1 });
        expect(mockAxiosInstance.request).toHaveBeenCalledWith(
            expect.objectContaining({
                method: 'GET',
                url: "/_async('poll-002')"
            })
        );
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
