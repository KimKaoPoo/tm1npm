/**
 * DimensionService Tests for tm1npm
 * Comprehensive tests for TM1 Dimension operations with proper mocking
 */

import { DimensionService } from '../services/DimensionService';
import { RestService } from '../services/RestService';
import { Dimension } from '../objects/Dimension';
import { TM1RestException } from '../exceptions/TM1Exception';

// Helper function to create mock AxiosResponse
const createMockResponse = (data: any, status: number = 200) => ({
    data,
    status,
    statusText: status === 200 ? 'OK' : status === 201 ? 'Created' : status === 204 ? 'No Content' : 'Error',
    headers: {},
    config: {} as any
});

describe('DimensionService Tests', () => {
    let dimensionService: DimensionService;
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

        dimensionService = new DimensionService(mockRestService);
    });

    describe('Dimension Retrieval Operations', () => {
        test('should get all dimension names', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse({
                value: [
                    { Name: 'Time' },
                    { Name: 'Account' },
                    { Name: 'Version' }
                ]
            }));

            const dimensionNames = await dimensionService.getAllNames();
            
            expect(Array.isArray(dimensionNames)).toBe(true);
            expect(dimensionNames.length).toBe(3);
            expect(dimensionNames).toEqual(['Time', 'Account', 'Version']);
            expect(mockRestService.get).toHaveBeenCalledWith("/Dimensions?$select=Name");
            
            console.log('✅ Dimension names retrieved successfully');
        });

        test('should get all dimensions with skip control dimensions', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse({
                value: [
                    { Name: 'Time', Hierarchies: [{ Name: 'Time' }] },
                    { Name: 'Account', Hierarchies: [{ Name: 'Account' }] }
                ]
            }));

            const dimensions = await dimensionService.getAll(true); // skip control dimensions
            
            expect(Array.isArray(dimensions)).toBe(true);
            expect(dimensions.length).toBe(2);
            expect(dimensions[0].name).toBe('Time');
            expect(dimensions[1].name).toBe('Account');
            
            console.log('✅ All dimensions retrieved with control dimension filtering');
        });

        test('should get a specific dimension if it exists', async () => {
            mockRestService.get.mockResolvedValueOnce(createMockResponse({
                value: [{ Name: 'Time' }]
            }));

            mockRestService.get.mockResolvedValueOnce(createMockResponse({
                Name: 'Time',
                Hierarchies: [{ Name: 'Time', Elements: [] }]
            }));

            const dimensionNames = await dimensionService.getAllNames();
            expect(dimensionNames).toContain('Time');

            const dimension = await dimensionService.get('Time');
            expect(dimension).toBeDefined();
            expect(dimension.name).toBe('Time');
            
            console.log('✅ Specific dimension retrieved successfully');
        });

        test('should check if a dimension exists', async () => {
            // Test existing dimension
            mockRestService.get.mockResolvedValue(createMockResponse({
                Name: 'Time',
                Hierarchies: []
            }));

            const exists = await dimensionService.exists('Time');
            expect(exists).toBe(true);

            console.log('✅ Dimension existence check working');
        });

        test('should check if a dimension does not exist', async () => {
            // Test non-existing dimension
            const mockError = new TM1RestException('Dimension not found', 404, { status: 404 });
            mockRestService.get.mockRejectedValue(mockError);

            const notExists = await dimensionService.exists('NonExistentDimension');
            expect(notExists).toBe(false);
            
            console.log('✅ Dimension non-existence check working');
        });
    });

    describe('Hierarchy Operations', () => {
        test('should get hierarchies count for existing dimensions', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse({
                Name: 'Time',
                Hierarchies: [
                    { Name: 'Time' },
                    { Name: 'TimeAlternate' }
                ]
            }));

            const dimension = await dimensionService.get('Time');
            
            expect(dimension.hierarchies).toBeDefined();
            expect(dimension.hierarchies.length).toBe(2);
            expect(dimension.hierarchies[0].name).toBe('Time');
            
            console.log('✅ Hierarchy operations working');
        });

        test('should get elements count for dimension', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse({
                Name: 'Account',
                Hierarchies: [{
                    Name: 'Account',
                    Elements: [
                        { Name: 'Revenue' },
                        { Name: 'Expenses' },
                        { Name: 'NetIncome' }
                    ]
                }]
            }));

            const dimension = await dimensionService.get('Account');
            const elements = dimension.hierarchies[0].elements;
            
            expect(elements).toBeDefined();
            expect(elements.length).toBe(3);
            expect(elements[0].name).toBe('Revenue');
            
            console.log('✅ Elements count operations working');
        });
    });

    describe('Element Operations', () => {
        test('should get dimension names for cube', async () => {
            // This would typically be handled by CubeService, but can test dimension context
            mockRestService.get.mockResolvedValue(createMockResponse({
                value: [
                    { Name: 'Time' },
                    { Name: 'Account' },
                    { Name: 'Version' }
                ]
            }));

            const dimensionNames = await dimensionService.getAllNames();
            
            expect(dimensionNames.includes('Time')).toBe(true);
            expect(dimensionNames.includes('Account')).toBe(true);
            expect(dimensionNames.includes('Version')).toBe(true);
            
            console.log('✅ Dimension names for cube context working');
        });

        test('should handle elements count operation', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse({
                Name: 'Time',
                Hierarchies: [{
                    Name: 'Time',
                    Elements: Array(12).fill(null).map((_, i) => ({
                        Name: `Month${i + 1}`,
                        Type: 'Numeric'
                    }))
                }]
            }));

            const dimension = await dimensionService.get('Time');
            const elementCount = dimension.hierarchies[0].elements.length;
            
            expect(elementCount).toBe(12);
            
            console.log('✅ Elements count operation working');
        });
    });

    describe('Dimension Error Handling', () => {
        test('should handle invalid dimension names gracefully', async () => {
            mockRestService.get.mockRejectedValue({
                response: { status: 400, statusText: 'Bad Request' }
            });

            await expect(dimensionService.get('')).rejects.toMatchObject({
                response: { status: 400 }
            });
            
            console.log('✅ Invalid dimension names handled gracefully');
        });

        test('should handle network errors gracefully', async () => {
            mockRestService.get.mockRejectedValue({
                code: 'ECONNREFUSED'
            });

            await expect(dimensionService.getAllNames()).rejects.toMatchObject({
                code: 'ECONNREFUSED'
            });
            
            console.log('✅ Network errors handled gracefully');
        });

        test('should handle authentication errors', async () => {
            mockRestService.get.mockRejectedValue({
                response: { status: 401, statusText: 'Unauthorized' }
            });

            await expect(dimensionService.getAllNames()).rejects.toMatchObject({
                response: { status: 401 }
            });
            
            console.log('✅ Authentication errors handled gracefully');
        });
    });

    describe('Dimension Service Edge Cases', () => {
        test('should handle empty dimension lists', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse({
                value: []
            }));

            const dimensionNames = await dimensionService.getAllNames();
            
            expect(Array.isArray(dimensionNames)).toBe(true);
            expect(dimensionNames.length).toBe(0);
            
            console.log('✅ Empty dimension lists handled correctly');
        });

        test('should handle concurrent dimension operations', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse({
                value: [{ Name: 'TestDimension' }]
            }));

            const operations = [
                dimensionService.getAllNames(),
                dimensionService.getAllNames(),
                dimensionService.getAllNames()
            ];

            const results = await Promise.allSettled(operations);
            const successful = results.filter(r => r.status === 'fulfilled');
            
            expect(successful.length).toBe(3);
            console.log('✅ Concurrent operations handled successfully');
        });

        test('should handle large dimension lists efficiently', async () => {
            const largeDimensionList = Array(1000).fill(null).map((_, i) => ({
                Name: `Dimension${i}`,
                Hierarchies: [{ Name: `Dimension${i}` }]
            }));

            mockRestService.get.mockResolvedValue(createMockResponse({
                value: largeDimensionList
            }));

            const startTime = Date.now();
            const dimensionNames = await dimensionService.getAllNames();
            const endTime = Date.now();
            
            expect(dimensionNames.length).toBe(1000);
            expect(endTime - startTime).toBeLessThan(1000); // Should be fast with mocking
            
            console.log('✅ Large dimension lists handled efficiently');
        });
    });

    describe('Dimension Service Integration', () => {
        test('should maintain consistent data across operations', async () => {
            const dimensionData = {
                value: [
                    { Name: 'Time' },
                    { Name: 'Account' }
                ]
            };

            mockRestService.get.mockResolvedValue(createMockResponse(dimensionData));

            const names1 = await dimensionService.getAllNames();
            const names2 = await dimensionService.getAllNames();
            
            expect(names1).toEqual(names2);
            expect(names1).toEqual(['Time', 'Account']);
            
            console.log('✅ Data consistency maintained across operations');
        });

        test('should handle dimension hierarchy consistency', async () => {
            const timeDimension = {
                Name: 'Time',
                Hierarchies: [
                    { Name: 'Time', Elements: [{ Name: 'Jan' }, { Name: 'Feb' }] }
                ]
            };

            mockRestService.get.mockResolvedValueOnce(createMockResponse({
                value: [{ Name: 'Time' }]
            }));

            mockRestService.get.mockResolvedValueOnce(createMockResponse(timeDimension));

            const dimensionNames = await dimensionService.getAllNames();
            expect(dimensionNames).toContain('Time');

            const dimension = await dimensionService.get('Time');
            expect(dimension.hierarchies[0].elements.length).toBe(2);
            
            console.log('✅ Dimension hierarchy consistency maintained');
        });
    });

    describe('Dimension CRUD Operations', () => {
        test('should handle dimension creation and deletion lifecycle', async () => {
            const testDimension = new Dimension('TestDimension');
            
            // Mock dimension existence check (false) for create method's internal check
            const mockError = new TM1RestException('Dimension not found', 404, { status: 404 });
            mockRestService.get.mockRejectedValueOnce(mockError);

            // Mock dimension creation
            mockRestService.post.mockResolvedValue(createMockResponse({}, 201));

            await dimensionService.create(testDimension);
            
            // Mock dimension existence check (true after creation)
            mockRestService.get.mockResolvedValueOnce(createMockResponse({
                Name: 'TestDimension',
                Hierarchies: []
            }));

            const afterCreationExists = await dimensionService.exists('TestDimension');
            expect(afterCreationExists).toBe(true);

            // Mock dimension deletion
            mockRestService.delete.mockResolvedValue(createMockResponse({}, 204));

            await dimensionService.delete('TestDimension');
            
            console.log('✅ Dimension lifecycle operations handled successfully');
        });
    });
});