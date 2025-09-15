import { ViewService } from '../services/ViewService';
import { RestService } from '../services/RestService';
import { NativeView } from '../objects/NativeView';
import { MDXView } from '../objects/MDXView';
import axios, { AxiosResponse } from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('Enhanced ViewService Tests', () => {
    let viewService: ViewService;
    let mockRestService: jest.Mocked<RestService>;

    const createMockResponse = (data: any, status: number = 200): AxiosResponse => ({
        data,
        status,
        statusText: status === 200 ? 'OK' : status === 201 ? 'Created' : 'Error',
        headers: {},
        config: {} as any
    });

    beforeEach(() => {
        mockRestService = {
            get: jest.fn(),
            post: jest.fn(),
            patch: jest.fn(),
            delete: jest.fn(),
            put: jest.fn()
        } as any;

        viewService = new ViewService(mockRestService);
    });

    describe('View Search Functions', () => {
        test('searchStringInName should find views by name substring', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse({
                value: [
                    { Name: 'Sales_View_Q1' },
                    { Name: 'Sales_View_Q2' },
                    { Name: 'Budget_View_2024' }
                ]
            }));

            const result = await viewService.searchStringInName('TestCube', 'Sales');

            expect(result).toEqual(['Sales_View_Q1', 'Sales_View_Q2', 'Budget_View_2024']);
            expect(mockRestService.get).toHaveBeenCalledWith(
                "/Cubes('TestCube')/Views?$select=Name&$filter=indexof(tolower(Name), 'sales') ge 0"
            );
            
            console.log('✅ searchStringInName test passed');
        });

        test('searchStringInName should search private views', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse({
                value: [
                    { Name: 'Private_Sales_View' }
                ]
            }));

            const result = await viewService.searchStringInName('TestCube', 'Sales', true);

            expect(result).toEqual(['Private_Sales_View']);
            expect(mockRestService.get).toHaveBeenCalledWith(
                "/Cubes('TestCube')/PrivateViews?$select=Name&$filter=indexof(tolower(Name), 'sales') ge 0"
            );
            
            console.log('✅ searchStringInName private views test passed');
        });

        test('searchStringInMdx should find views by MDX content', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse({
                value: [
                    { Name: 'MDXView1', MDX: 'SELECT {[Year].Members} ON 0 FROM [SalesCube]' },
                    { Name: 'MDXView2', MDX: 'SELECT {[Product].Members} ON 0 FROM [BudgetCube]' },
                    { Name: 'NativeView1', MDX: null }
                ]
            }));

            const result = await viewService.searchStringInMdx('TestCube', 'SalesCube');

            expect(result).toEqual(['MDXView1']);
            expect(mockRestService.get).toHaveBeenCalledWith(
                "/Cubes('TestCube')/Views?$select=Name,MDX"
            );
            
            console.log('✅ searchStringInMdx test passed');
        });

        test('searchStringInMdx should be case insensitive by default', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse({
                value: [
                    { Name: 'MDXView1', MDX: 'SELECT {[YEAR].Members} ON 0 FROM [SalesCube]' }
                ]
            }));

            const result = await viewService.searchStringInMdx('TestCube', 'year');

            expect(result).toEqual(['MDXView1']);
            
            console.log('✅ searchStringInMdx case insensitive test passed');
        });

        test('searchStringInMdx should respect case sensitivity when disabled', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse({
                value: [
                    { Name: 'MDXView1', MDX: 'SELECT {[YEAR].Members} ON 0 FROM [SalesCube]' }
                ]
            }));

            const result = await viewService.searchStringInMdx('TestCube', 'year', false, false);

            expect(result).toEqual([]);
            
            console.log('✅ searchStringInMdx case sensitive test passed');
        });
    });

    describe('View Type Detection', () => {
        test('isMdxView should return true for MDX views', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse({
                MDX: 'SELECT {[Year].Members} ON 0 FROM [TestCube]'
            }));

            const result = await viewService.isMdxView('TestCube', 'TestView');

            expect(result).toBe(true);
            expect(mockRestService.get).toHaveBeenCalledWith(
                "/Cubes('TestCube')/Views('TestView')/?$select=MDX"
            );
            
            console.log('✅ isMdxView positive test passed');
        });

        test('isMdxView should return false for native views', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse({
                MDX: null
            }));

            const result = await viewService.isMdxView('TestCube', 'TestView');

            expect(result).toBe(false);
            
            console.log('✅ isMdxView negative test passed');
        });

        test('isNativeView should return opposite of isMdxView', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse({
                MDX: null
            }));

            const result = await viewService.isNativeView('TestCube', 'TestView');

            expect(result).toBe(true);
            
            console.log('✅ isNativeView test passed');
        });

        test('isMdxView should check private views', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse({
                MDX: 'SELECT {[Product].Members} ON 0 FROM [TestCube]'
            }));

            const result = await viewService.isMdxView('TestCube', 'PrivateView', true);

            expect(result).toBe(true);
            expect(mockRestService.get).toHaveBeenCalledWith(
                "/Cubes('TestCube')/PrivateViews('PrivateView')/?$select=MDX"
            );
            
            console.log('✅ isMdxView private view test passed');
        });
    });

    describe('View Count Functions', () => {
        test('getViewCount should return total count for both view types', async () => {
            mockRestService.get
                .mockResolvedValueOnce(createMockResponse('5')) // private count
                .mockResolvedValueOnce(createMockResponse('10')); // public count

            const result = await viewService.getViewCount('TestCube');

            expect(result).toBe(15);
            expect(mockRestService.get).toHaveBeenCalledTimes(2);
            expect(mockRestService.get).toHaveBeenCalledWith(
                "/Cubes('TestCube')/PrivateViews/$count"
            );
            expect(mockRestService.get).toHaveBeenCalledWith(
                "/Cubes('TestCube')/Views/$count"
            );
            
            console.log('✅ getViewCount total test passed');
        });

        test('getViewCount should return private view count only', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse('3'));

            const result = await viewService.getViewCount('TestCube', true);

            expect(result).toBe(3);
            expect(mockRestService.get).toHaveBeenCalledWith(
                "/Cubes('TestCube')/PrivateViews/$count"
            );
            
            console.log('✅ getViewCount private test passed');
        });

        test('getViewCount should return public view count only', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse('7'));

            const result = await viewService.getViewCount('TestCube', false);

            expect(result).toBe(7);
            expect(mockRestService.get).toHaveBeenCalledWith(
                "/Cubes('TestCube')/Views/$count"
            );
            
            console.log('✅ getViewCount public test passed');
        });
    });

    describe('View Name Retrieval by Type', () => {
        test('getMdxViewNames should return only MDX view names', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse({
                value: [
                    { Name: 'MDXView1', MDX: 'SELECT {[Year].Members} ON 0 FROM [TestCube]' },
                    { Name: 'NativeView1', MDX: null },
                    { Name: 'MDXView2', MDX: 'SELECT {[Product].Members} ON 0 FROM [TestCube]' }
                ]
            }));

            const result = await viewService.getMdxViewNames('TestCube');

            expect(result).toEqual(['MDXView1', 'MDXView2']);
            expect(mockRestService.get).toHaveBeenCalledWith(
                "/Cubes('TestCube')/Views?$select=Name,MDX"
            );
            
            console.log('✅ getMdxViewNames test passed');
        });

        test('getNativeViewNames should return only native view names', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse({
                value: [
                    { Name: 'MDXView1', MDX: 'SELECT {[Year].Members} ON 0 FROM [TestCube]' },
                    { Name: 'NativeView1', MDX: null },
                    { Name: 'NativeView2', MDX: null }
                ]
            }));

            const result = await viewService.getNativeViewNames('TestCube');

            expect(result).toEqual(['NativeView1', 'NativeView2']);
            expect(mockRestService.get).toHaveBeenCalledWith(
                "/Cubes('TestCube')/Views?$select=Name,MDX"
            );
            
            console.log('✅ getNativeViewNames test passed');
        });

        test('getMdxViewNames should work with private views', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse({
                value: [
                    { Name: 'PrivateMDXView', MDX: 'SELECT {[Month].Members} ON 0 FROM [TestCube]' }
                ]
            }));

            const result = await viewService.getMdxViewNames('TestCube', true);

            expect(result).toEqual(['PrivateMDXView']);
            expect(mockRestService.get).toHaveBeenCalledWith(
                "/Cubes('TestCube')/PrivateViews?$select=Name,MDX"
            );
            
            console.log('✅ getMdxViewNames private test passed');
        });
    });

    describe('Update or Create Functionality', () => {
        test('updateOrCreate should update existing view', async () => {
            const mockView = { 
                cube: 'TestCube',
                name: 'TestView',
                mdx: 'SELECT {[Year].Members} ON 0 FROM [TestCube]'
            } as any;

            // Mock exists to return true
            jest.spyOn(viewService, 'exists').mockResolvedValue(true);
            jest.spyOn(viewService, 'update').mockResolvedValue(createMockResponse({}));

            await viewService.updateOrCreate(mockView, false);

            expect(viewService.update).toHaveBeenCalledWith(mockView, false);
            
            console.log('✅ updateOrCreate update test passed');
        });

        test('updateOrCreate should create non-existing view', async () => {
            const mockView = { 
                cube: 'TestCube',
                name: 'NewView',
                mdx: 'SELECT {[Product].Members} ON 0 FROM [TestCube]'
            } as any;

            // Mock exists to return false
            jest.spyOn(viewService, 'exists').mockResolvedValue(false);
            jest.spyOn(viewService, 'create').mockResolvedValue(createMockResponse({}));

            await viewService.updateOrCreate(mockView, false);

            expect(viewService.create).toHaveBeenCalledWith(mockView, false);
            
            console.log('✅ updateOrCreate create test passed');
        });

        test('updateOrCreate should handle complex exists response for private views', async () => {
            const mockView = { 
                cube: 'TestCube',
                name: 'TestView'
            } as any;

            // Mock exists to return [true, false] (private exists, public doesn't)
            jest.spyOn(viewService, 'exists').mockResolvedValue([true, false]);
            jest.spyOn(viewService, 'update').mockResolvedValue(createMockResponse({}));

            await viewService.updateOrCreate(mockView, true);

            expect(viewService.update).toHaveBeenCalledWith(mockView, true);
            
            console.log('✅ updateOrCreate complex exists test passed');
        });
    });

    describe('Error Handling', () => {
        test('should handle empty search results gracefully', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse({
                value: []
            }));

            const result = await viewService.searchStringInName('TestCube', 'NonExistent');

            expect(result).toEqual([]);
            
            console.log('✅ Empty search results handling test passed');
        });

        test('should handle invalid count responses', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse('invalid'));

            const result = await viewService.getViewCount('TestCube', false);

            expect(result).toBe(0);
            
            console.log('✅ Invalid count handling test passed');
        });

        test('should handle views without MDX in search', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse({
                value: [
                    { Name: 'NativeView1', MDX: null },
                    { Name: 'NativeView2', MDX: undefined }
                ]
            }));

            const result = await viewService.searchStringInMdx('TestCube', 'SELECT');

            expect(result).toEqual([]);
            
            console.log('✅ Views without MDX handling test passed');
        });
    });
});