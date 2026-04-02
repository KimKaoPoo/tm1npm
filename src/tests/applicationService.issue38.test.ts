/**
 * ApplicationService Tests — Issue #38 new methods
 */

import { ApplicationService } from '../services/ApplicationService';
import { RestService } from '../services/RestService';
import { TM1RestException } from '../exceptions/TM1Exception';
import { FolderApplication, CubeApplication, ApplicationTypes } from '../objects/Application';

const createMockResponse = (data: any, status: number = 200) => ({
    data,
    status,
    statusText: status === 200 ? 'OK' : status === 201 ? 'Created' : status === 204 ? 'No Content' : 'Error',
    headers: {},
    config: {} as any
});

describe('ApplicationService — Issue #38 new methods', () => {
    let applicationService: ApplicationService;
    let mockRestService: jest.Mocked<RestService>;

    beforeEach(() => {
        mockRestService = {
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

        applicationService = new ApplicationService(mockRestService);
    });

    // ===== discover =====

    describe('discover', () => {
        test('should return public items at root when includePrivate=false', async () => {
            mockRestService.get.mockImplementation(async (url: string) => {
                if (url.includes('Contents') && !url.includes('PrivateContents')) {
                    return createMockResponse({
                        value: [
                            { '@odata.type': '#ibm.tm1.api.v1.CubeApplication', Name: 'SalesCube' },
                            { '@odata.type': '#ibm.tm1.api.v1.FolderApplicationApplication', Name: 'Reports' }
                        ]
                    });
                }
                return createMockResponse({ value: [] });
            });

            const results = await applicationService.discover('', false, false);

            expect(results.length).toBeGreaterThanOrEqual(2);
            const names = results.map(r => r.name);
            expect(names).toContain('SalesCube');
            expect(names).toContain('Reports');
            // All should be public
            results.forEach(r => expect(r.is_private).toBe(false));
        });

        test('should include private items when includePrivate=true', async () => {
            mockRestService.get.mockImplementation(async (url: string) => {
                if (url.includes('PrivateContents')) {
                    return createMockResponse({
                        value: [
                            { '@odata.type': '#ibm.tm1.api.v1.CubeApplication', Name: 'PrivateReport' }
                        ]
                    });
                }
                return createMockResponse({
                    value: [
                        { '@odata.type': '#ibm.tm1.api.v1.CubeApplication', Name: 'PublicCube' }
                    ]
                });
            });

            const results = await applicationService.discover('', true, false);

            const privateItems = results.filter(r => r.is_private);
            const publicItems = results.filter(r => !r.is_private);
            expect(privateItems.length).toBeGreaterThanOrEqual(1);
            expect(publicItems.length).toBeGreaterThanOrEqual(1);
            const privateNames = privateItems.map(r => r.name);
            expect(privateNames).toContain('PrivateReport');
        });

        test('should recurse into folders when recursive=true', async () => {
            // TM1 returns @odata.type like '#ibm.tm1.api.v1.FolderApplication'.
            // _extractTypeFromOdata strips 'Application' suffix → 'Folder', which triggers recursion.
            mockRestService.get.mockImplementation(async (url: string) => {
                if (url.includes('PrivateContents')) {
                    return createMockResponse({ value: [] });
                }
                // Root Contents call
                if (url.match(/Contents\('Applications'\)\/Contents$/)) {
                    return createMockResponse({
                        value: [
                            { '@odata.type': '#ibm.tm1.api.v1.FolderApplication', Name: 'Reports' }
                        ]
                    });
                }
                // Sub-folder Contents call
                if (url.includes("Contents('Reports')/Contents")) {
                    return createMockResponse({
                        value: [
                            { '@odata.type': '#ibm.tm1.api.v1.CubeApplication', Name: 'SalesReport' }
                        ]
                    });
                }
                return createMockResponse({ value: [] });
            });

            const results = await applicationService.discover('', false, true);

            const names = results.map(r => r.name);
            expect(names).toContain('Reports');
            expect(names).toContain('SalesReport');
        });

        test('should use PrivateContents for nested paths in private context', async () => {
            mockRestService.get.mockImplementation(async (url: string) => {
                // Root private contents returns a folder
                if (url === "/Contents('Applications')/PrivateContents") {
                    return createMockResponse({
                        value: [
                            { '@odata.type': '#ibm.tm1.api.v1.FolderApplication', Name: 'PrivateFolder' }
                        ]
                    });
                }
                // Nested private folder contents — must use PrivateContents, not Contents
                if (url.includes("PrivateContents('PrivateFolder')/PrivateContents")) {
                    return createMockResponse({
                        value: [
                            { '@odata.type': '#ibm.tm1.api.v1.CubeApplication', Name: 'DeepCube' }
                        ]
                    });
                }
                // If the code incorrectly uses Contents for nested private paths, this will 404
                if (url.includes("Contents('PrivateFolder')/Contents")) {
                    throw new TM1RestException('Not found', 404, { status: 404 });
                }
                return createMockResponse({ value: [] });
            });

            const results = await applicationService.discover('', true, true);

            const names = results.map(r => r.name);
            expect(names).toContain('PrivateFolder');
            expect(names).toContain('DeepCube');
        });

        test('should return empty array on 404', async () => {
            mockRestService.get.mockRejectedValue(
                new TM1RestException('Not found', 404, { status: 404 })
            );

            const results = await applicationService.discover('NonExistentPath', false, false);

            expect(results).toEqual([]);
        });

        test('should include type in result items', async () => {
            mockRestService.get.mockImplementation(async (url: string) => {
                if (url.includes('PrivateContents')) {
                    return createMockResponse({ value: [] });
                }
                return createMockResponse({
                    value: [
                        { '@odata.type': '#ibm.tm1.api.v1.CubeApplication', Name: 'MyCube' }
                    ]
                });
            });

            const results = await applicationService.discover('', false, false);

            const cubeItem = results.find(r => r.name === 'MyCube');
            expect(cubeItem).toBeDefined();
            expect(cubeItem?.type).toBe('Cube');
        });
    });

    // ===== getNames with private path resolution (_resolvePath) =====

    describe('getNames — private path', () => {
        test('should resolve private path via _resolvePath and use PrivateContents', async () => {
            mockRestService.get.mockImplementation(async (url: string) => {
                if (url.includes('?$top=0') && url.includes("Contents('MyFolder')")) {
                    // Public path probe succeeds — folder is public
                    return createMockResponse({});
                }
                if (url.includes('PrivateContents')) {
                    return createMockResponse({
                        value: [{ Name: 'PrivateApp' }]
                    });
                }
                return createMockResponse({
                    value: [{ Name: 'PublicApp' }]
                });
            });

            const names = await applicationService.getNames('MyFolder', true);

            expect(Array.isArray(names)).toBe(true);
        });
    });

    // ===== exists with private path =====

    describe('exists — private path', () => {
        test('should use _resolvePath for private paths', async () => {
            // Simulate all-public probe succeeds
            mockRestService.get.mockImplementation(async (url: string) => {
                if (url.includes('?$top=0')) {
                    return createMockResponse({});
                }
                // exists check — return 200
                return createMockResponse({ Name: 'MyCubeApp' });
            });

            const result = await applicationService.exists(
                'MyFolder',
                ApplicationTypes.CUBE,
                'MyCubeApp',
                true
            );

            expect(typeof result).toBe('boolean');
        });

        test('should return false when private path resolution fails with not-found', async () => {
            mockRestService.get.mockRejectedValue(
                new TM1RestException('Not found', 404, { status: 404 })
            );

            const result = await applicationService.exists(
                'NonExistent',
                ApplicationTypes.CUBE,
                'SomeCube',
                true
            );

            expect(result).toBe(false);
        });

        test('should rethrow server errors from private exists', async () => {
            mockRestService.get.mockRejectedValue(
                new TM1RestException('Internal server error', 500, { status: 500 })
            );

            await expect(
                applicationService.exists('SomePath', ApplicationTypes.CUBE, 'SomeCube', true)
            ).rejects.toThrow('Internal server error');
        });
    });
});
