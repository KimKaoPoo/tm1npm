/**
 * SubsetService Tests for tm1npm
 * Comprehensive tests for TM1 Subset operations with proper mocking
 */

import { SubsetService } from '../services/SubsetService';
import { RestService } from '../services/RestService';
import { Subset } from '../objects/Subset';
import { TM1RestException } from '../exceptions/TM1Exception';

// Helper function to create mock AxiosResponse
const createMockResponse = (data: any, status: number = 200) => ({
    data,
    status,
    statusText: status === 200 ? 'OK' : status === 201 ? 'Created' : status === 204 ? 'No Content' : 'Error',
    headers: {},
    config: {} as any
});

describe('SubsetService Tests', () => {
    let subsetService: SubsetService;
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

        subsetService = new SubsetService(mockRestService);
    });

    describe('Subset Retrieval Operations', () => {
        test('should get all subset names for dimension/hierarchy', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse({
                value: [
                    { Name: 'Default' },
                    { Name: 'TopLevel' },
                    { Name: 'CustomSubset' }
                ]
            }));

            const subsetNames = await subsetService.getAllNames('TestDimension', 'TestHierarchy');
            
            expect(Array.isArray(subsetNames)).toBe(true);
            expect(subsetNames.length).toBe(3);
            expect(subsetNames).toEqual(['Default', 'TopLevel', 'CustomSubset']);
            
            console.log('✅ Subset names retrieved successfully');
        });

        test('should get all subsets with full details', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse({
                value: [
                    {
                        Name: 'Default',
                        UniqueName: '[TestDimension].[TestHierarchy].[Default]',
                        Expression: '',
                        Hierarchy: {
                            Name: 'TestHierarchy',
                            Dimension: { Name: 'TestDimension' }
                        }
                    },
                    {
                        Name: 'TopLevel', 
                        UniqueName: '[TestDimension].[TestHierarchy].[TopLevel]',
                        Expression: '{TM1FILTERBYLEVEL({TM1SUBSETALL([TestDimension])}, 0)}',
                        Hierarchy: {
                            Name: 'TestHierarchy',
                            Dimension: { Name: 'TestDimension' }
                        }
                    }
                ]
            }));

            const response = await subsetService.getAllNames('TestDimension', 'TestHierarchy');
            
            expect(Array.isArray(response)).toBe(true);
            expect(response.length).toBe(2);
            expect(response[0]).toBe('Default');
            expect(response[1]).toBe('TopLevel');
            
            console.log('✅ All subsets retrieved successfully');
        });

        test('should get specific subset by name', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse({
                Name: 'SpecificSubset',
                UniqueName: '[TestDimension].[TestHierarchy].[SpecificSubset]',
                Expression: '{[Element1], [Element2], [Element3]}',
                Hierarchy: {
                    Name: 'TestHierarchy',
                    Dimension: { Name: 'TestDimension' }
                },
                Elements: [
                    { Name: 'Element1' },
                    { Name: 'Element2' },
                    { Name: 'Element3' }
                ]
            }));

            const subset = await subsetService.get('TestDimension', 'TestHierarchy', 'SpecificSubset');
            
            expect(subset).toBeDefined();
            expect(subset.Name).toBe('SpecificSubset');
            
            console.log('✅ Specific subset retrieved successfully');
        });

        test('should check if subset exists', async () => {
            // Test existing subset
            mockRestService.get.mockResolvedValue(createMockResponse({
                Name: 'ExistingSubset'
            }));

            const exists = await subsetService.exists('TestDimension', 'TestHierarchy', 'ExistingSubset');
            expect(exists).toBe(true);

            console.log('✅ Subset existence check working correctly');
        });

        test('should check if subset does not exist', async () => {
            // Test non-existing subset
            const mockError = new TM1RestException('Subset not found', 404, { status: 404 });
            mockRestService.get.mockRejectedValue(mockError);

            const notExists = await subsetService.exists('TestDimension', 'TestHierarchy', 'NonExistent');
            expect(notExists).toBe(false);
            
            console.log('✅ Subset non-existence check working correctly');
        });
    });

    describe('Subset CRUD Operations', () => {
        test('should create new subset', async () => {
            const mockSubset = new Subset('NewSubset', 'TestDimension', 'TestHierarchy');
            mockSubset.expression = '{[Element1], [Element2]}';

            mockRestService.post.mockResolvedValue(createMockResponse({
                Name: 'NewSubset'
            }, 201));

            const result = await subsetService.create('TestDimension', 'TestHierarchy', mockSubset);
            
            expect(result.status).toBe(201);
            expect(mockRestService.post).toHaveBeenCalled();
            
            console.log('✅ Subset creation successful');
        });

        test('should update existing subset', async () => {
            const mockSubset = new Subset('UpdatedSubset', 'TestDimension', 'TestHierarchy');
            mockSubset.expression = '{[Element1], [Element2], [Element3]}';

            mockRestService.patch.mockResolvedValue(createMockResponse({}, 200));

            const result = await subsetService.update('TestDimension', 'TestHierarchy', mockSubset);
            
            expect(result.status).toBe(200);
            
            console.log('✅ Subset update successful');
        });

        test('should delete subset', async () => {
            mockRestService.delete.mockResolvedValue(createMockResponse({}, 204));

            const result = await subsetService.delete('TestDimension', 'TestHierarchy', 'SubsetToDelete');
            
            expect(result.status).toBe(204);
            
            console.log('✅ Subset deletion successful');
        });
    });

    describe('Subset Element Operations', () => {
        test('should get subset elements', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse({
                value: [
                    { Name: 'Element1' },
                    { Name: 'Element2' },
                    { Name: 'Element3' }
                ]
            }));

            const subset = await subsetService.get('TestDimension', 'TestHierarchy', 'TestSubset');
            
            expect(subset).toBeDefined();
            expect(Array.isArray(subset.value)).toBe(true);
            
            console.log('✅ Subset elements retrieved successfully');
        });

        test('should handle empty subset', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse({
                Name: 'EmptySubset',
                Elements: []
            }));

            const subset = await subsetService.get('TestDimension', 'TestHierarchy', 'EmptySubset');
            
            expect(subset).toBeDefined();
            expect(subset.Name).toBe('EmptySubset');
            
            console.log('✅ Empty subset handling working');
        });
    });

    describe('Subset Error Handling', () => {
        test('should handle invalid subset names gracefully', async () => {
            mockRestService.get.mockRejectedValue({
                response: { status: 400, statusText: 'Bad Request' }
            });

            await expect(subsetService.get('TestDimension', 'TestHierarchy', ''))
                .rejects.toMatchObject({
                    response: { status: 400 }
                });
            
            console.log('✅ Invalid subset name handling working');
        });

        test('should handle network errors gracefully', async () => {
            mockRestService.get.mockRejectedValue({
                code: 'ECONNREFUSED'
            });

            await expect(subsetService.getAllNames('TestDimension', 'TestHierarchy'))
                .rejects.toMatchObject({
                    code: 'ECONNREFUSED'
                });
                
            console.log('✅ Network error handling working');
        });

        test('should handle authentication errors', async () => {
            mockRestService.get.mockRejectedValue({
                response: { status: 401, statusText: 'Unauthorized' }
            });

            await expect(subsetService.get('TestDimension', 'TestHierarchy', 'TestSubset'))
                .rejects.toMatchObject({
                    response: { status: 401 }
                });
                
            console.log('✅ Authentication error handling working');
        });
    });

    describe('Subset Service Edge Cases', () => {
        test('should handle large subset lists', async () => {
            const largeSubsetData = Array(1000).fill(null).map((_, i) => ({
                Name: `Subset${i}`,
                Expression: `{[Element${i}]}`
            }));

            mockRestService.get.mockResolvedValue(createMockResponse({
                value: largeSubsetData
            }));

            const startTime = Date.now();
            const subsets = await subsetService.getAllNames('LargeDimension', 'LargeHierarchy');
            const endTime = Date.now();

            expect(subsets.length).toBe(1000);
            expect(endTime - startTime).toBeLessThan(1000); // Should be fast with mocking
            
            console.log('✅ Large subset list processing efficient');
        });

        test('should handle concurrent operations efficiently', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse({
                value: [{ Name: 'TestSubset' }]
            }));

            const operations = Array(5).fill(null).map(() => 
                subsetService.getAllNames('TestDimension', 'TestHierarchy')
            );

            const results = await Promise.allSettled(operations);
            
            const successful = results.filter(r => r.status === 'fulfilled');
            expect(successful.length).toBe(5);
            
            console.log('✅ Concurrent operations handling working');
        });
    });

    describe('Subset Service Integration', () => {
        test('should maintain data consistency across operations', async () => {
            const subsetList = [
                { Name: 'Subset1' },
                { Name: 'Subset2' }
            ];

            mockRestService.get.mockResolvedValue(createMockResponse({
                value: subsetList
            }));

            const names1 = await subsetService.getAllNames('TestDimension', 'TestHierarchy');
            const names2 = await subsetService.getAllNames('TestDimension', 'TestHierarchy');

            expect(names1).toEqual(names2);
            expect(names1).toEqual(['Subset1', 'Subset2']);
            
            console.log('✅ Data consistency maintained');
        });

        test('should handle subset lifecycle operations', async () => {
            const testSubset = new Subset('LifecycleSubset', 'TestDimension', 'TestHierarchy');
            testSubset.expression = '{[Element1]}';

            // Mock create
            mockRestService.post.mockResolvedValue(createMockResponse({}, 201));
            
            // Mock get (exists)
            mockRestService.get.mockResolvedValue(createMockResponse({
                Name: 'LifecycleSubset'
            }));
            
            // Mock update
            mockRestService.patch.mockResolvedValue(createMockResponse({}, 200));
            
            // Mock delete
            mockRestService.delete.mockResolvedValue(createMockResponse({}, 204));

            // Test lifecycle operations
            const createResult = await subsetService.create('TestDimension', 'TestHierarchy', testSubset);
            expect(createResult.status).toBe(201);

            const exists = await subsetService.exists('TestDimension', 'TestHierarchy', 'LifecycleSubset');
            expect(exists).toBe(true);

            const updateResult = await subsetService.update('TestDimension', 'TestHierarchy', testSubset);
            expect(updateResult.status).toBe(200);

            const deleteResult = await subsetService.delete('TestDimension', 'TestHierarchy', 'LifecycleSubset');
            expect(deleteResult.status).toBe(204);
            
            console.log('✅ Subset lifecycle operations working');
        });
    });
});