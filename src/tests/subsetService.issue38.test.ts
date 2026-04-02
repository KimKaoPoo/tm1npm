/**
 * SubsetService Tests — Issue #38 new methods
 */

import { SubsetService } from '../services/SubsetService';
import { RestService } from '../services/RestService';
import { Subset } from '../objects/Subset';
import { Element, ElementType } from '../objects/Element';

const createMockResponse = (data: any, status: number = 200) => ({
    data,
    status,
    statusText: status === 200 ? 'OK' : status === 201 ? 'Created' : status === 204 ? 'No Content' : 'Error',
    headers: {},
    config: {} as any
});

describe('SubsetService — Issue #38 new methods', () => {
    let subsetService: SubsetService;
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

        subsetService = new SubsetService(mockRestService);
    });

    // ===== updateStaticElements =====

    describe('updateStaticElements', () => {
        test('should PUT to Elements/$ref with correct @odata.id body', async () => {
            mockRestService.put.mockResolvedValue(createMockResponse({}, 200));

            await subsetService.updateStaticElements(
                'MySubset',
                'TestDimension',
                'TestHierarchy',
                false,
                ['ElemA', 'ElemB']
            );

            expect(mockRestService.put).toHaveBeenCalledTimes(1);
            const [url, body] = mockRestService.put.mock.calls[0];
            expect(url).toContain("Dimensions('TestDimension')/Hierarchies('TestHierarchy')");
            expect(url).toContain("Subsets('MySubset')/Elements/$ref");

            const parsed = JSON.parse(body);
            expect(Array.isArray(parsed.value)).toBe(true);
            expect(parsed.value).toHaveLength(2);
            expect(parsed.value[0]['@odata.id']).toContain("Elements('ElemA')");
            expect(parsed.value[1]['@odata.id']).toContain("Elements('ElemB')");
        });

        test('should accept a Subset object and use its elements', async () => {
            mockRestService.put.mockResolvedValue(createMockResponse({}, 200));

            const subset = new Subset('MySubset', 'TestDimension', 'TestHierarchy', undefined, undefined, ['X', 'Y', 'Z']);

            await subsetService.updateStaticElements(subset);

            expect(mockRestService.put).toHaveBeenCalledTimes(1);
            const [, body] = mockRestService.put.mock.calls[0];
            const parsed = JSON.parse(body);
            expect(parsed.value).toHaveLength(3);
            expect(parsed.value[0]['@odata.id']).toContain("Elements('X')");
            expect(parsed.value[2]['@odata.id']).toContain("Elements('Z')");
        });

        test('should accept a Subset object with overriding elements array', async () => {
            mockRestService.put.mockResolvedValue(createMockResponse({}, 200));

            const subset = new Subset('MySubset', 'TestDimension', 'TestHierarchy', undefined, undefined, ['X', 'Y']);
            // Override elements explicitly
            await subsetService.updateStaticElements(subset, undefined, undefined, false, ['Override1']);

            const [, body] = mockRestService.put.mock.calls[0];
            const parsed = JSON.parse(body);
            expect(parsed.value).toHaveLength(1);
            expect(parsed.value[0]['@odata.id']).toContain("Elements('Override1')");
        });

        test('should accept Element objects (not just strings)', async () => {
            mockRestService.put.mockResolvedValue(createMockResponse({}, 200));

            const elem1 = new Element('Alpha', ElementType.NUMERIC);
            const elem2 = new Element('Beta', ElementType.NUMERIC);

            await subsetService.updateStaticElements(
                'MySubset',
                'TestDimension',
                'TestHierarchy',
                false,
                [elem1, elem2]
            );

            const [, body] = mockRestService.put.mock.calls[0];
            const parsed = JSON.parse(body);
            expect(parsed.value[0]['@odata.id']).toContain("Elements('Alpha')");
            expect(parsed.value[1]['@odata.id']).toContain("Elements('Beta')");
        });

        test('should use PrivateSubsets collection when isPrivate=true', async () => {
            mockRestService.put.mockResolvedValue(createMockResponse({}, 200));

            await subsetService.updateStaticElements(
                'PrivateSubset',
                'TestDimension',
                'TestHierarchy',
                true,
                ['E1']
            );

            const [url] = mockRestService.put.mock.calls[0];
            expect(url).toContain('PrivateSubsets');
            // PrivateSubsets is the only subsets segment — there must be no plain '/Subsets(' prefix
            expect(url).not.toMatch(/\/Subsets\(/);
        });

        test('should use public Subsets collection when isPrivate=false', async () => {
            mockRestService.put.mockResolvedValue(createMockResponse({}, 200));

            await subsetService.updateStaticElements(
                'PublicSubset',
                'TestDimension',
                'TestHierarchy',
                false,
                ['E1']
            );

            const [url] = mockRestService.put.mock.calls[0];
            expect(url).toContain("Subsets('PublicSubset')");
            expect(url).not.toContain('PrivateSubsets');
        });

        test('should throw when dimensionName is missing for string argument', async () => {
            await expect(
                subsetService.updateStaticElements('MySubset', undefined, 'TestHierarchy', false, ['E1'])
            ).rejects.toThrow('dimensionName is required when passing subset name as string');
        });

        test('should default hierarchyName to dimensionName for string argument', async () => {
            mockRestService.put.mockResolvedValue(createMockResponse({}, 200));

            await subsetService.updateStaticElements(
                'MySubset',
                'TestDimension',
                undefined, // no hierarchyName — should default to dimensionName
                false,
                ['E1']
            );

            const [url] = mockRestService.put.mock.calls[0];
            expect(url).toContain("Hierarchies('TestDimension')");
        });

        test('should send empty value array when no elements provided', async () => {
            mockRestService.put.mockResolvedValue(createMockResponse({}, 200));

            await subsetService.updateStaticElements(
                'EmptySubset',
                'TestDimension',
                'TestHierarchy',
                false,
                []
            );

            const [, body] = mockRestService.put.mock.calls[0];
            const parsed = JSON.parse(body);
            expect(parsed.value).toEqual([]);
        });
    });
});
