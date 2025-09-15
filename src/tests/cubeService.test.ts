/**
 * CubeService Tests for tm1npm
 * Comprehensive tests for TM1 Cube operations with proper mocking
 */

import { CubeService } from '../services/CubeService';
import { RestService } from '../services/RestService';
import { Cube } from '../objects/Cube';
import { TM1RestException } from '../exceptions/TM1Exception';

// Helper function to create mock AxiosResponse
const createMockResponse = (data: any, status: number = 200) => ({
    data,
    status,
    statusText: status === 200 ? 'OK' : status === 201 ? 'Created' : status === 204 ? 'No Content' : 'Error',
    headers: {},
    config: {} as any
});

describe('CubeService Tests', () => {
    let cubeService: CubeService;
    let mockRestService: jest.Mocked<RestService>;

    beforeEach(() => {
        // Create comprehensive mock for RestService
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

        cubeService = new CubeService(mockRestService);
    });

    describe('Cube Retrieval Operations', () => {
        test('should get all cube names', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse({
                value: [
                    { Name: 'SalesCube', Dimensions: [{ Name: 'Time' }, { Name: 'Account' }] },
                    { Name: 'BudgetCube', Dimensions: [{ Name: 'Time' }, { Name: 'Version' }] },
                    { Name: 'ActualsCube', Dimensions: [{ Name: 'Time' }, { Name: 'Product' }] }
                ]
            }));

            const cubes = await cubeService.getAll();
            
            expect(Array.isArray(cubes)).toBe(true);
            expect(cubes.length).toBe(3);
            expect(cubes[0].name).toBe('SalesCube');
            expect(cubes[1].name).toBe('BudgetCube');
            expect(cubes[2].name).toBe('ActualsCube');
            expect(mockRestService.get).toHaveBeenCalledWith("/Cubes?$expand=Dimensions($select=Name)");
            
            console.log('✅ Cube names retrieved successfully');
        });

        test('should get all cubes with skip control cubes', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse({
                value: [
                    { Name: 'SalesCube', Dimensions: [{ Name: 'Time' }, { Name: 'Account' }] },
                    { Name: 'BudgetCube', Dimensions: [{ Name: 'Time' }, { Name: 'Version' }] }
                ]
            }));

            const cubes = await cubeService.getModelCubes(); // skip control cubes
            
            expect(Array.isArray(cubes)).toBe(true);
            expect(cubes.length).toBe(2);
            expect(cubes[0].name).toBe('SalesCube');
            expect(cubes[1].name).toBe('BudgetCube');
            expect(mockRestService.get).toHaveBeenCalledWith("/ModelCubes()?$expand=Dimensions($select=Name)");
            
            console.log('✅ Model cubes retrieved successfully');
        });

        test('should get a specific cube if it exists', async () => {
            mockRestService.get.mockResolvedValueOnce(createMockResponse({
                value: [{ 
                    Name: 'SalesCube', 
                    Dimensions: [{ Name: 'Time' }, { Name: 'Product' }, { Name: 'Measure' }]
                }]
            }));

            mockRestService.get.mockResolvedValueOnce(createMockResponse({
                Name: 'SalesCube',
                Dimensions: [{ Name: 'Time' }, { Name: 'Product' }, { Name: 'Measure' }]
            }));

            const cubes = await cubeService.getAll();
            expect(cubes.length).toBe(1);

            const cube = await cubeService.get('SalesCube');
            expect(cube).toBeDefined();
            expect(cube.name).toBe('SalesCube');
            expect(cube.dimensions.length).toBe(3);
            
            console.log('✅ Specific cube retrieved successfully');
        });

        test('should check if a cube exists', async () => {
            // Test existing cube by trying to get it
            mockRestService.get.mockResolvedValue(createMockResponse({
                Name: 'SalesCube',
                Dimensions: [{ Name: 'Time' }, { Name: 'Account' }]
            }));

            try {
                const cube = await cubeService.get('SalesCube');
                expect(cube).toBeDefined();
                expect(cube.name).toBe('SalesCube');
                console.log('✅ Cube existence check working via get method');
            } catch (error) {
                fail('Cube should exist');
            }
        });

        test('should check if a cube does not exist', async () => {
            // Test non-existing cube by checking for 404 error
            const mockError = new TM1RestException('Cube not found', 404, { status: 404 });
            mockRestService.get.mockRejectedValue(mockError);

            try {
                await cubeService.get('NonExistentCube');
                fail('Should have thrown an error for non-existent cube');
            } catch (error: any) {
                expect(error).toBeInstanceOf(TM1RestException);
                expect(error.status).toBe(404);
                console.log('✅ Cube non-existence check working via error handling');
            }
        });
    });

    describe('Cube Dimension Operations', () => {
        test('should get dimensions for existing cubes', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse({
                value: [
                    { 
                        Name: 'SalesCube', 
                        Dimensions: [
                            { Name: 'Time' }, 
                            { Name: 'Product' }, 
                            { Name: 'Measure' }
                        ] 
                    }
                ]
            }));

            const cubes = await cubeService.getModelCubes();
            
            expect(cubes[0].dimensions).toBeDefined();
            expect(cubes[0].dimensions.length).toBe(3);
            expect(cubes[0].dimensions[0]).toBe('Time');
            
            console.log('✅ Cube dimensions retrieved successfully');
        });

        test('should get dimension names for cube', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse({
                Name: 'SalesCube',
                Dimensions: [
                    { Name: 'Time' }, 
                    { Name: 'Product' }, 
                    { Name: 'Account' },
                    { Name: 'Measure' }
                ]
            }));

            const cube = await cubeService.get('SalesCube');
            
            expect(cube.dimensions.includes('Time')).toBe(true);
            expect(cube.dimensions.includes('Product')).toBe(true);
            expect(cube.dimensions.includes('Account')).toBe(true);
            expect(cube.dimensions.includes('Measure')).toBe(true);
            
            console.log('✅ Dimension names for cube working');
        });

        test('should get measure dimension for cube', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse({
                Name: 'SalesCube',
                Dimensions: [
                    { Name: 'Time' }, 
                    { Name: 'Product' }, 
                    { Name: 'Measure' }
                ]
            }));

            const measureDimension = await cubeService.getMeasureDimension('SalesCube');
            
            expect(measureDimension).toBe('Measure');
            
            console.log('✅ Measure dimension retrieval working');
        });
    });

    describe('Cube Data Operations', () => {
        test('should handle cube cell operations', async () => {
            // Mock cube retrieval for context
            mockRestService.get.mockResolvedValue(createMockResponse({
                Name: 'SalesCube',
                Dimensions: [{ Name: 'Time' }, { Name: 'Account' }, { Name: 'Measure' }]
            }));

            const cube = await cubeService.get('SalesCube');
            
            expect(cube.name).toBe('SalesCube');
            expect(cube.dimensions.length).toBe(3);
            
            // CellService operations would be tested separately
            console.log('✅ Cube cell operations context working');
        });

        test('should get cube size information', async () => {
            // Mock cube count
            mockRestService.get.mockResolvedValue(createMockResponse('25'));

            const cubeCount = await cubeService.getNumberOfCubes();
            
            expect(typeof cubeCount).toBe('number');
            expect(cubeCount).toBe(25);
            
            console.log('✅ Cube size information working');
        });

        test('should get model cubes count', async () => {
            // Mock model cubes count
            mockRestService.get.mockResolvedValue(createMockResponse({
                '@odata.count': '15'
            }));

            const modelCubeCount = await cubeService.getNumberOfCubes(true);
            
            expect(typeof modelCubeCount).toBe('number');
            expect(modelCubeCount).toBe(15);
            
            console.log('✅ Model cubes count working');
        });
    });

    describe('Cube Rule Operations', () => {
        test('should handle cube rules retrieval', async () => {
            // Mock cube with rules context
            mockRestService.get.mockResolvedValue(createMockResponse({
                Name: 'SalesCube',
                Dimensions: [{ Name: 'Time' }, { Name: 'Account' }, { Name: 'Measure' }]
            }));

            const cube = await cubeService.get('SalesCube');
            
            expect(cube.name).toBe('SalesCube');
            expect(cube.hasRules).toBeDefined(); // Rules are handled by the Cube object
            
            console.log('✅ Cube rules context working');
        });
    });

    describe('Cube Error Handling', () => {
        test('should handle invalid cube names gracefully', async () => {
            mockRestService.get.mockRejectedValue({
                response: { status: 400, statusText: 'Bad Request' }
            });

            await expect(cubeService.get('')).rejects.toMatchObject({
                response: { status: 400 }
            });
            
            console.log('✅ Invalid cube names handled gracefully');
        });

        test('should handle network errors gracefully', async () => {
            mockRestService.get.mockRejectedValue({
                code: 'ECONNREFUSED'
            });

            await expect(cubeService.getAll()).rejects.toMatchObject({
                code: 'ECONNREFUSED'
            });
            
            console.log('✅ Network errors handled gracefully');
        });

        test('should handle authentication errors', async () => {
            mockRestService.get.mockRejectedValue({
                response: { status: 401, statusText: 'Unauthorized' }
            });

            await expect(cubeService.getAll()).rejects.toMatchObject({
                response: { status: 401 }
            });
            
            console.log('✅ Authentication errors handled gracefully');
        });
    });

    describe('Cube Service Edge Cases', () => {
        test('should handle empty cube lists', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse({
                value: []
            }));

            const cubes = await cubeService.getAll();
            
            expect(Array.isArray(cubes)).toBe(true);
            expect(cubes.length).toBe(0);
            
            console.log('✅ Empty cube lists handled correctly');
        });

        test('should handle concurrent cube operations', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse({
                value: [{ Name: 'TestCube', Dimensions: [{ Name: 'Time' }] }]
            }));

            const operations = [
                cubeService.getAll(),
                cubeService.getAll(),
                cubeService.getAll()
            ];

            const results = await Promise.allSettled(operations);
            const successful = results.filter(r => r.status === 'fulfilled');
            
            expect(successful.length).toBe(3);
            console.log('✅ Concurrent operations handled successfully');
        });

        test('should handle large cube lists efficiently', async () => {
            const largeCubeList = Array(1000).fill(null).map((_, i) => ({
                Name: `Cube${i}`,
                Dimensions: [{ Name: 'Time' }, { Name: 'Account' }]
            }));

            mockRestService.get.mockResolvedValue(createMockResponse({
                value: largeCubeList
            }));

            const startTime = Date.now();
            const cubes = await cubeService.getAll();
            const endTime = Date.now();
            
            expect(cubes.length).toBe(1000);
            expect(endTime - startTime).toBeLessThan(1000); // Should be fast with mocking
            
            console.log('✅ Large cube lists handled efficiently');
        });
    });

    describe('Cube Service Integration', () => {
        test('should maintain consistent data across operations', async () => {
            const cubeData = {
                value: [
                    { Name: 'SalesCube', Dimensions: [{ Name: 'Time' }] },
                    { Name: 'BudgetCube', Dimensions: [{ Name: 'Version' }] }
                ]
            };

            mockRestService.get.mockResolvedValue(createMockResponse(cubeData));

            const cubes1 = await cubeService.getAll();
            const cubes2 = await cubeService.getAll();
            
            expect(cubes1.length).toEqual(cubes2.length);
            expect(cubes1[0].name).toEqual(cubes2[0].name);
            expect(cubes1[1].name).toEqual(cubes2[1].name);
            
            console.log('✅ Data consistency maintained across operations');
        });

        test('should handle cube dimension consistency', async () => {
            const salesCube = {
                Name: 'SalesCube',
                Dimensions: [
                    { Name: 'Time' }, 
                    { Name: 'Product' }, 
                    { Name: 'Measure' }
                ]
            };

            mockRestService.get.mockResolvedValueOnce(createMockResponse({
                value: [{ 
                    Name: 'SalesCube', 
                    Dimensions: [
                        { Name: 'Time' }, 
                        { Name: 'Product' }, 
                        { Name: 'Measure' }
                    ]
                }]
            }));

            mockRestService.get.mockResolvedValueOnce(createMockResponse(salesCube));

            const cubes = await cubeService.getModelCubes();
            expect(cubes.length).toBe(1);

            const cube = await cubeService.get('SalesCube');
            expect(cube.dimensions.length).toBe(3);
            expect(cube.dimensions[2]).toBe('Measure'); // Last dimension is measure
            
            console.log('✅ Cube dimension consistency maintained');
        });
    });

    describe('Cube View Operations', () => {
        test('should handle cube view operations', async () => {
            // Mock cube context for view operations
            mockRestService.get.mockResolvedValue(createMockResponse({
                value: [{ 
                    Name: 'SalesCube', 
                    Dimensions: [
                        { Name: 'Time' }, 
                        { Name: 'Product' }, 
                        { Name: 'Measure' }
                    ] 
                }]
            }));

            const cubes = await cubeService.getModelCubes();
            
            expect(cubes[0].name).toBe('SalesCube');
            expect(cubes[0].dimensions.length).toBe(3);
            
            // ViewService operations would be tested separately through cubeService.views
            expect(cubeService.views).toBeDefined();
            
            console.log('✅ Cube view operations context working');
        });
    });

    describe('Cube CRUD Operations', () => {
        test('should handle cube creation lifecycle', async () => {
            const testCube = new Cube('TestCube', ['Time', 'Account', 'Measure']);

            // Mock cube creation
            mockRestService.post.mockResolvedValue(createMockResponse({}, 201));

            const createResult = await cubeService.create(testCube);
            expect(createResult.status).toBe(201);
            
            // Mock cube retrieval after creation to verify it exists
            mockRestService.get.mockResolvedValueOnce(createMockResponse({
                Name: 'TestCube',
                Dimensions: [{ Name: 'Time' }, { Name: 'Account' }, { Name: 'Measure' }]
            }));

            const retrievedCube = await cubeService.get('TestCube');
            expect(retrievedCube.name).toBe('TestCube');
            expect(retrievedCube.dimensions.length).toBe(3);
            
            console.log('✅ Cube creation lifecycle handled successfully');
        });
    });
});