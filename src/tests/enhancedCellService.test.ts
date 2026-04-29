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
        jest.spyOn(cellService, 'getDimensionNamesForWriting').mockResolvedValue(['Year', 'Version', 'Region']);
        jest.spyOn(cellService, 'executeMdxValues').mockResolvedValue([]);
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

        test('writeAsync chunks the cellset and delegates to writeThroughBlob', async () => {
            const cellset = { '2024,Actual,London': 100, '2024,Actual,Paris': 200 };

            const writeThroughBlobSpy = jest
                .spyOn(cellService, 'writeThroughBlob')
                .mockResolvedValue(undefined);

            const result = await cellService.writeAsync('SalesCube', cellset, { slice_size: 1, max_workers: 2 });

            expect(result).toBeUndefined();
            // Two entries with slice_size=1 → two chunks → two writeThroughBlob calls
            expect(writeThroughBlobSpy).toHaveBeenCalledTimes(2);
            expect(writeThroughBlobSpy).toHaveBeenCalledWith(
                'SalesCube',
                expect.any(Object),
                expect.objectContaining({ use_blob: true })
            );
        });

        test('writeAsync aggregates per-chunk failures into a TM1Exception', async () => {
            const cellset = { 'a,b,c': 1, 'd,e,f': 2 };

            jest.spyOn(cellService, 'writeThroughBlob')
                .mockRejectedValueOnce(new Error('chunk1 failed'))
                .mockResolvedValueOnce(undefined);

            await expect(
                cellService.writeAsync('SalesCube', cellset, { slice_size: 1, max_workers: 2 })
            ).rejects.toThrow(/writeAsync partial failure: 1\/2 chunks failed/);
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
        test('executeMdxElementsValueDict parses CSV from executeMdxCsv into a dict', async () => {
            const csv = 'Region|Value\nLondon|100\nParis|200\nBerlin|150\n';
            jest.spyOn(cellService, 'executeMdxCsv').mockResolvedValue(csv);

            const result = await cellService.executeMdxElementsValueDict(
                'SELECT NON EMPTY {[Region].Members} ON 0 FROM [SalesCube]'
            );

            expect(result).toEqual({ London: '100', Paris: '200', Berlin: '150' });
        });

        test('executeMdxElementsValueDict honors quoted CSV fields with embedded separators', async () => {
            const csv = 'Region|Value\n"Lon|don"|100\nParis|"5|0"\n';
            jest.spyOn(cellService, 'executeMdxCsv').mockResolvedValue(csv);

            const result = await cellService.executeMdxElementsValueDict('SELECT 1 ON 0 FROM [c]');

            expect(result).toEqual({ 'Lon|don': '100', Paris: '5|0' });
        });
    });

    describe('Advanced Operations', () => {
        test('clearWithDataframe should delegate to clearWithMdx', async () => {
            const dataFrame = [
                ['2024', 'Actual', 'London'],
                ['2024', 'Forecast', 'Paris']
            ];
            const dimensions = ['Year', 'Version', 'Region'];

            jest.spyOn(cellService, 'clearWithMdx').mockResolvedValue();

            await cellService.clearWithDataframe('SalesCube', dataFrame, dimensions);

            expect(cellService.clearWithMdx).toHaveBeenCalledWith(
                'SalesCube',
                expect.stringContaining("('2024','Actual','London')"),
                undefined
            );

            console.log('✅ clearWithDataframe test passed');
        });

        test('relativeProportionalSpread builds RP cellset payload (parity with tm1py)', async () => {
            jest.spyOn(cellService, 'createCellset').mockResolvedValue('CSID1');
            jest.spyOn(cellService, 'deleteCellset').mockResolvedValue(undefined);
            mockRestService.post.mockResolvedValue(createMockResponse({}));

            await cellService.relativeProportionalSpread(
                100,
                'SalesCube',
                ['[Region].[All]', '[Time].[2024]'],
                ['[Region].[USA]'],
                undefined,
                'sb1'
            );

            expect(mockRestService.post.mock.calls[0][0]).toBe("/Cellsets('CSID1')/tm1.Update?!sandbox=sb1");
            const body = JSON.parse(mockRestService.post.mock.calls[0][1]);
            expect(body.Value).toBe('RP100');
            expect(body['ReferenceCube@odata.bind']).toBe("Cubes('SalesCube')");
            expect(body['ReferenceCell@odata.bind']).toEqual([
                "Dimensions('Region')/Hierarchies('Region')/Elements('USA')",
            ]);
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

            mockRestService.post.mockRejectedValue(new Error('Server Error'));

            await expect(cellService.write('SalesCube', cellset)).rejects.toThrow('Server Error');

            console.log('✅ Error handling test passed');
        });

        test('should handle sandbox operations', async () => {
            const cellset = { '2024,Actual,London': 100 };

            mockRestService.post.mockResolvedValue(createMockResponse({}));

            await cellService.write('SalesCube', cellset, undefined, { sandbox_name: 'TestSandbox' });

            expect(mockRestService.post).toHaveBeenCalledWith(
                "/Cubes('SalesCube')/tm1.Update?$sandbox=TestSandbox",
                expect.any(String)
            );

            console.log('✅ Sandbox operations test passed');
        });
    });

    describe('New Critical Methods Tests', () => {
        test('clear delegates to clearWithMdx with NON EMPTY column-axis MDX', async () => {
            jest.spyOn(cellService, 'getDimensionNamesForWriting').mockResolvedValue(['Year', 'Region']);
            const clearWithMdxSpy = jest.spyOn(cellService, 'clearWithMdx').mockResolvedValue(undefined);

            await cellService.clear('SalesCube', { region: '{[Region].[Australia]}' }, 'TestSandbox');

            expect(clearWithMdxSpy).toHaveBeenCalledTimes(1);
            const [, mdx, sandboxArg] = clearWithMdxSpy.mock.calls[0];
            expect(sandboxArg).toBe('TestSandbox');
            expect(mdx).toContain('NON EMPTY');
            expect(mdx).toContain('FROM [SalesCube]');
            expect(mdx).toContain('{[Region].[Australia]}');
            expect(mdx).toContain('{TM1FILTERBYLEVEL({TM1SUBSETALL([Year])},0)}');
        });

        test('clear without dimensionExpressions defaults all dims', async () => {
            jest.spyOn(cellService, 'getDimensionNamesForWriting').mockResolvedValue(['Year']);
            const clearWithMdxSpy = jest.spyOn(cellService, 'clearWithMdx').mockResolvedValue(undefined);

            await cellService.clear('SalesCube');

            const [, mdx, sandboxArg] = clearWithMdxSpy.mock.calls[0];
            expect(sandboxArg).toBeUndefined();
            expect(mdx).toContain('{TM1FILTERBYLEVEL({TM1SUBSETALL([Year])},0)}');
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

        test('execute_view_async creates cellset from view, extracts, and returns Map keyed by UniqueName', async () => {
            jest.spyOn(cellService, 'createCellsetFromView').mockResolvedValue('CSID-V');
            jest.spyOn(cellService, 'extractCellset').mockResolvedValue({
                Axes: [{
                    Cardinality: 1,
                    Tuples: [{ Members: [{ Name: 'London', UniqueName: '[Region].[Region].[London]' }] }],
                }],
                Cells: [{ Value: 100 }],
            });
            const deleteSpy = jest.spyOn(cellService, 'deleteCellset').mockResolvedValue(undefined);

            const result = await cellService.execute_view_async('SalesCube', 'TestView');

            expect(result instanceof Map).toBe(true);
            // Matches tm1py default element_unique_names=True
            expect(result.get('[Region].[Region].[London]')).toBe(100);
            expect(deleteSpy).toHaveBeenCalledWith('CSID-V', undefined);
        });

        test('execute_view_async respects private/sandbox options', async () => {
            const createSpy = jest.spyOn(cellService, 'createCellsetFromView').mockResolvedValue('CSID-V');
            jest.spyOn(cellService, 'extractCellset').mockResolvedValue({ Axes: [], Cells: [] });
            jest.spyOn(cellService, 'deleteCellset').mockResolvedValue(undefined);

            await cellService.execute_view_async('SalesCube', 'TestView', {
                private: true,
                sandbox_name: 'TestSandbox',
            });

            expect(createSpy).toHaveBeenCalledWith('SalesCube', 'TestView', true, 'TestSandbox');
        });
    });
});