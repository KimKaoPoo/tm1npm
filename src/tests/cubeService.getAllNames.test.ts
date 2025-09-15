/**
 * Test for CubeService.getAllNames method
 * Testing API consistency and functionality for issue #3
 */

import { CubeService } from '../services/CubeService';
import { RestService } from '../services/RestService';
import { TM1RestException } from '../exceptions/TM1Exception';

describe('CubeService.getAllNames', () => {
    let cubeService: CubeService;
    let mockRestService: jest.Mocked<RestService>;
    
    const mockResponse = (data: any) => ({
        data: data,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: { headers: {} }
    } as any);

    beforeEach(() => {
        mockRestService = {
            get: jest.fn(),
            post: jest.fn(),
            patch: jest.fn(),
            put: jest.fn(),
            delete: jest.fn()
        } as any;

        cubeService = new CubeService(mockRestService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('Basic Functionality', () => {
        test('should get all cube names including control cubes', async () => {
            const cubeNamesData = {
                value: [
                    { Name: 'SalesCube' },
                    { Name: 'BudgetCube' },
                    { Name: '}Stats' },
                    { Name: '}ClientSettings' },
                    { Name: '}ElementAttributes_Product' }
                ]
            };
            mockRestService.get.mockResolvedValue(mockResponse(cubeNamesData));

            const result = await cubeService.getAllNames();
            
            expect(result).toEqual([
                'SalesCube', 
                'BudgetCube', 
                '}Stats', 
                '}ClientSettings',
                '}ElementAttributes_Product'
            ]);
            expect(mockRestService.get).toHaveBeenCalledWith("/Cubes?$select=Name");
        });

        test('should get cube names excluding control cubes', async () => {
            const cubeNamesData = {
                value: [
                    { Name: 'SalesCube' },
                    { Name: 'BudgetCube' },
                    { Name: 'ForecastCube' }
                ]
            };
            mockRestService.get.mockResolvedValue(mockResponse(cubeNamesData));

            const result = await cubeService.getAllNames(true);
            
            expect(result).toEqual(['SalesCube', 'BudgetCube', 'ForecastCube']);
            expect(mockRestService.get).toHaveBeenCalledWith(
                "/Cubes?$select=Name&$filter=not startswith(Name,'}')"
            );
        });

        test('should return empty array when no cubes exist', async () => {
            const emptyData = { value: [] };
            mockRestService.get.mockResolvedValue(mockResponse(emptyData));

            const result = await cubeService.getAllNames();
            
            expect(result).toEqual([]);
            expect(mockRestService.get).toHaveBeenCalledWith("/Cubes?$select=Name");
        });
    });

    describe('API Consistency', () => {
        test('should have same method signature as DimensionService.getAllNames', () => {
            // Verify method exists and has correct signature
            expect(typeof cubeService.getAllNames).toBe('function');
            // Note: TypeScript default parameters don't count toward .length
            expect(cubeService.getAllNames.length).toBe(0); // Default parameter doesn't count
        });

        test('should return string array not object array', async () => {
            const cubeNamesData = {
                value: [
                    { Name: 'TestCube1' },
                    { Name: 'TestCube2' }
                ]
            };
            mockRestService.get.mockResolvedValue(mockResponse(cubeNamesData));

            const result = await cubeService.getAllNames();
            
            // Should return array of strings, not objects
            expect(Array.isArray(result)).toBe(true);
            expect(typeof result[0]).toBe('string');
            expect(typeof result[1]).toBe('string');
            expect(result).toEqual(['TestCube1', 'TestCube2']);
        });

        test('should use efficient $select=Name query', async () => {
            const cubeNamesData = { value: [{ Name: 'TestCube' }] };
            mockRestService.get.mockResolvedValue(mockResponse(cubeNamesData));

            await cubeService.getAllNames();
            
            // Should use $select=Name for efficiency (not full object expansion)
            expect(mockRestService.get).toHaveBeenCalledWith("/Cubes?$select=Name");
        });
    });

    describe('Parameter Handling', () => {
        test('should handle skipControlCubes=false explicitly', async () => {
            const cubeNamesData = { value: [{ Name: 'TestCube' }] };
            mockRestService.get.mockResolvedValue(mockResponse(cubeNamesData));

            await cubeService.getAllNames(false);
            
            expect(mockRestService.get).toHaveBeenCalledWith("/Cubes?$select=Name");
        });

        test('should handle skipControlCubes=true', async () => {
            const cubeNamesData = { value: [{ Name: 'TestCube' }] };
            mockRestService.get.mockResolvedValue(mockResponse(cubeNamesData));

            await cubeService.getAllNames(true);
            
            expect(mockRestService.get).toHaveBeenCalledWith(
                "/Cubes?$select=Name&$filter=not startswith(Name,'}')"
            );
        });

        test('should default to including control cubes when no parameter provided', async () => {
            const cubeNamesData = { value: [{ Name: 'TestCube' }] };
            mockRestService.get.mockResolvedValue(mockResponse(cubeNamesData));

            await cubeService.getAllNames();
            
            // Should not include filter when no parameter (default behavior)
            expect(mockRestService.get).toHaveBeenCalledWith("/Cubes?$select=Name");
        });
    });

    describe('Error Handling', () => {
        test('should handle TM1 REST exceptions', async () => {
            const error = new TM1RestException('Server not accessible', 503);
            mockRestService.get.mockRejectedValue(error);

            await expect(cubeService.getAllNames()).rejects.toThrow('Server not accessible');
        });

        test('should handle network errors', async () => {
            const error = new Error('Network timeout');
            mockRestService.get.mockRejectedValue(error);

            await expect(cubeService.getAllNames()).rejects.toThrow('Network timeout');
        });

        test('should handle invalid response format', async () => {
            // Malformed response without value property
            const invalidResponse = mockResponse({ invalid: 'format' });
            mockRestService.get.mockResolvedValue(invalidResponse);

            await expect(cubeService.getAllNames()).rejects.toThrow();
        });
    });

    describe('Edge Cases', () => {
        test('should handle cubes with special characters in names', async () => {
            const cubeNamesData = {
                value: [
                    { Name: "Cube's & \"Special\" Name" },
                    { Name: 'Cube with spaces' },
                    { Name: 'Cube-with-dashes' },
                    { Name: 'Cube_with_underscores' }
                ]
            };
            mockRestService.get.mockResolvedValue(mockResponse(cubeNamesData));

            const result = await cubeService.getAllNames();
            
            expect(result).toEqual([
                "Cube's & \"Special\" Name",
                'Cube with spaces',
                'Cube-with-dashes', 
                'Cube_with_underscores'
            ]);
        });

        test('should handle large numbers of cubes efficiently', async () => {
            const largeCubeList = Array.from({ length: 1000 }, (_, i) => ({ Name: `Cube${i}` }));
            const cubeNamesData = { value: largeCubeList };
            mockRestService.get.mockResolvedValue(mockResponse(cubeNamesData));

            const start = Date.now();
            const result = await cubeService.getAllNames();
            const duration = Date.now() - start;
            
            expect(result).toHaveLength(1000);
            expect(duration).toBeLessThan(100); // Should be fast since it's just array mapping
        });

        test('should handle mixed control and model cubes correctly', async () => {
            const mixedCubesData = {
                value: [
                    { Name: 'ModelCube1' },
                    { Name: '}ControlCube1' },
                    { Name: 'ModelCube2' },
                    { Name: '}Stats' },
                    { Name: 'ModelCube3' },
                    { Name: '}ElementAttributes_Dim' }
                ]
            };
            mockRestService.get.mockResolvedValue(mockResponse(mixedCubesData));

            // Test including all cubes
            const allCubes = await cubeService.getAllNames(false);
            expect(allCubes).toHaveLength(6);
            expect(allCubes).toContain('}ControlCube1');
            expect(allCubes).toContain('ModelCube1');

            // Test excluding control cubes
            const modelCubesData = {
                value: [
                    { Name: 'ModelCube1' },
                    { Name: 'ModelCube2' },
                    { Name: 'ModelCube3' }
                ]
            };
            mockRestService.get.mockResolvedValue(mockResponse(modelCubesData));
            
            const modelCubes = await cubeService.getAllNames(true);
            expect(modelCubes).toHaveLength(3);
            expect(modelCubes.every(name => !name.startsWith('}'))).toBe(true);
        });
    });

    describe('Integration Patterns', () => {
        test('should work with typical usage patterns', async () => {
            // First call - get model cubes (filtered response)
            const modelCubesData = {
                value: [
                    { Name: 'Sales' },
                    { Name: 'Budget' }
                ]
            };
            mockRestService.get.mockResolvedValueOnce(mockResponse(modelCubesData));

            // Typical usage: get model cubes for user display
            const modelCubes = await cubeService.getAllNames(true);
            expect(modelCubes).toEqual(['Sales', 'Budget']);

            // Second call - get all cubes (unfiltered response)
            const allCubesData = {
                value: [
                    { Name: 'Sales' },
                    { Name: 'Budget' },
                    { Name: '}Stats' }
                ]
            };
            mockRestService.get.mockResolvedValueOnce(mockResponse(allCubesData));

            // Typical usage: get all cubes for admin operations
            const allCubes = await cubeService.getAllNames();
            expect(allCubes).toEqual(['Sales', 'Budget', '}Stats']);
        });

        test('should support concurrent calls', async () => {
            const cubeNamesData = { value: [{ Name: 'TestCube' }] };
            mockRestService.get.mockResolvedValue(mockResponse(cubeNamesData));

            // Multiple concurrent calls should work
            const promises = [
                cubeService.getAllNames(),
                cubeService.getAllNames(true),
                cubeService.getAllNames(false)
            ];

            const results = await Promise.all(promises);
            
            expect(results).toHaveLength(3);
            expect(mockRestService.get).toHaveBeenCalledTimes(3);
        });
    });
});