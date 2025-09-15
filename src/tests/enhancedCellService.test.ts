import { CellService } from '../services/CellService';
import { RestService } from '../services/RestService';
import axios, { AxiosResponse } from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('Enhanced CellService Tests', () => {
    let cellService: CellService;
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

        cellService = new CellService(mockRestService);
    });

    describe('Enhanced Data Writing Functions', () => {
        test('writeDataframe should write tabular data to cube', async () => {
            const dataFrame = [
                ['2024', 'Actual', 'London', 100],
                ['2024', 'Forecast', 'Paris', 200]
            ];
            const dimensions = ['Year', 'Version', 'Region'];

            mockRestService.patch.mockResolvedValue(createMockResponse({}));

            await cellService.writeDataframe('SalesCube', dataFrame, dimensions);

            expect(mockRestService.patch).toHaveBeenCalledWith(
                "/Cubes('SalesCube')/tm1.Update",
                expect.objectContaining({
                    Cells: expect.arrayContaining([
                        expect.objectContaining({
                            Coordinates: [
                                { Name: '2024' },
                                { Name: 'Actual' },
                                { Name: 'London' }
                            ],
                            Value: 100
                        })
                    ])
                })
            );
            
            console.log('✅ writeDataframe test passed');
        });

        test('writeAsync should return async operation ID', async () => {
            const cellset = { '2024,Actual,London': 100 };

            mockRestService.patch.mockResolvedValue(createMockResponse(
                { ID: 'async-123' }
            ));

            const asyncId = await cellService.writeAsync('SalesCube', cellset);

            expect(asyncId).toBe('async-123');
            expect(mockRestService.patch).toHaveBeenCalledWith(
                "/Cubes('SalesCube')/tm1.UpdateAsync",
                expect.objectContaining({
                    Cells: expect.any(Array)
                })
            );
            
            console.log('✅ writeAsync test passed');
        });

        test('writeThroughUnboundProcess should execute TI statements', async () => {
            const cellset = { '2024,Actual,London': 100 };

            mockRestService.post.mockResolvedValue(createMockResponse({
                ProcessExecuteStatusCode: 'CompletedSuccessfully'
            }));

            const result = await cellService.writeThroughUnboundProcess('SalesCube', cellset);

            expect(mockRestService.post).toHaveBeenCalledWith(
                '/ExecuteProcessWithReturn',
                expect.objectContaining({
                    PrologProcedure: expect.stringContaining("CubeDataSet('SalesCube'")
                })
            );
            
            console.log('✅ writeThroughUnboundProcess test passed');
        });

        test('writeThroughBlob should upload CSV and load from blob', async () => {
            const csvData = "Year,Version,Region,Value\\n2024,Actual,London,100";

            mockRestService.post
                .mockResolvedValueOnce(createMockResponse({ ID: 'blob-123' })) // Blob upload
                .mockResolvedValueOnce(createMockResponse({})); // Cube load

            await cellService.writeThroughBlob('SalesCube', csvData);

            expect(mockRestService.post).toHaveBeenCalledTimes(2);
            expect(mockRestService.post).toHaveBeenNthCalledWith(1, '/Blobs', csvData, {
                headers: { 'Content-Type': 'text/csv' }
            });
            expect(mockRestService.post).toHaveBeenNthCalledWith(2, 
                "/Cubes('SalesCube')/tm1.LoadFromBlob",
                { BlobId: 'blob-123' }
            );
            
            console.log('✅ writeThroughBlob test passed');
        });
    });

    describe('Enhanced Data Reading Functions', () => {
        test('executeMdxElementsValueDict should return element-value dictionary', async () => {
            const mockData = { 'London': 100, 'Paris': 200, 'Berlin': 150 };

            mockRestService.post.mockResolvedValue(createMockResponse(mockData));

            const result = await cellService.executeMdxElementsValueDict(
                'SELECT NON EMPTY {[Region].Members} ON 0 FROM [SalesCube]'
            );

            expect(result).toEqual(mockData);
            expect(mockRestService.post).toHaveBeenCalledWith(
                '/ExecuteMDXElementsValue',
                { MDX: 'SELECT NON EMPTY {[Region].Members} ON 0 FROM [SalesCube]' }
            );
            
            console.log('✅ executeMdxElementsValueDict test passed');
        });
    });

    describe('Advanced Operations', () => {
        test('clearWithDataframe should clear based on DataFrame coordinates', async () => {
            const dataFrame = [
                ['2024', 'Actual', 'London'],
                ['2024', 'Forecast', 'Paris']
            ];
            const dimensions = ['Year', 'Version', 'Region'];

            mockRestService.post.mockResolvedValue(createMockResponse({}));

            await cellService.clearWithDataframe('SalesCube', dataFrame, dimensions);

            expect(mockRestService.post).toHaveBeenCalledWith(
                "/Cubes('SalesCube')/tm1.Clear",
                expect.objectContaining({
                    MDX: expect.stringContaining("('2024','Actual','London')")
                })
            );
            
            console.log('✅ clearWithDataframe test passed');
        });

        test('relativeProportionalSpread should execute proportional spread', async () => {
            const coordinates = ['2024', 'Actual', 'Total'];

            mockRestService.post.mockResolvedValue(createMockResponse({}));

            await cellService.relativeProportionalSpread('SalesCube', coordinates, 1000);

            expect(mockRestService.post).toHaveBeenCalledWith(
                "/Cubes('SalesCube')/tm1.ProportionalSpread(coordinates=['2024','Actual','Total'],value=1000)"
            );
            
            console.log('✅ relativeProportionalSpread test passed');
        });

        test('clearSpread should execute clear spread', async () => {
            const coordinates = ['2024', 'Actual', 'Total'];

            mockRestService.post.mockResolvedValue(createMockResponse({}));

            await cellService.clearSpread('SalesCube', coordinates);

            expect(mockRestService.post).toHaveBeenCalledWith(
                "/Cubes('SalesCube')/tm1.ClearSpread(coordinates=['2024','Actual','Total'])"
            );
            
            console.log('✅ clearSpread test passed');
        });

        test('checkCellFeeders should return feeder status', async () => {
            const coordinates = ['2024', 'Actual', 'London'];

            mockRestService.get.mockResolvedValue(createMockResponse({ value: true }));

            const hasFeeders = await cellService.checkCellFeeders('SalesCube', coordinates);

            expect(hasFeeders).toBe(true);
            expect(mockRestService.get).toHaveBeenCalledWith(
                "/Cubes('SalesCube')/tm1.CheckCellFeeders(coordinates=['2024','Actual','London'])"
            );
            
            console.log('✅ checkCellFeeders test passed');
        });
    });

    describe('Error Handling', () => {
        test('should handle write errors gracefully', async () => {
            const cellset = { '2024,Actual,London': 100 };

            mockRestService.patch.mockRejectedValue(new Error('Server Error'));

            await expect(cellService.write('SalesCube', cellset)).rejects.toThrow('Server Error');
            
            console.log('✅ Error handling test passed');
        });

        test('should handle sandbox operations', async () => {
            const cellset = { '2024,Actual,London': 100 };

            mockRestService.patch.mockResolvedValue(createMockResponse({}));

            await cellService.write('SalesCube', cellset, undefined, { sandbox_name: 'TestSandbox' });

            expect(mockRestService.patch).toHaveBeenCalledWith(
                "/Cubes('SalesCube')/tm1.Update?$sandbox=TestSandbox",
                expect.any(Object)
            );
            
            console.log('✅ Sandbox operations test passed');
        });
    });
});