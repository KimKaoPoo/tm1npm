/**
 * HierarchyService Tests for tm1npm
 * Comprehensive tests for TM1 Hierarchy operations with proper mocking
 */

import { HierarchyService } from '../services/HierarchyService';
import { RestService } from '../services/RestService';
import { Hierarchy } from '../objects/Hierarchy';
import { TM1RestException } from '../exceptions/TM1Exception';

// Helper function to create mock AxiosResponse
const createMockResponse = (data: any, status: number = 200) => ({
    data,
    status,
    statusText: status === 200 ? 'OK' : status === 201 ? 'Created' : status === 204 ? 'No Content' : 'Error',
    headers: {},
    config: {} as any
});

describe('HierarchyService Tests', () => {
    let hierarchyService: HierarchyService;
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

        hierarchyService = new HierarchyService(mockRestService);
    });

    describe('Hierarchy Retrieval Operations', () => {
        test('should get all hierarchy names for dimension', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse({
                value: [
                    { Name: 'Hierarchy1' },
                    { Name: 'Hierarchy2' }
                ]
            }));

            const hierarchyNames = await hierarchyService.getAllNames('TestDimension');
            
            expect(Array.isArray(hierarchyNames)).toBe(true);
            expect(hierarchyNames).toEqual(['Hierarchy1', 'Hierarchy2']);
            
            console.log('✅ Hierarchy names retrieved successfully');
        });

        test('should get all hierarchies with full details', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse({
                value: [
                    {
                        Name: 'MainHierarchy',
                        UniqueName: '[TestDimension].[MainHierarchy]',
                        Visible: true,
                        Elements: []
                    },
                    {
                        Name: 'AlternateHierarchy',
                        UniqueName: '[TestDimension].[AlternateHierarchy]',
                        Visible: false,
                        Elements: []
                    }
                ]
            }));

            const hierarchies = await hierarchyService.getAll('TestDimension');
            
            expect(Array.isArray(hierarchies)).toBe(true);
            expect(hierarchies.length).toBe(2);
            expect(hierarchies[0].name).toBe('MainHierarchy');
            expect(hierarchies[1].name).toBe('AlternateHierarchy');
            
            console.log('✅ All hierarchies retrieved successfully');
        });

        test('should get specific hierarchy by name', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse({
                Name: 'SpecificHierarchy',
                UniqueName: '[TestDimension].[SpecificHierarchy]',
                Visible: true,
                Elements: []
            }));

            const hierarchy = await hierarchyService.get('TestDimension', 'SpecificHierarchy');
            
            expect(hierarchy).toBeDefined();
            expect(hierarchy.name).toBe('SpecificHierarchy');
            
            console.log('✅ Specific hierarchy retrieved successfully');
        });

        test('should check if hierarchy exists', async () => {
            // Test existing hierarchy
            mockRestService.get.mockResolvedValue(createMockResponse({
                Name: 'ExistingHierarchy'
            }));

            const exists = await hierarchyService.exists('TestDimension', 'ExistingHierarchy');
            expect(exists).toBe(true);

            console.log('✅ Hierarchy existence check working correctly');
        });

        test('should check if hierarchy does not exist', async () => {
            // Test non-existing hierarchy
            const mockError = new TM1RestException('Hierarchy not found', 404, { status: 404 });
            mockRestService.get.mockRejectedValue(mockError);

            const notExists = await hierarchyService.exists('TestDimension', 'NonExistent');
            expect(notExists).toBe(false);
            
            console.log('✅ Hierarchy non-existence check working correctly');
        });
    });

    describe('Hierarchy CRUD Operations', () => {
        test('should create new hierarchy', async () => {
            const mockHierarchy = new Hierarchy('NewHierarchy', 'TestDimension');

            // Mock exists() to return false (hierarchy doesn't exist yet)
            const mockError = new TM1RestException('Hierarchy not found', 404, { status: 404 });
            mockRestService.get.mockRejectedValueOnce(mockError); // for exists() check

            // Mock create
            mockRestService.post.mockResolvedValue(createMockResponse({
                Name: 'NewHierarchy'
            }, 201));

            const result = await hierarchyService.create(mockHierarchy);
            
            expect(result.status).toBe(201);
            expect(mockRestService.post).toHaveBeenCalled();
            
            console.log('✅ Hierarchy creation successful');
        });

        test('should update existing hierarchy', async () => {
            const mockHierarchy = new Hierarchy('UpdatedHierarchy', 'TestDimension');

            // Mock the various calls that update() makes internally
            mockRestService.get.mockResolvedValue(createMockResponse({ value: [] })); // removeAllElements
            mockRestService.get.mockResolvedValue(createMockResponse({ value: [] })); // removeAllEdges
            mockRestService.get.mockResolvedValue(createMockResponse({ value: [] })); // getElementAttributes

            await hierarchyService.update(mockHierarchy);
            
            expect(mockRestService.get).toHaveBeenCalled();
            
            console.log('✅ Hierarchy update successful');
        });

        test('should delete hierarchy', async () => {
            mockRestService.delete.mockResolvedValue(createMockResponse({}, 204));

            const result = await hierarchyService.delete('TestDimension', 'HierarchyToDelete');
            
            expect(result.status).toBe(204);
            
            console.log('✅ Hierarchy deletion successful');
        });
    });

    describe('Hierarchy Element Attribute Operations', () => {
        test('should get element attributes', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse({
                value: [
                    { 
                        Name: 'Description', 
                        Type: 'String',
                        '@odata.type': '#ibm.tm1.api.v1.ElementAttribute'
                    },
                    { 
                        Name: 'Code', 
                        Type: 'Alias',
                        '@odata.type': '#ibm.tm1.api.v1.ElementAttribute'
                    }
                ]
            }));

            const attributes = await hierarchyService.getElementAttributes('TestDimension', 'TestHierarchy');
            
            expect(Array.isArray(attributes)).toBe(true);
            expect(attributes.length).toBe(2);
            expect(attributes[0].name).toBe('Description');
            
            console.log('✅ Element attributes retrieved successfully');
        });

        test('should check if element attribute exists', async () => {
            // Test existing attribute
            mockRestService.get.mockResolvedValue(createMockResponse({
                Name: 'ExistingAttribute'
            }));

            const exists = await hierarchyService.elementAttributeExists('TestDimension', 'TestHierarchy', 'ExistingAttribute');
            expect(exists).toBe(true);

            console.log('✅ Element attribute existence check working');
        });

        test('should check if element attribute does not exist', async () => {
            const mockError = new TM1RestException('Attribute not found', 404, { status: 404 });
            mockRestService.get.mockRejectedValue(mockError);

            const notExists = await hierarchyService.elementAttributeExists('TestDimension', 'TestHierarchy', 'NonExistentAttribute');
            expect(notExists).toBe(false);
            
            console.log('✅ Element attribute non-existence check working');
        });

        test('should delete element attribute', async () => {
            mockRestService.delete.mockResolvedValue(createMockResponse({}, 204));

            const result = await hierarchyService.deleteElementAttribute('TestDimension', 'TestHierarchy', 'AttributeToDelete');
            
            expect(result.status).toBe(204);
            
            console.log('✅ Element attribute deletion successful');
        });
    });

    describe('Hierarchy Error Handling', () => {
        test('should handle invalid hierarchy names gracefully', async () => {
            mockRestService.get.mockRejectedValue({
                response: { status: 400, statusText: 'Bad Request' }
            });

            await expect(hierarchyService.get('TestDimension', ''))
                .rejects.toMatchObject({
                    response: { status: 400 }
                });
            
            console.log('✅ Invalid hierarchy name handling working');
        });

        test('should handle network errors gracefully', async () => {
            mockRestService.get.mockRejectedValue({
                code: 'ECONNREFUSED'
            });

            await expect(hierarchyService.getAllNames('TestDimension'))
                .rejects.toMatchObject({
                    code: 'ECONNREFUSED'
                });
                
            console.log('✅ Network error handling working');
        });

        test('should handle authentication errors', async () => {
            mockRestService.get.mockRejectedValue({
                response: { status: 401, statusText: 'Unauthorized' }
            });

            await expect(hierarchyService.get('TestDimension', 'TestHierarchy'))
                .rejects.toMatchObject({
                    response: { status: 401 }
                });
                
            console.log('✅ Authentication error handling working');
        });
    });

    describe('Hierarchy Service Edge Cases', () => {
        test('should handle empty hierarchy lists', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse({
                value: []
            }));

            const hierarchies = await hierarchyService.getAll('EmptyDimension');
            
            expect(Array.isArray(hierarchies)).toBe(true);
            expect(hierarchies.length).toBe(0);
            
            console.log('✅ Empty hierarchy list handling working');
        });

        test('should handle concurrent operations efficiently', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse({
                value: [{ Name: 'TestHierarchy' }]
            }));

            const operations = Array(5).fill(null).map(() => 
                hierarchyService.getAllNames('TestDimension')
            );

            const results = await Promise.allSettled(operations);
            
            const successful = results.filter(r => r.status === 'fulfilled');
            expect(successful.length).toBe(5);
            
            console.log('✅ Concurrent operations handling working');
        });

        test('should handle large hierarchy data efficiently', async () => {
            const largeHierarchyData = Array(1000).fill(null).map((_, i) => ({
                Name: `Hierarchy${i}`,
                Visible: true,
                Elements: []
            }));

            mockRestService.get.mockResolvedValue(createMockResponse({
                value: largeHierarchyData
            }));

            const startTime = Date.now();
            const hierarchies = await hierarchyService.getAll('LargeDimension');
            const endTime = Date.now();

            expect(hierarchies.length).toBe(1000);
            expect(endTime - startTime).toBeLessThan(1000); // Should be fast with mocking
            
            console.log('✅ Large hierarchy data processing efficient');
        });
    });

    describe('Hierarchy Service Integration', () => {
        test('should maintain data consistency across operations', async () => {
            const hierarchyList = [
                { Name: 'Hierarchy1' },
                { Name: 'Hierarchy2' }
            ];

            mockRestService.get.mockResolvedValue(createMockResponse({
                value: hierarchyList
            }));

            const names1 = await hierarchyService.getAllNames('TestDimension');
            const names2 = await hierarchyService.getAllNames('TestDimension');

            expect(names1).toEqual(names2);
            expect(names1).toEqual(['Hierarchy1', 'Hierarchy2']);
            
            console.log('✅ Data consistency maintained');
        });

        test('should handle hierarchy lifecycle operations', async () => {
            const testHierarchy = new Hierarchy('LifecycleHierarchy', 'TestDimension');

            // Mock exists() to return false for create
            const mockError = new TM1RestException('Hierarchy not found', 404, { status: 404 });
            mockRestService.get.mockRejectedValueOnce(mockError); // for exists() in create()
            
            // Mock create
            mockRestService.post.mockResolvedValue(createMockResponse({}, 201));
            
            // Mock get for exists() check after creation (should return true)
            mockRestService.get.mockResolvedValueOnce(createMockResponse({
                Name: 'LifecycleHierarchy'
            }));
            
            // Mock update dependencies
            mockRestService.get.mockResolvedValue(createMockResponse({ value: [] })); // for removeAllElements
            mockRestService.get.mockResolvedValue(createMockResponse({ value: [] })); // for removeAllEdges  
            mockRestService.get.mockResolvedValue(createMockResponse({ value: [] })); // for getElementAttributes
            
            // Mock delete
            mockRestService.delete.mockResolvedValue(createMockResponse({}, 204));

            // Test lifecycle operations
            const createResult = await hierarchyService.create(testHierarchy);
            expect(createResult.status).toBe(201);

            const exists = await hierarchyService.exists('TestDimension', 'LifecycleHierarchy');
            expect(exists).toBe(true);

            await hierarchyService.update(testHierarchy);
            // update returns void, so just ensure it doesn't throw

            const deleteResult = await hierarchyService.delete('TestDimension', 'LifecycleHierarchy');
            expect(deleteResult.status).toBe(204);
            
            console.log('✅ Hierarchy lifecycle operations working');
        });
    });
});