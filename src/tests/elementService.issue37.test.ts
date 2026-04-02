/**
 * Tests for ElementService issue #37 — 13 missing methods for tm1py parity
 */

import { ElementService } from '../services/ElementService';
import { RestService } from '../services/RestService';
import { TM1RestException } from '../exceptions/TM1Exception';

const createMockResponse = (data: any, status: number = 200) => ({
    data,
    status,
    statusText: 'OK',
    headers: {},
    config: {} as any
});

describe('ElementService — Issue #37: 13 missing methods', () => {
    let elementService: ElementService;
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

        elementService = new ElementService(mockRestService);
    });

    // ===== COUNT METHODS =====

    describe('getNumberOfConsolidatedElements', () => {
        test('should return count with Type eq 3 filter', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse('5'));

            const count = await elementService.getNumberOfConsolidatedElements('Dim1', 'Hier1');

            expect(count).toBe(5);
            expect(mockRestService.get).toHaveBeenCalledWith(
                expect.stringContaining('$filter=Type eq 3')
            );
            expect(mockRestService.get).toHaveBeenCalledWith(
                expect.stringContaining('$count')
            );
        });

        test('should return 0 for empty response', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse(''));

            const count = await elementService.getNumberOfConsolidatedElements('Dim1', 'Hier1');
            expect(count).toBe(0);
        });
    });

    describe('getNumberOfLeafElements', () => {
        test('should return count with Type ne 3 filter', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse('10'));

            const count = await elementService.getNumberOfLeafElements('Dim1', 'Hier1');

            expect(count).toBe(10);
            expect(mockRestService.get).toHaveBeenCalledWith(
                expect.stringContaining('$filter=Type ne 3')
            );
        });
    });

    describe('getNumberOfNumericElements', () => {
        test('should return count with Type eq 1 filter', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse('7'));

            const count = await elementService.getNumberOfNumericElements('Dim1', 'Hier1');

            expect(count).toBe(7);
            expect(mockRestService.get).toHaveBeenCalledWith(
                expect.stringContaining('$filter=Type eq 1')
            );
        });
    });

    describe('getNumberOfStringElements', () => {
        test('should return count with Type eq 2 filter', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse('3'));

            const count = await elementService.getNumberOfStringElements('Dim1', 'Hier1');

            expect(count).toBe(3);
            expect(mockRestService.get).toHaveBeenCalledWith(
                expect.stringContaining('$filter=Type eq 2')
            );
        });
    });

    // ===== IDENTIFIER METHODS =====

    describe('getElementTypesFromAllHierarchies', () => {
        test('should return element types from all hierarchies', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse({
                Hierarchies: [
                    {
                        Elements: [
                            { Name: 'Elem1', Type: 'Numeric' },
                            { Name: 'Elem2', Type: 'String' }
                        ]
                    },
                    {
                        Elements: [
                            { Name: 'Elem3', Type: 'Consolidated' }
                        ]
                    }
                ]
            }));

            const result = await elementService.getElementTypesFromAllHierarchies('TestDim');

            expect(result.get('Elem1')).toBe('Numeric');
            expect(result.get('Elem2')).toBe('String');
            expect(result.get('Elem3')).toBe('Consolidated');
        });

        test('should include filter when skipConsolidations is true', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse({
                Hierarchies: [{ Elements: [{ Name: 'Elem1', Type: 'Numeric' }] }]
            }));

            await elementService.getElementTypesFromAllHierarchies('TestDim', true);

            expect(mockRestService.get).toHaveBeenCalledWith(
                expect.stringContaining('$filter=Type ne 3')
            );
        });

        test('should not include filter when skipConsolidations is false', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse({
                Hierarchies: [{ Elements: [{ Name: 'Elem1', Type: 'Numeric' }] }]
            }));

            await elementService.getElementTypesFromAllHierarchies('TestDim', false);

            const calledUrl = mockRestService.get.mock.calls[0][0];
            expect(calledUrl).not.toContain('$filter');
        });

        test('should be case-and-space-insensitive', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse({
                Hierarchies: [
                    { Elements: [{ Name: 'My Element', Type: 'Numeric' }] }
                ]
            }));

            const result = await elementService.getElementTypesFromAllHierarchies('TestDim');
            expect(result.get('myelement')).toBe('Numeric');
            expect(result.get('MY ELEMENT')).toBe('Numeric');
        });
    });

    describe('getAllLeafElementIdentifiers', () => {
        test('should return element names when no alias attributes exist', async () => {
            // Mock getAliasElementAttributes → empty
            jest.spyOn(elementService, 'getAliasElementAttributes').mockResolvedValue([]);
            // Mock executeSetMdx → returns members
            jest.spyOn(elementService, 'executeSetMdx').mockResolvedValue([
                [{ Name: 'Leaf1' }],
                [{ Name: 'Leaf2' }],
                [{ Name: 'Leaf3' }]
            ]);

            const result = await elementService.getAllLeafElementIdentifiers('Dim1', 'Hier1');

            expect(result.has('Leaf1')).toBe(true);
            expect(result.has('Leaf2')).toBe(true);
            expect(result.has('Leaf3')).toBe(true);
            expect(result.has('leaf1')).toBe(true); // case insensitive
        });

        test('should include alias values when alias attributes exist', async () => {
            jest.spyOn(elementService, 'getAliasElementAttributes').mockResolvedValue(['Alias1']);

            // Mock ExecuteMDX response with axes and cells
            mockRestService.post.mockResolvedValue(createMockResponse({
                Axes: [
                    { Tuples: [{ Members: [{ Name: 'Alias1' }] }] },  // column axis
                    {
                        Tuples: [
                            { Members: [{ Name: 'Leaf1' }] },
                            { Members: [{ Name: 'Leaf2' }] }
                        ]
                    }  // row axis
                ],
                Cells: [
                    { Value: 'Alias_Leaf1' },
                    { Value: 'Alias_Leaf2' }
                ]
            }));

            const result = await elementService.getAllLeafElementIdentifiers('Dim1', 'Hier1');

            // Should contain both element names and alias values
            expect(result.has('Leaf1')).toBe(true);
            expect(result.has('Leaf2')).toBe(true);
            expect(result.has('Alias_Leaf1')).toBe(true);
            expect(result.has('Alias_Leaf2')).toBe(true);
        });

        test('should skip empty alias values', async () => {
            jest.spyOn(elementService, 'getAliasElementAttributes').mockResolvedValue(['Alias1']);

            mockRestService.post.mockResolvedValue(createMockResponse({
                Axes: [
                    { Tuples: [{ Members: [{ Name: 'Alias1' }] }] },
                    { Tuples: [{ Members: [{ Name: 'Elem1' }] }] }
                ],
                Cells: [
                    { Value: '' },  // empty alias
                    { Value: null }  // null alias
                ]
            }));

            const result = await elementService.getAllLeafElementIdentifiers('Dim1', 'Hier1');

            expect(result.has('Elem1')).toBe(true);
            expect(result.size).toBe(1); // only the element name, no empty/null aliases
        });
    });

    // ===== EXISTENCE METHODS =====

    describe('attributeCubeExists', () => {
        test('should return true when attribute cube exists', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse({}));

            const result = await elementService.attributeCubeExists('TestDim');

            expect(result).toBe(true);
            expect(mockRestService.get).toHaveBeenCalledWith(
                expect.stringContaining("ElementAttributes_TestDim")
            );
        });

        test('should return false when attribute cube does not exist', async () => {
            mockRestService.get.mockRejectedValue(
                new TM1RestException('Not found', 404, { status: 404 })
            );

            const result = await elementService.attributeCubeExists('NonExistentDim');
            expect(result).toBe(false);
        });
    });

    // ===== TRAVERSAL METHODS =====

    describe('getParentsOfAllElements', () => {
        test('should return parent mapping for all elements', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse({
                value: [
                    { Name: 'Leaf1', Parents: [{ Name: 'Parent1' }, { Name: 'Parent2' }] },
                    { Name: 'Leaf2', Parents: [{ Name: 'Parent1' }] },
                    { Name: 'Parent1', Parents: [] }
                ]
            }));

            const result = await elementService.getParentsOfAllElements('Dim1', 'Hier1');

            expect(result['Leaf1']).toEqual(['Parent1', 'Parent2']);
            expect(result['Leaf2']).toEqual(['Parent1']);
            expect(result['Parent1']).toEqual([]);
        });

        test('should handle elements with no Parents property', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse({
                value: [
                    { Name: 'Orphan' }
                ]
            }));

            const result = await elementService.getParentsOfAllElements('Dim1', 'Hier1');
            expect(result['Orphan']).toEqual([]);
        });

        test('should use correct URL with expand', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse({ value: [] }));

            await elementService.getParentsOfAllElements('Dim1', 'Hier1');

            expect(mockRestService.get).toHaveBeenCalledWith(
                expect.stringContaining('$expand=Parents($select=Name)')
            );
        });
    });

    describe('getElementPrincipalName', () => {
        test('should return the canonical element name', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse({
                Name: 'CanonicalName',
                Type: 'Numeric',
                Level: 0,
                Index: 1
            }));

            const name = await elementService.getElementPrincipalName('Dim1', 'Hier1', 'someAlias');
            expect(name).toBe('CanonicalName');
        });
    });

    // ===== RELATIONSHIP CHECK METHODS =====

    describe('elementIsParent', () => {
        test('should return true when element is a direct parent', async () => {
            mockRestService.post.mockResolvedValue(createMockResponse({
                Cardinality: 1
            }));

            const result = await elementService.elementIsParent('Dim1', 'Hier1', 'ParentElem', 'ChildElem');
            expect(result).toBe(true);
        });

        test('should return false when element is not a direct parent', async () => {
            mockRestService.post.mockResolvedValue(createMockResponse({
                Cardinality: 0
            }));

            const result = await elementService.elementIsParent('Dim1', 'Hier1', 'NotParent', 'ChildElem');
            expect(result).toBe(false);
        });

        test('should use TM1DRILLDOWNMEMBER without RECURSIVE', async () => {
            mockRestService.post.mockResolvedValue(createMockResponse({ Cardinality: 0 }));

            await elementService.elementIsParent('Dim1', 'Hier1', 'Parent', 'Child');

            const mdxPayload = JSON.parse(mockRestService.post.mock.calls[0][1]);
            expect(mdxPayload.MDX).toContain('TM1DRILLDOWNMEMBER');
            expect(mdxPayload.MDX).not.toContain('RECURSIVE');
            expect(mdxPayload.MDX).toContain('INTERSECT');
        });
    });

    describe('elementIsAncestor', () => {
        test('should use TM1DrillDownMember with RECURSIVE for non-admin', async () => {
            // Mock isAdmin = false (default)
            jest.spyOn(elementService, 'exists').mockResolvedValue(true);
            mockRestService.post.mockResolvedValue(createMockResponse({ Cardinality: 1 }));

            const result = await elementService.elementIsAncestor('Dim1', 'Hier1', 'Ancestor', 'Elem');

            expect(result).toBe(true);
            const mdxPayload = JSON.parse(mockRestService.post.mock.calls[0][1]);
            expect(mdxPayload.MDX).toContain('TM1DRILLDOWNMEMBER');
            expect(mdxPayload.MDX).toContain('RECURSIVE');
        });

        test('should return false when element does not exist (TM1DrillDownMember)', async () => {
            jest.spyOn(elementService, 'exists').mockResolvedValue(false);
            jest.spyOn(elementService, 'hierarchyExists').mockResolvedValue(true);

            const result = await elementService.elementIsAncestor(
                'Dim1', 'Hier1', 'Ancestor', 'NonExistent', 'TM1DrillDownMember'
            );

            expect(result).toBe(false);
        });

        test('should throw when hierarchy does not exist (TM1DrillDownMember)', async () => {
            jest.spyOn(elementService, 'exists').mockResolvedValue(false);
            jest.spyOn(elementService, 'hierarchyExists').mockResolvedValue(false);

            await expect(
                elementService.elementIsAncestor('Dim1', 'BadHier', 'Ancestor', 'Elem', 'TM1DrillDownMember')
            ).rejects.toThrow("Hierarchy 'BadHier' does not exist in dimension 'Dim1'");
        });

        test('should use DESCENDANTS method when specified', async () => {
            jest.spyOn(elementService, 'exists').mockResolvedValue(true);
            mockRestService.post.mockResolvedValue(createMockResponse({ Cardinality: 1 }));

            await elementService.elementIsAncestor('Dim1', 'Hier1', 'Ancestor', 'Elem', 'Descendants');

            const mdxPayload = JSON.parse(mockRestService.post.mock.calls[0][1]);
            expect(mdxPayload.MDX).toContain('DESCENDANTS');
        });

        test('should use TI method when specified', async () => {
            // Mock _elementIsAncestorTi
            const tiSpy = jest.spyOn(elementService as any, '_elementIsAncestorTi').mockResolvedValue(true);

            const result = await elementService.elementIsAncestor('Dim1', 'Hier1', 'Ancestor', 'Elem', 'TI');

            expect(result).toBe(true);
            expect(tiSpy).toHaveBeenCalledWith('Dim1', 'Hier1', 'Elem', 'Ancestor');
        });

        test('should check hierarchy existence when TI returns false', async () => {
            jest.spyOn(elementService as any, '_elementIsAncestorTi').mockResolvedValue(false);
            const hierSpy = jest.spyOn(elementService, 'hierarchyExists').mockResolvedValue(true);

            const result = await elementService.elementIsAncestor('Dim1', 'Hier1', 'Ancestor', 'Elem', 'TI');

            expect(result).toBe(false);
            expect(hierSpy).toHaveBeenCalledWith('Dim1', 'Hier1');
        });

        test('should throw when TI returns false and hierarchy does not exist', async () => {
            jest.spyOn(elementService as any, '_elementIsAncestorTi').mockResolvedValue(false);
            jest.spyOn(elementService, 'hierarchyExists').mockResolvedValue(false);

            await expect(
                elementService.elementIsAncestor('Dim1', 'BadHier', 'Ancestor', 'Elem', 'TI')
            ).rejects.toThrow("Hierarchy: 'BadHier' does not exist in dimension: 'Dim1'");
        });
    });

    // ===== EDGE METHODS =====

    describe('removeEdge', () => {
        test('should DELETE the correct edge URL', async () => {
            mockRestService.delete.mockResolvedValue(createMockResponse({}, 204));

            await elementService.removeEdge('Dim1', 'Hier1', 'ParentElem', 'ChildElem');

            const calledUrl = mockRestService.delete.mock.calls[0][0];
            expect(calledUrl).toContain("Elements('ParentElem')");
            expect(calledUrl).toContain("ParentName='ParentElem'");
            expect(calledUrl).toContain("ComponentName='ChildElem'");
            expect(calledUrl).toContain('Edges(');
        });
    });

    describe('hierarchyExists', () => {
        test('should delegate to HierarchyService.exists and return true', async () => {
            // HierarchyService.exists does a GET and checks names
            mockRestService.get.mockResolvedValue(createMockResponse({
                value: [{ Name: 'Hier1' }]
            }));

            const result = await elementService.hierarchyExists('Dim1', 'Hier1');
            expect(result).toBe(true);
        });

        test('should return false when hierarchy does not exist', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse({
                value: [{ Name: 'OtherHier' }]
            }));

            const result = await elementService.hierarchyExists('Dim1', 'NonExistent');
            expect(result).toBe(false);
        });
    });

    // ===== PRIVATE HELPER TESTS =====

    describe('_buildDrillIntersectionMdx (via elementIsParent/elementIsAncestor)', () => {
        test('should throw for invalid MDX method', () => {
            const buildMdx = (elementService as any)._buildDrillIntersectionMdx.bind(elementService);
            expect(() => buildMdx('D', 'H', 'A', 'B', 'INVALID', false)).toThrow(
                "Invalid MDX Drill Method"
            );
        });

        test('should build correct TM1DrillDownMember MDX', () => {
            const buildMdx = (elementService as any)._buildDrillIntersectionMdx.bind(elementService);

            const nonRecursive = buildMdx('Dim', 'Hier', 'Parent', 'Child', 'TM1DrillDownMember', false);
            expect(nonRecursive).toBe(
                'INTERSECT({TM1DRILLDOWNMEMBER({[Dim].[Hier].[Parent]}, ALL)}, {[Dim].[Hier].[Child]})'
            );

            const recursive = buildMdx('Dim', 'Hier', 'Ancestor', 'Leaf', 'TM1DrillDownMember', true);
            expect(recursive).toBe(
                'INTERSECT({TM1DRILLDOWNMEMBER({[Dim].[Hier].[Ancestor]}, ALL, RECURSIVE)}, {[Dim].[Hier].[Leaf]})'
            );
        });

        test('should build correct DESCENDANTS MDX', () => {
            const buildMdx = (elementService as any)._buildDrillIntersectionMdx.bind(elementService);

            const result = buildMdx('Dim', 'Hier', 'Ancestor', 'Elem', 'Descendants', true);
            expect(result).toBe(
                'INTERSECT({DESCENDANTS([Dim].[Hier].[Ancestor], [Dim].[Hier].[Elem].Level, SELF)}, {[Dim].[Hier].[Elem]})'
            );
        });
    });

    describe('_getMdxSetCardinality', () => {
        test('should POST to ExecuteMDXSetExpression and return cardinality', async () => {
            mockRestService.post.mockResolvedValue(createMockResponse({ Cardinality: 5 }));

            const getCardinality = (elementService as any)._getMdxSetCardinality.bind(elementService);
            const result = await getCardinality('SOME MDX');

            expect(result).toBe(5);
            expect(mockRestService.post).toHaveBeenCalledWith(
                '/ExecuteMDXSetExpression?$select=Cardinality',
                expect.stringContaining('SOME MDX')
            );
        });

        test('should return 0 when Cardinality is missing', async () => {
            mockRestService.post.mockResolvedValue(createMockResponse({}));

            const getCardinality = (elementService as any)._getMdxSetCardinality.bind(elementService);
            const result = await getCardinality('SOME MDX');

            expect(result).toBe(0);
        });
    });

    // ===== EDGE CASE TESTS (P2 review feedback) =====

    describe('elementIsAncestor — additional edge cases', () => {
        test('should auto-select TI method when isAdmin is true', async () => {
            Object.defineProperty(elementService, 'isAdmin', { get: () => true });
            const tiSpy = jest.spyOn(elementService as any, '_elementIsAncestorTi').mockResolvedValue(true);

            const result = await elementService.elementIsAncestor('Dim1', 'Hier1', 'Ancestor', 'Elem');

            expect(result).toBe(true);
            expect(tiSpy).toHaveBeenCalled();
        });
    });

    describe('getElementTypesFromAllHierarchies — additional edge cases', () => {
        test('should handle empty Hierarchies array', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse({
                Hierarchies: []
            }));

            const result = await elementService.getElementTypesFromAllHierarchies('EmptyDim');
            expect(result.size).toBe(0);
        });
    });

    describe('getParentsOfAllElements — additional edge cases', () => {
        test('should handle empty value array', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse({ value: [] }));

            const result = await elementService.getParentsOfAllElements('Dim1', 'Hier1');
            expect(Object.keys(result)).toHaveLength(0);
        });
    });

    describe('_retrieveMdxRowsAndCellValuesAsStringSet — additional edge cases', () => {
        test('should return empty set when Axes and Cells are missing', async () => {
            // CellService.executeMdxRowsAndValues handles missing Axes/Cells
            mockRestService.post.mockResolvedValue(createMockResponse({}));

            const retrieve = (elementService as any)._retrieveMdxRowsAndCellValuesAsStringSet.bind(elementService);
            const result = await retrieve('SELECT {} ON ROWS FROM [Cube]');

            expect(result.size).toBe(0);
        });
    });

    describe('getElementPrincipalName — additional edge cases', () => {
        test('should propagate error when element not found', async () => {
            mockRestService.get.mockRejectedValue(
                new TM1RestException('Not found', 404, { status: 404 })
            );

            await expect(
                elementService.getElementPrincipalName('Dim1', 'Hier1', 'NonExistent')
            ).rejects.toThrow();
        });
    });
});
