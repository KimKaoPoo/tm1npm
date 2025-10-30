import { ElementService } from '../services/ElementService';
import { RestService } from '../services/RestService';
import { AxiosResponse } from 'axios';

// Mock axios
jest.mock('axios');

describe('Enhanced ElementService Tests', () => {
    let elementService: ElementService;
    let mockRestService: jest.Mocked<RestService>;

    const createMockResponse = (data: any, status: number = 200): AxiosResponse => ({
        data,
        status,
        statusText: status === 200 ? 'OK' : status === 201 ? 'Created' : 'Error',
        headers: {},
        config: {} as any
    });

    beforeEach(() => {
        mockRestService = {
            get: jest.fn(),
            post: jest.fn(),
            patch: jest.fn(),
            delete: jest.fn(),
            put: jest.fn()
        } as any;

        elementService = new ElementService(mockRestService);
    });

    describe('Bulk Operations', () => {
        test('deleteElements should delete multiple elements via REST', async () => {
            const elementNames = ['Element1', 'Element2', 'Element3'];

            mockRestService.delete.mockResolvedValue(createMockResponse({}));

            await elementService.deleteElements('TestDim', 'TestHier', elementNames, false);

            expect(mockRestService.delete).toHaveBeenCalledTimes(3);
            expect(mockRestService.delete).toHaveBeenCalledWith(
                "/Dimensions('TestDim')/Hierarchies('TestHier')/Elements('Element1')"
            );
            
            console.log('✅ deleteElements via REST test passed');
        });

        test('deleteElements should delete multiple elements via TI', async () => {
            const elementNames = ['Element1', 'Element2'];

            mockRestService.post.mockResolvedValue(createMockResponse({
                ProcessExecuteStatusCode: 'CompletedSuccessfully'
            }));

            await elementService.deleteElements('TestDim', 'TestHier', elementNames, true);

            // Should create process first, then execute it
            expect(mockRestService.post).toHaveBeenCalledTimes(2); // Create, Execute
            expect(mockRestService.post).toHaveBeenNthCalledWith(1,
                "/Processes",
                expect.stringContaining("DeleteElements_")
            );
            
            console.log('✅ deleteElements via TI test passed');
        });

        test('addEdges should create parent-child relationships', async () => {
            const edges = [
                { parent: 'Total', child: 'Region1', weight: 1 },
                { parent: 'Total', child: 'Region2', weight: 2 }
            ];

            mockRestService.post.mockResolvedValue(createMockResponse({}));

            await elementService.addEdges('TestDim', 'TestHier', edges);

            expect(mockRestService.post).toHaveBeenCalledTimes(2);
            expect(mockRestService.post).toHaveBeenCalledWith(
                "/Dimensions('TestDim')/Hierarchies('TestHier')/Elements('Total')/Components",
                { Name: 'Region1', Weight: 1 }
            );
            
            console.log('✅ addEdges test passed');
        });

        test('deleteEdges should remove parent-child relationships via REST', async () => {
            const edges = [
                { parent: 'Total', child: 'Region1' },
                { parent: 'Total', child: 'Region2' }
            ];

            mockRestService.delete.mockResolvedValue(createMockResponse({}));

            await elementService.deleteEdges('TestDim', 'TestHier', edges, false);

            expect(mockRestService.delete).toHaveBeenCalledTimes(2);
            expect(mockRestService.delete).toHaveBeenCalledWith(
                "/Dimensions('TestDim')/Hierarchies('TestHier')/Elements('Total')/Components('Region1')"
            );
            
            console.log('✅ deleteEdges via REST test passed');
        });

        test('deleteEdges should remove parent-child relationships via TI', async () => {
            const edges = [{ parent: 'Total', child: 'Region1' }];

            mockRestService.post.mockResolvedValue(createMockResponse({}));

            await elementService.deleteEdges('TestDim', 'TestHier', edges, true);

            expect(mockRestService.post).toHaveBeenCalledWith(
                '/ExecuteProcessWithReturn',
                expect.objectContaining({
                    PrologProcedure: expect.stringContaining("HierarchyElementComponentDelete('TestDim','TestHier','Total','Region1')")
                })
            );
            
            console.log('✅ deleteEdges via TI test passed');
        });
    });

    describe('DataFrame Integration', () => {
        test('getElementsDataframe should return tabular data', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse({
                value: [
                    { Name: 'Element1', Type: 'Numeric', Attributes: { Code: 'E1', Description: 'First' } },
                    { Name: 'Element2', Type: 'String', Attributes: { Code: 'E2', Description: 'Second' } }
                ]
            }));

            const result = await elementService.getElementsDataframe('TestDim', 'TestHier', undefined, { attributes: ['Code', 'Description'] });

            expect(result).toEqual({
                columns: ['Name', 'Type', 'Parents', 'Weight', 'Code', 'Description'],
                data: [
                    ['Element1', 'Numeric', '', 1, null, null],
                    ['Element2', 'String', '', 1, null, null]
                ]
            });
            
            console.log('✅ getElementsDataframe test passed');
        });

        test('createHierarchyFromDataframe should create elements and relationships', async () => {
            const dataFrame = [
                ['Name', 'Type', 'Parent1', 'Weight1'],
                ['Total', 'Consolidated', '', ''],
                ['Region1', 'Numeric', 'Total', '1'],
                ['Region2', 'Numeric', 'Total', '2']
            ];

            mockRestService.post.mockResolvedValue(createMockResponse({}));

            await elementService.createHierarchyFromDataframe('TestDim', 'TestHier', dataFrame);

            // Should create 3 elements
            expect(mockRestService.post).toHaveBeenCalledTimes(5); // 3 creates + 2 edges
            
            // Check element creation calls
            expect(mockRestService.post).toHaveBeenCalledWith(
                "/Dimensions('TestDim')/Hierarchies('TestHier')/Elements",
                JSON.stringify({
                    Name: 'Total',
                    Type: 'Consolidated'
                })
            );
            
            console.log('✅ createHierarchyFromDataframe test passed');
        });
    });

    describe('Enhanced Element Retrieval', () => {
        test('getElementsCount should return element count', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse('25'));

            const count = await elementService.getElementsCount('TestDim', 'TestHier');

            expect(count).toBe(25);
            expect(mockRestService.get).toHaveBeenCalledWith(
                "/Dimensions('TestDim')/Hierarchies('TestHier')/Elements/$count"
            );
            
            console.log('✅ getElementsCount test passed');
        });

        test('getElementsCount should filter consolidated elements', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse('15'));

            const count = await elementService.getElementsCount('TestDim', 'TestHier', true);

            expect(count).toBe(15);
            expect(mockRestService.get).toHaveBeenCalledWith(
                "/Dimensions('TestDim')/Hierarchies('TestHier')/Elements/$count?$filter=Type ne 'Consolidated'"
            );
            
            console.log('✅ getElementsCount with filter test passed');
        });

        test('getLeafElements should return non-consolidated elements', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse({
                value: [
                    { Name: 'Element1', Type: 'Numeric' },
                    { Name: 'Element2', Type: 'String' }
                ]
            }));

            const elements = await elementService.getLeafElements('TestDim', 'TestHier');

            expect(elements).toHaveLength(2);
            expect(mockRestService.get).toHaveBeenCalledWith(
                "/Dimensions('TestDim')/Hierarchies('TestHier')/Elements?$expand=*&$filter=Type ne 'Consolidated'"
            );
            
            console.log('✅ getLeafElements test passed');
        });

        test('getConsolidatedElements should return consolidated elements only', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse({
                value: [
                    { Name: 'Total', Type: 'Consolidated' },
                    { Name: 'Region', Type: 'Consolidated' }
                ]
            }));

            const elements = await elementService.getConsolidatedElements('TestDim', 'TestHier');

            expect(elements).toHaveLength(2);
            expect(mockRestService.get).toHaveBeenCalledWith(
                "/Dimensions('TestDim')/Hierarchies('TestHier')/Elements?$expand=*&$filter=Type eq 'Consolidated'"
            );
            
            console.log('✅ getConsolidatedElements test passed');
        });
    });

    describe('Element Attributes', () => {
        test('updateElementAttribute should update attribute value', async () => {
            mockRestService.patch.mockResolvedValue(createMockResponse({}));

            await elementService.updateElementAttribute('TestDim', 'TestHier', 'Element1', 'Code', 'E1-NEW');

            expect(mockRestService.patch).toHaveBeenCalledWith(
                "/Dimensions('TestDim')/Hierarchies('TestHier')/Elements('Element1')/Attributes('Code')",
                { Value: 'E1-NEW' }
            );
            
            console.log('✅ updateElementAttribute test passed');
        });
    });

    describe('MDX Operations', () => {
        test('executeSetMdxElementNames should return element names from MDX set', async () => {
            mockRestService.post.mockResolvedValue(createMockResponse({
                Axes: [{
                    Tuples: [
                        { Members: [{ Name: 'Element1' }] },
                        { Members: [{ Name: 'Element2' }] },
                        { Members: [{ Name: 'Element3' }] }
                    ]
                }]
            }));

            const elements = await elementService.executeSetMdxElementNames(
                '{[TestDim].[TestHier].Members}'
            );

            expect(elements).toEqual(['Element1', 'Element2', 'Element3']);
            expect(mockRestService.post).toHaveBeenCalledWith(
                '/ExecuteMDX',
                {
                    MDX: '{[TestDim].[TestHier].Members}'
                }
            );
            
            console.log('✅ executeSetMdxElementNames test passed');
        });
    });

    describe('Error Handling', () => {
        test('should handle empty element list gracefully', async () => {
            await elementService.deleteElements('TestDim', 'TestHier', [], true);

            // Should not make any API calls
            expect(mockRestService.post).not.toHaveBeenCalled();
            expect(mockRestService.delete).not.toHaveBeenCalled();
            
            console.log('✅ Empty element list handling test passed');
        });

        test('should handle invalid DataFrame format', async () => {
            const invalidDataFrame = [
                ['InvalidColumn', 'AnotherColumn'],
                ['Data1', 'Data2']
            ];

            await expect(
                elementService.createHierarchyFromDataframe('TestDim', 'TestHier', invalidDataFrame)
            ).rejects.toThrow('DataFrame must contain Name and Type columns');
            
            console.log('✅ Invalid DataFrame handling test passed');
        });
    });
});