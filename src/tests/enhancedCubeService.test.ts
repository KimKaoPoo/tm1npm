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
        test('searchForDimensionSubstring should find cubes with matching dimensions', async () => {
            const mockCubes = [
                { name: 'SalesCube', dimensions: ['Year', 'Region', 'Product'] },
                { name: 'BudgetCube', dimensions: ['Year', 'Department', 'Account'] },
                { name: 'PlanningCube', dimensions: ['Month', 'Region', 'Scenario'] }
            ];

            jest.spyOn(cubeService, 'getAll').mockResolvedValue(mockCubes as any);

            const result = await cubeService.searchForDimensionSubstring('Reg');

            expect(result).toEqual({
                'SalesCube': ['Region'],
                'PlanningCube': ['Region']
            });
            
            console.log('✅ searchForDimensionSubstring test passed');
        });

        test('searchForRuleSubstring should find cubes with matching rules', async () => {
            const mockCubes = [
                { 
                    name: 'TestCube1', 
                    dimensions: ['Year'], 
                    rules: { text: 'RULE; N: C = 1; FEEDERS;' }
                },
                { 
                    name: 'TestCube2', 
                    dimensions: ['Month'], 
                    rules: { text: 'RULE; S: C = "Test"; FEEDERS;' }
                }
            ];

            jest.spyOn(cubeService, 'getAll').mockResolvedValue(mockCubes as any);

            const result = await cubeService.searchForRuleSubstring('RULE');

            expect(result).toHaveLength(2);
            expect(result[0].name).toBe('TestCube1');
            expect(result[1].name).toBe('TestCube2');
            
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
                "/Cubes('TestCube')/Dimensions?$select=Name"
            );
            
            console.log('✅ getStorageDimensionOrder test passed');
        });

        test('updateStorageDimensionOrder should reorder dimensions', async () => {
            const newOrder = ['Product', 'Region', 'Year'];

            mockRestService.post.mockResolvedValue(createMockResponse({}));

            await cubeService.updateStorageDimensionOrder('TestCube', newOrder);

            expect(mockRestService.post).toHaveBeenCalledWith(
                "/Cubes('TestCube')/tm1.UpdateStorageOrder",
                { Dimensions: newOrder }
            );
            
            console.log('✅ updateStorageDimensionOrder test passed');
        });

        test('getRandomIntersection should return random intersection', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse({
                value: ['2024', 'North', 'ProductA']
            }));

            const result = await cubeService.getRandomIntersection('TestCube');

            expect(result).toEqual(['2024', 'North', 'ProductA']);
            expect(mockRestService.get).toHaveBeenCalledWith(
                "/Cubes('TestCube')/tm1.GetRandomIntersection"
            );
            
            console.log('✅ getRandomIntersection test passed');
        });

        test('getRandomIntersection with unique names should include uniqueNames parameter', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse({
                value: ['[Year].[2024]', '[Region].[North]', '[Product].[ProductA]']
            }));

            const result = await cubeService.getRandomIntersection('TestCube', true);

            expect(result).toEqual(['[Year].[2024]', '[Region].[North]', '[Product].[ProductA]']);
            expect(mockRestService.get).toHaveBeenCalledWith(
                "/Cubes('TestCube')/tm1.GetRandomIntersection?uniqueNames=true"
            );
            
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

        test('cubeSaveData should save cube data to disk', async () => {
            mockRestService.post.mockResolvedValue(createMockResponse({}));

            await cubeService.cubeSaveData('TestCube');

            expect(mockRestService.post).toHaveBeenCalledWith(
                "/Cubes('TestCube')/tm1.SaveData"
            );
            
            console.log('✅ cubeSaveData test passed');
        });
    });

    describe('Memory Configuration Functions', () => {
        test('getVmm should get view storage max memory', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse('256'));

            const result = await cubeService.getVmm('TestCube');

            expect(result).toBe(256);
            expect(mockRestService.get).toHaveBeenCalledWith(
                "/Cubes('TestCube')/ViewStorageMaxMemory/$value"
            );
            
            console.log('✅ getVmm test passed');
        });

        test('setVmm should set view storage max memory', async () => {
            mockRestService.patch.mockResolvedValue(createMockResponse({}));

            await cubeService.setVmm('TestCube', 512);

            expect(mockRestService.patch).toHaveBeenCalledWith(
                "/Cubes('TestCube')/ViewStorageMaxMemory",
                { Value: 512 }
            );
            
            console.log('✅ setVmm test passed');
        });

        test('getVmt should get view storage min time', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse('30'));

            const result = await cubeService.getVmt('TestCube');

            expect(result).toBe(30);
            expect(mockRestService.get).toHaveBeenCalledWith(
                "/Cubes('TestCube')/ViewStorageMinTime/$value"
            );
            
            console.log('✅ getVmt test passed');
        });

        test('setVmt should set view storage min time', async () => {
            mockRestService.patch.mockResolvedValue(createMockResponse({}));

            await cubeService.setVmt('TestCube', 60);

            expect(mockRestService.patch).toHaveBeenCalledWith(
                "/Cubes('TestCube')/ViewStorageMinTime",
                { Value: 60 }
            );
            
            console.log('✅ setVmt test passed');
        });
    });

    describe('Rules Management Functions', () => {
        test('checkRules should validate cube rules syntax', async () => {
            mockRestService.post.mockResolvedValue(createMockResponse({
                Errors: [],
                Valid: true
            }));

            const result = await cubeService.checkRules('TestCube');

            expect(result.data.Valid).toBe(true);
            expect(mockRestService.post).toHaveBeenCalledWith(
                "/Cubes('TestCube')/tm1.CheckRules"
            );
            
            console.log('✅ checkRules test passed');
        });

        test('updateOrCreateRules should update rules with string input', async () => {
            const rulesText = 'RULE; N: = C * 1.1; FEEDERS;';

            mockRestService.patch.mockResolvedValue(createMockResponse({}));

            await cubeService.updateOrCreateRules('TestCube', rulesText);

            expect(mockRestService.patch).toHaveBeenCalledWith(
                "/Cubes('TestCube')/Rules",
                { Text: rulesText }
            );
            
            console.log('✅ updateOrCreateRules with string test passed');
        });

        test('updateOrCreateRules should create rules if update fails', async () => {
            const rulesText = 'RULE; N: = C * 1.1; FEEDERS;';

            mockRestService.patch.mockRejectedValue(new Error('Not Found'));
            mockRestService.post.mockResolvedValue(createMockResponse({}));

            await cubeService.updateOrCreateRules('TestCube', rulesText);

            expect(mockRestService.patch).toHaveBeenCalled();
            expect(mockRestService.post).toHaveBeenCalledWith(
                "/Cubes('TestCube')/Rules",
                { Text: rulesText }
            );
            
            console.log('✅ updateOrCreateRules fallback to create test passed');
        });
    });

    describe('Error Handling', () => {
        test('should handle empty search results', async () => {
            const mockCubes = [
                { name: 'TestCube', dimensions: ['Year', 'Month'], rules: null }
            ];

            jest.spyOn(cubeService, 'getAll').mockResolvedValue(mockCubes as any);

            const result = await cubeService.searchForDimensionSubstring('NonExistent');

            expect(result).toEqual({});
            
            console.log('✅ Empty search results handling test passed');
        });

        test('should handle cubes without rules in rule search', async () => {
            const mockCubes = [
                { name: 'TestCube', dimensions: ['Year'], rules: null }
            ];

            jest.spyOn(cubeService, 'getAll').mockResolvedValue(mockCubes as any);

            const result = await cubeService.searchForRuleSubstring('RULE');

            expect(result).toEqual([]);
            
            console.log('✅ No rules handling test passed');
        });

        test('should handle invalid memory values gracefully', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse('invalid'));

            const result = await cubeService.getVmm('TestCube');

            expect(result).toBe(0);
            
            console.log('✅ Invalid memory value handling test passed');
        });
    });

    describe('Integration Tests', () => {
        test('should perform complete cube memory management workflow', async () => {
            mockRestService.post.mockResolvedValue(createMockResponse({}));
            mockRestService.patch.mockResolvedValue(createMockResponse({}));
            mockRestService.get.mockResolvedValue(createMockResponse('128'));

            // Load cube
            await cubeService.load('TestCube');
            
            // Set memory configuration
            await cubeService.setVmm('TestCube', 256);
            await cubeService.setVmt('TestCube', 30);
            
            // Verify settings
            const vmm = await cubeService.getVmm('TestCube');
            
            // Save and unload
            await cubeService.cubeSaveData('TestCube');
            await cubeService.unload('TestCube');

            expect(mockRestService.post).toHaveBeenCalledTimes(3); // load, save, unload
            expect(mockRestService.patch).toHaveBeenCalledTimes(2); // set vmm, set vmt
            expect(vmm).toBe(128);
            
            console.log('✅ Complete memory management workflow test passed');
        });
    });
});