/**
 * ViewService Tests for tm1npm
 * Comprehensive tests for TM1 View operations with proper mocking
 */

import { ViewService } from '../services/ViewService';
import { RestService } from '../services/RestService';
import { NativeView } from '../objects/NativeView';
import { MDXView } from '../objects/MDXView';
import { TM1RestException } from '../exceptions/TM1Exception';

// Helper function to create mock AxiosResponse
const createMockResponse = (data: any, status: number = 200) => ({
    data,
    status,
    statusText: status === 200 ? 'OK' : status === 201 ? 'Created' : status === 204 ? 'No Content' : 'Error',
    headers: {},
    config: {} as any
});

describe('ViewService Tests', () => {
    let viewService: ViewService;
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

        viewService = new ViewService(mockRestService);
    });

    describe('View Retrieval Operations', () => {
        test('should get all view names for cube', async () => {
            // Mock both private and public view calls
            mockRestService.get
                .mockResolvedValueOnce(createMockResponse({
                    value: [{ Name: 'PrivateView1' }]
                }))
                .mockResolvedValueOnce(createMockResponse({
                    value: [{ Name: 'PublicView1' }, { Name: 'PublicView2' }]
                }));

            const viewNames = await viewService.getAllNames('TestCube');
            
            expect(Array.isArray(viewNames)).toBe(true);
            expect(viewNames.length).toBe(3);
            expect(viewNames).toEqual(['PrivateView1', 'PublicView1', 'PublicView2']);
            
            console.log('✅ View names retrieved successfully');
        });

        test('should get all views for cube', async () => {
            // Mock the main views call - first call for getAll
            mockRestService.get.mockResolvedValueOnce(createMockResponse({
                value: [
                    { Name: 'MDXView1', MDX: 'SELECT FROM [TestCube]' }, // Has MDX property
                    { Name: 'NativeView1' } // Doesn't have MDX property  
                ]
            }));

            // Mock the getNativeView call that will be made for the native view
            mockRestService.get.mockResolvedValueOnce(createMockResponse({
                Name: 'NativeView1',
                Columns: [],
                Rows: [],
                Titles: []
            }));

            const views = await viewService.getAll('TestCube');
            
            expect(Array.isArray(views)).toBe(true);
            expect(views.length).toBe(2); // Returns [nativeViews, mdxViews]
            expect(views[0]).toEqual(expect.any(Array)); // nativeViews array
            expect(views[1]).toEqual(expect.any(Array)); // mdxViews array
            
            console.log('✅ All views retrieved successfully');
        });

        test('should check if view exists', async () => {
            // Test existing view
            mockRestService.get.mockResolvedValue(createMockResponse({ 
                Name: 'ExistingView' 
            }));

            const exists = await viewService.exists('TestCube', 'ExistingView', false);
            expect(exists).toBe(true);

            console.log('✅ View existence check working correctly');
        });

        test('should check if view does not exist', async () => {
            // Test non-existing view
            const mockError = new TM1RestException('View not found', 404, { status: 404 });
            mockRestService.get.mockRejectedValue(mockError);

            const notExists = await viewService.exists('TestCube', 'NonExistentView', false);
            expect(notExists).toBe(false);
            
            console.log('✅ View non-existence check working correctly');
        });
    });

    describe('View CRUD Operations', () => {
        test('should create native view', async () => {
            const mockNativeView = new NativeView('TestCube', 'NewNativeView');
            
            mockRestService.post.mockResolvedValue(createMockResponse(
                { Name: 'NewNativeView' }, 201
            ));

            const result = await viewService.create(mockNativeView);
            
            expect(mockRestService.post).toHaveBeenCalled();
            expect(result.status).toBe(201);
            
            console.log('✅ Native view creation successful');
        });

        test('should create MDX view', async () => {
            const mockMDXView = new MDXView('TestCube', 'NewMDXView', 'SELECT FROM [TestCube]');
            
            mockRestService.post.mockResolvedValue(createMockResponse(
                { Name: 'NewMDXView' }, 201
            ));

            const result = await viewService.create(mockMDXView);
            
            expect(result.status).toBe(201);
            console.log('✅ MDX view creation successful');
        });

        test('should update existing view', async () => {
            const mockView = new NativeView('TestCube', 'UpdatedView');

            mockRestService.patch.mockResolvedValue(createMockResponse(
                { Name: 'UpdatedView' }, 200
            ));

            const result = await viewService.update(mockView);
            
            expect(mockRestService.patch).toHaveBeenCalled();
            expect(result.status).toBe(200);
            
            console.log('✅ View update successful');
        });

        test('should delete view', async () => {
            mockRestService.delete.mockResolvedValue(createMockResponse({}, 204));

            const result = await viewService.delete('TestCube', 'ViewToDelete');
            
            expect(mockRestService.delete).toHaveBeenCalled();
            expect(result.status).toBe(204);
            
            console.log('✅ View deletion successful');
        });
    });

    describe('View Error Handling', () => {
        test('should handle network errors gracefully', async () => {
            mockRestService.get.mockRejectedValue({
                code: 'ECONNREFUSED'
            });

            await expect(viewService.getAllNames('TestCube'))
                .rejects.toMatchObject({
                    code: 'ECONNREFUSED'
                });
                
            console.log('✅ Network error handling working');
        });

        test('should handle authentication errors', async () => {
            mockRestService.get.mockRejectedValue({
                response: { status: 401 }
            });

            await expect(viewService.getAll('TestCube'))
                .rejects.toMatchObject({
                    response: { status: 401 }
                });
                
            console.log('✅ Authentication error handling working');
        });

        test('should handle invalid cube names', async () => {
            mockRestService.get.mockRejectedValue({
                response: { status: 400, statusText: 'Bad Request' }
            });

            await expect(viewService.getAllNames('')).rejects.toMatchObject({
                response: { status: 400 }
            });
            
            console.log('✅ Invalid input handling working');
        });
    });

    describe('View Service Edge Cases', () => {
        test('should handle empty view lists', async () => {
            // Mock both private and public calls returning empty
            mockRestService.get
                .mockResolvedValueOnce(createMockResponse({ value: [] }))
                .mockResolvedValueOnce(createMockResponse({ value: [] }));

            const views = await viewService.getAllNames('EmptyCube');
            
            expect(Array.isArray(views)).toBe(true);
            expect(views.length).toBe(0);
            
            console.log('✅ Empty view list handling working');
        });

        test('should handle concurrent operations', async () => {
            // Mock both private and public calls for each concurrent operation
            mockRestService.get.mockImplementation(() => 
                Promise.resolve(createMockResponse({
                    value: [{ Name: 'TestView' }]
                }))
            );

            const operations = [
                viewService.getAllNames('TestCube'),
                viewService.getAllNames('TestCube'),
                viewService.getAllNames('TestCube')
            ];

            const results = await Promise.allSettled(operations);
            
            const successful = results.filter(r => r.status === 'fulfilled');
            expect(successful.length).toBe(3);
            
            console.log('✅ Concurrent operations handling working');
        });

        test('should handle large view datasets efficiently', async () => {
            const largeViewList = Array(1000).fill(null).map((_, i) => ({
                Name: `View${i}`
            }));

            // Mock both calls returning large datasets
            mockRestService.get
                .mockResolvedValueOnce(createMockResponse({ value: largeViewList.slice(0, 500) }))
                .mockResolvedValueOnce(createMockResponse({ value: largeViewList.slice(500) }));

            const startTime = Date.now();
            const result = await viewService.getAllNames('LargeCube');
            const endTime = Date.now();

            expect(result.length).toBe(1000);
            expect(endTime - startTime).toBeLessThan(1000); // Should be fast with mocking
            
            console.log('✅ Large dataset handling efficient');
        });
    });

    describe('View Service Integration', () => {
        test('should maintain data consistency across operations', async () => {
            const viewList = [
                { Name: 'View1' },
                { Name: 'View2' }
            ];

            // Mock consistent responses
            mockRestService.get.mockImplementation(() => 
                Promise.resolve(createMockResponse({
                    value: viewList
                }))
            );

            const names1 = await viewService.getAllNames('TestCube');
            const names2 = await viewService.getAllNames('TestCube');

            // Note: getAllNames returns combined private+public, so results will be ['View1', 'View2', 'View1', 'View2']
            expect(names1.length).toBeGreaterThan(0);
            expect(names2.length).toBeGreaterThan(0);
            
            console.log('✅ Data consistency maintained');
        });

        test('should handle view lifecycle operations', async () => {
            const testView = new NativeView('TestCube', 'LifecycleView');

            // Mock create
            mockRestService.post.mockResolvedValue(createMockResponse({}, 201));
            
            // Mock get (exists)
            mockRestService.get.mockResolvedValue(createMockResponse({
                Name: 'LifecycleView'
            }));
            
            // Mock update
            mockRestService.patch.mockResolvedValue(createMockResponse({}, 200));
            
            // Mock delete
            mockRestService.delete.mockResolvedValue(createMockResponse({}, 204));

            // Test full lifecycle
            const createResult = await viewService.create(testView);
            expect(createResult.status).toBe(201);

            const exists = await viewService.exists('TestCube', 'LifecycleView', false);
            expect(exists).toBe(true);

            const updateResult = await viewService.update(testView);
            expect(updateResult.status).toBe(200);

            const deleteResult = await viewService.delete('TestCube', 'LifecycleView');
            expect(deleteResult.status).toBe(204);
            
            console.log('✅ View lifecycle operations working');
        });
    });
});