/**
 * HierarchyService Tests for tm1npm
 * Tests validate parity with tm1py v2.2.4 HierarchyService
 */

import { HierarchyService } from '../services/HierarchyService';
import { RestService } from '../services/RestService';
import { Hierarchy } from '../objects/Hierarchy';
import { ElementAttribute } from '../objects/ElementAttribute';
import { TM1RestException } from '../exceptions/TM1Exception';

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

    describe('get() — explicit $expand', () => {
        test('should use explicit $expand properties instead of wildcard', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse({
                Name: 'TestHierarchy',
                Elements: [],
                Edges: [],
                ElementAttributes: [],
                Subsets: [],
                DefaultMember: null
            }));

            await hierarchyService.get('TestDimension', 'TestHierarchy');

            const calledUrl = mockRestService.get.mock.calls[0][0];
            expect(calledUrl).toContain('$expand=Edges,Elements,ElementAttributes,Subsets,DefaultMember');
            expect(calledUrl).not.toContain('$expand=*');
        });

        test('should default hierarchyName to dimensionName when not provided', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse({
                Name: 'TestDimension',
                Elements: [],
                Edges: [],
                ElementAttributes: [],
                Subsets: [],
                DefaultMember: null
            }));

            await hierarchyService.get('TestDimension');

            const calledUrl = mockRestService.get.mock.calls[0][0];
            expect(calledUrl).toContain("Hierarchies('TestDimension')");
        });
    });

    describe('getAll() — explicit $expand', () => {
        test('should use explicit $expand properties instead of wildcard', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse({
                value: [
                    { Name: 'Hierarchy1', Elements: [], Edges: [], ElementAttributes: [], Subsets: [] },
                    { Name: 'Hierarchy2', Elements: [], Edges: [], ElementAttributes: [], Subsets: [] }
                ]
            }));

            const hierarchies = await hierarchyService.getAll('TestDimension');

            const calledUrl = mockRestService.get.mock.calls[0][0];
            expect(calledUrl).toContain('$expand=Edges,Elements,ElementAttributes,Subsets,DefaultMember');
            expect(calledUrl).not.toContain('$expand=*');
            expect(hierarchies).toHaveLength(2);
        });
    });

    describe('exists() — lightweight name check', () => {
        test('should use $select=Name endpoint, not get()', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse({
                value: [{ Name: 'TestHierarchy' }, { Name: 'OtherHierarchy' }]
            }));

            const result = await hierarchyService.exists('TestDimension', 'TestHierarchy');

            expect(result).toBe(true);
            const calledUrl = mockRestService.get.mock.calls[0][0];
            expect(calledUrl).toContain('$select=Name');
            expect(calledUrl).not.toContain('$expand');
        });

        test('should do case+space insensitive comparison', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse({
                value: [{ Name: 'Test Hierarchy' }]
            }));

            const result = await hierarchyService.exists('TestDimension', 'testhierarchy');

            expect(result).toBe(true);
        });

        test('should return false when hierarchy name not in list', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse({
                value: [{ Name: 'OtherHierarchy' }]
            }));

            const result = await hierarchyService.exists('TestDimension', 'NonExistent');

            expect(result).toBe(false);
        });

        test('should return false when dimension does not exist (404)', async () => {
            mockRestService.get.mockRejectedValue(
                new TM1RestException('Dimension not found', 404, { status: 404 })
            );

            const result = await hierarchyService.exists('NonExistentDimension', 'TestHierarchy');

            expect(result).toBe(false);
        });

        test('should rethrow non-404 errors', async () => {
            mockRestService.get.mockRejectedValue(
                new TM1RestException('Server error', 500, { status: 500 })
            );

            await expect(hierarchyService.exists('TestDimension', 'TestHierarchy'))
                .rejects.toThrow();
        });
    });

    describe('create() — no pre-existence check', () => {
        test('should POST directly without calling exists() first', async () => {
            const mockHierarchy = new Hierarchy('NewHierarchy', 'TestDimension');

            mockRestService.post.mockResolvedValue(createMockResponse({ Name: 'NewHierarchy' }, 201));
            mockRestService.get.mockResolvedValue(createMockResponse({ value: [] }));

            const result = await hierarchyService.create(mockHierarchy);

            expect(result.status).toBe(201);
            // The first call should be POST (create), not GET (exists check)
            expect(mockRestService.post).toHaveBeenCalled();
            const postUrl = mockRestService.post.mock.calls[0][0];
            expect(postUrl).toContain("/Hierarchies");
        });

        test('should call updateElementAttributes after POST', async () => {
            const mockHierarchy = new Hierarchy('NewHierarchy', 'TestDimension');

            mockRestService.post.mockResolvedValue(createMockResponse({ Name: 'NewHierarchy' }, 201));
            // Mock getElementAttributes for updateElementAttributes
            mockRestService.get.mockResolvedValue(createMockResponse({ value: [] }));

            await hierarchyService.create(mockHierarchy);

            // GET should be called for getElementAttributes (inside updateElementAttributes)
            expect(mockRestService.get).toHaveBeenCalled();
            const getUrl = mockRestService.get.mock.calls[0][0];
            expect(getUrl).toContain('ElementAttributes');
        });
    });

    describe('update() — PATCH with response array', () => {
        test('should send PATCH and return responses array', async () => {
            const mockHierarchy = new Hierarchy('TestHierarchy', 'TestDimension');

            mockRestService.patch.mockResolvedValue(createMockResponse({}, 200));
            mockRestService.get.mockResolvedValue(createMockResponse({ value: [] }));

            const responses = await hierarchyService.update(mockHierarchy);

            expect(Array.isArray(responses)).toBe(true);
            expect(responses).toHaveLength(1);
            expect(mockRestService.patch).toHaveBeenCalledTimes(1);

            const patchUrl = mockRestService.patch.mock.calls[0][0];
            expect(patchUrl).toContain("/Dimensions('TestDimension')/Hierarchies('TestHierarchy')");
        });

        test('should call updateElementAttributes after PATCH', async () => {
            const mockHierarchy = new Hierarchy('TestHierarchy', 'TestDimension');

            mockRestService.patch.mockResolvedValue(createMockResponse({}, 200));
            mockRestService.get.mockResolvedValue(createMockResponse({ value: [] }));

            await hierarchyService.update(mockHierarchy);

            // GET called for getElementAttributes inside updateElementAttributes
            expect(mockRestService.get).toHaveBeenCalled();
        });
    });

    describe('isBalanced() — server-side Structure/$value', () => {
        test('should call Structure/$value endpoint', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse(0));

            await hierarchyService.isBalanced('TestDimension', 'TestHierarchy');

            const calledUrl = mockRestService.get.mock.calls[0][0];
            expect(calledUrl).toContain('/Structure/$value');
        });

        test('should return true when structure is 0 (balanced)', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse(0));

            const result = await hierarchyService.isBalanced('TestDimension', 'TestHierarchy');

            expect(result).toBe(true);
        });

        test('should return false when structure is 2 (unbalanced)', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse(2));

            const result = await hierarchyService.isBalanced('TestDimension', 'TestHierarchy');

            expect(result).toBe(false);
        });

        test('should throw on unexpected structure value', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse(99));

            await expect(hierarchyService.isBalanced('TestDimension', 'TestHierarchy'))
                .rejects.toThrow('Unexpected return value from TM1 API request: 99');
        });

        test('should throw on structure=1 (ragged hierarchy) matching tm1py behavior', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse(1));

            await expect(hierarchyService.isBalanced('TestDimension', 'TestHierarchy'))
                .rejects.toThrow('Unexpected return value from TM1 API request: 1');
        });

        test('should handle string response from $value endpoint', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse('0'));

            const result = await hierarchyService.isBalanced('TestDimension', 'TestHierarchy');

            expect(result).toBe(true);
        });
    });

    describe('removeAllEdges() — single PATCH', () => {
        test('should send single PATCH with empty edges array', async () => {
            mockRestService.patch.mockResolvedValue(createMockResponse({}, 200));

            await hierarchyService.removeAllEdges('TestDimension', 'TestHierarchy');

            expect(mockRestService.patch).toHaveBeenCalledTimes(1);
            const [url, body] = mockRestService.patch.mock.calls[0];
            expect(url).toContain("/Dimensions('TestDimension')/Hierarchies('TestHierarchy')");
            expect(JSON.parse(body)).toEqual({ Edges: [] });
        });

        test('should default hierarchyName to dimensionName', async () => {
            mockRestService.patch.mockResolvedValue(createMockResponse({}, 200));

            await hierarchyService.removeAllEdges('TestDimension');

            const [url] = mockRestService.patch.mock.calls[0];
            expect(url).toContain("/Hierarchies('TestDimension')");
        });

        test('should not make any GET or DELETE calls', async () => {
            mockRestService.patch.mockResolvedValue(createMockResponse({}, 200));

            await hierarchyService.removeAllEdges('TestDimension', 'TestHierarchy');

            expect(mockRestService.get).not.toHaveBeenCalled();
            expect(mockRestService.delete).not.toHaveBeenCalled();
        });
    });

    describe('updateElementAttributes() — intelligent diff', () => {
        test('should only create attributes that do not exist yet', async () => {
            const mockHierarchy = new Hierarchy('TestHierarchy', 'TestDimension');
            mockHierarchy.addElementAttribute(new ElementAttribute('Description', 'String'));
            mockHierarchy.addElementAttribute(new ElementAttribute('NewAttr', 'Numeric'));

            // Existing: Description (same type)
            mockRestService.get.mockResolvedValue(createMockResponse({
                value: [{ Name: 'Description', Type: 'String' }]
            }));
            mockRestService.post.mockResolvedValue(createMockResponse({}, 201));

            await hierarchyService.updateElementAttributes(mockHierarchy);

            // Only NewAttr should be created (Description already exists with same type)
            expect(mockRestService.post).toHaveBeenCalledTimes(1);
            const postedBody = JSON.parse(mockRestService.post.mock.calls[0][1]);
            expect(postedBody.Name).toBe('NewAttr');
        });

        test('should only delete attributes that are no longer present', async () => {
            const mockHierarchy = new Hierarchy('TestHierarchy', 'TestDimension');
            mockHierarchy.addElementAttribute(new ElementAttribute('Description', 'String'));

            // Existing: Description + OldAttr (OldAttr should be deleted)
            mockRestService.get.mockResolvedValue(createMockResponse({
                value: [
                    { Name: 'Description', Type: 'String' },
                    { Name: 'OldAttr', Type: 'Numeric' }
                ]
            }));
            mockRestService.delete.mockResolvedValue(createMockResponse({}, 204));

            await hierarchyService.updateElementAttributes(mockHierarchy);

            // Only OldAttr should be deleted
            expect(mockRestService.delete).toHaveBeenCalledTimes(1);
            const deleteUrl = mockRestService.delete.mock.calls[0][0];
            expect(deleteUrl).toContain("ElementAttributes('OldAttr')");
        });

        test('should update attributes with changed type (delete + recreate)', async () => {
            const mockHierarchy = new Hierarchy('TestHierarchy', 'TestDimension');
            mockHierarchy.addElementAttribute(new ElementAttribute('Description', 'Alias'));

            // Existing: Description with type String (type changed to Alias)
            mockRestService.get.mockResolvedValue(createMockResponse({
                value: [{ Name: 'Description', Type: 'String' }]
            }));
            mockRestService.delete.mockResolvedValue(createMockResponse({}, 204));
            mockRestService.post.mockResolvedValue(createMockResponse({}, 201));

            await hierarchyService.updateElementAttributes(mockHierarchy);

            // Should delete old then create new
            expect(mockRestService.delete).toHaveBeenCalledTimes(1);
            expect(mockRestService.post).toHaveBeenCalledTimes(1);
            const postedBody = JSON.parse(mockRestService.post.mock.calls[0][1]);
            expect(postedBody.Name).toBe('Description');
            expect(postedBody.Type).toBe('Alias');
        });

        test('should not delete existing attributes when keepExisting is true', async () => {
            const mockHierarchy = new Hierarchy('TestHierarchy', 'TestDimension');

            mockRestService.get.mockResolvedValue(createMockResponse({
                value: [{ Name: 'OldAttr', Type: 'Numeric' }]
            }));

            await hierarchyService.updateElementAttributes(mockHierarchy, true);

            // Should NOT delete OldAttr because keepExisting is true
            expect(mockRestService.delete).not.toHaveBeenCalled();
            expect(mockRestService.post).not.toHaveBeenCalled();
        });

        test('should do nothing when attributes are unchanged', async () => {
            const mockHierarchy = new Hierarchy('TestHierarchy', 'TestDimension');
            mockHierarchy.addElementAttribute(new ElementAttribute('Description', 'String'));

            mockRestService.get.mockResolvedValue(createMockResponse({
                value: [{ Name: 'Description', Type: 'String' }]
            }));

            await hierarchyService.updateElementAttributes(mockHierarchy);

            expect(mockRestService.post).not.toHaveBeenCalled();
            expect(mockRestService.delete).not.toHaveBeenCalled();
        });

        test('should use case+space insensitive comparison for attribute names', async () => {
            const mockHierarchy = new Hierarchy('TestHierarchy', 'TestDimension');
            mockHierarchy.addElementAttribute(new ElementAttribute('My Description', 'String'));

            // Existing has slightly different casing/spacing
            mockRestService.get.mockResolvedValue(createMockResponse({
                value: [{ Name: 'mydescription', Type: 'String' }]
            }));

            await hierarchyService.updateElementAttributes(mockHierarchy);

            // Should recognize as same attribute — no creates or deletes
            expect(mockRestService.post).not.toHaveBeenCalled();
            expect(mockRestService.delete).not.toHaveBeenCalled();
        });
    });

    describe('Hierarchy Retrieval Operations', () => {
        test('should get all hierarchy names for dimension', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse({
                value: [{ Name: 'Hierarchy1' }, { Name: 'Hierarchy2' }]
            }));

            const hierarchyNames = await hierarchyService.getAllNames('TestDimension');

            expect(hierarchyNames).toEqual(['Hierarchy1', 'Hierarchy2']);
        });

        test('should handle empty hierarchy lists', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse({ value: [] }));

            const hierarchies = await hierarchyService.getAll('EmptyDimension');

            expect(hierarchies).toHaveLength(0);
        });
    });

    describe('Hierarchy CRUD Operations', () => {
        test('should delete hierarchy', async () => {
            mockRestService.delete.mockResolvedValue(createMockResponse({}, 204));

            const result = await hierarchyService.delete('TestDimension', 'HierarchyToDelete');

            expect(result.status).toBe(204);
        });
    });

    describe('Element Attribute Utility Operations', () => {
        test('should get element attributes', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse({
                value: [
                    { Name: 'Description', Type: 'String' },
                    { Name: 'Code', Type: 'Alias' }
                ]
            }));

            const attributes = await hierarchyService.getElementAttributes('TestDimension', 'TestHierarchy');

            expect(attributes).toHaveLength(2);
            expect(attributes[0].name).toBe('Description');
        });

        test('should check if element attribute exists', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse({ Name: 'ExistingAttribute' }));

            const exists = await hierarchyService.elementAttributeExists('TestDimension', 'TestHierarchy', 'ExistingAttribute');

            expect(exists).toBe(true);
        });

        test('should return false for non-existing element attribute', async () => {
            mockRestService.get.mockRejectedValue(
                new TM1RestException('Attribute not found', 404, { status: 404 })
            );

            const exists = await hierarchyService.elementAttributeExists('TestDimension', 'TestHierarchy', 'NonExistent');

            expect(exists).toBe(false);
        });

        test('should delete element attribute', async () => {
            mockRestService.delete.mockResolvedValue(createMockResponse({}, 204));

            const result = await hierarchyService.deleteElementAttribute('TestDimension', 'TestHierarchy', 'AttrToDelete');

            expect(result.status).toBe(204);
        });
    });

    describe('Error Handling', () => {
        test('should propagate non-404 errors from get()', async () => {
            mockRestService.get.mockRejectedValue({
                response: { status: 500, statusText: 'Internal Server Error' }
            });

            await expect(hierarchyService.get('TestDimension', 'TestHierarchy'))
                .rejects.toMatchObject({ response: { status: 500 } });
        });

        test('should propagate network errors', async () => {
            mockRestService.get.mockRejectedValue({ code: 'ECONNREFUSED' });

            await expect(hierarchyService.getAllNames('TestDimension'))
                .rejects.toMatchObject({ code: 'ECONNREFUSED' });
        });
    });
});
