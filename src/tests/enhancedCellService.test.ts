import { CellService } from '../services/CellService';
import { RestService } from '../services/RestService';
import { AxiosResponse } from 'axios';

// Mock axios
jest.mock('axios');

// Mock FileService
jest.mock('../services/FileService', () => ({
    FileService: jest.fn().mockImplementation(() => ({
        create: jest.fn().mockResolvedValue({})
    }))
}));

describe('Enhanced CellService Tests', () => {
    let cellService: CellService;
    let mockRestService: jest.Mocked<RestService>;
    let mockProcessService: any;

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

        mockProcessService = {
            create: jest.fn().mockResolvedValue({}),
            execute: jest.fn().mockResolvedValue({}),
            delete: jest.fn().mockResolvedValue({})
        } as any;

        cellService = new CellService(mockRestService, mockProcessService);
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

            await cellService.writeThroughUnboundProcess('SalesCube', cellset);

            expect(mockRestService.post).toHaveBeenCalledWith(
                '/ExecuteProcessWithReturn',
                expect.objectContaining({
                    PrologProcedure: expect.stringContaining("CubeDataSet('SalesCube'")
                })
            );

            console.log('✅ writeThroughUnboundProcess test passed');
        });

        test('writeThroughBlob should upload CSV and load from blob', async () => {
            const cellsetData = {
                'Year,Version,Region': 100
            };

            // Mock the REST calls for process creation, execution, and deletion
            mockRestService.post
                .mockResolvedValueOnce(createMockResponse({})) // Process creation
                .mockResolvedValueOnce(createMockResponse({})); // Process execution

            mockRestService.delete
                .mockResolvedValueOnce(createMockResponse({})); // Process deletion

            await cellService.writeThroughBlob('SalesCube', cellsetData);

            // Should create process, execute it, and delete it
            expect(mockRestService.post).toHaveBeenCalledTimes(2);
            expect(mockRestService.delete).toHaveBeenCalledTimes(1);

            // Verify process creation call
            expect(mockRestService.post).toHaveBeenNthCalledWith(1,
                '/Processes',
                expect.objectContaining({
                    Name: expect.stringContaining('tm1npm_blob_import_')
                })
            );

            // Verify process execution call
            expect(mockRestService.post).toHaveBeenNthCalledWith(2,
                expect.stringMatching(/\/Processes\(.*\)\/tm1\.ExecuteProcess/),
                {}
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

    describe('New Critical Methods Tests', () => {
        test('clear should clear cube data with sandbox support', async () => {
            mockRestService.post.mockResolvedValue(createMockResponse({}));

            await cellService.clear('SalesCube', 'TestSandbox');

            expect(mockRestService.post).toHaveBeenCalledWith(
                "/Cubes('SalesCube')/tm1.Clear?$sandbox=TestSandbox"
            );

            console.log('✅ clear test passed');
        });

        test('clear should clear cube data without sandbox', async () => {
            mockRestService.post.mockResolvedValue(createMockResponse({}));

            await cellService.clear('SalesCube');

            expect(mockRestService.post).toHaveBeenCalledWith(
                "/Cubes('SalesCube')/tm1.Clear"
            );

            console.log('✅ clear without sandbox test passed');
        });

        test('extractCellsetCsv should extract cellset as CSV with headers', async () => {
            const mockCellset = {
                Axes: [
                    {
                        Hierarchies: [
                            { Dimension: { Name: 'Year' } },
                            { Dimension: { Name: 'Region' } }
                        ],
                        Tuples: []
                    },
                    {
                        Tuples: [
                            { Members: [{ Name: '2024' }, { Name: 'London' }] },
                            { Members: [{ Name: '2024' }, { Name: 'Paris' }] }
                        ]
                    }
                ],
                Cells: [
                    { Value: 100 },
                    { Value: 200 }
                ]
            };

            mockRestService.get.mockResolvedValue(createMockResponse(mockCellset));

            const csv = await cellService.extractCellsetCsv('cellset-123');

            expect(csv).toContain('Year');
            expect(csv).toContain('Region');
            expect(csv).toContain('100');
            expect(csv).toContain('200');
            expect(mockRestService.get).toHaveBeenCalledWith(
                expect.stringContaining("Cellsets('cellset-123')")
            );

            console.log('✅ extractCellsetCsv test passed');
        });

        test('extractCellsetCsv should extract cellset as CSV without headers', async () => {
            const mockCellset = {
                Axes: [
                    {
                        Hierarchies: [{ Dimension: { Name: 'Year' } }],
                        Tuples: []
                    },
                    {
                        Tuples: [{ Members: [{ Name: '2024' }] }]
                    }
                ],
                Cells: [{ Value: 100 }]
            };

            mockRestService.get.mockResolvedValue(createMockResponse(mockCellset));

            const csv = await cellService.extractCellsetCsv('cellset-123', undefined, false);

            expect(csv).not.toContain('Year');
            expect(csv).toContain('100');

            console.log('✅ extractCellsetCsv without headers test passed');
        });

        test('extractCellsetCsv should handle special characters in CSV', async () => {
            const mockCellset = {
                Axes: [
                    { Hierarchies: [{ Dimension: { Name: 'Region' } }], Tuples: [] },
                    { Tuples: [{ Members: [{ Name: 'London, UK' }] }] }
                ],
                Cells: [{ Value: 'Test, Value' }]
            };

            mockRestService.get.mockResolvedValue(createMockResponse(mockCellset));

            const csv = await cellService.extractCellsetCsv('cellset-123');

            expect(csv).toContain('"London, UK"');
            expect(csv).toContain('"Test, Value"');

            console.log('✅ extractCellsetCsv special characters test passed');
        });

        test('execute_view_async should execute view asynchronously', async () => {
            mockRestService.post.mockResolvedValue(createMockResponse({
                ID: 'async-view-123'
            }));

            const asyncId = await cellService.execute_view_async('SalesCube', 'TestView');

            expect(asyncId).toBe('async-view-123');
            expect(mockRestService.post).toHaveBeenCalledWith(
                "/Cubes('SalesCube')/Views('TestView')/tm1.ExecuteAsync"
            );

            console.log('✅ execute_view_async test passed');
        });

        test('execute_view_async should support all options', async () => {
            mockRestService.post.mockResolvedValue(createMockResponse({
                ID: 'async-view-456'
            }));

            const options = {
                private: true,
                sandbox_name: 'TestSandbox',
                element_unique_names: true,
                skip_zeros: true,
                skip_consolidated: true,
                skip_rule_derived: true
            };

            const asyncId = await cellService.execute_view_async('SalesCube', 'TestView', options);

            expect(asyncId).toBe('async-view-456');

            const callUrl = mockRestService.post.mock.calls[0][0];
            expect(callUrl).toContain('/tm1.ExecuteAsync');
            expect(callUrl).toContain('private=true');
            expect(callUrl).toContain('sandbox=TestSandbox');
            expect(callUrl).toContain('element_unique_names=true');

            console.log('✅ execute_view_async with options test passed');
        });

        test('execute_view_async should return generated ID if no ID in response', async () => {
            mockRestService.post.mockResolvedValue(createMockResponse({}));

            const asyncId = await cellService.execute_view_async('SalesCube', 'TestView');

            expect(asyncId).toMatch(/^view_async_/);

            console.log('✅ execute_view_async fallback ID test passed');
        });
    });
});