/**
 * HierarchyService Tests — Issue #38 new methods
 */

import { HierarchyService } from '../services/HierarchyService';
import { RestService } from '../services/RestService';
import { Hierarchy } from '../objects/Hierarchy';
import { Element, ElementType } from '../objects/Element';
import { ElementAttribute } from '../objects/ElementAttribute';
import { TM1RestException } from '../exceptions/TM1Exception';

const createMockResponse = (data: any, status: number = 200) => ({
    data,
    status,
    statusText: status === 200 ? 'OK' : status === 201 ? 'Created' : status === 204 ? 'No Content' : 'Error',
    headers: {},
    config: {} as any
});

describe('HierarchyService — Issue #38 new methods', () => {
    let hierarchyService: HierarchyService;
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

        hierarchyService = new HierarchyService(mockRestService);
    });

    // ===== updateOrCreate =====

    describe('updateOrCreate', () => {
        test('should call create when hierarchy does not exist', async () => {
            const hierarchy = new Hierarchy('NewHierarchy', 'TestDimension');

            // exists() does a GET for $select=Name — return list without the hierarchy
            mockRestService.get.mockImplementation(async (url: string) => {
                if (url.includes('$select=Name')) {
                    return createMockResponse({ value: [] });
                }
                // getElementAttributes inside create -> updateElementAttributes
                return createMockResponse({ value: [] });
            });
            mockRestService.post.mockResolvedValue(createMockResponse({ Name: 'NewHierarchy' }, 201));

            const result = await hierarchyService.updateOrCreate(hierarchy);

            expect(mockRestService.post).toHaveBeenCalledTimes(1);
            const postUrl = mockRestService.post.mock.calls[0][0];
            expect(postUrl).toContain("/Hierarchies");
        });

        test('should call update when hierarchy exists', async () => {
            const hierarchy = new Hierarchy('ExistingHierarchy', 'TestDimension');

            // exists() returns the hierarchy in the list
            mockRestService.get.mockImplementation(async (url: string) => {
                if (url.includes('$select=Name')) {
                    return createMockResponse({ value: [{ Name: 'ExistingHierarchy' }] });
                }
                // getElementAttributes inside update -> updateElementAttributes
                return createMockResponse({ value: [] });
            });
            mockRestService.patch.mockResolvedValue(createMockResponse({}, 200));

            const result = await hierarchyService.updateOrCreate(hierarchy);

            expect(mockRestService.patch).toHaveBeenCalledTimes(1);
            const patchUrl = mockRestService.patch.mock.calls[0][0];
            expect(patchUrl).toContain("Hierarchies('ExistingHierarchy')");
        });
    });

    // ===== getHierarchySummary =====

    describe('getHierarchySummary', () => {
        test('should return correct counts from OData response', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse({
                'Cardinality': 0,
                'Elements@odata.count': 42,
                'Edges@odata.count': 30,
                'ElementAttributes@odata.count': 5,
                'Members@odata.count': 50,
                'Levels@odata.count': 3
            }));

            const summary = await hierarchyService.getHierarchySummary('TestDimension', 'TestHierarchy');

            expect(summary.Elements).toBe(42);
            expect(summary.Edges).toBe(30);
            expect(summary.ElementAttributes).toBe(5);
            expect(summary.Members).toBe(50);
            expect(summary.Levels).toBe(3);
        });

        test('should default hierarchyName to dimensionName when not provided', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse({
                'Elements@odata.count': 10,
                'Edges@odata.count': 5,
                'ElementAttributes@odata.count': 2,
                'Members@odata.count': 10,
                'Levels@odata.count': 1
            }));

            await hierarchyService.getHierarchySummary('TestDimension');

            const calledUrl = mockRestService.get.mock.calls[0][0];
            expect(calledUrl).toContain("Hierarchies('TestDimension')");
        });

        test('should default missing odata counts to 0', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse({}));

            const summary = await hierarchyService.getHierarchySummary('TestDimension', 'TestHierarchy');

            expect(summary.Elements).toBe(0);
            expect(summary.Edges).toBe(0);
            expect(summary.ElementAttributes).toBe(0);
            expect(summary.Members).toBe(0);
            expect(summary.Levels).toBe(0);
        });
    });

    // ===== getDefaultMember =====

    describe('getDefaultMember', () => {
        test('should return member name from response', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse({ Name: 'All Members' }));

            const result = await hierarchyService.getDefaultMember('TestDimension', 'TestHierarchy');

            expect(result).toBe('All Members');
            const calledUrl = mockRestService.get.mock.calls[0][0];
            expect(calledUrl).toContain('/DefaultMember');
        });

        test('should return null on 404', async () => {
            mockRestService.get.mockRejectedValue(
                new TM1RestException('Not found', 404, { status: 404 })
            );

            const result = await hierarchyService.getDefaultMember('TestDimension', 'TestHierarchy');

            expect(result).toBeNull();
        });

        test('should rethrow non-404 errors', async () => {
            mockRestService.get.mockRejectedValue(
                new TM1RestException('Server error', 500, { status: 500 })
            );

            await expect(
                hierarchyService.getDefaultMember('TestDimension', 'TestHierarchy')
            ).rejects.toThrow();
        });

        test('should default hierarchyName to dimensionName', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse({ Name: 'Root' }));

            await hierarchyService.getDefaultMember('TestDimension');

            const calledUrl = mockRestService.get.mock.calls[0][0];
            expect(calledUrl).toContain("Hierarchies('TestDimension')");
        });
    });

    // ===== updateDefaultMember =====

    describe('updateDefaultMember', () => {
        test('should use API approach (PATCH) when version is 12.0.0', async () => {
            (mockRestService as any).version = '12.0.0';
            mockRestService.patch.mockResolvedValue(createMockResponse({}, 200));

            await hierarchyService.updateDefaultMember('TestDimension', 'TestHierarchy', 'RootMember');

            expect(mockRestService.patch).toHaveBeenCalledTimes(1);
            const [url, body] = mockRestService.patch.mock.calls[0];
            expect(url).toContain("Dimensions('TestDimension')/Hierarchies('TestHierarchy')");
            const parsed = JSON.parse(body);
            expect(parsed['DefaultMember@odata.bind']).toContain("Elements('RootMember')");
        });

        test('should use API approach when version is undefined', async () => {
            (mockRestService as any).version = undefined;
            mockRestService.patch.mockResolvedValue(createMockResponse({}, 200));

            await hierarchyService.updateDefaultMember('TestDimension', 'TestHierarchy', 'RootMember');

            expect(mockRestService.patch).toHaveBeenCalledTimes(1);
        });

        test('should use props cube approach for pre-v12 (version 11.8.0)', async () => {
            (mockRestService as any).version = '11.8.0';
            // CellService.writeValue calls getDimensionNamesForWriting (GET) then POST
            mockRestService.get.mockResolvedValue(createMockResponse({
                Dimensions: [
                    { Name: '}HierarchyProperties' },
                    { Name: '}HierarchyProperties_dim' },
                    { Name: 'MEMBER_DEFAULT' }
                ]
            }));
            mockRestService.post.mockResolvedValue(createMockResponse({}, 200));

            await hierarchyService.updateDefaultMember('TestDimension', 'TestHierarchy', 'RootMember');

            expect(mockRestService.post).toHaveBeenCalledTimes(1);
            const [url, body] = mockRestService.post.mock.calls[0];
            // The cube name '}HierarchyProperties' gets URL-encoded as '%7DHierarchyProperties'
            expect(url).toContain('HierarchyProperties');
            const parsed = JSON.parse(body);
            expect(parsed.Cells[0].Value).toBe('RootMember');
        });

        test('should clear default member when memberName is empty string (API approach)', async () => {
            (mockRestService as any).version = '12.0.0';
            mockRestService.patch.mockResolvedValue(createMockResponse({}, 200));

            await hierarchyService.updateDefaultMember('TestDimension', 'TestHierarchy', '');

            expect(mockRestService.patch).toHaveBeenCalledTimes(1);
            const [, body] = mockRestService.patch.mock.calls[0];
            const parsed = JSON.parse(body);
            expect(parsed['DefaultMember@odata.bind']).toBeNull();
        });

        test('should default hierarchyName to dimensionName', async () => {
            (mockRestService as any).version = '12.0.0';
            mockRestService.patch.mockResolvedValue(createMockResponse({}, 200));

            await hierarchyService.updateDefaultMember('TestDimension', undefined, 'Root');

            const [url] = mockRestService.patch.mock.calls[0];
            expect(url).toContain("Hierarchies('TestDimension')");
        });
    });

    // ===== removeEdgesUnderConsolidation =====

    describe('removeEdgesUnderConsolidation', () => {
        test('should remove edges under the specified consolidation element', async () => {
            // Build a hierarchy: Total -> [A, B], A -> [A1, A2]
            const hierarchy = new Hierarchy('TestHierarchy', 'TestDimension');
            hierarchy.addEdge('Total', 'A', 1);
            hierarchy.addEdge('Total', 'B', 1);
            hierarchy.addEdge('A', 'A1', 1);
            hierarchy.addEdge('A', 'A2', 1);

            let getCallCount = 0;
            mockRestService.get.mockImplementation(async (url: string) => {
                getCallCount++;
                if (getCallCount === 1) {
                    // First call is the get(dimensionName, hierarchyName) inside removeEdgesUnderConsolidation
                    return createMockResponse({
                        Name: 'TestHierarchy',
                        Elements: [
                            { Name: 'Total', Type: 'Consolidated' },
                            { Name: 'A', Type: 'Consolidated' },
                            { Name: 'B', Type: 'Numeric' },
                            { Name: 'A1', Type: 'Numeric' },
                            { Name: 'A2', Type: 'Numeric' }
                        ],
                        Edges: [
                            { ParentName: 'Total', ComponentName: 'A', Weight: 1 },
                            { ParentName: 'Total', ComponentName: 'B', Weight: 1 },
                            { ParentName: 'A', ComponentName: 'A1', Weight: 1 },
                            { ParentName: 'A', ComponentName: 'A2', Weight: 1 }
                        ],
                        ElementAttributes: [],
                        Subsets: []
                    });
                }
                // Subsequent calls from updateElementAttributes
                return createMockResponse({ value: [] });
            });
            mockRestService.patch.mockResolvedValue(createMockResponse({}, 200));

            await hierarchyService.removeEdgesUnderConsolidation(
                'TestDimension', 'TestHierarchy', 'A'
            );

            expect(mockRestService.patch).toHaveBeenCalledTimes(1);
            const [, body] = mockRestService.patch.mock.calls[0];
            const parsed = JSON.parse(body);
            // After removing edges under A, A should have no children in the hierarchy
            const remainingEdges: Array<{ ParentName: string; ComponentName: string }> = parsed.Edges || [];
            const aEdges = remainingEdges.filter((e: any) => e.ParentName === 'A');
            expect(aEdges).toHaveLength(0);
        });
    });

    // ===== addEdges =====

    describe('addEdges', () => {
        test('should delegate to ElementService.addEdges', async () => {
            mockRestService.post.mockResolvedValue(createMockResponse({}, 201));

            await hierarchyService.addEdges(
                'TestDimension',
                'TestHierarchy',
                { Parent: { Child: 1 } }
            );

            expect(mockRestService.post).toHaveBeenCalledTimes(1);
            const [url] = mockRestService.post.mock.calls[0];
            expect(url).toContain("Dimensions('TestDimension')/Hierarchies('TestHierarchy')");
        });

        test('should use dimensionName as hierarchyName when hierarchyName is undefined', async () => {
            mockRestService.post.mockResolvedValue(createMockResponse({}, 201));

            await hierarchyService.addEdges('TestDimension', undefined, { P: { C: 1 } });

            const [url] = mockRestService.post.mock.calls[0];
            expect(url).toContain("Hierarchies('TestDimension')");
        });
    });

    // ===== addElements =====

    describe('addElements', () => {
        test('should delegate to ElementService.addElements', async () => {
            mockRestService.post.mockResolvedValue(createMockResponse({}, 201));
            const elements = [new Element('Elem1', ElementType.NUMERIC)];

            await hierarchyService.addElements('TestDimension', 'TestHierarchy', elements);

            expect(mockRestService.post).toHaveBeenCalledTimes(1);
            const [url] = mockRestService.post.mock.calls[0];
            expect(url).toContain("Dimensions('TestDimension')/Hierarchies('TestHierarchy')/Elements");
        });
    });

    // ===== addElementAttributes =====

    describe('addElementAttributes', () => {
        test('should delegate to ElementService.addElementAttributes', async () => {
            mockRestService.post.mockResolvedValue(createMockResponse({}, 201));
            const attrs = [new ElementAttribute('Description', 'String')];

            await hierarchyService.addElementAttributes('TestDimension', 'TestHierarchy', attrs);

            expect(mockRestService.post).toHaveBeenCalledTimes(1);
            const [url] = mockRestService.post.mock.calls[0];
            expect(url).toContain("Dimensions('TestDimension')/Hierarchies('TestHierarchy')/ElementAttributes");
        });
    });
});
