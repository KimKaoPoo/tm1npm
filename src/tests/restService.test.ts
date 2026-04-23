import axios, { AxiosResponse } from 'axios';
import { RestService, AuthenticationMode } from '../services/RestService';
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
                expect(instance.get).toHaveBeenCalledWith(
                    '/Configuration/ServerName',
                    expect.objectContaining({ _idempotent: false })
                );
                expect(svc.isLoggedIn()).toBe(true);
            });

            test('connect probe is marked non-idempotent so interceptor retry skips it', async () => {
                const { svc, instance } = makeSvc({ sessionId: 'seed' });
                instance.get.mockResolvedValue(createMockResponse({ value: 'Server1' }));

                await svc.connect();

                const probeConfig = instance.get.mock.calls[0][1];
                expect(probeConfig).toBeDefined();
                expect(probeConfig._idempotent).toBe(false);
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
            })).toThrow("'address', 'tenant' and 'database' must be provided to connect to TM1 > v12 in IBM Cloud");
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
            await expect((svc as any)._authenticateServiceToService()).rejects.toThrow(
                /'authUrl' is required for Service-to-Service authentication on v11 topology/
            );
        });

        test('should throw when S2S auth runs on v11-style baseUrl topology without authUrl', async () => {
            const svc = new RestService({
                baseUrl: 'http://x/api/v1',
                applicationClientId: 'id',
                applicationClientSecret: 'secret'
            });
            await expect((svc as any)._authenticateServiceToService()).rejects.toThrow(
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
            await expect((svc as any)._authenticateServiceToService())
                .rejects.not.toThrow(/'authUrl' is required/);
        });
    });
});

// =========================================================================
// Authentication flow tests — issue #59
// =========================================================================
describe('RestService authentication flows', () => {
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
            defaults: { headers: { common: {} as Record<string, string> } }
        };
        mockedAxios.create.mockReturnValue(mockAxiosInstance as any);
    });

    describe('getAuthenticationMode', () => {
        test('should detect BASIC when only user and password are provided', () => {
            const svc = new RestService({ address: 'host', ssl: true, user: 'admin', password: 'pw' });
            expect(svc.getAuthenticationMode()).toBe(AuthenticationMode.BASIC);
        });

        test('should detect CAM when namespace is set without gateway', () => {
            const svc = new RestService({
                address: 'host', ssl: true,
                user: 'u', password: 'p', namespace: 'LDAP'
            });
            expect(svc.getAuthenticationMode()).toBe(AuthenticationMode.CAM);
        });

        test('should detect CAM when camPassport is set', () => {
            const svc = new RestService({
                address: 'host', ssl: true, camPassport: 'passport123'
            });
            expect(svc.getAuthenticationMode()).toBe(AuthenticationMode.CAM);
        });

        test('should detect CAM_SSO when gateway is set', () => {
            const svc = new RestService({
                address: 'host', ssl: true,
                user: 'u', password: 'p', namespace: 'LDAP', gateway: 'https://gw'
            });
            expect(svc.getAuthenticationMode()).toBe(AuthenticationMode.CAM_SSO);
        });

        test('should detect IBM_CLOUD_API_KEY when iamUrl is set', () => {
            const svc = new RestService({
                address: 'pa.ibm.com', tenant: 'T1', database: 'DB1',
                iamUrl: 'https://iam.cloud.ibm.com', ssl: true, apiKey: 'k'
            });
            expect(svc.getAuthenticationMode()).toBe(AuthenticationMode.IBM_CLOUD_API_KEY);
        });

        test('should detect PA_PROXY when address + user + paUrl (no instance)', () => {
            const svc = new RestService({
                address: 'host', user: 'u', password: 'p',
                paUrl: 'https://pa', database: 'db', ssl: true
            });
            expect(svc.getAuthenticationMode()).toBe(AuthenticationMode.PA_PROXY);
        });

        test('should detect SERVICE_TO_SERVICE with instance + database', () => {
            const svc = new RestService({
                address: 'h', instance: 'INST', database: 'DB', ssl: true,
                applicationClientId: 'id', applicationClientSecret: 'secret'
            });
            expect(svc.getAuthenticationMode()).toBe(AuthenticationMode.SERVICE_TO_SERVICE);
        });

        test('should detect SERVICE_TO_SERVICE on v11 when clientId + clientSecret provided', () => {
            const svc = new RestService({
                address: 'host', ssl: true,
                applicationClientId: 'id', applicationClientSecret: 'secret'
            });
            expect(svc.getAuthenticationMode()).toBe(AuthenticationMode.SERVICE_TO_SERVICE);
        });

        test('should detect ACCESS_TOKEN when accessToken is set', () => {
            const svc = new RestService({
                baseUrl: 'http://x/api/v1', accessToken: 'jwt123'
            });
            expect(svc.getAuthenticationMode()).toBe(AuthenticationMode.ACCESS_TOKEN);
        });

        test('should detect BASIC_API_KEY when apiKey is set', () => {
            const svc = new RestService({
                baseUrl: 'http://x/api/v1', apiKey: 'mykey'
            });
            expect(svc.getAuthenticationMode()).toBe(AuthenticationMode.BASIC_API_KEY);
        });

        test('should fall through to BASIC when gateway is set without namespace', () => {
            const svc = new RestService({
                address: 'host', ssl: true,
                user: 'u', password: 'p', gateway: 'https://gw'
            });
            expect(svc.getAuthenticationMode()).toBe(AuthenticationMode.BASIC);
        });

        test('should detect WIA when integratedLogin is set', () => {
            const svc = new RestService({
                address: 'host', ssl: true,
                integratedLogin: true
            });
            expect(svc.getAuthenticationMode()).toBe(AuthenticationMode.WIA);
        });
    });

    describe('setupAuthentication — Basic', () => {
        test('should set Basic Authorization header', async () => {
            const svc = new RestService({
                baseUrl: 'http://x/api/v1', user: 'admin', password: 'apple'
            });
            await (svc as any).setupAuthentication();
            expect(mockAxiosInstance.defaults.headers.common['Authorization'])
                .toBe('Basic ' + Buffer.from('admin:apple').toString('base64'));
        });

        test('should decode Base64 password when decodeB64 is true', async () => {
            const encoded = Buffer.from('mypassword').toString('base64');
            const svc = new RestService({
                baseUrl: 'http://x/api/v1', user: 'admin', password: encoded, decodeB64: true
            });
            await (svc as any).setupAuthentication();
            expect(mockAxiosInstance.defaults.headers.common['Authorization'])
                .toBe('Basic ' + Buffer.from('admin:mypassword').toString('base64'));
        });

        test('should throw when no user or password for BASIC mode', async () => {
            const svc = new RestService({ baseUrl: 'http://x/api/v1' });
            await expect((svc as any).setupAuthentication())
                .rejects.toThrow('No valid authentication configuration provided');
        });
    });

    describe('setupAuthentication — CAM (camPassport)', () => {
        test('should set CAMPassport Authorization header', async () => {
            const svc = new RestService({
                baseUrl: 'http://x/api/v1', camPassport: 'test-passport-value'
            });
            await (svc as any).setupAuthentication();
            expect(mockAxiosInstance.defaults.headers.common['Authorization'])
                .toBe('CAMPassport test-passport-value');
        });
    });

    describe('setupAuthentication — CAM (namespace)', () => {
        test('should set CAMNamespace Authorization header', async () => {
            const svc = new RestService({
                baseUrl: 'http://x/api/v1',
                user: 'admin', password: 'pass', namespace: 'LDAP'
            });
            await (svc as any).setupAuthentication();
            const expected = 'CAMNamespace ' + Buffer.from('admin:pass:LDAP').toString('base64');
            expect(mockAxiosInstance.defaults.headers.common['Authorization']).toBe(expected);
        });

        test('should decode B64 password in CAMNamespace header', async () => {
            const encoded = Buffer.from('pass').toString('base64');
            const svc = new RestService({
                baseUrl: 'http://x/api/v1',
                user: 'admin', password: encoded, namespace: 'LDAP', decodeB64: true
            });
            await (svc as any).setupAuthentication();
            const expected = 'CAMNamespace ' + Buffer.from('admin:pass:LDAP').toString('base64');
            expect(mockAxiosInstance.defaults.headers.common['Authorization']).toBe(expected);
        });

        test('should throw CAM error when namespace set but no user/password/camPassport', async () => {
            const svc = new RestService({
                baseUrl: 'http://x/api/v1', namespace: 'LDAP'
            });
            await expect((svc as any).setupAuthentication())
                .rejects.toThrow('CAM authentication requires either camPassport or user/password/namespace');
        });
    });

    describe('setupAuthentication — CAM_SSO (gateway)', () => {
        test('should GET gateway and set CAMPassport header from cam_passport cookie', async () => {
            (axios.get as jest.Mock).mockResolvedValue({
                status: 200,
                headers: {
                    'set-cookie': ['cam_passport=GW_PASSPORT_VALUE; Path=/; HttpOnly']
                }
            });
            const svc = new RestService({
                address: 'host', ssl: true,
                user: 'u', password: 'p', namespace: 'NS', gateway: 'https://gw.example.com'
            });
            await (svc as any).setupAuthentication();
            expect(axios.get).toHaveBeenCalledWith('https://gw.example.com', expect.objectContaining({
                params: { CAMNamespace: 'NS' }
            }));
            expect(mockAxiosInstance.defaults.headers.common['Authorization'])
                .toBe('CAMPassport GW_PASSPORT_VALUE');
        });

        test('should throw when gateway response has no cam_passport cookie', async () => {
            (axios.get as jest.Mock).mockResolvedValue({
                status: 200,
                headers: { 'set-cookie': ['other=value; Path=/'] }
            });
            const svc = new RestService({
                address: 'host', ssl: true,
                user: 'u', password: 'p', namespace: 'NS', gateway: 'https://gw'
            });
            await expect((svc as any).setupAuthentication())
                .rejects.toThrow(/cam_passport/);
        });

        test('should throw when gateway response has no Set-Cookie header', async () => {
            (axios.get as jest.Mock).mockResolvedValue({
                status: 200,
                headers: {}
            });
            const svc = new RestService({
                address: 'host', ssl: true,
                user: 'u', password: 'p', namespace: 'NS', gateway: 'https://gw'
            });
            await expect((svc as any).setupAuthentication())
                .rejects.toThrow(/cam_passport/);
        });

        test('should throw when gateway returns non-200 status', async () => {
            (axios.get as jest.Mock).mockResolvedValue({
                status: 403,
                headers: {}
            });
            const svc = new RestService({
                address: 'host', ssl: true,
                user: 'u', password: 'p', namespace: 'NS', gateway: 'https://gw'
            });
            await expect((svc as any).setupAuthentication())
                .rejects.toThrow(/Expected status_code 200/);
        });
    });

    describe('setupAuthentication — IBM_CLOUD_API_KEY (IAM token exchange)', () => {
        test('should exchange API key for IAM bearer token', async () => {
            (axios.post as jest.Mock).mockResolvedValue({
                data: { access_token: 'iam-bearer-token-123' }
            });
            const svc = new RestService({
                address: 'pa.ibm.com', tenant: 'T1', database: 'DB1',
                iamUrl: 'https://iam.cloud.ibm.com/identity/token',
                ssl: true, apiKey: 'test-api-key'
            });
            await (svc as any).setupAuthentication();
            expect(axios.post).toHaveBeenCalledWith(
                'https://iam.cloud.ibm.com/identity/token',
                expect.stringContaining('grant_type=urn'),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        'Content-Type': 'application/x-www-form-urlencoded'
                    })
                })
            );
            expect(mockAxiosInstance.defaults.headers.common['Authorization'])
                .toBe('Bearer iam-bearer-token-123');
        });

        test('should include apiKey in URL-encoded payload', async () => {
            (axios.post as jest.Mock).mockResolvedValue({
                data: { access_token: 'token' }
            });
            const svc = new RestService({
                address: 'pa.ibm.com', tenant: 'T1', database: 'DB1',
                iamUrl: 'https://iam.cloud.ibm.com', ssl: true, apiKey: 'my-key'
            });
            await (svc as any).setupAuthentication();
            const calledPayload = (axios.post as jest.Mock).mock.calls[0][1];
            expect(calledPayload).toContain('apikey=my-key');
            expect(calledPayload).toContain('grant_type=');
        });

        test('should throw when IAM response lacks access_token', async () => {
            (axios.post as jest.Mock).mockResolvedValue({ data: {} });
            const svc = new RestService({
                address: 'pa.ibm.com', tenant: 'T1', database: 'DB1',
                iamUrl: 'https://iam.cloud.ibm.com', ssl: true, apiKey: 'k'
            });
            await expect((svc as any).setupAuthentication())
                .rejects.toThrow(/Failed to generate access_token/);
        });

        test('should throw when iamUrl is set but apiKey is missing', async () => {
            const svc = new RestService({
                address: 'pa.ibm.com', tenant: 'T1', database: 'DB1',
                iamUrl: 'https://iam.cloud.ibm.com', ssl: true
            });
            await expect((svc as any)._generateIbmIamCloudAccessToken())
                .rejects.toThrow(/'iamUrl' and 'apiKey' must be provided/);
        });
    });

    describe('setupAuthentication — PA_PROXY (CPD + proxy auth)', () => {
        test('should generate CPD token then authenticate with PA Proxy', async () => {
            (axios.post as jest.Mock)
                // First call: CPD signin
                .mockResolvedValueOnce({
                    data: { token: 'cpd-jwt-token-abc' }
                })
                // Second call: PA Proxy auth
                .mockResolvedValueOnce({
                    status: 200,
                    headers: {
                        'set-cookie': [
                            'ba-sso-csrf=csrf-value; Path=/',
                            'paSession=session123; Path=/'
                        ]
                    }
                });
            const svc = new RestService({
                address: 'host', user: 'user', password: 'pass',
                paUrl: 'https://pa', database: 'db', ssl: true,
                cpdUrl: 'https://cpd.example.com'
            });
            await (svc as any).setupAuthentication();

            // Verify CPD signin was called
            expect(axios.post).toHaveBeenNthCalledWith(1,
                'https://cpd.example.com/v1/preauth/signin',
                { username: 'user', password: 'pass' },
                expect.objectContaining({
                    headers: expect.objectContaining({ 'Content-Type': 'application/json;charset=UTF-8' })
                })
            );
            // Verify PA Proxy auth was called with jwt
            expect(axios.post).toHaveBeenNthCalledWith(2,
                expect.stringContaining('/login'),
                'jwt=cpd-jwt-token-abc',
                expect.objectContaining({
                    headers: expect.objectContaining({ 'Content-Type': 'application/x-www-form-urlencoded' })
                })
            );
            // Verify ba-sso-authenticity header was set
            expect(mockAxiosInstance.defaults.headers.common['ba-sso-authenticity']).toBe('csrf-value');
        });

        test('should throw when cpdUrl is missing for PA_PROXY', async () => {
            const svc = new RestService({
                address: 'host', user: 'u', password: 'p',
                paUrl: 'https://pa', database: 'db', ssl: true
            });
            await expect((svc as any).setupAuthentication())
                .rejects.toThrow(/'cpdUrl' must be provided to authenticate via CPD/);
        });

        test('should throw when CPD response lacks token', async () => {
            (axios.post as jest.Mock).mockResolvedValue({ data: {} });
            const svc = new RestService({
                address: 'host', user: 'u', password: 'p',
                paUrl: 'https://pa', database: 'db', ssl: true,
                cpdUrl: 'https://cpd'
            });
            await expect((svc as any).setupAuthentication())
                .rejects.toThrow(/Failed to generate CPD access token/);
        });
    });

    describe('setupAuthentication — SERVICE_TO_SERVICE', () => {
        test('should use Basic auth with clientId:clientSecret and POST {User: user}', async () => {
            (axios.post as jest.Mock).mockResolvedValue({
                status: 200,
                headers: {
                    'set-cookie': ['TM1SessionId=s2s-session-id; Path=/']
                }
            });
            const svc = new RestService({
                address: 'h', instance: 'INST', database: 'DB', ssl: true,
                applicationClientId: 'clientA', applicationClientSecret: 'secretB',
                user: 'admin'
            });
            await (svc as any).setupAuthentication();

            const expectedBasicAuth = 'Basic ' + Buffer.from('clientA:secretB').toString('base64');
            expect(axios.post).toHaveBeenCalledWith(
                expect.stringContaining('/auth/v1/session'),
                JSON.stringify({ User: 'admin' }),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        'Authorization': expectedBasicAuth
                    })
                })
            );
            // Session cookie should be captured
            expect((svc as any).sessionCookies.get('TM1SessionId')).toBe('s2s-session-id');
        });

        test('should capture TM1SessionId from response with wrong domain attribute', async () => {
            (axios.post as jest.Mock).mockResolvedValue({
                status: 200,
                headers: {
                    'set-cookie': ['TM1SessionId=domain-id; Domain=wrong.domain; Path=/']
                }
            });
            const svc = new RestService({
                address: 'h', instance: 'INST', database: 'DB', ssl: true,
                applicationClientId: 'id', applicationClientSecret: 'secret',
                user: 'admin'
            });
            await (svc as any).setupAuthentication();
            // parseSetCookieHeaders strips Domain and captures the cookie directly
            expect((svc as any).sessionCookies.get('TM1SessionId')).toBe('domain-id');
        });
    });

    describe('setupAuthentication — ACCESS_TOKEN', () => {
        test('should set Bearer token header', async () => {
            const svc = new RestService({
                baseUrl: 'http://x/api/v1', accessToken: 'my-jwt-token'
            });
            await (svc as any).setupAuthentication();
            expect(mockAxiosInstance.defaults.headers.common['Authorization'])
                .toBe('Bearer my-jwt-token');
        });
    });

    describe('setupAuthentication — BASIC_API_KEY', () => {
        test('should set API-Key header when user is not apikey', async () => {
            const svc = new RestService({
                baseUrl: 'http://x/api/v1', apiKey: 'my-api-key'
            });
            await (svc as any).setupAuthentication();
            expect(mockAxiosInstance.defaults.headers.common['API-Key']).toBe('my-api-key');
        });

        test('should set Basic auth with apikey:key when user is apikey', async () => {
            const svc = new RestService({
                baseUrl: 'http://x/api/v1', apiKey: 'my-api-key', user: 'apikey'
            });
            await (svc as any).setupAuthentication();
            const expected = 'Basic ' + Buffer.from('apikey:my-api-key').toString('base64');
            expect(mockAxiosInstance.defaults.headers.common['Authorization']).toBe(expected);
        });
    });

    describe('setupAuthentication — WIA', () => {
        test('should throw for Windows Integrated Authentication', async () => {
            const svc = new RestService({
                address: 'host', ssl: true, integratedLogin: true
            });
            await expect((svc as any).setupAuthentication())
                .rejects.toThrow(/Windows Integrated Authentication.*not supported/);
        });
    });

    describe('verify propagation to external auth requests', () => {
        test('should pass rejectUnauthorized:false to IAM request when verify is false', async () => {
            (axios.post as jest.Mock).mockResolvedValue({
                data: { access_token: 'token' }
            });
            const svc = new RestService({
                address: 'pa.ibm.com', tenant: 'T', database: 'D',
                iamUrl: 'https://iam', ssl: true, apiKey: 'k',
                verify: false
            });
            await (svc as any)._generateIbmIamCloudAccessToken();
            const callArgs = (axios.post as jest.Mock).mock.calls[0][2];
            expect(callArgs.httpsAgent).toBeDefined();
        });

        test('should pass rejectUnauthorized:false to S2S request when verify is false', async () => {
            (axios.post as jest.Mock).mockResolvedValue({
                status: 200,
                headers: { 'set-cookie': ['TM1SessionId=s; Path=/'] }
            });
            const svc = new RestService({
                address: 'h', instance: 'I', database: 'D', ssl: true,
                applicationClientId: 'id', applicationClientSecret: 'secret',
                user: 'admin', verify: false
            });
            await (svc as any)._authenticateServiceToService();
            const callArgs = (axios.post as jest.Mock).mock.calls[0][2];
            expect(callArgs.httpsAgent).toBeDefined();
        });

        test('should pass rejectUnauthorized:false to CPD request when verify is false', async () => {
            (axios.post as jest.Mock).mockResolvedValue({
                data: { token: 'jwt' }
            });
            const svc = new RestService({
                address: 'h', user: 'u', password: 'p',
                paUrl: 'https://pa', database: 'db', ssl: true,
                cpdUrl: 'https://cpd', verify: false
            });
            await (svc as any)._generateCpdAccessToken({ username: 'u', password: 'p' });
            const callArgs = (axios.post as jest.Mock).mock.calls[0][2];
            expect(callArgs.httpsAgent).toBeDefined();
        });
    });

    describe('issue #81 — admin checks, utility helpers, reconnect config', () => {
        let svcMock: any;
        let onError: ((error: any) => Promise<any>) | undefined;

        const buildService = (extra: Record<string, any> = {}) => {
            svcMock = Object.assign(jest.fn(), {
                get: jest.fn(),
                post: jest.fn(),
                patch: jest.fn(),
                put: jest.fn(),
                delete: jest.fn(),
                request: jest.fn(),
                defaults: { headers: { common: {} as Record<string, string> } },
                interceptors: {
                    request: { use: jest.fn() },
                    response: {
                        use: jest.fn((_onFulfilled: any, onRejected: any) => {
                            onError = onRejected;
                            return 0;
                        })
                    }
                }
            });
            mockedAxios.create.mockReturnValue(svcMock);

            return new RestService({
                baseUrl: 'http://localhost:8879/api/v1',
                user: 'bob',
                password: 'pw',
                timeout: 60,
                ...extra
            });
        };

        test('caches is_admin and only calls /ActiveUser/Groups once', async () => {
            const svc = buildService();
            svcMock.request.mockResolvedValue(
                createMockResponse({ value: [{ Name: 'ADMIN' }] })
            );

            const first = await svc.is_admin();
            const second = await svc.is_admin();

            expect(first).toBe(true);
            expect(second).toBe(true);
            expect(svcMock.request).toHaveBeenCalledTimes(1);
        });

        test('is_admin returns false when ADMIN group not present', async () => {
            const svc = buildService();
            svcMock.request.mockResolvedValue(
                createMockResponse({ value: [{ Name: 'Users' }] })
            );

            expect(await svc.is_admin()).toBe(false);
        });

        test('is_admin matches ADMIN case-insensitively in returned group names', async () => {
            const svc = buildService();
            svcMock.request.mockResolvedValue(
                createMockResponse({ value: [{ Name: 'admin' }] })
            );

            expect(await svc.is_admin()).toBe(true);
        });

        test('pre-populates all admin flags when configured user is ADMIN (any casing)', async () => {
            for (const user of ['ADMIN', 'admin', 'Ad Min']) {
                const svc = buildService({ user });

                expect(await svc.is_admin()).toBe(true);
                expect(await svc.is_data_admin()).toBe(true);
                expect(await svc.is_security_admin()).toBe(true);
                expect(await svc.is_ops_admin()).toBe(true);
                expect(svcMock.request).not.toHaveBeenCalled();
            }
        });

        test('is_data_admin matches Admin or DataAdmin case+space insensitively', async () => {
            const svc = buildService();
            svcMock.request.mockResolvedValue(
                createMockResponse({ value: [{ Name: 'Data Admin' }] })
            );

            expect(await svc.is_data_admin()).toBe(true);
        });

        test('is_security_admin matches SecurityAdmin', async () => {
            const svc = buildService();
            svcMock.request.mockResolvedValue(
                createMockResponse({ value: [{ Name: 'securityadmin' }] })
            );

            expect(await svc.is_security_admin()).toBe(true);
        });

        test('is_ops_admin matches OperationsAdmin', async () => {
            const svc = buildService();
            svcMock.request.mockResolvedValue(
                createMockResponse({ value: [{ Name: 'Operations Admin' }] })
            );

            expect(await svc.is_ops_admin()).toBe(true);
        });

        test('admin checks propagate errors instead of swallowing them', async () => {
            const svc = buildService();
            svcMock.request.mockRejectedValue(new TM1RestException('boom', 500));

            await expect(svc.is_admin()).rejects.toThrow('boom');
        });

        test('sync isAdmin/isDataAdmin/isSecurityAdmin/isOpsAdmin getters reflect cached state', async () => {
            const svc = buildService();
            // Before any is_*() call resolves, all sync getters return false.
            expect(svc.isAdmin).toBe(false);
            expect(svc.isDataAdmin).toBe(false);
            expect(svc.isSecurityAdmin).toBe(false);
            expect(svc.isOpsAdmin).toBe(false);

            svcMock.request.mockResolvedValue(
                createMockResponse({ value: [{ Name: 'ADMIN' }] })
            );
            await svc.is_admin();
            await svc.is_data_admin();
            await svc.is_security_admin();
            await svc.is_ops_admin();

            expect(svc.isAdmin).toBe(true);
            expect(svc.isDataAdmin).toBe(true);
            expect(svc.isSecurityAdmin).toBe(true);
            expect(svc.isOpsAdmin).toBe(true);
        });

        test('concurrent is_*_admin() calls coalesce onto a single /ActiveUser/Groups request', async () => {
            const svc = buildService();
            // Non-ADMIN user so pre-populated fast-path does not apply.
            svcMock.request.mockResolvedValue(
                createMockResponse({ value: [{ Name: 'Users' }] })
            );

            const [a, b, c, d] = await Promise.all([
                svc.is_admin(),
                svc.is_data_admin(),
                svc.is_security_admin(),
                svc.is_ops_admin()
            ]);

            expect([a, b, c, d]).toEqual([false, false, false, false]);
            expect(svcMock.request).toHaveBeenCalledTimes(1);
        });

        test('failed in-flight fetch does not poison subsequent calls', async () => {
            const svc = buildService();
            svcMock.request.mockRejectedValueOnce(new TM1RestException('boom', 500));
            await expect(svc.is_admin()).rejects.toThrow('boom');

            // In-flight promise cleared on rejection; next call hits a fresh request.
            svcMock.request.mockResolvedValueOnce(
                createMockResponse({ value: [{ Name: 'ADMIN' }] })
            );
            expect(await svc.is_admin()).toBe(true);
        });

        test('b64_decode_password roundtrips Base64 to UTF-8', () => {
            const secret = 'p@ssw0rd_äß';
            const encoded = Buffer.from(secret, 'utf-8').toString('base64');

            expect(RestService.b64_decode_password(encoded)).toBe(secret);
        });

        test('translate_to_boolean handles booleans, numbers, and strings', () => {
            expect(RestService.translate_to_boolean(true)).toBe(true);
            expect(RestService.translate_to_boolean(false)).toBe(false);
            expect(RestService.translate_to_boolean(1)).toBe(true);
            expect(RestService.translate_to_boolean(0)).toBe(false);
            expect(RestService.translate_to_boolean('True')).toBe(true);
            expect(RestService.translate_to_boolean('  TRUE  ')).toBe(true);
            expect(RestService.translate_to_boolean('false')).toBe(false);
            expect(RestService.translate_to_boolean('no')).toBe(false);
        });

        test('translate_to_boolean throws on invalid types', () => {
            expect(() => RestService.translate_to_boolean(null)).toThrow(/Invalid argument/);
            expect(() => RestService.translate_to_boolean(undefined)).toThrow(/Invalid argument/);
            expect(() => RestService.translate_to_boolean({})).toThrow(/Invalid argument/);
        });

        test('add_compact_json_header inserts tm1.compact=v0 at position 1 and returns original', () => {
            const svc = buildService();
            const accept = 'application/json;odata.metadata=none,text/plain';
            svcMock.defaults.headers.common['Accept'] = accept;

            const original = svc.add_compact_json_header();

            expect(original).toBe(accept);
            expect(svcMock.defaults.headers.common['Accept']).toBe(
                'application/json;tm1.compact=v0;odata.metadata=none,text/plain'
            );
        });

        test('skips 401 reauth when reConnectOnSessionTimeout is false', async () => {
            const svc = buildService({ reConnectOnSessionTimeout: false });
            (svc as any).isConnected = true;
            const reAuthSpy = jest.spyOn(svc, 'reAuthenticate');

            const error401: any = {
                response: { status: 401, statusText: 'Unauthorized', data: {} },
                config: { _idempotent: true }
            };

            await expect(onError!(error401)).rejects.toBeInstanceOf(TM1RestException);
            expect(reAuthSpy).not.toHaveBeenCalled();
        });

        test('skips connection-error retry when reConnectOnRemoteDisconnect is false', async () => {
            const svc = buildService({ reConnectOnRemoteDisconnect: false });
            (svc as any).isConnected = true;

            const networkError: any = { code: 'ECONNRESET', message: 'reset', config: { _idempotent: true } };

            await expect(onError!(networkError)).rejects.toBeInstanceOf(TM1RestException);
            expect(svcMock).not.toHaveBeenCalled();
        });

        test('respects remoteDisconnectMaxRetries: stops retrying once cap reached', async () => {
            const svc = buildService({ remoteDisconnectMaxRetries: 1 });
            (svc as any).isConnected = true;

            // canRetryRequest is gated on the per-request _retryCount; pre-seed to the cap
            // so the next retry attempt is rejected and the error propagates as TM1RestException.
            const requestConfig: any = { _idempotent: true, _retryCount: 1 };
            const networkError: any = { code: 'ECONNRESET', message: 'reset', config: requestConfig };

            await expect(onError!(networkError)).rejects.toBeInstanceOf(TM1RestException);
            expect(svcMock).not.toHaveBeenCalled();
        });
    });
});
