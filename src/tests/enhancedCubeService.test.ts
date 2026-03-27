import { CubeService } from '../services/CubeService';
import { RestService } from '../services/RestService';
import { AxiosResponse } from 'axios';

// Mock axios
jest.mock('axios');

describe('Enhanced CubeService Tests', () => {
    let cubeService: CubeService;
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

        cubeService = new CubeService(mockRestService);
    });

    describe('Cube Analysis Functions', () => {
        test('searchForDimensionSubstring should use server-side OData filter', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse({
                value: [
                    { Name: 'SalesCube', Dimensions: [{ Name: 'Region' }] },
                    { Name: 'PlanningCube', Dimensions: [{ Name: 'Region' }] }
                ]
            }));

            const result = await cubeService.searchForDimensionSubstring('Reg');

            expect(result).toEqual({
                'SalesCube': ['Region'],
                'PlanningCube': ['Region']
            });
            const url = mockRestService.get.mock.calls[0][0];
            expect(url).toContain("Dimensions/any(d: contains(");
            expect(url).toContain("'reg'");

            console.log('✅ searchForDimensionSubstring test passed');
        });

        test('searchForRuleSubstring should use server-side OData filter', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse({
                value: [
                    { Name: 'TestCube1', Dimensions: [{ Name: 'Year' }] },
                    { Name: 'TestCube2', Dimensions: [{ Name: 'Month' }] }
                ]
            }));

            const result = await cubeService.searchForRuleSubstring('RULE');

            expect(result).toHaveLength(2);
            const url = mockRestService.get.mock.calls[0][0];
            expect(url).toContain("Rules ne null and contains(");

            console.log('✅ searchForRuleSubstring test passed');
        });

        test('getStorageDimensionOrder should return ordered dimension names', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse({
                value: [
                    { Name: 'Year' },
                    { Name: 'Region' },
                    { Name: 'Product' }
                ]
            }));

            const result = await cubeService.getStorageDimensionOrder('TestCube');

            expect(result).toEqual(['Year', 'Region', 'Product']);
            expect(mockRestService.get).toHaveBeenCalledWith(
                "/Cubes('TestCube')/tm1.DimensionsStorageOrder()?$select=Name"
            );
            
            console.log('✅ getStorageDimensionOrder test passed');
        });

        test('updateStorageDimensionOrder should reorder dimensions', async () => {
            const newOrder = ['Product', 'Region', 'Year'];

            mockRestService.post.mockResolvedValue(createMockResponse({ value: -23.07 }));

            const result = await cubeService.updateStorageDimensionOrder('TestCube', newOrder);

            expect(mockRestService.post).toHaveBeenCalledWith(
                "/Cubes('TestCube')/tm1.ReorderDimensions",
                JSON.stringify({
                    'Dimensions@odata.bind': [
                        "Dimensions('Product')",
                        "Dimensions('Region')",
                        "Dimensions('Year')"
                    ]
                })
            );
            expect(result).toBe(-23.07);

            console.log('✅ updateStorageDimensionOrder test passed');
        });

        test('getRandomIntersection should traverse dimensions and pick random elements', async () => {
            // First call: getDimensionNames
            mockRestService.get.mockResolvedValueOnce(createMockResponse({
                value: [{ Name: 'Year' }, { Name: 'Region' }]
            }));
            // Second call: elements for Year
            mockRestService.get.mockResolvedValueOnce(createMockResponse({
                value: [{ Name: '2024' }, { Name: '2025' }]
            }));
            // Third call: elements for Region
            mockRestService.get.mockResolvedValueOnce(createMockResponse({
                value: [{ Name: 'North' }, { Name: 'South' }]
            }));

            const result = await cubeService.getRandomIntersection('TestCube');

            expect(result).toHaveLength(2);
            expect(mockRestService.get).toHaveBeenCalledTimes(3);

            console.log('✅ getRandomIntersection test passed');
        });

        test('getRandomIntersection with uniqueNames should format as [dim].[elem]', async () => {
            mockRestService.get.mockResolvedValueOnce(createMockResponse({
                value: [{ Name: 'Year' }]
            }));
            mockRestService.get.mockResolvedValueOnce(createMockResponse({
                value: [{ Name: '2024' }]
            }));

            const result = await cubeService.getRandomIntersection('TestCube', true);

            expect(result[0]).toBe('[Year].[2024]');

            console.log('✅ getRandomIntersection with unique names test passed');
        });
    });

    describe('Memory Management Functions', () => {
        test('load should load cube into memory', async () => {
            mockRestService.post.mockResolvedValue(createMockResponse({}));

            await cubeService.load('TestCube');

            expect(mockRestService.post).toHaveBeenCalledWith(
                "/Cubes('TestCube')/tm1.Load"
            );
            
            console.log('✅ load test passed');
        });

        test('unload should unload cube from memory', async () => {
            mockRestService.post.mockResolvedValue(createMockResponse({}));

            await cubeService.unload('TestCube');

            expect(mockRestService.post).toHaveBeenCalledWith(
                "/Cubes('TestCube')/tm1.Unload"
            );
            
            console.log('✅ unload test passed');
        });

        test('lock should lock cube', async () => {
            mockRestService.post.mockResolvedValue(createMockResponse({}));

            await cubeService.lock('TestCube');

            expect(mockRestService.post).toHaveBeenCalledWith(
                "/Cubes('TestCube')/tm1.Lock"
            );
            
            console.log('✅ lock test passed');
        });

        test('unlock should unlock cube', async () => {
            mockRestService.post.mockResolvedValue(createMockResponse({}));

            await cubeService.unlock('TestCube');

            expect(mockRestService.post).toHaveBeenCalledWith(
                "/Cubes('TestCube')/tm1.Unlock"
            );
            
            console.log('✅ unlock test passed');
        });

        test('cubeSaveData should execute TI code via ProcessService', async () => {
            // cubeSaveData creates a temp process internally, so it calls create + execute + delete
            mockRestService.post.mockResolvedValue(createMockResponse({}));
            mockRestService.delete.mockResolvedValue(createMockResponse({}));

            await cubeService.cubeSaveData('TestCube');

            // Verify ProcessService.executeTiCode was triggered (creates temp process)
            expect(mockRestService.post).toHaveBeenCalled();

            console.log('✅ cubeSaveData test passed');
        });
    });

    describe('Memory Configuration Functions', () => {
        test('getVmm should GET /Cubes()?$select=ViewStorageMaxMemory', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse({ ViewStorageMaxMemory: 256 }));

            const result = await cubeService.getVmm('TestCube');

            expect(result).toBe(256);
            expect(mockRestService.get).toHaveBeenCalledWith(
                "/Cubes('TestCube')?$select=ViewStorageMaxMemory"
            );

            console.log('✅ getVmm test passed');
        });

        test('setVmm should PATCH /Cubes() with ViewStorageMaxMemory', async () => {
            mockRestService.patch.mockResolvedValue(createMockResponse({}));

            await cubeService.setVmm('TestCube', 512);

            expect(mockRestService.patch).toHaveBeenCalledWith(
                "/Cubes('TestCube')",
                JSON.stringify({ ViewStorageMaxMemory: 512 })
            );

            console.log('✅ setVmm test passed');
        });

        test('getVmt should GET /Cubes()?$select=ViewStorageMinTime', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse({ ViewStorageMinTime: 30 }));

            const result = await cubeService.getVmt('TestCube');

            expect(result).toBe(30);
            expect(mockRestService.get).toHaveBeenCalledWith(
                "/Cubes('TestCube')?$select=ViewStorageMinTime"
            );

            console.log('✅ getVmt test passed');
        });

        test('setVmt should PATCH /Cubes() with ViewStorageMinTime', async () => {
            mockRestService.patch.mockResolvedValue(createMockResponse({}));

            await cubeService.setVmt('TestCube', 60);

            expect(mockRestService.patch).toHaveBeenCalledWith(
                "/Cubes('TestCube')",
                JSON.stringify({ ViewStorageMinTime: 60 })
            );

            console.log('✅ setVmt test passed');
        });
    });

    describe('Rules Management Functions', () => {
        test('checkRules should return errors array from response value', async () => {
            mockRestService.post.mockResolvedValue(createMockResponse({
                value: []
            }));

            const result = await cubeService.checkRules('TestCube');

            expect(Array.isArray(result)).toBe(true);
            expect(result).toEqual([]);
            expect(mockRestService.post).toHaveBeenCalledWith(
                "/Cubes('TestCube')/tm1.CheckRules"
            );

            console.log('✅ checkRules test passed');
        });

        test('updateOrCreateRules should PATCH /Cubes() with rules body', async () => {
            const rulesText = 'RULE; N: = C * 1.1; FEEDERS;';

            mockRestService.patch.mockResolvedValue(createMockResponse({}));

            await cubeService.updateOrCreateRules('TestCube', rulesText);

            // Should PATCH /Cubes('TestCube') (not /Rules) with Rules body
            expect(mockRestService.patch).toHaveBeenCalledWith(
                "/Cubes('TestCube')",
                expect.any(String)
            );

            console.log('✅ updateOrCreateRules with string test passed');
        });
    });

    describe('Error Handling', () => {
        test('should handle empty search results from server-side filter', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse({ value: [] }));

            const result = await cubeService.searchForDimensionSubstring('NonExistent');

            expect(result).toEqual({});

            console.log('✅ Empty search results handling test passed');
        });

        test('should handle empty rule search results from server-side filter', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse({ value: [] }));

            const result = await cubeService.searchForRuleSubstring('RULE');

            expect(result).toEqual([]);

            console.log('✅ No rules handling test passed');
        });
    });

    describe('Integration Tests', () => {
        test('should perform complete cube memory management workflow', async () => {
            mockRestService.post.mockResolvedValue(createMockResponse({}));
            mockRestService.patch.mockResolvedValue(createMockResponse({}));
            mockRestService.get.mockResolvedValue(createMockResponse({ ViewStorageMaxMemory: 128 }));
            mockRestService.delete.mockResolvedValue(createMockResponse({}));

            // Load cube
            await cubeService.load('TestCube');

            // Set memory configuration
            await cubeService.setVmm('TestCube', 256);
            await cubeService.setVmt('TestCube', 30);

            // Verify settings
            const vmm = await cubeService.getVmm('TestCube');
            expect(vmm).toBe(128);

            console.log('✅ Complete memory management workflow test passed');
        });
    });
});