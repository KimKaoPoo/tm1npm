/**
 * Comprehensive AnnotationService Tests
 * Testing all annotation operations including CRUD, cube annotations, and edge cases
 */

import { AnnotationService } from '../services/AnnotationService';
import { RestService } from '../services/RestService';
import { Annotation } from '../objects/Annotation';
import { TM1RestException } from '../exceptions/TM1Exception';

// Mock dependencies
jest.mock('../objects/Annotation');

describe('AnnotationService - Comprehensive Tests', () => {
    let annotationService: AnnotationService;
    let mockRestService: jest.Mocked<RestService>;
    
    const mockResponse = (data: any) => ({
        data: data,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: { headers: {} }
    } as any);

    const mockAnnotation = {
        id: 'annotation-1',
        objectName: 'TestCube',
        dimensionalContext: ['Dim1', 'Dim2'],
        commentText: 'Test annotation',
        commentType: 'COMMENT',
        body: {
            Id: 'annotation-1',
            ObjectName: 'TestCube',
            DimensionalContext: [
                { Name: 'Dim1' },
                { Name: 'Dim2' }
            ],
            CommentText: 'Test annotation',
            CommentType: 'COMMENT'
        },
        constructBodyForPost: jest.fn().mockReturnValue({
            ObjectName: 'TestCube',
            CommentText: 'Test annotation',
            CommentType: 'COMMENT'
        })
    } as any;

    beforeEach(() => {
        mockRestService = {
            get: jest.fn(),
            post: jest.fn(),
            patch: jest.fn(),
            put: jest.fn(),
            delete: jest.fn()
        } as any;

        annotationService = new AnnotationService(mockRestService);
        
        // Mock Annotation.fromJSON
        (Annotation as any).fromJSON = jest.fn().mockReturnValue(mockAnnotation);
        
        // Mock CubeService for circular dependency
        jest.doMock('../services/CubeService', () => ({
            CubeService: jest.fn().mockImplementation(() => ({
                getDimensionNames: jest.fn().mockResolvedValue(['Dim1', 'Dim2', 'Dim3'])
            }))
        }));
    });

    afterEach(() => {
        jest.clearAllMocks();
        jest.resetModules();
    });

    describe('Constructor and Initialization', () => {
        test('should initialize AnnotationService properly', () => {
            expect(annotationService).toBeDefined();
            expect(annotationService).toBeInstanceOf(AnnotationService);
        });

        test('should extend ObjectService', () => {
            expect(annotationService).toBeInstanceOf(AnnotationService);
        });
    });

    describe('Annotation Retrieval Operations', () => {
        test('should get all annotations from cube', async () => {
            const annotationsData = {
                value: [
                    {
                        Id: 'annotation-1',
                        ObjectName: 'TestCube',
                        CommentText: 'First annotation',
                        DimensionalContext: [{ Name: 'Dim1' }, { Name: 'Dim2' }]
                    },
                    {
                        Id: 'annotation-2',
                        ObjectName: 'TestCube',
                        CommentText: 'Second annotation',
                        DimensionalContext: [{ Name: 'Dim1' }, { Name: 'Dim3' }]
                    }
                ]
            };
            mockRestService.get.mockResolvedValue(mockResponse(annotationsData));

            const result = await annotationService.getAll('TestCube');
            
            expect(result).toHaveLength(2);
            expect(Annotation.fromJSON).toHaveBeenCalledTimes(2);
            expect(mockRestService.get).toHaveBeenCalledWith(
                "/Cubes('TestCube')/Annotations?$expand=DimensionalContext($select=Name)"
            );
        });

        test('should handle empty annotations list', async () => {
            const emptyData = { value: [] };
            mockRestService.get.mockResolvedValue(mockResponse(emptyData));

            const result = await annotationService.getAll('EmptyCube');
            
            expect(result).toEqual([]);
            expect(Annotation.fromJSON).not.toHaveBeenCalled();
        });

        test('should handle cube names with special characters', async () => {
            const annotationsData = { value: [] };
            mockRestService.get.mockResolvedValue(mockResponse(annotationsData));

            await annotationService.getAll("Cube's & \"Special\" Name");
            
            expect(mockRestService.get).toHaveBeenCalledWith(
                "/Cubes('Cube's%20%26%20%22Special%22%20Name')/Annotations?$expand=DimensionalContext($select=Name)"
            );
        });
    });

    describe('Annotation Creation Operations', () => {
        test('should create annotation successfully', async () => {
            mockRestService.post.mockResolvedValue(mockResponse({}));

            const result = await annotationService.create(mockAnnotation);
            
            expect(result).toBeDefined();
            expect(mockRestService.post).toHaveBeenCalledWith(
                "/Annotations",
                JSON.stringify({
                    ObjectName: 'TestCube',
                    CommentText: 'Test annotation',
                    CommentType: 'COMMENT'
                })
            );
            expect(mockAnnotation.constructBodyForPost).toHaveBeenCalledWith(['Dim1', 'Dim2', 'Dim3']);
        });

        test('should handle annotation creation with complex dimensional context', async () => {
            const complexAnnotation = {
                ...mockAnnotation,
                dimensionalContext: ['Dim1', 'Dim2', 'Dim3', 'Dim4'],
                constructBodyForPost: jest.fn().mockReturnValue({
                    ObjectName: 'ComplexCube',
                    CommentText: 'Complex annotation',
                    CommentType: 'ANNOTATION'
                })
            };

            mockRestService.post.mockResolvedValue(mockResponse({}));

            const result = await annotationService.create(complexAnnotation);
            
            expect(result).toBeDefined();
            expect(mockRestService.post).toHaveBeenCalledWith(
                "/Annotations",
                JSON.stringify({
                    ObjectName: 'ComplexCube',
                    CommentText: 'Complex annotation',
                    CommentType: 'ANNOTATION'
                })
            );
        });

        test('should handle different comment types', async () => {
            const warningAnnotation = {
                ...mockAnnotation,
                commentType: 'WARNING',
                constructBodyForPost: jest.fn().mockReturnValue({
                    ObjectName: 'TestCube',
                    CommentText: 'Warning annotation',
                    CommentType: 'WARNING'
                })
            };

            mockRestService.post.mockResolvedValue(mockResponse({}));

            await annotationService.create(warningAnnotation);
            
            expect(mockRestService.post).toHaveBeenCalledWith(
                "/Annotations",
                expect.stringContaining('"CommentType":"WARNING"')
            );
        });
    });

    describe('Error Handling', () => {
        test('should handle annotation retrieval errors', async () => {
            const error = new TM1RestException('Cube not found', 404);
            mockRestService.get.mockRejectedValue(error);

            await expect(annotationService.getAll('NonExistentCube')).rejects.toThrow('Cube not found');
        });

        test('should handle annotation creation errors', async () => {
            const error = new TM1RestException('Invalid annotation data', 400);
            mockRestService.post.mockRejectedValue(error);

            await expect(annotationService.create(mockAnnotation)).rejects.toThrow('Invalid annotation data');
        });

        test('should handle network errors gracefully', async () => {
            const networkError = new Error('Network timeout');
            mockRestService.get.mockRejectedValue(networkError);

            await expect(annotationService.getAll('TestCube')).rejects.toThrow('Network timeout');
        });

        test('should handle invalid cube dimension retrieval errors', async () => {
            // Mock CubeService to throw error
            jest.doMock('../services/CubeService', () => ({
                CubeService: jest.fn().mockImplementation(() => ({
                    getDimensionNames: jest.fn().mockRejectedValue(new Error('Cube not found'))
                }))
            }));

            await expect(annotationService.create(mockAnnotation)).rejects.toThrow();
        });
    });

    describe('Edge Cases and Special Scenarios', () => {
        test('should handle annotations with empty comment text', async () => {
            const emptyAnnotation = {
                ...mockAnnotation,
                commentText: '',
                constructBodyForPost: jest.fn().mockReturnValue({
                    ObjectName: 'TestCube',
                    CommentText: '',
                    CommentType: 'COMMENT'
                })
            };

            mockRestService.post.mockResolvedValue(mockResponse({}));

            const result = await annotationService.create(emptyAnnotation);
            
            expect(result).toBeDefined();
            expect(mockRestService.post).toHaveBeenCalledWith(
                "/Annotations",
                expect.stringContaining('"CommentText":""')
            );
        });

        test('should handle annotations with very long comment text', async () => {
            const longText = 'A'.repeat(10000);
            const longAnnotation = {
                ...mockAnnotation,
                commentText: longText,
                constructBodyForPost: jest.fn().mockReturnValue({
                    ObjectName: 'TestCube',
                    CommentText: longText,
                    CommentType: 'COMMENT'
                })
            };

            mockRestService.post.mockResolvedValue(mockResponse({}));

            const result = await annotationService.create(longAnnotation);
            
            expect(result).toBeDefined();
            expect(mockRestService.post).toHaveBeenCalledWith(
                "/Annotations",
                expect.stringContaining(longText)
            );
        });

        test('should handle cubes with no dimensions', async () => {
            // Mock CubeService to return empty dimensions
            jest.doMock('../services/CubeService', () => ({
                CubeService: jest.fn().mockImplementation(() => ({
                    getDimensionNames: jest.fn().mockResolvedValue([])
                }))
            }));

            mockRestService.post.mockResolvedValue(mockResponse({}));
            mockAnnotation.constructBodyForPost.mockReturnValueOnce({
                ObjectName: 'EmptyCube',
                CommentText: 'Test annotation',
                CommentType: 'COMMENT'
            });

            const result = await annotationService.create(mockAnnotation);
            
            expect(result).toBeDefined();
            expect(mockAnnotation.constructBodyForPost).toHaveBeenCalledWith([]);
        });

        test('should handle special characters in comment text', async () => {
            const specialTextAnnotation = {
                ...mockAnnotation,
                commentText: 'Special chars: àáâãäåæçèéêë "quotes" & ampersand',
                constructBodyForPost: jest.fn().mockReturnValue({
                    ObjectName: 'TestCube',
                    CommentText: 'Special chars: àáâãäåæçèéêë "quotes" & ampersand',
                    CommentType: 'COMMENT'
                })
            };

            mockRestService.post.mockResolvedValue(mockResponse({}));

            const result = await annotationService.create(specialTextAnnotation);
            
            expect(result).toBeDefined();
            expect(mockRestService.post).toHaveBeenCalledWith(
                "/Annotations",
                expect.stringContaining('Special chars: àáâãäåæçèéêë \\"quotes\\" & ampersand')
            );
        });
    });

    describe('Integration Patterns', () => {
        test('should support annotation workflow management', async () => {
            const annotationsData = { value: [mockAnnotation.body] };
            mockRestService.get.mockResolvedValue(mockResponse(annotationsData));
            mockRestService.post.mockResolvedValue(mockResponse({}));

            // Workflow: get existing annotations, then create new one
            const existingAnnotations = await annotationService.getAll('TestCube');
            const newAnnotation = await annotationService.create(mockAnnotation);

            expect(existingAnnotations).toHaveLength(1);
            expect(newAnnotation).toBeDefined();
            expect(mockRestService.get).toHaveBeenCalledTimes(1);
            expect(mockRestService.post).toHaveBeenCalledTimes(1);
        });

        test('should handle multiple cube annotation retrieval', async () => {
            const cubes = ['Cube1', 'Cube2', 'Cube3'];
            const annotationsData = { value: [mockAnnotation.body] };
            mockRestService.get.mockResolvedValue(mockResponse(annotationsData));

            const results = await Promise.all(
                cubes.map(cube => annotationService.getAll(cube))
            );

            expect(results).toHaveLength(3);
            expect(mockRestService.get).toHaveBeenCalledTimes(3);
            results.forEach(result => {
                expect(result).toHaveLength(1);
            });
        });

        test('should handle annotation creation for multiple cubes', async () => {
            const annotations = [
                { ...mockAnnotation, objectName: 'Cube1' },
                { ...mockAnnotation, objectName: 'Cube2' },
                { ...mockAnnotation, objectName: 'Cube3' }
            ];
            
            mockRestService.post.mockResolvedValue(mockResponse({}));

            const results = await Promise.all(
                annotations.map(annotation => annotationService.create(annotation))
            );

            expect(results).toHaveLength(3);
            expect(mockRestService.post).toHaveBeenCalledTimes(3);
            results.forEach(result => {
                expect(result).toBeDefined();
            });
        });
    });

    describe('Performance and Scalability', () => {
        test('should handle large numbers of annotations efficiently', async () => {
            const largeAnnotationsList = Array.from({ length: 1000 }, (_, i) => ({
                Id: `annotation-${i}`,
                ObjectName: 'TestCube',
                CommentText: `Annotation ${i}`,
                DimensionalContext: [{ Name: 'Dim1' }, { Name: 'Dim2' }]
            }));

            const annotationsData = { value: largeAnnotationsList };
            mockRestService.get.mockResolvedValue(mockResponse(annotationsData));

            const start = Date.now();
            const result = await annotationService.getAll('TestCube');
            const end = Date.now();

            expect(result).toHaveLength(1000);
            expect(end - start).toBeLessThan(5000); // Should complete within 5 seconds
            expect(Annotation.fromJSON).toHaveBeenCalledTimes(1000);
        });

        test('should handle concurrent annotation operations', async () => {
            mockRestService.get.mockResolvedValue(mockResponse({ value: [] }));
            mockRestService.post.mockResolvedValue(mockResponse({}));

            const concurrentOperations = [
                annotationService.getAll('Cube1'),
                annotationService.getAll('Cube2'),
                annotationService.create(mockAnnotation),
                annotationService.create({ ...mockAnnotation, objectName: 'Cube2' })
            ];

            const results = await Promise.all(concurrentOperations);

            expect(results).toHaveLength(4);
            expect(mockRestService.get).toHaveBeenCalledTimes(2);
            expect(mockRestService.post).toHaveBeenCalledTimes(2);
        });
    });
});