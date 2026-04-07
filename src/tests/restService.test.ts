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
        mockAxiosInstance.request.mockResolvedValue(
            createMockResponse({}, 202, {
                location: "/api/v1/_async('async-001')"
            })
        );
        mockAxiosInstance.get.mockResolvedValue(createMockResponse({ done: true }, 200));

        const response = await restService.get('/Threads', { asyncRequestsMode: true });

        expect(response.data.done).toBe(true);
        expect(mockAxiosInstance.request).toHaveBeenCalledWith(
            expect.objectContaining({
                method: 'GET',
                url: '/Threads',
                headers: expect.objectContaining({
                    Prefer: 'respond-async,wait=55'
                })
            })
        );
        expect(mockAxiosInstance.get).toHaveBeenCalledWith("/_async('async-001')");
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

    test('cancels async operation on timeout when cancelAtTimeout is true', async () => {
        jest.useFakeTimers();

        mockAxiosInstance.request.mockResolvedValue(
            createMockResponse({}, 202, {
                location: "/api/v1/_async('async-timeout')"
            })
        );
        mockAxiosInstance.get.mockResolvedValue(createMockResponse({}, 202));
        mockAxiosInstance.delete.mockResolvedValue(createMockResponse({}, 204));

        const pending = restService.get('/Threads', {
            asyncRequestsMode: true,
            timeout: 0.25,
            cancelAtTimeout: true
        });
        const expectation = expect(pending).rejects.toThrow(TM1TimeoutException);

        await Promise.resolve();
        await jest.advanceTimersByTimeAsync(1000);

        await expectation;
        expect(mockAxiosInstance.delete).toHaveBeenCalledWith("/_async('async-timeout')");
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

    test('get_async_operation_status reads Status from the async response payload', async () => {
        mockAxiosInstance.request.mockResolvedValue(
            createMockResponse({ Status: 'CompletedSuccessfully' })
        );

        const status = await restService.get_async_operation_status('poll-003');

        expect(status).toBe('CompletedSuccessfully');
        expect(mockAxiosInstance.request).toHaveBeenCalledWith(
            expect.objectContaining({
                method: 'GET',
                url: "/_async('poll-003')"
            })
        );
    });

    test('wait_for_async_operation returns response data', async () => {
        mockAxiosInstance.get.mockResolvedValue(createMockResponse({ Status: 'Completed', Result: 1 }, 200));

        const data = await restService.wait_for_async_operation('poll-002', 1);

        expect(data).toEqual({ Status: 'Completed', Result: 1 });
        expect(mockAxiosInstance.get).toHaveBeenCalledWith("/_async('poll-002')");
    });
});
