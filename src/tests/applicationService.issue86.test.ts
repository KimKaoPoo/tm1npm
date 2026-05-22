/**
 * ApplicationService Tests — Issue #86
 *
 * Covers tm1py parity for:
 *   - _resolvePath / _buildPathUrl / _findPrivateBoundary branches
 *   - privatePathCache behavior (use_cache parameter)
 *   - update() PATCH for documents, POST to collection for non-documents
 *   - discover() flat vs nested, includePrivate, recursive, depth-first order
 *   - _extractTypeFromOdata exact tm1py port (no Application strip)
 *   - exists() does not route through _resolvePath; replicates tm1py quirks
 *   - non-404 error rethrow
 */

import { ApplicationService } from '../services/ApplicationService';
import { RestService } from '../services/RestService';
import { TM1RestException } from '../exceptions/TM1Exception';
import {
    ApplicationTypes,
    CubeApplication,
    DocumentApplication
} from '../objects/Application';

const createMockResponse = (data: any, status: number = 200) => ({
    data,
    status,
    statusText: 'OK',
    headers: {},
    config: {} as any
});

function notFound(): TM1RestException {
    return new TM1RestException('Not Found', 404, { status: 404 });
}

function serverError(): TM1RestException {
    return new TM1RestException('Internal Server Error', 500, { status: 500 });
}

function mockRest(): jest.Mocked<RestService> {
    return {
        get: jest.fn(),
        post: jest.fn(),
        patch: jest.fn(),
        delete: jest.fn(),
        put: jest.fn(),
        config: {} as any,
        rest: {} as any,
        buildBaseUrl: jest.fn(),
        extractErrorMessage: jest.fn()
    } as any;
}

describe('ApplicationService — Issue #86 parity', () => {
    let service: ApplicationService;
    let rest: jest.Mocked<RestService>;

    beforeEach(() => {
        rest = mockRest();
        service = new ApplicationService(rest);
    });

    // ───────────────────────── _extractTypeFromOdata ─────────────────────────

    describe('_extractTypeFromOdata', () => {
        const extract = (s: string): string => (service as any)._extractTypeFromOdata(s);

        test('returns last dotted segment for dotted input', () => {
            expect(extract('#ibm.tm1.api.v1.Folder')).toBe('Folder');
        });

        test('does NOT strip Application suffix (tm1py parity)', () => {
            expect(extract('#ibm.tm1.api.v1.FolderApplication')).toBe('FolderApplication');
        });

        test('returns "Unknown" for empty string', () => {
            expect(extract('')).toBe('Unknown');
        });

        test('returns original string when no dot present', () => {
            expect(extract('NoDots')).toBe('NoDots');
        });
    });

    // ───────────────────────── _resolvePath ─────────────────────────

    describe('_resolvePath', () => {
        const resolve = async (path: string, isPrivate = false, useCache = false) =>
            await (service as any)._resolvePath(path, isPrivate, useCache);

        test('empty path returns base with inPrivateContext=false even when isPrivate=true', async () => {
            const result = await resolve('', true);
            expect(result.baseUrl).toBe("/Contents('Applications')");
            expect(result.inPrivateContext).toBe(false);
            expect(rest.get).not.toHaveBeenCalled();
        });

        test('public branch returns base + all-public segments and fires no GET', async () => {
            const result = await resolve('Finance/Reports', false);
            expect(result.baseUrl).toBe("/Contents('Applications')/Contents('Finance')/Contents('Reports')");
            expect(result.inPrivateContext).toBe(false);
            expect(rest.get).not.toHaveBeenCalled();
        });

        test('private branch all-public probe hits → public URL, inPrivateContext=false', async () => {
            rest.get.mockResolvedValueOnce(createMockResponse({}));
            const result = await resolve('Finance/Reports', true);
            expect(result.baseUrl).toBe("/Contents('Applications')/Contents('Finance')/Contents('Reports')");
            expect(result.inPrivateContext).toBe(false);
        });

        test('private branch all-private probe hits after public 404 → all-private URL, inPrivateContext=true', async () => {
            rest.get
                .mockRejectedValueOnce(notFound())
                .mockResolvedValueOnce(createMockResponse({}));
            const result = await resolve('A/B', true);
            expect(result.baseUrl).toBe("/Contents('Applications')/PrivateContents('A')/PrivateContents('B')");
            expect(result.inPrivateContext).toBe(true);
        });

        test('private branch mixed boundary search → mixed URL, inPrivateContext=true', async () => {
            // public/A succeeds, public/A/B fails, private/A/B succeeds
            rest.get
                .mockRejectedValueOnce(notFound()) // optimistic all-public on A/B
                .mockRejectedValueOnce(notFound()) // optimistic all-private on A/B
                .mockResolvedValueOnce(createMockResponse({})) // boundary public probe for A
                .mockRejectedValueOnce(notFound()) // boundary public probe for B
                .mockResolvedValueOnce(createMockResponse({})); // boundary private probe for B
            const result = await resolve('A/B', true);
            expect(result.baseUrl).toBe("/Contents('Applications')/Contents('A')/PrivateContents('B')");
            expect(result.inPrivateContext).toBe(true);
        });

        test('path-not-found returns public URL (no throw)', async () => {
            rest.get.mockRejectedValue(notFound());
            const result = await resolve('Ghost/Path', true);
            expect(result.baseUrl).toBe("/Contents('Applications')/Contents('Ghost')/Contents('Path')");
            expect(result.inPrivateContext).toBe(false);
        });

        test('non-404 server error on public probe is rethrown', async () => {
            rest.get.mockRejectedValueOnce(serverError());
            await expect(resolve('A', true)).rejects.toThrow('Internal Server Error');
        });

        test('useCache=true populates the cache and a second call hits cache (no probe GETs)', async () => {
            rest.get.mockResolvedValueOnce(createMockResponse({}));
            await resolve('Finance/Reports', true, true);
            const callsAfterFirst = rest.get.mock.calls.length;

            await resolve('Finance/Reports', true, true);
            expect(rest.get.mock.calls.length).toBe(callsAfterFirst); // no additional GET
        });
    });

    // ───────────────────────── _findPrivateBoundary ─────────────────────────

    describe('_findPrivateBoundary', () => {
        test('non-404 on public probe is rethrown', async () => {
            rest.get.mockRejectedValueOnce(serverError());
            await expect((service as any)._findPrivateBoundary(['x'])).rejects.toThrow('Internal Server Error');
        });

        test('non-404 on private probe is rethrown', async () => {
            rest.get
                .mockRejectedValueOnce(notFound())
                .mockRejectedValueOnce(serverError());
            await expect((service as any)._findPrivateBoundary(['x'])).rejects.toThrow('Internal Server Error');
        });
    });

    // ───────────────────────── _getContentsRaw ─────────────────────────

    describe('_getContentsRaw', () => {
        test('404 returns empty array', async () => {
            rest.get.mockRejectedValue(notFound());
            const result = await (service as any)._getContentsRaw('Some/Path', false, false);
            expect(result).toEqual([]);
        });

        test('non-404 error rethrown', async () => {
            rest.get.mockRejectedValue(serverError());
            await expect((service as any)._getContentsRaw('', false, false))
                .rejects.toThrow('Internal Server Error');
        });
    });

    // ───────────────────────── update() ─────────────────────────

    describe('update()', () => {
        test('DocumentApplication uses PATCH on /Document/Content', async () => {
            const doc = new DocumentApplication('Reports', 'P&L', Buffer.from('hi'));
            rest.patch.mockResolvedValue(createMockResponse({}, 204));

            await service.update(doc);

            expect(rest.patch).toHaveBeenCalledTimes(1);
            expect(rest.post).not.toHaveBeenCalled();
            const calledUrl = rest.patch.mock.calls[0][0] as string;
            expect(calledUrl).toContain('/Document/Content');
        });

        test('DocumentApplication with undefined content still issues PATCH (no validation throw)', async () => {
            const doc = new DocumentApplication('Reports', 'P&L');
            rest.patch.mockResolvedValue(createMockResponse({}, 204));

            await expect(service.update(doc)).resolves.toBeDefined();
            expect(rest.patch).toHaveBeenCalledTimes(1);
        });

        test('Non-document POSTs to collection URL (no item name)', async () => {
            const app = new CubeApplication('Planning', 'TestApp', 'SalesCube');
            rest.post.mockResolvedValue(createMockResponse({}, 200));

            await service.update(app);

            const url = rest.post.mock.calls[0][0] as string;
            expect(url).toBe("/Contents('Applications')/Contents('Planning')/Contents");
            expect(url).not.toContain("'TestApp'");
        });
    });

    // ───────────────────────── discover() ─────────────────────────

    describe('discover()', () => {
        test('flat=true returns flat list with @odata.type and id fields', async () => {
            rest.get.mockImplementation(async (url: string) => {
                if (url === "/Contents('Applications')/Contents") {
                    return createMockResponse({
                        value: [
                            { '@odata.type': '#ibm.tm1.api.v1.Cube', Name: 'Sales', ID: 'id-sales' }
                        ]
                    });
                }
                return createMockResponse({ value: [] });
            });

            const result = await service.discover('', false, false, true);

            expect(result.length).toBe(1);
            expect(result[0]['@odata.type']).toBe('#ibm.tm1.api.v1.Cube');
            expect(result[0].id).toBe('id-sales');
            expect(result[0].type).toBe('Cube');
            expect(result[0].name).toBe('Sales');
        });

        test('flat=false, recursive=true → nested structure with children on folders', async () => {
            rest.get.mockImplementation(async (url: string) => {
                if (url === "/Contents('Applications')/Contents") {
                    return createMockResponse({
                        value: [{ '@odata.type': '#ibm.tm1.api.v1.Folder', Name: 'Reports' }]
                    });
                }
                if (url === "/Contents('Applications')/Contents('Reports')/Contents") {
                    return createMockResponse({
                        value: [{ '@odata.type': '#ibm.tm1.api.v1.Cube', Name: 'Sales' }]
                    });
                }
                return createMockResponse({ value: [] });
            });

            const result = await service.discover('', false, true, false);

            expect(result.length).toBe(1);
            expect(result[0].name).toBe('Reports');
            expect(result[0].children).toBeDefined();
            expect(result[0].children!.length).toBe(1);
            expect(result[0].children![0].name).toBe('Sales');
        });

        test('flat=false, recursive=false → folders have no children key', async () => {
            rest.get.mockImplementation(async (url: string) => {
                if (url === "/Contents('Applications')/Contents") {
                    return createMockResponse({
                        value: [{ '@odata.type': '#ibm.tm1.api.v1.Folder', Name: 'Reports' }]
                    });
                }
                return createMockResponse({ value: [] });
            });

            const result = await service.discover('', false, false, false);

            expect(result.length).toBe(1);
            expect(result[0].name).toBe('Reports');
            expect(result[0].children).toBeUndefined();
        });

        test('flat=true, recursive=true → children appear before parent (tm1py depth-first order)', async () => {
            rest.get.mockImplementation(async (url: string) => {
                if (url === "/Contents('Applications')/Contents") {
                    return createMockResponse({
                        value: [{ '@odata.type': '#ibm.tm1.api.v1.Folder', Name: 'Reports' }]
                    });
                }
                if (url === "/Contents('Applications')/Contents('Reports')/Contents") {
                    return createMockResponse({
                        value: [{ '@odata.type': '#ibm.tm1.api.v1.Cube', Name: 'Sales' }]
                    });
                }
                return createMockResponse({ value: [] });
            });

            const result = await service.discover('', false, true, true);
            const names = result.map(r => r.name);

            expect(names.indexOf('Sales')).toBeLessThan(names.indexOf('Reports'));
        });

        test('includePrivate=true at root issues both Contents and PrivateContents GETs', async () => {
            const calledUrls: string[] = [];
            rest.get.mockImplementation(async (url: string) => {
                calledUrls.push(url);
                return createMockResponse({ value: [] });
            });

            await service.discover('', true, false, true);

            expect(calledUrls).toContain("/Contents('Applications')/Contents");
            expect(calledUrls).toContain("/Contents('Applications')/PrivateContents");
        });

        test('discover from private path calls _resolvePath once for initial context', async () => {
            const spy = jest.spyOn(service as any, '_resolvePath');
            rest.get.mockImplementation(async () => createMockResponse({ value: [] }));

            await service.discover('PrivateRoot', true, false, true);

            // Initial context call exactly once (the rest of the flow uses _getContentsRaw/_findPrivateBoundary)
            const directCalls = spy.mock.calls.filter(c => c[0] === 'PrivateRoot');
            expect(directCalls.length).toBe(1);
            spy.mockRestore();
        });
    });

    // ───────────────────────── exists() — tm1py-specific flow ─────────────────────────

    describe('exists() — tm1py-specific flow', () => {
        test('does NOT route through _resolvePath for private exists', async () => {
            const spy = jest.spyOn(service as any, '_resolvePath');
            rest.get.mockResolvedValue(createMockResponse({}));

            await service.exists('Finance', ApplicationTypes.CUBE, 'Q1', true);

            expect(spy).not.toHaveBeenCalled();
            spy.mockRestore();
        });

        test('cache-hit with boundary === segments.length checks /Contents leaf (tm1py parity bug)', async () => {
            // First call populates cache via successful all-public-with-PrivateContents probe
            rest.get.mockResolvedValueOnce(createMockResponse({}));
            await service.exists('Finance', ApplicationTypes.CUBE, 'Q1', true, true);

            // Second call should hit cache and use /Contents leaf (NOT PrivateContents)
            rest.get.mockResolvedValueOnce(createMockResponse({}));
            await service.exists('Finance', ApplicationTypes.CUBE, 'Q1', true, true);

            const cacheHitUrl = rest.get.mock.calls[1][0] as string;
            expect(cacheHitUrl).toBe("/Contents('Applications')/Contents('Finance')/Contents('Q1')");
        });

        test('iterative-boundary tautology — PrivateContents leaf regardless of boundary', async () => {
            // Force public probe → 404, private boundary search succeeds at segments.length
            rest.get
                .mockRejectedValueOnce(notFound()) // all-public-with-PrivateContents probe
                .mockResolvedValueOnce(createMockResponse({})) // boundary public probe for "F" → success
                .mockResolvedValueOnce(createMockResponse({})); // final exists probe

            await service.exists('F', ApplicationTypes.CUBE, 'x', true);

            const finalUrl = rest.get.mock.calls[rest.get.mock.calls.length - 1][0] as string;
            expect(finalUrl).toContain('PrivateContents');
        });

        test('returns false when iterative boundary search returns -1', async () => {
            rest.get
                .mockRejectedValueOnce(notFound()) // public probe with PrivateContents leaf
                .mockRejectedValueOnce(notFound()) // boundary public probe
                .mockRejectedValueOnce(notFound()); // boundary private probe

            const result = await service.exists('Ghost', ApplicationTypes.CUBE, 'x', true);
            expect(result).toBe(false);
        });

        test('public branch (isPrivate=false) builds /Contents leaf URL', async () => {
            rest.get.mockResolvedValue(createMockResponse({}));
            await service.exists('Finance', ApplicationTypes.CUBE, 'Q1', false);
            const url = rest.get.mock.calls[0][0] as string;
            expect(url).toContain("/Contents('Q1')");
            expect(url).not.toContain('PrivateContents');
        });

        test('private root (empty path) checks /PrivateContents leaf directly', async () => {
            rest.get.mockResolvedValue(createMockResponse({}));
            await service.exists('', ApplicationTypes.CUBE, 'X', true);
            const url = rest.get.mock.calls[0][0] as string;
            expect(url).toBe("/Contents('Applications')/PrivateContents('X')");
        });
    });
});
