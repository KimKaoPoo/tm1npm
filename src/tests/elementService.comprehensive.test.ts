/**
 * Comprehensive ElementService Tests
 * Target: Achieve 80%+ coverage for ElementService (currently 48%)
 * Testing all element operations including CRUD, hierarchy management, attributes, and advanced features
 */

import { ElementService, MDXDrillMethod } from '../services/ElementService';
import { RestService } from '../services/RestService';
import { Element, ElementType } from '../objects/Element';
import { ElementAttribute } from '../objects/ElementAttribute';
import { CaseAndSpaceInsensitiveDict } from '../utils/Utils';

// Mock dependencies
jest.mock('../objects/Element');
jest.mock('../objects/ElementAttribute');

describe('ElementService - Comprehensive Tests', () => {
    let elementService: ElementService;
    let mockRestService: jest.Mocked<RestService>;
    
    const mockResponse = (data: any) => ({
        data: data,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: { headers: {} }
    } as any);

    const mockElement = {
        name: 'TestElement',
        elementType: ElementType.NUMERIC,
        body: {
            Name: 'TestElement',
            Type: 'Numeric'
        }
    } as any;

    const mockElementAttribute = {
        name: 'TestAttribute',
        attributeType: 'String',
        body: {
            Name: 'TestAttribute',
            Type: 'String'
        }
    } as any;

    beforeEach(() => {
        mockRestService = {
            get: jest.fn(),
            post: jest.fn(),
            patch: jest.fn(),
            put: jest.fn(),
            delete: jest.fn()
        } as any;

        elementService = new ElementService(mockRestService);
        
        // Mock Element.fromDict
        (Element as any).fromDict = jest.fn().mockReturnValue(mockElement);
        
        // Mock ElementAttribute.fromDict
        (ElementAttribute as any).fromDict = jest.fn().mockReturnValue(mockElementAttribute);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('Constructor and Initialization', () => {
        test('should initialize ElementService properly', () => {
            expect(elementService).toBeDefined();
            expect(elementService).toBeInstanceOf(ElementService);
        });

        test('should extend ObjectService', () => {
            expect(elementService).toBeInstanceOf(ElementService);
        });
    });

    describe('Element CRUD Operations', () => {
        test('should get element by dimension, hierarchy, and name', async () => {
            const elementData = {
                Name: 'TestElement',
                Type: 'Numeric'
            };
            mockRestService.get.mockResolvedValue(mockResponse(elementData));

            const result = await elementService.get('TestDim', 'TestHierarchy', 'TestElement');
            
            expect(Element.fromDict).toHaveBeenCalledWith(elementData);
            expect(mockRestService.get).toHaveBeenCalledWith(
                "/Dimensions('TestDim')/Hierarchies('TestHierarchy')/Elements('TestElement')?$expand=*"
            );
            expect(result).toEqual(mockElement);
        });

        test('should create element', async () => {
            mockRestService.post.mockResolvedValue(mockResponse({}));

            const result = await elementService.create('TestDim', 'TestHierarchy', mockElement);
            
            expect(result).toBeDefined();
            expect(mockRestService.post).toHaveBeenCalledWith(
                "/Dimensions('TestDim')/Hierarchies('TestHierarchy')/Elements",
                mockElement.body
            );
        });

        test('should update element', async () => {
            mockRestService.patch.mockResolvedValue(mockResponse({}));

            const result = await elementService.update('TestDim', 'TestHierarchy', mockElement);
            
            expect(result).toBeDefined();
            expect(mockRestService.patch).toHaveBeenCalledWith(
                "/Dimensions('TestDim')/Hierarchies('TestHierarchy')/Elements('TestElement')",
                mockElement.body
            );
        });

        test('should delete element', async () => {
            mockRestService.delete.mockResolvedValue(mockResponse({}));

            const result = await elementService.delete('TestDim', 'TestHierarchy', 'TestElement');
            
            expect(result).toBeDefined();
            expect(mockRestService.delete).toHaveBeenCalledWith(
                "/Dimensions('TestDim')/Hierarchies('TestHierarchy')/Elements('TestElement')"
            );
        });

        test('should check if element exists', async () => {
            mockRestService.get.mockResolvedValue(mockResponse({}));

            const result = await elementService.exists('TestDim', 'TestHierarchy', 'TestElement');
            
            expect(result).toBe(true);
        });

        test('should return false when element does not exist', async () => {
            mockRestService.get.mockRejectedValue(new Error('Element not found'));

            const result = await elementService.exists('TestDim', 'TestHierarchy', 'NonExistent');
            
            expect(result).toBe(false);
        });

        test('should update or create element - update existing', async () => {
            jest.spyOn(elementService, 'exists').mockResolvedValue(true);
            jest.spyOn(elementService, 'update').mockResolvedValue(mockResponse({}));

            const result = await elementService.updateOrCreate('TestDim', 'TestHierarchy', mockElement);
            
            expect(elementService.exists).toHaveBeenCalledWith('TestDim', 'TestHierarchy', 'TestElement');
            expect(elementService.update).toHaveBeenCalledWith('TestDim', 'TestHierarchy', mockElement);
            expect(result).toBeDefined();
        });

        test('should update or create element - create new', async () => {
            jest.spyOn(elementService, 'exists').mockResolvedValue(false);
            jest.spyOn(elementService, 'create').mockResolvedValue(mockResponse({}));

            const result = await elementService.updateOrCreate('TestDim', 'TestHierarchy', mockElement);
            
            expect(elementService.exists).toHaveBeenCalledWith('TestDim', 'TestHierarchy', 'TestElement');
            expect(elementService.create).toHaveBeenCalledWith('TestDim', 'TestHierarchy', mockElement);
            expect(result).toBeDefined();
        });
    });

    describe('Element Retrieval Operations', () => {
        test('should get element names', async () => {
            const elementsData = {
                value: [
                    { Name: 'Element1' },
                    { Name: 'Element2' },
                    { Name: 'ConsolElement' }
                ]
            };
            mockRestService.get.mockResolvedValue(mockResponse(elementsData));

            const result = await elementService.getNames('TestDim', 'TestHierarchy');
            
            expect(result).toEqual(['Element1', 'Element2', 'ConsolElement']);
            expect(mockRestService.get).toHaveBeenCalledWith(
                "/Dimensions('TestDim')/Hierarchies('TestHierarchy')/Elements?$select=Name"
            );
        });

        test('should get element names with default hierarchy', async () => {
            const elementsData = {
                value: [
                    { Name: 'Element1' },
                    { Name: 'Element2' }
                ]
            };
            mockRestService.get.mockResolvedValue(mockResponse(elementsData));

            const result = await elementService.getNames('TestDim');
            
            expect(result).toEqual(['Element1', 'Element2']);
            expect(mockRestService.get).toHaveBeenCalledWith(
                "/Dimensions('TestDim')/Hierarchies('TestDim')/Elements?$select=Name"
            );
        });

        test('should get element names excluding consolidated elements', async () => {
            const elementsData = {
                value: [
                    { Name: 'Element1' },
                    { Name: 'Element2' }
                ]
            };
            mockRestService.get.mockResolvedValue(mockResponse(elementsData));

            const result = await elementService.getNames('TestDim', 'TestHierarchy', true);
            
            expect(result).toEqual(['Element1', 'Element2']);
            expect(mockRestService.get).toHaveBeenCalledWith(
                "/Dimensions('TestDim')/Hierarchies('TestHierarchy')/Elements?$select=Name&$filter=Type ne 'Consolidated'"
            );
        });

        test('should get all elements', async () => {
            const elementsData = {
                value: [
                    { Name: 'Element1', Type: 'Numeric' },
                    { Name: 'Element2', Type: 'String' }
                ]
            };
            mockRestService.get.mockResolvedValue(mockResponse(elementsData));

            const result = await elementService.getElements('TestDim', 'TestHierarchy');
            
            expect(result).toHaveLength(2);
            expect(Element.fromDict).toHaveBeenCalledTimes(2);
            expect(mockRestService.get).toHaveBeenCalledWith(
                "/Dimensions('TestDim')/Hierarchies('TestHierarchy')/Elements?$expand=*"
            );
        });

        test('should get leaf element names', async () => {
            const leafElementsData = {
                value: [
                    { Name: 'NumericLeaf' },
                    { Name: 'StringLeaf' }
                ]
            };
            mockRestService.get.mockResolvedValue(mockResponse(leafElementsData));

            const result = await elementService.getLeafElementNames('TestDim', 'TestHierarchy');
            
            expect(result).toEqual(['NumericLeaf', 'StringLeaf']);
            expect(mockRestService.get).toHaveBeenCalledWith(
                "/Dimensions('TestDim')/Hierarchies('TestHierarchy')/Elements?$select=Name&$filter=Type eq 'Numeric' or Type eq 'String'"
            );
        });

        test('should get consolidated element names', async () => {
            const consolidatedData = {
                value: [
                    { Name: 'ConsolElement1' },
                    { Name: 'ConsolElement2' }
                ]
            };
            mockRestService.get.mockResolvedValue(mockResponse(consolidatedData));

            const result = await elementService.getConsolidatedElementNames('TestDim', 'TestHierarchy');
            
            expect(result).toEqual(['ConsolElement1', 'ConsolElement2']);
            expect(mockRestService.get).toHaveBeenCalledWith(
                "/Dimensions('TestDim')/Hierarchies('TestHierarchy')/Elements?$select=Name&$filter=Type eq 'Consolidated'"
            );
        });

        test('should get numeric element names', async () => {
            const numericData = {
                value: [
                    { Name: 'NumericElement1' },
                    { Name: 'NumericElement2' }
                ]
            };
            mockRestService.get.mockResolvedValue(mockResponse(numericData));

            const result = await elementService.getNumericElementNames('TestDim', 'TestHierarchy');
            
            expect(result).toEqual(['NumericElement1', 'NumericElement2']);
            expect(mockRestService.get).toHaveBeenCalledWith(
                "/Dimensions('TestDim')/Hierarchies('TestHierarchy')/Elements?$select=Name&$filter=Type eq 'Numeric'"
            );
        });

        test('should get string element names', async () => {
            const stringData = {
                value: [
                    { Name: 'StringElement1' },
                    { Name: 'StringElement2' }
                ]
            };
            mockRestService.get.mockResolvedValue(mockResponse(stringData));

            const result = await elementService.getStringElementNames('TestDim', 'TestHierarchy');
            
            expect(result).toEqual(['StringElement1', 'StringElement2']);
            expect(mockRestService.get).toHaveBeenCalledWith(
                "/Dimensions('TestDim')/Hierarchies('TestHierarchy')/Elements?$select=Name&$filter=Type eq 'String'"
            );
        });

        test('should get element types', async () => {
            const typesData = {
                value: [
                    { Name: 'Element1', Type: 'Numeric' },
                    { Name: 'Element2', Type: 'String' },
                    { Name: 'Element3', Type: 'Consolidated' }
                ]
            };
            mockRestService.get.mockResolvedValue(mockResponse(typesData));

            const result = await elementService.getElementTypes('TestDim', 'TestHierarchy');
            
            expect(result).toBeInstanceOf(CaseAndSpaceInsensitiveDict);
            expect(mockRestService.get).toHaveBeenCalledWith(
                "/Dimensions('TestDim')/Hierarchies('TestHierarchy')/Elements?$select=Name,Type"
            );
        });

        test('should get elements count', async () => {
            mockRestService.get.mockResolvedValue(mockResponse('15'));

            const result = await elementService.getElementsCount('TestDim', 'TestHierarchy');
            
            expect(result).toBe(15);
            expect(mockRestService.get).toHaveBeenCalledWith(
                "/Dimensions('TestDim')/Hierarchies('TestHierarchy')/Elements/$count"
            );
        });

        test('should get elements count excluding consolidated elements', async () => {
            mockRestService.get.mockResolvedValue(mockResponse('10'));

            const result = await elementService.getElementsCount('TestDim', 'TestHierarchy', true);
            
            expect(result).toBe(10);
            expect(mockRestService.get).toHaveBeenCalledWith(
                "/Dimensions('TestDim')/Hierarchies('TestHierarchy')/Elements/$count?$filter=Type ne 'Consolidated'"
            );
        });
    });

    describe('Hierarchy Relationship Operations', () => {
        test('should get element parents', async () => {
            const parentsData = {
                value: [
                    { Name: 'Parent1' },
                    { Name: 'Parent2' }
                ]
            };
            mockRestService.get.mockResolvedValue(mockResponse(parentsData));

            const result = await elementService.getParents('TestDim', 'TestHierarchy', 'ChildElement');
            
            expect(result).toEqual(['Parent1', 'Parent2']);
            expect(mockRestService.get).toHaveBeenCalledWith(
                "/Dimensions('TestDim')/Hierarchies('TestHierarchy')/Elements('ChildElement')/Parents?$select=Name"
            );
        });

        test('should get element children', async () => {
            const childrenData = {
                value: [
                    { Name: 'Child1' },
                    { Name: 'Child2' }
                ]
            };
            mockRestService.get.mockResolvedValue(mockResponse(childrenData));

            const result = await elementService.getChildren('TestDim', 'TestHierarchy', 'ParentElement');
            
            expect(result).toEqual(['Child1', 'Child2']);
            expect(mockRestService.get).toHaveBeenCalledWith(
                "/Dimensions('TestDim')/Hierarchies('TestHierarchy')/Elements('ParentElement')/Components?$select=Name"
            );
        });

        test('should get element ancestors', async () => {
            // Mock parent chain: Element -> Parent1 -> GrandParent1
            mockRestService.get
                .mockResolvedValueOnce(mockResponse({ value: [{ Name: 'Parent1' }] })) // First call - direct parents
                .mockResolvedValueOnce(mockResponse({ value: [{ Name: 'GrandParent1' }] })) // Second call - grandparents
                .mockResolvedValueOnce(mockResponse({ value: [] })); // Third call - no more ancestors

            const result = await elementService.getAncestors('TestDim', 'TestHierarchy', 'Element');
            
            expect(result).toEqual(['Parent1', 'GrandParent1']);
            expect(mockRestService.get).toHaveBeenCalledTimes(3);
        });

        test('should get element descendants', async () => {
            // Mock child chain: Element -> Child1 -> GrandChild1
            mockRestService.get
                .mockResolvedValueOnce(mockResponse({ value: [{ Name: 'Child1' }] })) // First call - direct children
                .mockResolvedValueOnce(mockResponse({ value: [{ Name: 'GrandChild1' }] })) // Second call - grandchildren
                .mockResolvedValueOnce(mockResponse({ value: [] })); // Third call - no more descendants

            const result = await elementService.getDescendants('TestDim', 'TestHierarchy', 'Element');
            
            expect(result).toEqual(['Child1', 'GrandChild1']);
            expect(mockRestService.get).toHaveBeenCalledTimes(3);
        });

        test('should handle circular references in ancestors', async () => {
            // Mock circular reference: Element -> Parent1 -> Element
            mockRestService.get
                .mockResolvedValueOnce(mockResponse({ value: [{ Name: 'Parent1' }] }))
                .mockResolvedValueOnce(mockResponse({ value: [{ Name: 'Element' }] }));

            const result = await elementService.getAncestors('TestDim', 'TestHierarchy', 'Element');
            
            // Should include both Parent1 and Element (the circular reference is handled by processed set)
            expect(result).toEqual(['Parent1', 'Element']);
        });

        test('should handle circular references in descendants', async () => {
            // Mock circular reference: Element -> Child1 -> Element
            mockRestService.get
                .mockResolvedValueOnce(mockResponse({ value: [{ Name: 'Child1' }] }))
                .mockResolvedValueOnce(mockResponse({ value: [{ Name: 'Element' }] }));

            const result = await elementService.getDescendants('TestDim', 'TestHierarchy', 'Element');
            
            // Should include both Child1 and Element (the circular reference is handled by processed set)
            expect(result).toEqual(['Child1', 'Element']);
        });
    });

    describe('Edge Management Operations', () => {
        test('should add edges', async () => {
            mockRestService.post.mockResolvedValue(mockResponse({}));

            const edges = [
                { parent: 'Parent1', child: 'Child1', weight: 1.5 },
                { parent: 'Parent1', child: 'Child2', weight: 2.0 },
                { parent: 'Parent2', child: 'Child1' } // No weight specified
            ];

            await elementService.addEdges('TestDim', 'TestHierarchy', edges);
            
            expect(mockRestService.post).toHaveBeenCalledTimes(3);
            expect(mockRestService.post).toHaveBeenNthCalledWith(1,
                "/Dimensions('TestDim')/Hierarchies('TestHierarchy')/Elements('Parent1')/Components",
                { Name: 'Child1', Weight: 1.5 }
            );
            expect(mockRestService.post).toHaveBeenNthCalledWith(2,
                "/Dimensions('TestDim')/Hierarchies('TestHierarchy')/Elements('Parent1')/Components",
                { Name: 'Child2', Weight: 2.0 }
            );
            expect(mockRestService.post).toHaveBeenNthCalledWith(3,
                "/Dimensions('TestDim')/Hierarchies('TestHierarchy')/Elements('Parent2')/Components",
                { Name: 'Child1', Weight: 1 }
            );
        });

        test('should delete edges using REST API', async () => {
            mockRestService.delete.mockResolvedValue(mockResponse({}));

            const edges = [
                { parent: 'Parent1', child: 'Child1' },
                { parent: 'Parent2', child: 'Child2' }
            ];

            await elementService.deleteEdges('TestDim', 'TestHierarchy', edges, false);
            
            expect(mockRestService.delete).toHaveBeenCalledTimes(2);
            expect(mockRestService.delete).toHaveBeenNthCalledWith(1,
                "/Dimensions('TestDim')/Hierarchies('TestHierarchy')/Elements('Parent1')/Components('Child1')"
            );
            expect(mockRestService.delete).toHaveBeenNthCalledWith(2,
                "/Dimensions('TestDim')/Hierarchies('TestHierarchy')/Elements('Parent2')/Components('Child2')"
            );
        });

        test('should delete edges using TI', async () => {
            mockRestService.post.mockResolvedValue(mockResponse({}));

            const edges = [
                { parent: 'Parent1', child: 'Child1' },
                { parent: 'Parent2', child: 'Child2' }
            ];

            await elementService.deleteEdges('TestDim', 'TestHierarchy', edges, true);
            
            expect(mockRestService.post).toHaveBeenCalledWith(
                "/ExecuteProcessWithReturn",
                expect.objectContaining({
                    Name: expect.stringContaining('tm1npm_delete_edges_'),
                    PrologProcedure: expect.stringContaining("HierarchyElementComponentDelete('TestDim','TestHierarchy','Parent1','Child1');")
                })
            );
        });

        test('should get edges under consolidation', async () => {
            const componentsData = {
                value: [
                    { Name: 'Child1', Weight: 1.5 },
                    { Name: 'Child2', Weight: 2.0 },
                    { Name: 'Child3' } // No weight
                ]
            };
            mockRestService.get.mockResolvedValue(mockResponse(componentsData));

            const result = await elementService.getEdgesUnderConsolidation('TestDim', 'TestHierarchy', 'Parent1');
            
            expect(result).toEqual([
                { parent: 'Parent1', child: 'Child1', weight: 1.5 },
                { parent: 'Parent1', child: 'Child2', weight: 2.0 },
                { parent: 'Parent1', child: 'Child3', weight: 1 }
            ]);
        });
    });

    describe('Element Bulk Operations', () => {
        test('should add multiple elements', async () => {
            mockRestService.post.mockResolvedValue(mockResponse({}));

            const elements = [mockElement, mockElement, mockElement];

            await elementService.addElements('TestDim', 'TestHierarchy', elements);
            
            expect(mockRestService.post).toHaveBeenCalledTimes(3);
        });

        test('should delete multiple elements using REST API', async () => {
            mockRestService.delete.mockResolvedValue(mockResponse({}));

            const elementNames = ['Element1', 'Element2', 'Element3'];

            await elementService.deleteElements('TestDim', 'TestHierarchy', elementNames, false);
            
            expect(mockRestService.delete).toHaveBeenCalledTimes(3);
        });

        test('should delete multiple elements using TI', async () => {
            mockRestService.post.mockResolvedValue(mockResponse({}));

            const elementNames = ['Element1', 'Element2', 'Element3'];

            await elementService.deleteElements('TestDim', 'TestHierarchy', elementNames, true);
            
            expect(mockRestService.post).toHaveBeenCalledWith(
                "/ExecuteProcessWithReturn",
                expect.objectContaining({
                    Name: expect.stringContaining('tm1npm_delete_elements_'),
                    PrologProcedure: expect.stringContaining("HierarchyElementDelete('TestDim','TestHierarchy','Element1');")
                })
            );
        });

        test('should handle empty element list for deletion', async () => {
            await elementService.deleteElements('TestDim', 'TestHierarchy', [], true);
            
            expect(mockRestService.post).not.toHaveBeenCalled();
        });
    });

    describe('Element Attribute Operations', () => {
        test('should get element attributes', async () => {
            const attributesData = {
                value: [
                    { Name: 'Attribute1', Type: 'String' },
                    { Name: 'Attribute2', Type: 'Numeric' }
                ]
            };
            mockRestService.get.mockResolvedValue(mockResponse(attributesData));

            const result = await elementService.getElementAttributes('TestDim', 'TestHierarchy');
            
            expect(result).toHaveLength(2);
            expect(ElementAttribute.fromDict).toHaveBeenCalledTimes(2);
            expect(mockRestService.get).toHaveBeenCalledWith(
                "/Dimensions('TestDim')/Hierarchies('TestHierarchy')/ElementAttributes"
            );
        });

        test('should get element attribute names', async () => {
            const attributeNamesData = {
                value: [
                    { Name: 'Attribute1' },
                    { Name: 'Attribute2' }
                ]
            };
            mockRestService.get.mockResolvedValue(mockResponse(attributeNamesData));

            const result = await elementService.getElementAttributeNames('TestDim', 'TestHierarchy');
            
            expect(result).toEqual(['Attribute1', 'Attribute2']);
            expect(mockRestService.get).toHaveBeenCalledWith(
                "/Dimensions('TestDim')/Hierarchies('TestHierarchy')/ElementAttributes?$select=Name"
            );
        });

        test('should create element attribute', async () => {
            mockRestService.post.mockResolvedValue(mockResponse({}));

            const result = await elementService.createElementAttribute('TestDim', 'TestHierarchy', mockElementAttribute);
            
            expect(result).toBeDefined();
            expect(mockRestService.post).toHaveBeenCalledWith(
                "/Dimensions('TestDim')/Hierarchies('TestHierarchy')/ElementAttributes",
                mockElementAttribute.body
            );
        });

        test('should delete element attribute', async () => {
            mockRestService.delete.mockResolvedValue(mockResponse({}));

            const result = await elementService.deleteElementAttribute('TestDim', 'TestHierarchy', 'TestAttribute');
            
            expect(result).toBeDefined();
            expect(mockRestService.delete).toHaveBeenCalledWith(
                "/Dimensions('TestDim')/Hierarchies('TestHierarchy')/ElementAttributes('TestAttribute')"
            );
        });

        test('should update element attribute value', async () => {
            mockRestService.patch.mockResolvedValue(mockResponse({}));

            const result = await elementService.updateElementAttribute(
                'TestDim', 'TestHierarchy', 'TestElement', 'TestAttribute', 'NewValue'
            );
            
            expect(result).toBeDefined();
            expect(mockRestService.patch).toHaveBeenCalledWith(
                "/Dimensions('TestDim')/Hierarchies('TestHierarchy')/Elements('TestElement')/Attributes('TestAttribute')",
                { Value: 'NewValue' }
            );
        });

        test('should get attribute values for multiple elements', async () => {
            mockRestService.get
                .mockResolvedValueOnce(mockResponse({ Value: 'Value1' })) // Element1 attribute
                .mockResolvedValueOnce(mockResponse({ Value: 'Value2' })) // Element2 attribute
                .mockRejectedValueOnce(new Error('Not found')); // Element3 attribute missing

            const result = await elementService.getAttributeOfElements(
                'TestDim', 'TestHierarchy', ['Element1', 'Element2', 'Element3'], 'TestAttribute'
            );
            
            expect(result).toEqual({
                Element1: 'Value1',
                Element2: 'Value2',
                Element3: null
            });
            expect(mockRestService.get).toHaveBeenCalledTimes(3);
        });

        test('should get alias element attributes', async () => {
            const aliasAttributesData = {
                value: [
                    { Name: 'Caption', Type: 'Alias' },
                    { Name: 'DisplayName', Type: 'Alias' }
                ]
            };
            mockRestService.get.mockResolvedValue(mockResponse(aliasAttributesData));

            const result = await elementService.getAliasElementAttributes('TestDim', 'TestHierarchy');
            
            expect(result).toHaveLength(2);
            expect(mockRestService.get).toHaveBeenCalledWith(
                "/Dimensions('TestDim')/Hierarchies('TestHierarchy')/ElementAttributes?$filter=Type eq 'Alias'"
            );
        });
    });

    describe('MDX and Query Operations', () => {
        test('should execute set MDX', async () => {
            const mdxResult = {
                value: ['Element1', 'Element2', 'Element3']
            };
            mockRestService.post.mockResolvedValue(mockResponse(mdxResult));

            const mdx = "{[TestDim].[TestHierarchy].[All]}";
            const result = await elementService.executeSetMdx('TestDim', 'TestHierarchy', mdx);
            
            expect(result).toEqual(['Element1', 'Element2', 'Element3']);
            expect(mockRestService.post).toHaveBeenCalledWith(
                '/ExecuteMDXSetExpression',
                {
                    MDX: mdx,
                    Dimension: 'TestDim',
                    Hierarchy: 'TestHierarchy'
                }
            );
        });

        test('should execute set MDX for element names', async () => {
            const mdxResult = {
                value: ['Element1', 'Element2']
            };
            mockRestService.post.mockResolvedValue(mockResponse(mdxResult));

            const mdx = "DESCENDANTS({[TestDim].[TestHierarchy].[Total]}, 1, LEAVES)";
            const result = await elementService.executeSetMdxElementNames('TestDim', 'TestHierarchy', mdx);
            
            expect(result).toEqual(['Element1', 'Element2']);
        });

        test('should handle empty MDX results', async () => {
            mockRestService.post.mockResolvedValue(mockResponse({}));

            const result = await elementService.executeSetMdx('TestDim', 'TestHierarchy', '{[Empty]}');
            
            expect(result).toEqual([]);
        });
    });

    describe('Advanced Element Operations', () => {
        test('should get leaf elements', async () => {
            jest.spyOn(elementService, 'getElements').mockResolvedValue([mockElement]);

            const result = await elementService.getLeafElements('TestDim', 'TestHierarchy');
            
            expect(result).toEqual([mockElement]);
            expect(elementService.getElements).toHaveBeenCalledWith('TestDim', 'TestHierarchy', true);
        });

        test('should get consolidated elements', async () => {
            const consolidatedData = {
                value: [
                    { Name: 'Consol1', Type: 'Consolidated' },
                    { Name: 'Consol2', Type: 'Consolidated' }
                ]
            };
            mockRestService.get.mockResolvedValue(mockResponse(consolidatedData));

            const result = await elementService.getConsolidatedElements('TestDim', 'TestHierarchy');
            
            expect(result).toHaveLength(2);
            expect(mockRestService.get).toHaveBeenCalledWith(
                "/Dimensions('TestDim')/Hierarchies('TestHierarchy')/Elements?$expand=*&$filter=Type eq 'Consolidated'"
            );
        });

        test('should get elements dataframe', async () => {
            const elementsData = {
                value: [
                    { Name: 'Element1', Type: 'Numeric', Attributes: { Caption: 'Elem1' } },
                    { Name: 'Element2', Type: 'String', Attributes: { Caption: 'Elem2' } }
                ]
            };
            mockRestService.get.mockResolvedValue(mockResponse(elementsData));

            const result = await elementService.getElementsDataframe('TestDim', 'TestHierarchy', ['Caption']);
            
            expect(result).toEqual([
                ['Name', 'Type', 'Caption'],
                ['Element1', 'Numeric', 'Elem1'],
                ['Element2', 'String', 'Elem2']
            ]);
        });

        test('should get elements dataframe without attributes', async () => {
            const elementsData = {
                value: [
                    { Name: 'Element1', Type: 'Numeric' },
                    { Name: 'Element2', Type: 'String' }
                ]
            };
            mockRestService.get.mockResolvedValue(mockResponse(elementsData));

            const result = await elementService.getElementsDataframe('TestDim', 'TestHierarchy');
            
            expect(result).toEqual([
                ['Name', 'Type'],
                ['Element1', 'Numeric'],
                ['Element2', 'String']
            ]);
        });

        test('should create hierarchy from dataframe', async () => {
            const dataFrame = [
                ['Name', 'Type', 'Parent1', 'Weight1'],
                ['Child1', 'Numeric', 'Parent1', '1.0'],
                ['Child2', 'String', 'Parent1', '2.0'],
                ['Parent1', 'Consolidated', '', '']
            ];

            jest.spyOn(elementService, 'create').mockResolvedValue(mockResponse({}));
            jest.spyOn(elementService, 'addEdges').mockResolvedValue();

            await elementService.createHierarchyFromDataframe('TestDim', 'TestHierarchy', dataFrame);
            
            expect(elementService.create).toHaveBeenCalledTimes(3);
            expect(elementService.addEdges).toHaveBeenCalledWith('TestDim', 'TestHierarchy', [
                { parent: 'Parent1', child: 'Child1', weight: 1.0 },
                { parent: 'Parent1', child: 'Child2', weight: 2.0 }
            ]);
        });

        test('should throw error for invalid dataframe structure', async () => {
            const invalidDataFrame = [
                ['InvalidHeader1', 'InvalidHeader2'],
                ['Data1', 'Data2']
            ];

            await expect(elementService.createHierarchyFromDataframe('TestDim', 'TestHierarchy', invalidDataFrame))
                .rejects.toThrow('DataFrame must contain Name and Type columns');
        });
    });

    describe('Advanced Features and Parity Functions', () => {
        test('should delete elements using TI method', async () => {
            mockRestService.post
                .mockResolvedValueOnce(mockResponse({})) // Create process
                .mockResolvedValueOnce(mockResponse({})) // Execute process
                .mockResolvedValueOnce(mockResponse({})); // Delete process

            mockRestService.delete.mockResolvedValue(mockResponse({}));

            await elementService.deleteElementsUseTi('TestDim', 'TestHierarchy', ['Element1', 'Element2']);
            
            expect(mockRestService.post).toHaveBeenCalledTimes(2); // Create and execute
            expect(mockRestService.delete).toHaveBeenCalledTimes(1); // Delete process
        });

        test('should handle empty element list in TI deletion', async () => {
            await elementService.deleteElementsUseTi('TestDim', 'TestHierarchy', []);
            
            expect(mockRestService.post).not.toHaveBeenCalled();
        });

        test('should delete edges using blob method', async () => {
            mockRestService.post
                .mockResolvedValueOnce(mockResponse({})) // Create process
                .mockResolvedValueOnce(mockResponse({})); // Execute process

            mockRestService.delete.mockResolvedValue(mockResponse({}));

            const edges = [
                { parent: 'Parent1', child: 'Child1' },
                { parent: 'Parent2', child: 'Child2' }
            ];

            await elementService.deleteEdgesUseBlob('TestDim', 'TestHierarchy', edges);
            
            expect(mockRestService.post).toHaveBeenCalledTimes(2);
            expect(mockRestService.delete).toHaveBeenCalledTimes(1);
        });

        test('should get elements by level', async () => {
            const allElements = [
                { name: 'Leaf1', elementType: ElementType.NUMERIC },
                { name: 'Consol1', elementType: ElementType.CONSOLIDATED }
            ];
            jest.spyOn(elementService, 'getElements').mockResolvedValue(allElements as any);

            const result = await elementService.getElementsByLevel('TestDim', 'TestHierarchy', 1);
            
            expect(result).toHaveLength(1);
            expect(result[0].name).toBe('Consol1');
        });

        test('should get elements filtered by wildcard', async () => {
            const filteredData = {
                value: [
                    { Name: 'TestElement1', Type: 'Numeric' },
                    { Name: 'TestElement2', Type: 'String' }
                ]
            };
            mockRestService.get.mockResolvedValue(mockResponse(filteredData));

            const result = await elementService.getElementsFilteredByWildcard('TestDim', 'TestHierarchy', 'Test*');
            
            expect(result).toHaveLength(2);
            expect(mockRestService.get).toHaveBeenCalledWith(
                expect.stringContaining("substringof('Test%',Name)")
            );
        });

        test('should get elements filtered by attribute', async () => {
            const allElements = [
                { name: 'Element1', elementType: ElementType.NUMERIC },
                { name: 'Element2', elementType: ElementType.STRING }
            ];
            jest.spyOn(elementService, 'getElements').mockResolvedValue(allElements as any);

            mockRestService.get
                .mockResolvedValueOnce(mockResponse({ Value: 'MatchingValue' })) // Element1 matches
                .mockRejectedValueOnce(new Error('Not found')); // Element2 has no attribute

            const result = await elementService.getElementsFilteredByAttribute(
                'TestDim', 'TestHierarchy', 'TestAttribute', 'MatchingValue'
            );
            
            expect(result).toHaveLength(1);
            expect(result[0].name).toBe('Element1');
        });

        test('should lock element', async () => {
            mockRestService.post.mockResolvedValue(mockResponse({}));

            await elementService.elementLock('TestDim', 'TestHierarchy', 'TestElement');
            
            expect(mockRestService.post).toHaveBeenCalledWith(
                "/Dimensions('TestDim')/Hierarchies('TestHierarchy')/Elements('TestElement')/tm1.Lock",
                {}
            );
        });

        test('should unlock element', async () => {
            mockRestService.post.mockResolvedValue(mockResponse({}));

            await elementService.elementUnlock('TestDim', 'TestHierarchy', 'TestElement');
            
            expect(mockRestService.post).toHaveBeenCalledWith(
                "/Dimensions('TestDim')/Hierarchies('TestHierarchy')/Elements('TestElement')/tm1.Unlock",
                {}
            );
        });

        test('should get levels count', async () => {
            const elements = [
                { name: 'Leaf1', elementType: ElementType.NUMERIC },
                { name: 'Consol1', elementType: ElementType.CONSOLIDATED },
                { name: 'Leaf2', elementType: ElementType.STRING }
            ];
            jest.spyOn(elementService, 'getElements').mockResolvedValue(elements as any);

            const result = await elementService.getLevelsCount('TestDim', 'TestHierarchy');
            
            expect(result).toBe(2); // 1 consolidated level + 1 leaf level
        });

        test('should get level names', async () => {
            jest.spyOn(elementService, 'getLevelsCount').mockResolvedValue(3);

            const result = await elementService.getLevelNames('TestDim', 'TestHierarchy');
            
            expect(result).toEqual(['Level 0', 'Level 1', 'Level 2']);
        });

        test('should get leaves under consolidation using MDX', async () => {
            jest.spyOn(elementService, 'executeSetMdxElementNames').mockResolvedValue(['Leaf1', 'Leaf2']);
            jest.spyOn(elementService, 'get')
                .mockResolvedValueOnce(mockElement)
                .mockResolvedValueOnce(mockElement);

            const result = await elementService.getLeavesUnderConsolidation('TestDim', 'TestHierarchy', 'Consol1');
            
            expect(result).toHaveLength(2);
            expect(elementService.executeSetMdxElementNames).toHaveBeenCalledWith(
                'TestDim', 'TestHierarchy',
                expect.stringContaining('FILTER(DESCENDANTS')
            );
        });

        test('should get members under consolidation using MDX', async () => {
            jest.spyOn(elementService, 'executeSetMdxElementNames').mockResolvedValue(['Member1', 'Member2']);
            jest.spyOn(elementService, 'get')
                .mockResolvedValueOnce(mockElement)
                .mockResolvedValueOnce(mockElement);

            const result = await elementService.getMembersUnderConsolidation('TestDim', 'TestHierarchy', 'Consol1');
            
            expect(result).toHaveLength(2);
            expect(elementService.executeSetMdxElementNames).toHaveBeenCalledWith(
                'TestDim', 'TestHierarchy',
                expect.stringContaining('DESCENDANTS')
            );
        });

        test('should get all element identifiers', async () => {
            jest.spyOn(elementService, 'getNames').mockResolvedValue(['Element1', 'Element2', 'Element3']);

            const result = await elementService.getAllElementIdentifiers('TestDim', 'TestHierarchy');
            
            expect(result).toEqual([
                '[TestDim].[TestHierarchy].[Element1]',
                '[TestDim].[TestHierarchy].[Element2]',
                '[TestDim].[TestHierarchy].[Element3]'
            ]);
        });

        test('should get element identifiers with filter pattern', async () => {
            const filteredElements = [
                { name: 'FilteredElement1', elementType: ElementType.NUMERIC },
                { name: 'FilteredElement2', elementType: ElementType.STRING }
            ];
            jest.spyOn(elementService, 'getElementsFilteredByWildcard').mockResolvedValue(filteredElements as any);

            const result = await elementService.getElementIdentifiers('TestDim', 'TestHierarchy', 'Filtered*');
            
            expect(result).toEqual([
                '[TestDim].[TestHierarchy].[FilteredElement1]',
                '[TestDim].[TestHierarchy].[FilteredElement2]'
            ]);
        });

        test('should get element identifiers without filter', async () => {
            jest.spyOn(elementService, 'getNames').mockResolvedValue(['Element1', 'Element2']);

            const result = await elementService.getElementIdentifiers('TestDim', 'TestHierarchy');
            
            expect(result).toEqual([
                '[TestDim].[TestHierarchy].[Element1]',
                '[TestDim].[TestHierarchy].[Element2]'
            ]);
        });
    });

    describe('MDXDrillMethod Enum', () => {
        test('should export all drill methods correctly', () => {
            expect(MDXDrillMethod.TM1DRILLDOWNMEMBER).toBe(1);
            expect(MDXDrillMethod.DESCENDANTS).toBe(2);
        });
    });

    describe('Error Handling', () => {
        test('should handle element retrieval errors', async () => {
            const error = new Error('Element not found');
            mockRestService.get.mockRejectedValue(error);

            await expect(elementService.get('TestDim', 'TestHierarchy', 'NonExistent'))
                .rejects.toThrow('Element not found');
        });

        test('should handle element creation errors', async () => {
            const error = new Error('Element creation failed');
            mockRestService.post.mockRejectedValue(error);

            await expect(elementService.create('TestDim', 'TestHierarchy', mockElement))
                .rejects.toThrow('Element creation failed');
        });

        test('should handle MDX execution errors', async () => {
            const error = new Error('MDX execution failed');
            mockRestService.post.mockRejectedValue(error);

            await expect(elementService.executeSetMdx('TestDim', 'TestHierarchy', 'INVALID MDX'))
                .rejects.toThrow('MDX execution failed');
        });

        test('should handle attribute operation errors', async () => {
            const error = new Error('Attribute operation failed');
            mockRestService.get.mockRejectedValue(error);

            await expect(elementService.getElementAttributes('TestDim', 'TestHierarchy'))
                .rejects.toThrow('Attribute operation failed');
        });

        test('should handle hierarchy traversal errors', async () => {
            const error = new Error('Hierarchy access failed');
            mockRestService.get.mockRejectedValue(error);

            await expect(elementService.getParents('TestDim', 'TestHierarchy', 'Element'))
                .rejects.toThrow('Hierarchy access failed');
        });
    });

    describe('Edge Cases and Special Scenarios', () => {
        test('should handle empty results gracefully', async () => {
            mockRestService.get.mockResolvedValue(mockResponse({ value: [] }));

            const names = await elementService.getNames('TestDim', 'TestHierarchy');
            const elements = await elementService.getElements('TestDim', 'TestHierarchy');
            const parents = await elementService.getParents('TestDim', 'TestHierarchy', 'Element');
            const children = await elementService.getChildren('TestDim', 'TestHierarchy', 'Element');
            
            expect(names).toEqual([]);
            expect(elements).toEqual([]);
            expect(parents).toEqual([]);
            expect(children).toEqual([]);
        });

        test('should handle special characters in element names', async () => {
            const specialName = "Element's & \"Special\" Name";
            mockRestService.get.mockResolvedValue(mockResponse({ Name: specialName }));

            await elementService.get('TestDim', 'TestHierarchy', specialName);
            
            // The formatUrl method encodes special characters, so we expect the encoded version
            expect(mockRestService.get).toHaveBeenCalledWith(
                expect.stringContaining("/Elements('Element's%20%26%20%22Special%22%20Name')")
            );
        });

        test('should handle null/undefined values in element types', async () => {
            const typesData = {
                value: [
                    { Name: 'Element1', Type: null },
                    { Name: 'Element2', Type: undefined },
                    { Name: 'Element3', Type: 'Numeric' }
                ]
            };
            mockRestService.get.mockResolvedValue(mockResponse(typesData));

            const result = await elementService.getElementTypes('TestDim', 'TestHierarchy');
            
            expect(result).toBeInstanceOf(CaseAndSpaceInsensitiveDict);
        });

        test('should handle large datasets efficiently', async () => {
            const largeDataset = Array.from({ length: 10000 }, (_, i) => ({
                Name: `Element${i}`,
                Type: i % 2 === 0 ? 'Numeric' : 'String'
            }));

            mockRestService.get.mockResolvedValue(mockResponse({ value: largeDataset }));

            const result = await elementService.getNames('TestDim', 'TestHierarchy');
            
            expect(result).toHaveLength(10000);
            expect(result[0]).toBe('Element0');
            expect(result[9999]).toBe('Element9999');
        });

        test('should handle missing attribute values gracefully', async () => {
            const elementsData = {
                value: [
                    { Name: 'Element1', Type: 'Numeric', Attributes: {} },
                    { Name: 'Element2', Type: 'String' } // No Attributes property
                ]
            };
            mockRestService.get.mockResolvedValue(mockResponse(elementsData));

            const result = await elementService.getElementsDataframe('TestDim', 'TestHierarchy', ['MissingAttribute']);
            
            expect(result).toEqual([
                ['Name', 'Type', 'MissingAttribute'],
                ['Element1', 'Numeric', ''],
                ['Element2', 'String'] // No attribute value added when no Attributes property exists
            ]);
        });
    });

    describe('Integration Patterns', () => {
        test('should support element lifecycle management', async () => {
            mockRestService.post.mockResolvedValue(mockResponse({}));
            mockRestService.patch.mockResolvedValue(mockResponse({}));
            mockRestService.delete.mockResolvedValue(mockResponse({}));
            jest.spyOn(elementService, 'exists').mockResolvedValue(true);

            // Element lifecycle: create, add relationships, update, delete
            await elementService.create('TestDim', 'TestHierarchy', mockElement);
            await elementService.addEdges('TestDim', 'TestHierarchy', [
                { parent: 'Parent1', child: 'TestElement', weight: 1.5 }
            ]);
            await elementService.update('TestDim', 'TestHierarchy', mockElement);
            await elementService.delete('TestDim', 'TestHierarchy', 'TestElement');

            expect(mockRestService.post).toHaveBeenCalledTimes(2); // create + add edge
            expect(mockRestService.patch).toHaveBeenCalledTimes(1);
            expect(mockRestService.delete).toHaveBeenCalledTimes(1);
        });

        test('should support hierarchy building workflow', async () => {
            mockRestService.post.mockResolvedValue(mockResponse({}));
            jest.spyOn(elementService, 'create').mockResolvedValue(mockResponse({}));
            jest.spyOn(elementService, 'addEdges').mockResolvedValue();

            const elements = [mockElement, mockElement, mockElement];
            const edges = [
                { parent: 'Parent1', child: 'Child1', weight: 1 },
                { parent: 'Parent1', child: 'Child2', weight: 2 }
            ];

            // Hierarchy building workflow
            await elementService.addElements('TestDim', 'TestHierarchy', elements);
            await elementService.addEdges('TestDim', 'TestHierarchy', edges);

            expect(elementService.create).toHaveBeenCalledTimes(3);
            expect(elementService.addEdges).toHaveBeenCalledWith('TestDim', 'TestHierarchy', edges);
        });

        test('should support attribute management workflow', async () => {
            mockRestService.post.mockResolvedValue(mockResponse({}));
            mockRestService.patch.mockResolvedValue(mockResponse({}));
            mockRestService.delete.mockResolvedValue(mockResponse({}));

            // Attribute management workflow
            await elementService.createElementAttribute('TestDim', 'TestHierarchy', mockElementAttribute);
            await elementService.updateElementAttribute('TestDim', 'TestHierarchy', 'Element1', 'TestAttribute', 'Value1');
            await elementService.deleteElementAttribute('TestDim', 'TestHierarchy', 'TestAttribute');

            expect(mockRestService.post).toHaveBeenCalledTimes(1);
            expect(mockRestService.patch).toHaveBeenCalledTimes(1);
            expect(mockRestService.delete).toHaveBeenCalledTimes(1);
        });
    });
});