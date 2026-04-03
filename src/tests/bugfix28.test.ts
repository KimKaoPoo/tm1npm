/**
 * Bug fix tests for issue #28 (epic)
 *
 * Bug #10 - SubsetService: isPrivate defaults to false (matching tm1py)
 * Bug #11 - ApplicationService: update() uses POST not PATCH
 * Bug #12 - ApplicationService: getNames() does not inject /api/v1/ prefix
 * Bug #13 - SessionService: getThreadsForCurrent() includes /api/v1/ in filter
 */

import { SubsetService } from '../services/SubsetService';
import { ApplicationService } from '../services/ApplicationService';
import { SessionService } from '../services/SessionService';
import { RestService } from '../services/RestService';
import { TM1RestException } from '../exceptions/TM1Exception';
import { Subset } from '../objects/Subset';
import { CubeApplication, ApplicationTypes } from '../objects/Application';

const createMockResponse = (data: any, status: number = 200) => ({
    data,
    status,
    statusText: 'OK',
    headers: {},
    config: {} as any
});

function createMockRestService(): jest.Mocked<RestService> {
    return {
        get: jest.fn(),
        post: jest.fn(),
        patch: jest.fn(),
        delete: jest.fn(),
        put: jest.fn(),
        version: '12.0.0',
        config: {} as any,
        rest: {} as any,
        buildBaseUrl: jest.fn(),
        extractErrorMessage: jest.fn()
    } as any;
}

describe('Bug #10 - SubsetService isPrivate defaults to false', () => {
    let subsetService: SubsetService;
    let mockRest: jest.Mocked<RestService>;

    beforeEach(() => {
        mockRest = createMockRestService();
        subsetService = new SubsetService(mockRest);
    });

    test('get() should default isPrivate to false and use Subsets collection', async () => {
        mockRest.get.mockResolvedValue(createMockResponse({ Name: 'TestSubset' }));

        await subsetService.get('Dim1', 'Hier1', 'TestSubset');

        const calledUrl = mockRest.get.mock.calls[0][0] as string;
        expect(calledUrl).toContain('/Subsets(');
        expect(calledUrl).not.toContain('/PrivateSubsets(');
    });

    test('get() with isPrivate=true should use PrivateSubsets collection', async () => {
        mockRest.get.mockResolvedValue(createMockResponse({ Name: 'TestSubset' }));

        await subsetService.get('Dim1', 'Hier1', 'TestSubset', true);

        const calledUrl = mockRest.get.mock.calls[0][0] as string;
        expect(calledUrl).toContain('/PrivateSubsets(');
    });

    test('delete() should default isPrivate to false and use Subsets collection', async () => {
        mockRest.delete.mockResolvedValue(createMockResponse({}, 204));

        await subsetService.delete('Dim1', 'Hier1', 'TestSubset');

        const calledUrl = mockRest.delete.mock.calls[0][0] as string;
        expect(calledUrl).toContain('/Subsets(');
        expect(calledUrl).not.toContain('/PrivateSubsets(');
    });

    test('exists() should default isPrivate to false and use Subsets collection', async () => {
        mockRest.get.mockResolvedValue(createMockResponse({ Name: 'TestSubset' }));

        await subsetService.exists('Dim1', 'Hier1', 'TestSubset');

        const calledUrl = mockRest.get.mock.calls[0][0] as string;
        expect(calledUrl).toContain('/Subsets(');
        expect(calledUrl).not.toContain('/PrivateSubsets(');
    });

    test('getAllNames() should default isPrivate to false and use Subsets collection', async () => {
        mockRest.get.mockResolvedValue(createMockResponse({ value: [{ Name: 'Sub1' }] }));

        await subsetService.getAllNames('Dim1', 'Hier1');

        const calledUrl = mockRest.get.mock.calls[0][0] as string;
        expect(calledUrl).toContain('/Subsets?');
        expect(calledUrl).not.toContain('/PrivateSubsets?');
    });

    test('getAllNames() with isPrivate=true should use PrivateSubsets', async () => {
        mockRest.get.mockResolvedValue(createMockResponse({ value: [{ Name: 'Sub1' }] }));

        await subsetService.getAllNames('Dim1', 'Hier1', true);

        const calledUrl = mockRest.get.mock.calls[0][0] as string;
        expect(calledUrl).toContain('/PrivateSubsets?');
    });
});

describe('Bug #11 - ApplicationService update() uses POST not PATCH', () => {
    let appService: ApplicationService;
    let mockRest: jest.Mocked<RestService>;

    beforeEach(() => {
        mockRest = createMockRestService();
        appService = new ApplicationService(mockRest);
    });

    test('update() should call rest.post for non-document applications', async () => {
        const app = new CubeApplication('', 'TestApp', 'SalesCube');
        mockRest.post.mockResolvedValue(createMockResponse({}, 200));

        await appService.update(app);

        expect(mockRest.post).toHaveBeenCalledTimes(1);
        expect(mockRest.patch).not.toHaveBeenCalled();
    });

    test('update() should use POST on the correct URL', async () => {
        const app = new CubeApplication('Planning', 'TestApp', 'SalesCube');
        mockRest.post.mockResolvedValue(createMockResponse({}, 200));

        await appService.update(app);

        const calledUrl = mockRest.post.mock.calls[0][0] as string;
        expect(calledUrl).toContain("/Contents('Applications')");
        expect(calledUrl).toContain("/Contents('Planning')");
        expect(calledUrl).toContain("/Contents('TestApp')");
    });
});

describe('Bug #12 - ApplicationService getNames() should not inject /api/v1/ prefix', () => {
    let appService: ApplicationService;
    let mockRest: jest.Mocked<RestService>;

    beforeEach(() => {
        mockRest = createMockRestService();
        appService = new ApplicationService(mockRest);
    });

    test('getNames() URL should not contain /api/v1/', async () => {
        mockRest.get.mockResolvedValue(createMockResponse({ value: [{ Name: 'App1' }] }));

        await appService.getNames('Planning');

        const calledUrl = mockRest.get.mock.calls[0][0] as string;
        expect(calledUrl).not.toContain('/api/v1/');
        expect(calledUrl).toMatch(/^\/Contents\('Applications'\)/);
    });

    test('getNames() URL format should match other methods in the service', async () => {
        mockRest.get.mockResolvedValue(createMockResponse({ value: [{ Name: 'App1' }] }));

        await appService.getNames('Planning', false);

        const calledUrl = mockRest.get.mock.calls[0][0] as string;
        expect(calledUrl).toBe("/Contents('Applications')/Contents('Planning')/Contents");
    });

    test('getNames() with isPrivate should use PrivateContents', async () => {
        // _resolvePath probes public path first (returns 404), then tries private
        const notFound = new TM1RestException('Not Found', 404, { status: 404 });
        mockRest.get
            .mockRejectedValueOnce(notFound)   // public probe → 404
            .mockRejectedValueOnce(notFound)   // private probe → 404 (falls through to findBoundary)
            .mockResolvedValueOnce(createMockResponse({ value: [] }))  // boundary probe succeeds
            .mockResolvedValueOnce(createMockResponse({ value: [{ Name: 'App1' }] }));  // actual getNames

        await appService.getNames('Planning', true);

        // The final GET should target PrivateContents
        const lastCall = mockRest.get.mock.calls[mockRest.get.mock.calls.length - 1][0] as string;
        expect(lastCall).not.toContain('/api/v1/');
        expect(lastCall).toContain('PrivateContents');
    });

    test('getNames() with empty path', async () => {
        mockRest.get.mockResolvedValue(createMockResponse({ value: [{ Name: 'App1' }] }));

        await appService.getNames('');

        const calledUrl = mockRest.get.mock.calls[0][0] as string;
        expect(calledUrl).not.toContain('/api/v1/');
        expect(calledUrl).toBe("/Contents('Applications')/Contents");
    });
});

describe('Bug #13 - SessionService getThreadsForCurrent() filter condition', () => {
    let sessionService: SessionService;
    let mockRest: jest.Mocked<RestService>;

    beforeEach(() => {
        mockRest = createMockRestService();
        sessionService = new SessionService(mockRest);
    });

    test('getThreadsForCurrent() should include /api/v1/ in the filter Function value', async () => {
        mockRest.get.mockResolvedValue(createMockResponse({ value: [] }));

        await sessionService.getThreadsForCurrent();

        const calledUrl = mockRest.get.mock.calls[0][0] as string;
        expect(calledUrl).toContain("Function ne 'GET /api/v1/ActiveSession/Threads'");
    });

    test('getThreadsForCurrent() with excludeIdle=true should add State filter', async () => {
        mockRest.get.mockResolvedValue(createMockResponse({ value: [] }));

        await sessionService.getThreadsForCurrent(true);

        const calledUrl = mockRest.get.mock.calls[0][0] as string;
        expect(calledUrl).toContain("Function ne 'GET /api/v1/ActiveSession/Threads'");
        expect(calledUrl).toContain("and State ne 'Idle'");
    });

    test('getThreadsForCurrent() with excludeIdle=false should not add State filter', async () => {
        mockRest.get.mockResolvedValue(createMockResponse({ value: [] }));

        await sessionService.getThreadsForCurrent(false);

        const calledUrl = mockRest.get.mock.calls[0][0] as string;
        expect(calledUrl).toContain("Function ne 'GET /api/v1/ActiveSession/Threads'");
        expect(calledUrl).not.toContain("State ne 'Idle'");
    });

    test('getThreadsForCurrent() URL path should NOT include /api/v1/ prefix', async () => {
        mockRest.get.mockResolvedValue(createMockResponse({ value: [] }));

        await sessionService.getThreadsForCurrent();

        const calledUrl = mockRest.get.mock.calls[0][0] as string;
        // The URL path itself should start with /ActiveSession, not /api/v1/ActiveSession
        expect(calledUrl).toMatch(/^\/ActiveSession\/Threads/);
    });
});
