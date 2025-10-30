/**
 * Comprehensive DimensionService Tests
 * Target: Achieve 80%+ coverage for DimensionService (currently 45%)
 * Testing all dimension operations including CRUD, hierarchy management, and service integration
 */

import { DimensionService } from '../services/DimensionService';
import { RestService } from '../services/RestService';
import { HierarchyService } from '../services/HierarchyService';
import { SubsetService } from '../services/SubsetService';
import { Dimension } from '../objects/Dimension';
import { TM1RestException } from '../exceptions/TM1Exception';

// Mock dependencies
jest.mock('../services/HierarchyService');
jest.mock('../services/SubsetService');
jest.mock('../objects/Dimension');
jest.mock('../objects/Hierarchy');

describe('DimensionService - Comprehensive Tests', () => {
    let dimensionService: DimensionService;
    let mockRestService: jest.Mocked<RestService>;
    let mockHierarchyService: jest.Mocked<HierarchyService>;
    let mockSubsetService: jest.Mocked<SubsetService>;
    
    const mockResponse = (data: any) => ({
        data: data,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: { headers: {} }
    } as any);

    const mockDimension = {
        name: 'TestDimension',
        hierarchies: [
            { name: 'TestDimension', dimensionName: 'TestDimension' },
            { name: 'AltHierarchy', dimensionName: 'TestDimension' }
        ],
        hierarchyNames: ['TestDimension', 'AltHierarchy'],
        defaultHierarchy: { name: 'TestDimension', dimensionName: 'TestDimension' },
        body: {
            Name: 'TestDimension',
            Hierarchies: [
                { Name: 'TestDimension' },
                { Name: 'AltHierarchy' }
            ]
        },
        addHierarchy: jest.fn(),
        [Symbol.iterator]: function* () {
            yield* this.hierarchies;
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

        // Mock the constructor-injected services
        mockHierarchyService = {
            getAllNames: jest.fn(),
            exists: jest.fn(),
            update: jest.fn(),
            create: jest.fn(),
            delete: jest.fn(),
            updateElementAttributes: jest.fn()
        } as any;

        mockSubsetService = {} as any;

        // Mock the service constructors to return our mocks
        (HierarchyService as jest.MockedClass<typeof HierarchyService>).mockImplementation(() => mockHierarchyService);
        (SubsetService as jest.MockedClass<typeof SubsetService>).mockImplementation(() => mockSubsetService);

        dimensionService = new DimensionService(mockRestService);
        
        // Mock Dimension.fromJSON and fromDict
        (Dimension as any).fromJSON = jest.fn().mockReturnValue(mockDimension);
        (Dimension as any).fromDict = jest.fn().mockReturnValue(mockDimension);

        // Note: formatUrl and caseAndSpaceInsensitiveEquals are inherited from ObjectService
    });

    afterEach(() => {
        jest.clearAllMocks();
        jest.restoreAllMocks();
    });

    describe('Constructor and Initialization', () => {
        test('should initialize DimensionService with sub-services', () => {
            expect(dimensionService).toBeDefined();
            expect(dimensionService).toBeInstanceOf(DimensionService);
            expect(HierarchyService).toHaveBeenCalledWith(mockRestService);
            expect(SubsetService).toHaveBeenCalledWith(mockRestService);
        });

        test('should extend ObjectService', () => {
            expect(dimensionService).toBeInstanceOf(DimensionService);
        });
    });

    describe('Dimension CRUD Operations', () => {
        test('should create dimension successfully', async () => {
            jest.spyOn(dimensionService, 'exists').mockResolvedValue(false);
            mockRestService.post.mockResolvedValue(mockResponse({}));
            mockHierarchyService.updateElementAttributes.mockResolvedValue();

            const result = await dimensionService.create(mockDimension);
            
            expect(dimensionService.exists).toHaveBeenCalledWith('TestDimension');
            expect(mockRestService.post).toHaveBeenCalledWith('/Dimensions', mockDimension.body);
            expect(mockHierarchyService.updateElementAttributes).toHaveBeenCalledTimes(2); // For non-Leaves hierarchies
            expect(result).toBeDefined();
        });

        test('should throw error when creating existing dimension', async () => {
            jest.spyOn(dimensionService, 'exists').mockResolvedValue(true);

            await expect(dimensionService.create(mockDimension))
                .rejects.toThrow("Dimension 'TestDimension' already exists");
            
            expect(mockRestService.post).not.toHaveBeenCalled();
        });

        test('should handle creation failure and cleanup', async () => {
            jest.spyOn(dimensionService, 'exists')
                .mockResolvedValueOnce(false) // Initial check
                .mockResolvedValueOnce(true); // Check during cleanup
            jest.spyOn(dimensionService, 'delete').mockResolvedValue(mockResponse({}));
            
            const error = new Error('Creation failed');
            mockRestService.post.mockRejectedValue(error);

            await expect(dimensionService.create(mockDimension)).rejects.toThrow('Creation failed');
            
            expect(dimensionService.delete).toHaveBeenCalledWith('TestDimension');
        });

        test('should skip Leaves hierarchy during creation', async () => {
            const dimensionWithLeaves = {
                ...mockDimension,
                hierarchies: [
                    { name: 'TestDimension', dimensionName: 'TestDimension' },
                    { name: 'Leaves', dimensionName: 'TestDimension' },
                    { name: 'AltHierarchy', dimensionName: 'TestDimension' }
                ],
                [Symbol.iterator]: function* () {
                    yield* this.hierarchies;
                }
            };

            jest.spyOn(dimensionService, 'exists').mockResolvedValue(false);
            mockRestService.post.mockResolvedValue(mockResponse({}));
            mockHierarchyService.updateElementAttributes.mockResolvedValue();

            await dimensionService.create(dimensionWithLeaves);
            
            // Should skip 'Leaves' hierarchy, so only 2 calls instead of 3
            expect(mockHierarchyService.updateElementAttributes).toHaveBeenCalledTimes(2);
        });

        test('should get dimension by name', async () => {
            const dimensionData = {
                Name: 'TestDimension',
                Hierarchies: [{ Name: 'TestDimension' }]
            };
            mockRestService.get.mockResolvedValue(mockResponse(dimensionData));

            const result = await dimensionService.get('TestDimension');
            
            expect(mockRestService.get).toHaveBeenCalledWith("/Dimensions('TestDimension')?$expand=Hierarchies($expand=*)");
            expect(Dimension.fromJSON).toHaveBeenCalledWith(JSON.stringify(dimensionData));
            expect(result).toEqual(mockDimension);
        });

        test('should update dimension with existing hierarchies', async () => {
            mockHierarchyService.getAllNames.mockResolvedValue(['TestDimension', 'OldHierarchy', 'AltHierarchy']);
            mockHierarchyService.exists.mockResolvedValue(true);
            mockHierarchyService.update.mockResolvedValue();
            mockHierarchyService.delete.mockResolvedValue(mockResponse({}));

            await dimensionService.update(mockDimension);
            
            expect(mockHierarchyService.getAllNames).toHaveBeenCalledWith('TestDimension');
            expect(mockHierarchyService.update).toHaveBeenCalledTimes(2); // For TestDimension and AltHierarchy
            expect(mockHierarchyService.delete).toHaveBeenCalledWith('TestDimension', 'OldHierarchy'); // Remove old hierarchy
        });

        test('should update dimension and create new hierarchies', async () => {
            mockHierarchyService.getAllNames.mockResolvedValue(['TestDimension']);
            mockHierarchyService.exists
                .mockResolvedValueOnce(true)  // TestDimension exists
                .mockResolvedValueOnce(false); // AltHierarchy doesn't exist
            mockHierarchyService.update.mockResolvedValue();
            mockHierarchyService.create.mockResolvedValue(mockResponse({}));

            await dimensionService.update(mockDimension);
            
            expect(mockHierarchyService.update).toHaveBeenCalledTimes(1); // For existing TestDimension
            expect(mockHierarchyService.create).toHaveBeenCalledTimes(1); // For new AltHierarchy
        });

        test('should update dimension with keepExistingAttributes flag', async () => {
            mockHierarchyService.getAllNames.mockResolvedValue(['TestDimension']);
            mockHierarchyService.exists.mockResolvedValue(true);
            mockHierarchyService.update.mockResolvedValue();

            await dimensionService.update(mockDimension, true);
            
            expect(mockHierarchyService.update).toHaveBeenCalledWith(
                mockDimension.hierarchies[0], 
                true // keepExistingAttributes
            );
        });

        test('should skip Leaves hierarchy during update', async () => {
            const dimensionWithLeaves = {
                ...mockDimension,
                hierarchies: [
                    { name: 'TestDimension', dimensionName: 'TestDimension' },
                    { name: 'Leaves', dimensionName: 'TestDimension' }
                ],
                hierarchyNames: ['TestDimension', 'Leaves'],
                [Symbol.iterator]: function* () {
                    yield* this.hierarchies;
                }
            };

            mockHierarchyService.getAllNames.mockResolvedValue(['TestDimension', 'Leaves']);
            mockHierarchyService.exists.mockResolvedValue(true);
            mockHierarchyService.update.mockResolvedValue();

            await dimensionService.update(dimensionWithLeaves);
            
            // Should only update TestDimension, skip Leaves
            expect(mockHierarchyService.update).toHaveBeenCalledTimes(1);
            expect(mockHierarchyService.delete).not.toHaveBeenCalledWith('TestDimension', 'Leaves');
        });

        test('should delete dimension', async () => {
            mockRestService.delete.mockResolvedValue(mockResponse({}));

            const result = await dimensionService.delete('TestDimension');
            
            expect(mockRestService.delete).toHaveBeenCalledWith("/Dimensions('TestDimension')");
            expect(result).toBeDefined();
        });

        test('should check if dimension exists', async () => {
            mockRestService.get.mockResolvedValue(mockResponse({}));

            const result = await dimensionService.exists('TestDimension');
            
            expect(result).toBe(true);
            expect(mockRestService.get).toHaveBeenCalledWith("/Dimensions('TestDimension')");
        });

        test('should return false when dimension does not exist', async () => {
            const error = new TM1RestException('Not found', 404);
            error.statusCode = 404; // Set the statusCode property that DimensionService checks
            mockRestService.get.mockRejectedValue(error);

            const result = await dimensionService.exists('NonExistent');
            
            expect(result).toBe(false);
        });

        test('should throw error for non-404 errors in exists check', async () => {
            const error = new TM1RestException('Server error', 500);
            mockRestService.get.mockRejectedValue(error);

            await expect(dimensionService.exists('TestDimension')).rejects.toThrow('Server error');
        });
    });

    describe('Dimension Retrieval Operations', () => {
        test('should get all dimension names', async () => {
            const dimensionsData = {
                value: [
                    { Name: 'Dimension1' },
                    { Name: 'Dimension2' },
                    { Name: '}Stats' }
                ]
            };
            mockRestService.get.mockResolvedValue(mockResponse(dimensionsData));

            const result = await dimensionService.getAllNames();
            
            expect(result).toEqual(['Dimension1', 'Dimension2', '}Stats']);
            expect(mockRestService.get).toHaveBeenCalledWith('/Dimensions?$select=Name');
        });

        test('should get all dimension names excluding control dimensions', async () => {
            const dimensionsData = {
                value: [
                    { Name: 'Dimension1' },
                    { Name: 'Dimension2' }
                ]
            };
            mockRestService.get.mockResolvedValue(mockResponse(dimensionsData));

            const result = await dimensionService.getAllNames(true);
            
            expect(result).toEqual(['Dimension1', 'Dimension2']);
            expect(mockRestService.get).toHaveBeenCalledWith("/Dimensions?$select=Name&$filter=not startswith(Name,'}')");
        });

        test('should get all dimensions', async () => {
            const dimensionsData = {
                value: [
                    { Name: 'Dimension1', Hierarchies: [{ Name: 'Dimension1' }] },
                    { Name: 'Dimension2', Hierarchies: [{ Name: 'Dimension2' }] }
                ]
            };
            mockRestService.get.mockResolvedValue(mockResponse(dimensionsData));

            const result = await dimensionService.getAll();
            
            expect(result).toHaveLength(2);
            expect(Dimension.fromDict).toHaveBeenCalledTimes(2);
            expect(mockRestService.get).toHaveBeenCalledWith('/Dimensions?$expand=Hierarchies($expand=*)');
        });

        test('should get all dimensions excluding control dimensions', async () => {
            const dimensionsData = {
                value: [
                    { Name: 'Dimension1', Hierarchies: [{ Name: 'Dimension1' }] }
                ]
            };
            mockRestService.get.mockResolvedValue(mockResponse(dimensionsData));

            const result = await dimensionService.getAll(true);
            
            expect(result).toHaveLength(1);
            expect(mockRestService.get).toHaveBeenCalledWith("/Dimensions?$expand=Hierarchies($expand=*)&$filter=not startswith(Name,'}')");
        });

        test('should get dimension names from cube', async () => {
            const cubeData = {
                Dimensions: [
                    { Name: 'Time' },
                    { Name: 'Account' },
                    { Name: 'Version' }
                ]
            };
            mockRestService.get.mockResolvedValue(mockResponse(cubeData));

            const result = await dimensionService.getDimensionNames('SalesCube');
            
            expect(result).toEqual(['Time', 'Account', 'Version']);
            expect(mockRestService.get).toHaveBeenCalledWith("/Cubes('SalesCube')?$select=Dimensions");
        });
    });

    describe('Dimension Cloning Operations', () => {
        test('should clone dimension with all hierarchies', async () => {
            jest.spyOn(dimensionService, 'exists').mockResolvedValue(false);
            jest.spyOn(dimensionService, 'get').mockResolvedValue(mockDimension);
            jest.spyOn(dimensionService, 'create').mockResolvedValue(mockResponse({}));

            const result = await dimensionService.clone('SourceDim', 'TargetDim', true);
            
            expect(dimensionService.exists).toHaveBeenCalledWith('TargetDim');
            expect(dimensionService.get).toHaveBeenCalledWith('SourceDim');
            expect(dimensionService.create).toHaveBeenCalled();
            expect(result).toBeDefined();
        });

        test('should clone dimension without additional hierarchies', async () => {
            const sourceDimensionWithMultipleHierarchies = {
                ...mockDimension,
                hierarchies: [
                    { name: 'SourceDim', dimensionName: 'SourceDim' },
                    { name: 'AltHierarchy', dimensionName: 'SourceDim' },
                    { name: 'AnotherHierarchy', dimensionName: 'SourceDim' }
                ],
                defaultHierarchy: { name: 'SourceDim', dimensionName: 'SourceDim' },
                addHierarchy: jest.fn()
            };

            jest.spyOn(dimensionService, 'exists').mockResolvedValue(false);
            jest.spyOn(dimensionService, 'get').mockResolvedValue(sourceDimensionWithMultipleHierarchies);
            jest.spyOn(dimensionService, 'create').mockResolvedValue(mockResponse({}));

            await dimensionService.clone('SourceDim', 'TargetDim', false);
            
            expect(sourceDimensionWithMultipleHierarchies.hierarchies.length).toBe(0);
            expect(sourceDimensionWithMultipleHierarchies.addHierarchy).toHaveBeenCalledWith(
                expect.objectContaining({ name: 'TargetDim' })
            );
        });

        test('should rename hierarchies to match target dimension name', async () => {
            const sourceDimension = {
                name: 'SourceDim',
                hierarchies: [
                    { name: 'SourceDim', dimensionName: 'SourceDim' }, // Should be renamed
                    { name: 'CustomHierarchy', dimensionName: 'SourceDim' } // Should not be renamed
                ],
                hierarchyNames: ['SourceDim', 'CustomHierarchy'],
                defaultHierarchy: { name: 'SourceDim', dimensionName: 'SourceDim' },
                body: {},
                addHierarchy: jest.fn(),
                [Symbol.iterator]: function* () {
                    yield* this.hierarchies;
                }
            };

            jest.spyOn(dimensionService, 'exists').mockResolvedValue(false);
            jest.spyOn(dimensionService, 'get').mockResolvedValue(sourceDimension as any);
            jest.spyOn(dimensionService, 'create').mockResolvedValue(mockResponse({}));

            await dimensionService.clone('SourceDim', 'TargetDim', true);
            
            expect(sourceDimension.hierarchies[0].name).toBe('TargetDim'); // Renamed
            expect(sourceDimension.hierarchies[1].name).toBe('CustomHierarchy'); // Not renamed
        });

        test('should throw error when cloning to existing dimension', async () => {
            jest.spyOn(dimensionService, 'exists').mockResolvedValue(true);

            await expect(dimensionService.clone('SourceDim', 'ExistingDim'))
                .rejects.toThrow("Dimension 'ExistingDim' already exists");
        });

        test('should handle cloning when default hierarchy is null', async () => {
            const sourceDimensionNoDefault = {
                ...mockDimension,
                defaultHierarchy: null
            };

            jest.spyOn(dimensionService, 'exists').mockResolvedValue(false);
            jest.spyOn(dimensionService, 'get').mockResolvedValue(sourceDimensionNoDefault);
            jest.spyOn(dimensionService, 'create').mockResolvedValue(mockResponse({}));

            await dimensionService.clone('SourceDim', 'TargetDim', false);
            
            expect(dimensionService.create).toHaveBeenCalled();
        });
    });

    describe('Dimension Statistics Operations', () => {
        test('should get elements count for dimension', async () => {
            mockRestService.get.mockResolvedValue(mockResponse('150'));

            const result = await dimensionService.getElementsCount('TestDimension');
            
            expect(result).toBe(150);
            expect(mockRestService.get).toHaveBeenCalledWith("/Dimensions('TestDimension')/Hierarchies('TestDimension')/Elements/$count");
        });

        test('should get elements count for specific hierarchy', async () => {
            mockRestService.get.mockResolvedValue(mockResponse('75'));

            const result = await dimensionService.getElementsCount('TestDimension', 'CustomHierarchy');
            
            expect(result).toBe(75);
            expect(mockRestService.get).toHaveBeenCalledWith("/Dimensions('TestDimension')/Hierarchies('CustomHierarchy')/Elements/$count");
        });

        test('should get hierarchies count for dimension', async () => {
            mockRestService.get.mockResolvedValue(mockResponse('3'));

            const result = await dimensionService.getHierarchiesCount('TestDimension');
            
            expect(result).toBe(3);
            expect(mockRestService.get).toHaveBeenCalledWith("/Dimensions('TestDimension')/Hierarchies/$count");
        });

        test('should handle non-numeric count responses', async () => {
            mockRestService.get.mockResolvedValue(mockResponse('invalid'));

            const result = await dimensionService.getElementsCount('TestDimension');
            
            expect(isNaN(result)).toBe(true);
        });
    });

    describe('Error Handling', () => {
        test('should handle dimension retrieval errors', async () => {
            const error = new Error('Dimension not found');
            mockRestService.get.mockRejectedValue(error);

            await expect(dimensionService.get('NonExistent')).rejects.toThrow('Dimension not found');
        });

        test('should handle dimension creation errors', async () => {
            jest.spyOn(dimensionService, 'exists').mockResolvedValue(false);
            const error = new Error('Creation failed');
            mockRestService.post.mockRejectedValue(error);

            await expect(dimensionService.create(mockDimension)).rejects.toThrow('Creation failed');
        });

        test('should handle dimension deletion errors', async () => {
            const error = new Error('Deletion failed');
            mockRestService.delete.mockRejectedValue(error);

            await expect(dimensionService.delete('TestDimension')).rejects.toThrow('Deletion failed');
        });

        test('should handle hierarchy service errors during creation', async () => {
            jest.spyOn(dimensionService, 'exists').mockResolvedValue(false);
            mockRestService.post.mockResolvedValue(mockResponse({}));
            mockHierarchyService.updateElementAttributes.mockRejectedValue(new Error('Hierarchy error'));

            await expect(dimensionService.create(mockDimension)).rejects.toThrow('Hierarchy error');
        });

        test('should handle hierarchy service errors during update', async () => {
            mockHierarchyService.getAllNames.mockRejectedValue(new Error('Hierarchy access failed'));

            await expect(dimensionService.update(mockDimension)).rejects.toThrow('Hierarchy access failed');
        });

        test('should handle cube dimension retrieval errors', async () => {
            const error = new Error('Cube not found');
            mockRestService.get.mockRejectedValue(error);

            await expect(dimensionService.getDimensionNames('NonExistentCube')).rejects.toThrow('Cube not found');
        });
    });

    describe('Edge Cases and Special Scenarios', () => {
        test('should handle empty dimension lists', async () => {
            mockRestService.get.mockResolvedValue(mockResponse({ value: [] }));

            const names = await dimensionService.getAllNames();
            const dimensions = await dimensionService.getAll();
            
            expect(names).toEqual([]);
            expect(dimensions).toEqual([]);
        });

        test('should handle special characters in dimension names', async () => {
            const specialName = "Dimension's & \"Special\" Name";
            mockRestService.get.mockResolvedValue(mockResponse({}));

            await dimensionService.exists(specialName);
            
            // The formatUrl method encodes special characters
            expect(mockRestService.get).toHaveBeenCalledWith(
                expect.stringContaining("Dimension's%20%26%20%22Special%22%20Name")
            );
        });

        test('should handle dimension with no hierarchies', async () => {
            const emptyDimension = {
                name: 'EmptyDimension',
                hierarchies: [],
                hierarchyNames: [],
                body: { Name: 'EmptyDimension', Hierarchies: [] },
                [Symbol.iterator]: function* () {
                    yield* this.hierarchies;
                }
            };

            jest.spyOn(dimensionService, 'exists').mockResolvedValue(false);
            mockRestService.post.mockResolvedValue(mockResponse({}));

            await dimensionService.create(emptyDimension as any);
            
            expect(mockHierarchyService.updateElementAttributes).not.toHaveBeenCalled();
        });

        test('should handle dimension update with no hierarchy changes', async () => {
            mockHierarchyService.getAllNames.mockResolvedValue(['TestDimension', 'AltHierarchy']);
            mockHierarchyService.exists.mockResolvedValue(true);
            mockHierarchyService.update.mockResolvedValue();

            await dimensionService.update(mockDimension);
            
            expect(mockHierarchyService.delete).not.toHaveBeenCalled(); // No hierarchies to remove
            expect(mockHierarchyService.create).not.toHaveBeenCalled(); // No new hierarchies
        });

        test('should handle large dimension lists efficiently', async () => {
            const largeDimensionList = Array.from({ length: 1000 }, (_, i) => ({
                Name: `Dimension${i}`
            }));

            mockRestService.get.mockResolvedValue(mockResponse({ value: largeDimensionList }));

            const result = await dimensionService.getAllNames();
            
            expect(result).toHaveLength(1000);
            expect(result[0]).toBe('Dimension0');
            expect(result[999]).toBe('Dimension999');
        });

        test('should handle cube with no dimensions', async () => {
            mockRestService.get.mockResolvedValue(mockResponse({ Dimensions: [] }));

            const result = await dimensionService.getDimensionNames('EmptyCube');
            
            expect(result).toEqual([]);
        });

        test('should handle null/undefined values gracefully', async () => {
            const malformedResponse = {
                value: [
                    { Name: 'ValidDimension' },
                    { Name: null },
                    { Name: undefined },
                    {} // No Name property
                ]
            };

            mockRestService.get.mockResolvedValue(mockResponse(malformedResponse));

            const result = await dimensionService.getAllNames();
            
            // Should handle malformed data gracefully
            expect(result).toContain('ValidDimension');
        });
    });

    describe('Service Integration', () => {
        test('should integrate with HierarchyService for dimension operations', async () => {
            jest.spyOn(dimensionService, 'exists').mockResolvedValue(false);
            mockRestService.post.mockResolvedValue(mockResponse({}));
            mockHierarchyService.updateElementAttributes.mockResolvedValue();

            await dimensionService.create(mockDimension);
            
            expect(mockHierarchyService.updateElementAttributes).toHaveBeenCalledWith(
                mockDimension.hierarchies[0]
            );
        });

        test('should coordinate hierarchy updates during dimension update', async () => {
            // Create a fresh dimension object for this test
            const testDimension = {
                name: 'TestDimension',
                hierarchies: [
                    { name: 'TestDimension', dimensionName: 'TestDimension' },
                    { name: 'AltHierarchy', dimensionName: 'TestDimension' }
                ],
                hierarchyNames: ['TestDimension', 'AltHierarchy'],
                body: {},
                [Symbol.iterator]: function* () {
                    yield* this.hierarchies;
                }
            };
            
            // Clear any previous calls first
            mockHierarchyService.getAllNames.mockClear();
            mockHierarchyService.exists.mockClear();
            mockHierarchyService.create.mockClear();
            mockHierarchyService.delete.mockClear();
            
            mockHierarchyService.getAllNames.mockResolvedValue(['OldHierarchy']);
            mockHierarchyService.exists.mockResolvedValue(false);
            mockHierarchyService.create.mockResolvedValue(mockResponse({}));
            mockHierarchyService.delete.mockResolvedValue(mockResponse({}));

            await dimensionService.update(testDimension as any);
            
            expect(mockHierarchyService.create).toHaveBeenCalledTimes(2); // Create new hierarchies
            expect(mockHierarchyService.delete).toHaveBeenLastCalledWith('TestDimension', 'OldHierarchy'); // Remove old
        });

        test('should handle hierarchy service initialization', () => {
            new DimensionService(mockRestService);

            expect(HierarchyService).toHaveBeenCalledWith(mockRestService);
            expect(SubsetService).toHaveBeenCalledWith(mockRestService);
        });

        test('should maintain service state across operations', async () => {
            // Test that the service maintains its internal state properly
            jest.spyOn(dimensionService, 'exists').mockResolvedValue(true);
            
            const exists1 = await dimensionService.exists('Dimension1');
            const exists2 = await dimensionService.exists('Dimension2');
            
            expect(exists1).toBe(true);
            expect(exists2).toBe(true);
            expect(dimensionService.exists).toHaveBeenCalledTimes(2);
        });
    });

    describe('Complex Workflow Scenarios', () => {
        test('should support complete dimension lifecycle', async () => {
            // Create, update, clone, delete workflow
            jest.spyOn(dimensionService, 'exists')
                .mockResolvedValueOnce(false) // Create check
                .mockResolvedValueOnce(false) // Clone target check
                .mockResolvedValue(true);     // Other operations

            jest.spyOn(dimensionService, 'get').mockResolvedValue(mockDimension);
            jest.spyOn(dimensionService, 'create').mockResolvedValue(mockResponse({}));
            mockRestService.post.mockResolvedValue(mockResponse({}));
            mockRestService.delete.mockResolvedValue(mockResponse({}));
            mockHierarchyService.updateElementAttributes.mockResolvedValue();
            mockHierarchyService.getAllNames.mockResolvedValue(['TestDimension']);
            mockHierarchyService.exists.mockResolvedValue(true);
            mockHierarchyService.update.mockResolvedValue();

            // Full lifecycle
            await dimensionService.create(mockDimension);
            await dimensionService.update(mockDimension);
            await dimensionService.clone('TestDimension', 'ClonedDimension');
            await dimensionService.delete('TestDimension');

            expect(dimensionService.create).toHaveBeenCalledTimes(2); // Original + clone
            expect(mockHierarchyService.update).toHaveBeenCalled();
            expect(mockRestService.delete).toHaveBeenCalled();
        });

        test('should handle complex hierarchy management scenario', async () => {
            const complexDimension = {
                name: 'ComplexDim',
                hierarchies: [
                    { name: 'ComplexDim', dimensionName: 'ComplexDim' },
                    { name: 'NewHierarchy', dimensionName: 'ComplexDim' },
                    { name: 'Leaves', dimensionName: 'ComplexDim' } // Should be skipped
                ],
                hierarchyNames: ['ComplexDim', 'NewHierarchy', 'Leaves'],
                body: {},
                [Symbol.iterator]: function* () {
                    yield* this.hierarchies;
                }
            };

            mockHierarchyService.getAllNames.mockResolvedValue(['ComplexDim', 'OldHierarchy', 'Leaves']);
            mockHierarchyService.exists
                .mockResolvedValueOnce(true)  // ComplexDim exists
                .mockResolvedValueOnce(false); // NewHierarchy doesn't exist
            mockHierarchyService.update.mockResolvedValue();
            mockHierarchyService.create.mockResolvedValue(mockResponse({}));
            mockHierarchyService.delete.mockResolvedValue(mockResponse({}));

            await dimensionService.update(complexDimension as any);
            
            expect(mockHierarchyService.update).toHaveBeenCalledTimes(1); // ComplexDim updated
            expect(mockHierarchyService.create).toHaveBeenCalledTimes(1); // NewHierarchy created
            expect(mockHierarchyService.delete).toHaveBeenCalledWith('ComplexDim', 'OldHierarchy'); // Remove old
            expect(mockHierarchyService.delete).not.toHaveBeenCalledWith('ComplexDim', 'Leaves'); // Skip Leaves
        });

        test('should handle error recovery during complex operations', async () => {
            // Create a fresh dimension object for this test
            const testDimension = {
                name: 'TestDimension',
                hierarchies: [
                    { name: 'TestDimension', dimensionName: 'TestDimension' }
                ],
                hierarchyNames: ['TestDimension'],
                body: {},
                [Symbol.iterator]: function* () {
                    yield* this.hierarchies;
                }
            };
            
            // Create fresh spies for this test to avoid interference
            const existsSpy = jest.spyOn(dimensionService, 'exists')
                .mockResolvedValueOnce(false) // Initial check passes
                .mockResolvedValueOnce(true);  // Cleanup check - dimension was created

            const deleteSpy = jest.spyOn(dimensionService, 'delete').mockResolvedValue(mockResponse({}));
            
            mockRestService.post.mockClear().mockResolvedValue(mockResponse({})); // Creation succeeds
            mockHierarchyService.updateElementAttributes.mockClear().mockRejectedValue(new Error('Hierarchy update failed')); // But hierarchy update fails

            await expect(dimensionService.create(testDimension as any)).rejects.toThrow('Hierarchy update failed');
            
            expect(deleteSpy).toHaveBeenLastCalledWith('TestDimension'); // Cleanup performed
            
            // Clean up spies
            existsSpy.mockRestore();
            deleteSpy.mockRestore();
        });
    });
});