/**
 * ElementService Tests for tm1npm
 * Comprehensive tests for TM1 Element operations with proper mocking
 */

import { ElementService } from '../services/ElementService';
import { RestService } from '../services/RestService';
import { Element } from '../objects/Element';
import { TM1RestException } from '../exceptions/TM1Exception';

// Helper function to create mock AxiosResponse
const createMockResponse = (data: any, status: number = 200) => ({
    data,
    status,
    statusText: status === 200 ? 'OK' : status === 201 ? 'Created' : status === 204 ? 'No Content' : 'Error',
    headers: {},
    config: {} as any
});

describe('ElementService Tests', () => {
    let elementService: ElementService;
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

        elementService = new ElementService(mockRestService);
    });

    describe('Element Retrieval Operations', () => {
        test('should get element names for dimension hierarchy', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse({
                value: [
                    { Name: 'Element1' },
                    { Name: 'Element2' },
                    { Name: 'Element3' }
                ]
            }));

            const elementNames = await elementService.getNames('TestDimension', 'TestHierarchy');
            
            expect(Array.isArray(elementNames)).toBe(true);
            expect(elementNames.length).toBe(3);
            expect(elementNames).toEqual(['Element1', 'Element2', 'Element3']);
            
            console.log('✅ Element names retrieved successfully');
        });

        test('should get elements for dimension hierarchy', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse({
                value: [
                    { 
                        Name: 'Element1',
                        Type: 'Numeric',
                        Level: 0,
                        Index: 1,
                        Attributes: {}
                    },
                    { 
                        Name: 'Element2',
                        Type: 'Consolidated',
                        Level: 1,
                        Index: 2,
                        Attributes: {}
                    }
                ]
            }));

            const elements = await elementService.getElements('TestDimension', 'TestHierarchy');
            
            expect(Array.isArray(elements)).toBe(true);
            expect(elements.length).toBe(2);
            expect(elements[0].name).toBe('Element1');
            expect(elements[1].name).toBe('Element2');
            
            console.log('✅ Elements retrieved successfully');
        });

        test('should get a specific element if it exists', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse({
                Name: 'TestElement',
                Type: 'Numeric',
                Level: 0,
                Index: 1,
                Attributes: {}
            }));

            const element = await elementService.get('TestDimension', 'TestHierarchy', 'TestElement');
            expect(element).toBeDefined();
            expect(element.name).toBe('TestElement');
            
            console.log('✅ Specific element retrieved successfully');
        });

        test('should check if an element exists', async () => {
            // Test existing element
            mockRestService.get.mockResolvedValue(createMockResponse({
                Name: 'ExistingElement'
            }));

            const exists = await elementService.exists('TestDimension', 'TestHierarchy', 'ExistingElement');
            expect(exists).toBe(true);

            console.log('✅ Element existence check working');
        });

        test('should check if an element does not exist', async () => {
            // Test non-existing element
            const mockError = new TM1RestException('Element not found', 404, { status: 404 });
            mockRestService.get.mockRejectedValue(mockError);

            const notExists = await elementService.exists('TestDimension', 'TestHierarchy', 'NonExistentElement');
            expect(notExists).toBe(false);
            
            console.log('✅ Element non-existence check working');
        });
    });

    describe('Element CRUD Operations', () => {
        test('should create element', async () => {
            const testElement = new Element('NewElement', 'Numeric');
            
            mockRestService.post.mockResolvedValue(createMockResponse(
                { Name: 'NewElement' }, 201
            ));

            const result = await elementService.create('TestDimension', 'TestHierarchy', testElement);
            
            expect(mockRestService.post).toHaveBeenCalled();
            expect(result.status).toBe(201);
            
            console.log('✅ Element creation successful');
        });

        test('should update existing element', async () => {
            const testElement = new Element('UpdatedElement', 'Numeric');

            mockRestService.patch.mockResolvedValue(createMockResponse(
                { Name: 'UpdatedElement' }, 200
            ));

            const result = await elementService.update('TestDimension', 'TestHierarchy', testElement);
            
            expect(mockRestService.patch).toHaveBeenCalled();
            expect(result.status).toBe(200);
            
            console.log('✅ Element update successful');
        });

        test('should delete element', async () => {
            mockRestService.delete.mockResolvedValue(createMockResponse({}, 204));

            const result = await elementService.delete('TestDimension', 'TestHierarchy', 'ElementToDelete');
            
            expect(mockRestService.delete).toHaveBeenCalled();
            expect(result.status).toBe(204);
            
            console.log('✅ Element deletion successful');
        });

        test('should update or create element', async () => {
            const testElement = new Element('TestElement', 'Numeric');

            // Mock exists method to return true (element exists)
            jest.spyOn(elementService, 'exists').mockResolvedValue(true);
            
            mockRestService.patch.mockResolvedValue(createMockResponse(
                { Name: 'TestElement' }, 200
            ));

            const result = await elementService.updateOrCreate('TestDimension', 'TestHierarchy', testElement);
            
            expect(mockRestService.patch).toHaveBeenCalled();
            expect(result.status).toBe(200);
            
            console.log('✅ Element update or create successful');
        });
    });

    describe('Element Hierarchy Operations', () => {
        test('should get element parents', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse({
                value: [{ Name: 'Parent1' }]
            }));

            const parents = await elementService.getParents('TestDimension', 'TestHierarchy', 'ChildElement');
            
            expect(Array.isArray(parents)).toBe(true);
            expect(parents.length).toBe(1);
            expect(parents[0]).toBe('Parent1');
            
            console.log('✅ Element parents retrieved successfully');
        });

        test('should get element children', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse({
                value: [{ Name: 'Child1' }, { Name: 'Child2' }]
            }));

            const children = await elementService.getChildren('TestDimension', 'TestHierarchy', 'ParentElement');
            
            expect(Array.isArray(children)).toBe(true);
            expect(children.length).toBe(2);
            expect(children[0]).toBe('Child1');
            expect(children[1]).toBe('Child2');
            
            console.log('✅ Element children retrieved successfully');
        });

        test('should get leaf elements', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse({
                value: [
                    { Name: 'Leaf1', Type: 'String' },
                    { Name: 'Leaf2', Type: 'Numeric' }
                ]
            }));

            const leafElements = await elementService.getLeafElements('TestDimension', 'TestHierarchy');
            
            expect(Array.isArray(leafElements)).toBe(true);
            expect(leafElements.length).toBe(2);
            expect(leafElements[0].name).toBe('Leaf1');
            expect(leafElements[1].name).toBe('Leaf2');
            
            console.log('✅ Leaf elements retrieved successfully');
        });

        test('should get consolidated elements', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse({
                value: [
                    { Name: 'Consol1', Type: 'Consolidated' },
                    { Name: 'Consol2', Type: 'Consolidated' }
                ]
            }));

            const consolElements = await elementService.getConsolidatedElements('TestDimension', 'TestHierarchy');
            
            expect(Array.isArray(consolElements)).toBe(true);
            expect(consolElements.length).toBe(2);
            expect(consolElements[0].name).toBe('Consol1');
            expect(consolElements[1].name).toBe('Consol2');
            
            console.log('✅ Consolidated elements retrieved successfully');
        });
    });

    describe('Element Count Operations', () => {
        test('should get elements count', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse('150'));

            const count = await elementService.getElementsCount('TestDimension', 'TestHierarchy');
            
            expect(typeof count).toBe('number');
            expect(count).toBe(150);
            
            console.log('✅ Elements count retrieved successfully');
        });
    });

    describe('Element Attributes Operations', () => {
        test('should get element attributes', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse({
                value: [
                    { Name: 'Attribute1', Type: 'String' },
                    { Name: 'Attribute2', Type: 'Numeric' }
                ]
            }));

            const attributes = await elementService.getElementAttributes('TestDimension', 'TestHierarchy');
            
            expect(Array.isArray(attributes)).toBe(true);
            expect(attributes.length).toBe(2);
            expect(attributes[0].name).toBe('Attribute1');
            expect(attributes[1].name).toBe('Attribute2');
            
            console.log('✅ Element attributes retrieved successfully');
        });

        test('should update element attribute', async () => {
            mockRestService.patch.mockResolvedValue(createMockResponse({}, 200));

            const result = await elementService.updateElementAttribute(
                'TestDimension', 
                'TestHierarchy', 
                'TestElement', 
                'TestAttribute', 
                'TestValue'
            );
            
            expect(mockRestService.patch).toHaveBeenCalled();
            expect(result.status).toBe(200);
            
            console.log('✅ Element attribute updated successfully');
        });
    });

    describe('Element Error Handling', () => {
        test('should handle invalid element names gracefully', async () => {
            mockRestService.get.mockRejectedValue({
                response: { status: 400, statusText: 'Bad Request' }
            });

            await expect(elementService.get('TestDimension', 'TestHierarchy', ''))
                .rejects.toMatchObject({
                    response: { status: 400 }
                });
            
            console.log('✅ Invalid element names handled gracefully');
        });

        test('should handle network errors gracefully', async () => {
            mockRestService.get.mockRejectedValue({
                code: 'ECONNREFUSED'
            });

            await expect(elementService.getNames('TestDimension', 'TestHierarchy'))
                .rejects.toMatchObject({
                    code: 'ECONNREFUSED'
                });
            
            console.log('✅ Network errors handled gracefully');
        });

        test('should handle authentication errors', async () => {
            mockRestService.get.mockRejectedValue({
                response: { status: 401, statusText: 'Unauthorized' }
            });

            await expect(elementService.getElements('TestDimension', 'TestHierarchy'))
                .rejects.toMatchObject({
                    response: { status: 401 }
                });
            
            console.log('✅ Authentication errors handled gracefully');
        });
    });

    describe('Element Service Edge Cases', () => {
        test('should handle empty element lists', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse({
                value: []
            }));

            const elementNames = await elementService.getNames('EmptyDimension', 'EmptyHierarchy');
            
            expect(Array.isArray(elementNames)).toBe(true);
            expect(elementNames.length).toBe(0);
            
            console.log('✅ Empty element lists handled correctly');
        });

        test('should handle concurrent element operations', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse({
                value: [{ Name: 'TestElement' }]
            }));

            const operations = [
                elementService.getNames('TestDimension', 'TestHierarchy'),
                elementService.getNames('TestDimension', 'TestHierarchy'),
                elementService.getNames('TestDimension', 'TestHierarchy')
            ];

            const results = await Promise.allSettled(operations);
            const successful = results.filter(r => r.status === 'fulfilled');
            
            expect(successful.length).toBe(3);
            console.log('✅ Concurrent operations handled successfully');
        });

        test('should handle large element lists efficiently', async () => {
            const largeElementList = Array(1000).fill(null).map((_, i) => ({
                Name: `Element${i}`,
                Type: 'Numeric',
                Level: 0,
                Index: i
            }));

            mockRestService.get.mockResolvedValue(createMockResponse({
                value: largeElementList
            }));

            const startTime = Date.now();
            const elementNames = await elementService.getNames('LargeDimension', 'LargeHierarchy');
            const endTime = Date.now();
            
            expect(elementNames.length).toBe(1000);
            expect(endTime - startTime).toBeLessThan(1000); // Should be fast with mocking
            
            console.log('✅ Large element lists handled efficiently');
        });
    });

    describe('Element Service Integration', () => {
        test('should maintain consistent data across operations', async () => {
            const elementData = {
                value: [
                    { Name: 'Element1' },
                    { Name: 'Element2' }
                ]
            };

            mockRestService.get.mockResolvedValue(createMockResponse(elementData));

            const names1 = await elementService.getNames('TestDimension', 'TestHierarchy');
            const names2 = await elementService.getNames('TestDimension', 'TestHierarchy');
            
            expect(names1).toEqual(names2);
            expect(names1).toEqual(['Element1', 'Element2']);
            
            console.log('✅ Data consistency maintained across operations');
        });

        test('should handle element lifecycle operations', async () => {
            const testElement = new Element('LifecycleElement', 'Numeric');
            
            // Mock element creation
            mockRestService.post.mockResolvedValue(createMockResponse({}, 201));

            await elementService.create('TestDimension', 'TestHierarchy', testElement);
            
            // Mock element existence check (true after creation)
            mockRestService.get.mockResolvedValue(createMockResponse({
                Name: 'LifecycleElement'
            }));

            const afterCreationExists = await elementService.exists('TestDimension', 'TestHierarchy', 'LifecycleElement');
            expect(afterCreationExists).toBe(true);

            // Mock element update
            mockRestService.patch.mockResolvedValue(createMockResponse({}, 200));

            const updateResult = await elementService.update('TestDimension', 'TestHierarchy', testElement);
            expect(updateResult.status).toBe(200);

            // Mock element deletion
            mockRestService.delete.mockResolvedValue(createMockResponse({}, 204));

            await elementService.delete('TestDimension', 'TestHierarchy', 'LifecycleElement');
            
            console.log('✅ Element lifecycle operations handled successfully');
        });
    });

    describe('Element Bulk Operations', () => {
        test('should handle bulk element deletion', async () => {
            const elementsToDelete = ['Element1', 'Element2', 'Element3'];
            
            // For the useTI=true path, we need to mock ProcessService operations
            // The method creates a TI process, executes it, and then deletes it
            
            // Mock process creation, execution, and deletion
            mockRestService.post.mockResolvedValue(createMockResponse({}, 201)); // create process
            mockRestService.post.mockResolvedValue(createMockResponse({}, 200)); // execute process  
            mockRestService.delete.mockResolvedValue(createMockResponse({}, 204)); // delete process

            await elementService.deleteElements('TestDimension', 'TestHierarchy', elementsToDelete, true);
            
            console.log('✅ Bulk element deletion handled successfully');
        });
    });
});