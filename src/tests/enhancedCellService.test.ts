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
        test('writeDataframe routes through write() with built CellsetDict (sums numeric duplicates)', async () => {
            const dataFrame = [
                ['2024', 'Actual', 'London', 100],
                ['2024', 'Actual', 'London', 50],     // duplicate intersection — should sum
                ['2024', 'Forecast', 'Paris', 200],
            ];

            const writeSpy = jest.spyOn(cellService, 'write').mockResolvedValue(undefined);

            await cellService.writeDataframe('SalesCube', dataFrame);

            expect(writeSpy).toHaveBeenCalledTimes(1);
            const [cube, cells, opts] = writeSpy.mock.calls[0];
            expect(cube).toBe('SalesCube');
            expect(cells).toEqual({
                '2024,Actual,London': 150,
                '2024,Forecast,Paris': 200,
            });
            expect(opts).toEqual({});

            console.log('✅ writeDataframe routing test passed');
        });

        test('writeDataframe rejects rows with wrong column count', async () => {
            const dataFrame = [
                ['2024', 'Actual', 100],   // missing one dim column (3 dims expected → 4 cols)
            ];

            await expect(cellService.writeDataframe('SalesCube', dataFrame))
                .rejects.toThrow(/Number of columns/);
        });

        test('writeAsync chunks the cellset and delegates to writeThroughBlob', async () => {
            const cellset = { '2024,Actual,London': 100, '2024,Actual,Paris': 200 };

            const writeThroughBlobSpy = jest
                .spyOn(cellService, 'writeThroughBlob')
                .mockResolvedValue(undefined);

            const result = await cellService.writeAsync('SalesCube', cellset, { slice_size: 1, max_workers: 2 });

            expect(result).toBeUndefined();
            // Two entries with slice_size=1 → two chunks → two writeThroughBlob calls.
            // writeAsync calls writeThroughBlob directly (not through write()), so use_blob is not
            // a meaningful flag on the underlying call; we just check the cube name and that the
            // chunks are forwarded as-is.
            expect(writeThroughBlobSpy).toHaveBeenCalledTimes(2);
            expect(writeThroughBlobSpy).toHaveBeenNthCalledWith(
                1, 'SalesCube', expect.any(Object), expect.any(Object)
            );
        });

        test('writeAsync aggregates TM1pyWriteFailureException chunks into TM1pyWritePartialFailureException with merged statuses/logs', async () => {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const { TM1pyWriteFailureException, TM1pyWritePartialFailureException } =
                require('../exceptions/TM1Exception');
            const cellset = { 'a,b,c': 1, 'd,e,f': 2, 'g,h,i': 3 };

            jest.spyOn(cellService, 'writeThroughBlob')
                .mockRejectedValueOnce(new TM1pyWriteFailureException(['HasMinorErrors'], ['log1.log']))
                .mockResolvedValueOnce(undefined)
                .mockRejectedValueOnce(new TM1pyWritePartialFailureException(['Aborted'], ['log3.log'], 2));

            try {
                await cellService.writeAsync('SalesCube', cellset, { slice_size: 1, max_workers: 3 });
                fail('expected writeAsync to throw');
            } catch (err: any) {
                expect(err).toBeInstanceOf(TM1pyWritePartialFailureException);
                // Statuses + log files are concatenated across both failed chunks (tm1py-style merge).
                expect(err.statuses).toEqual(['HasMinorErrors', 'Aborted']);
                expect(err.errorLogFiles).toEqual(['log1.log', 'log3.log']);
                // attempts: 1 (bare WriteFailure) + 2 (partial.attempts) = 3
                expect(err.attempts).toBe(3);
            }
        });

        test('writeAsync hoists transaction-log toggles around the whole job (does NOT forward to chunks)', async () => {
            const cellset = { 'a,b,c': 1, 'd,e,f': 2 };
            const deactivateSpy = jest.spyOn(cellService, 'deactivateTransactionlog').mockResolvedValue(undefined);
            const activateSpy = jest.spyOn(cellService, 'activateTransactionlog').mockResolvedValue(undefined);
            const blobSpy = jest.spyOn(cellService, 'writeThroughBlob').mockResolvedValue(undefined);

            await cellService.writeAsync('SalesCube', cellset, {
                slice_size: 1,
                max_workers: 2,
                deactivate_transaction_log: true,
                reactivate_transaction_log: true,
            });

            // Only ONE deactivate / activate pair around the whole job, not one per chunk.
            expect(deactivateSpy).toHaveBeenCalledTimes(1);
            expect(activateSpy).toHaveBeenCalledTimes(1);
            // Per-chunk options must NOT include transaction-log toggles (would race in parallel).
            for (const call of blobSpy.mock.calls) {
                const opts = call[2] as Record<string, unknown>;
                expect(opts).not.toHaveProperty('deactivate_transaction_log');
                expect(opts).not.toHaveProperty('reactivate_transaction_log');
            }
        });

        test('writeThroughUnboundProcess emits CellPutN statements via Process body', async () => {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const { CaseAndSpaceInsensitiveDict } = require('../utils/Utils');
            const cellset = { '2024,Actual,London': 100 };

            // Stub out the auto-fetch of measure dimension element types so the test stays
            // hermetic. The helper returns a CaseAndSpaceInsensitiveDict; an empty one is fine —
            // the statement builder defaults to 'Numeric' for unknown measures.
            jest.spyOn(cellService as any, '_fetchMeasureDimensionElementTypes')
                .mockResolvedValue(new CaseAndSpaceInsensitiveDict());

            mockRestService.post.mockResolvedValue(createMockResponse({
                ProcessExecuteStatusCode: 'CompletedSuccessfully',
            }));

            await cellService.writeThroughUnboundProcess('SalesCube', cellset);

            expect(mockRestService.post).toHaveBeenCalledWith(
                '/ExecuteProcessWithReturn?$expand=*',
                expect.stringContaining("CellPutN(")
            );
            // Confirm the emitted statement targets the right cube and coordinates.
            const body = JSON.parse(mockRestService.post.mock.calls[0][1]);
            expect(body.Process.PrologProcedure).toContain("CellPutN(100,'SalesCube','2024','Actual','London');");

            console.log('✅ writeThroughUnboundProcess test passed');
        });

        test('writeThroughBlob uploads CSV and executes a TI process via /ExecuteProcessWithReturn', async () => {
            const cellsetData = {
                '2024,Actual,London': 100,
            };

            // Capture the FileService factory mock created at module load time.
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const { FileService } = require('../services/FileService');
            const fsCreate = jest.fn().mockResolvedValue({});
            const fsDelete = jest.fn().mockResolvedValue({});
            (FileService as jest.Mock).mockImplementationOnce(() => ({
                create: fsCreate,
                delete: fsDelete,
            }));

            mockRestService.post.mockResolvedValue(createMockResponse({
                ProcessExecuteStatusCode: 'CompletedSuccessfully',
            }));

            await cellService.writeThroughBlob('SalesCube', cellsetData);

            // CSV uploaded as a single file, then the TI process executed, then file deleted.
            expect(fsCreate).toHaveBeenCalledTimes(1);
            const [fname, content] = fsCreate.mock.calls[0];
            expect(fname).toMatch(/^tm1py_[0-9a-f]+\.csv$/);
            expect(Buffer.isBuffer(content)).toBe(true);
            // tm1py csv.writer default: '\r\n' terminator after every row (including the last).
            expect(content.toString('utf-8')).toBe('"2024","Actual","London","100"\r\n');

            expect(mockRestService.post).toHaveBeenCalledTimes(1);
            expect(mockRestService.post).toHaveBeenCalledWith(
                '/ExecuteProcessWithReturn?$expand=*',
                expect.any(String)
            );

            expect(fsDelete).toHaveBeenCalledTimes(1);
            expect(fsDelete).toHaveBeenCalledWith(fname);

            console.log('✅ writeThroughBlob test passed');
        });

        test('writeThroughBlob skips file delete when remove_blob is false', async () => {
            const cellsetData = { '2024,Actual,London': 100 };

            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const { FileService } = require('../services/FileService');
            const fsCreate = jest.fn().mockResolvedValue({});
            const fsDelete = jest.fn().mockResolvedValue({});
            (FileService as jest.Mock).mockImplementationOnce(() => ({
                create: fsCreate,
                delete: fsDelete,
            }));

            mockRestService.post.mockResolvedValue(createMockResponse({
                ProcessExecuteStatusCode: 'CompletedSuccessfully',
            }));

            await cellService.writeThroughBlob('SalesCube', cellsetData, { remove_blob: false });

            expect(fsCreate).toHaveBeenCalledTimes(1);
            expect(fsDelete).not.toHaveBeenCalled();
        });

        test('write throws when clear_view is set without use_blob', async () => {
            await expect(
                cellService.write('SalesCube', { 'a,b,c': 1 }, { clear_view: 'SomeView' })
            ).rejects.toThrow(/clear_view.*use_blob/);
        });

        test('write routes to writeThroughUnboundProcess when use_ti=true', async () => {
            const spy = jest.spyOn(cellService, 'writeThroughUnboundProcess').mockResolvedValue(undefined);
            await cellService.write('SalesCube', { 'a,b,c': 1 }, { use_ti: true });
            expect(spy).toHaveBeenCalledTimes(1);
        });

        test('write routes to writeThroughBlob when use_blob=true', async () => {
            const spy = jest.spyOn(cellService, 'writeThroughBlob').mockResolvedValue(undefined);
            await cellService.write('SalesCube', { 'a,b,c': 1 }, { use_blob: true });
            expect(spy).toHaveBeenCalledTimes(1);
        });
    });

    describe('Enhanced Data Reading Functions', () => {
        test('executeMdxElementsValueDict parses comma-CSV into a dict joined by user separator', async () => {
            const csv = 'Region,Value\nLondon,100\nParis,200\nBerlin,150\n';
            jest.spyOn(cellService, 'executeMdxCsv').mockResolvedValue(csv);

            const result = await cellService.executeMdxElementsValueDict(
                'SELECT NON EMPTY {[Region].Members} ON 0 FROM [SalesCube]'
            );

            expect(result).toEqual({ London: '100', Paris: '200', Berlin: '150' });
        });

        test('executeMdxElementsValueDict joins multi-dim keys with the user-supplied separator', async () => {
            const csv = 'Region,Year,Value\nLondon,2024,100\nParis,2024,200\n';
            jest.spyOn(cellService, 'executeMdxCsv').mockResolvedValue(csv);

            const result = await cellService.executeMdxElementsValueDict(
                'SELECT 1 ON 0 FROM [c]',
                '|',
            );

            expect(result).toEqual({ 'London|2024': '100', 'Paris|2024': '200' });
        });

        test('executeMdxElementsValueDict honors quoted CSV fields with embedded commas', async () => {
            const csv = 'Region,Value\n"Lon,don",100\nParis,"5,0"\n';
            jest.spyOn(cellService, 'executeMdxCsv').mockResolvedValue(csv);

            const result = await cellService.executeMdxElementsValueDict('SELECT 1 ON 0 FROM [c]');

            expect(result).toEqual({ 'Lon,don': '100', Paris: '5,0' });
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
            // extractCellsetCsv now makes 2 REST calls:
            // 1. extractCellsetComposition → GET Cube+Axes(Hierarchies)
            // 2. extractCellsetRaw → GET full cellset
            const mockComposition = {
                Cube: { Name: 'SalesCube' },
                Axes: [
                    { Hierarchies: [{ UniqueName: '[Year].[Year]' }] },   // columns axis 0
                    { Hierarchies: [{ UniqueName: '[Region].[Region]' }] }, // rows axis 1
                ]
            };
            const mockRawCellset = {
                Cube: { Name: 'SalesCube', Dimensions: [{ Name: 'Year' }, { Name: 'Region' }] },
                Axes: [
                    {
                        Cardinality: 1,
                        Tuples: [{ Members: [{ Name: '2024', UniqueName: '[Year].[Year].[2024]' }] }]
                    },
                    {
                        Cardinality: 2,
                        Tuples: [
                            { Members: [{ Name: 'London', UniqueName: '[Region].[Region].[London]' }] },
                            { Members: [{ Name: 'Paris', UniqueName: '[Region].[Region].[Paris]' }] }
                        ]
                    }
                ],
                Cells: [{ Value: 100 }, { Value: 200 }]
            };

            mockRestService.get
                .mockResolvedValueOnce(createMockResponse(mockComposition))
                .mockResolvedValueOnce(createMockResponse(mockRawCellset));
            mockRestService.delete = jest.fn().mockResolvedValue({});

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
            const mockComposition = {
                Cube: { Name: 'SalesCube' },
                Axes: [
                    { Hierarchies: [{ UniqueName: '[Year].[Year]' }] },
                ]
            };
            const mockRawCellset = {
                Cube: { Name: 'SalesCube', Dimensions: [{ Name: 'Year' }] },
                Axes: [
                    {
                        Cardinality: 1,
                        Tuples: [{ Members: [{ Name: '2024', UniqueName: '[Year].[Year].[2024]' }] }]
                    }
                ],
                Cells: [{ Value: 100 }]
            };

            mockRestService.get
                .mockResolvedValueOnce(createMockResponse(mockComposition))
                .mockResolvedValueOnce(createMockResponse(mockRawCellset));
            mockRestService.delete = jest.fn().mockResolvedValue({});

            const csv = await cellService.extractCellsetCsv('cellset-123', { includeHeaders: false });

            expect(csv).not.toContain('Year');
            expect(csv).toContain('100');

            console.log('✅ extractCellsetCsv without headers test passed');
        });

        test('extractCellsetCsv should handle special characters in CSV', async () => {
            const mockComposition = {
                Cube: { Name: 'SalesCube' },
                Axes: [
                    { Hierarchies: [{ UniqueName: '[Region].[Region]' }] },
                ]
            };
            const mockRawCellset = {
                Cube: { Name: 'SalesCube', Dimensions: [{ Name: 'Region' }] },
                Axes: [
                    {
                        Cardinality: 1,
                        Tuples: [{ Members: [{ Name: 'London, UK', UniqueName: '[Region].[Region].[London, UK]' }] }]
                    }
                ],
                Cells: [{ Value: 'Test, Value' }]
            };

            mockRestService.get
                .mockResolvedValueOnce(createMockResponse(mockComposition))
                .mockResolvedValueOnce(createMockResponse(mockRawCellset));
            mockRestService.delete = jest.fn().mockResolvedValue({});

            const csv = await cellService.extractCellsetCsv('cellset-123');

            expect(csv).toContain('"London, UK"');
            expect(csv).toContain('"Test, Value"');

            console.log('✅ extractCellsetCsv special characters test passed');
        });

        test('execute_view_async creates cellset from view, extracts, and returns Map keyed by UniqueName', async () => {
            jest.spyOn(cellService, 'createCellsetFromView').mockResolvedValue('CSID-V');
            jest.spyOn(cellService as any, '_extractCellsetForTupleDict').mockResolvedValue({
                Axes: [{
                    Cardinality: 1,
                    Hierarchies: [{ Dimension: { Name: 'Region' }, Name: 'Region' }],
                    Tuples: [{ Members: [{ Name: 'London', UniqueName: '[Region].[Region].[London]' }] }],
                }],
                Cells: [{ Value: 100 }],
            });
            jest.spyOn(cellService, 'getDimensionNamesForWriting').mockResolvedValue(['Region']);
            const deleteSpy = jest.spyOn(cellService, 'deleteCellset').mockResolvedValue(undefined);

            const result = await cellService.execute_view_async('SalesCube', 'TestView');

            expect(result instanceof Map).toBe(true);
            // Matches tm1py default element_unique_names=True
            expect(result.get('[Region].[Region].[London]')).toBe(100);
            expect(deleteSpy).toHaveBeenCalledWith('CSID-V', undefined);
        });

        test('execute_view_async reorders tuple parts by cube dimension order (parity with tm1py.sort_coordinates)', async () => {
            jest.spyOn(cellService, 'createCellsetFromView').mockResolvedValue('CSID-V');
            // Axis 0 = Region; Axis 1 = Time. Cube dimensions = [Time, Region] — keys must come out as Time,Region.
            jest.spyOn(cellService as any, '_extractCellsetForTupleDict').mockResolvedValue({
                Axes: [
                    {
                        Cardinality: 1,
                        Hierarchies: [{ Dimension: { Name: 'Region' } }],
                        Tuples: [{ Members: [{ UniqueName: '[Region].[Region].[USA]' }] }],
                    },
                    {
                        Cardinality: 1,
                        Hierarchies: [{ Dimension: { Name: 'Time' } }],
                        Tuples: [{ Members: [{ UniqueName: '[Time].[Time].[2024]' }] }],
                    },
                ],
                Cells: [{ Value: 42 }],
            });
            jest.spyOn(cellService, 'getDimensionNamesForWriting').mockResolvedValue(['Time', 'Region']);
            jest.spyOn(cellService, 'deleteCellset').mockResolvedValue(undefined);

            const result = await cellService.execute_view_async('SalesCube', 'TestView');

            expect(result.get('[Time].[Time].[2024],[Region].[Region].[USA]')).toBe(42);
        });

        test('execute_view_async respects private/sandbox options', async () => {
            const createSpy = jest.spyOn(cellService, 'createCellsetFromView').mockResolvedValue('CSID-V');
            jest.spyOn(cellService as any, '_extractCellsetForTupleDict').mockResolvedValue({ Axes: [], Cells: [] });
            jest.spyOn(cellService, 'getDimensionNamesForWriting').mockResolvedValue([]);
            jest.spyOn(cellService, 'deleteCellset').mockResolvedValue(undefined);

            await cellService.execute_view_async('SalesCube', 'TestView', {
                private: true,
                sandbox_name: 'TestSandbox',
            });

            expect(createSpy).toHaveBeenCalledWith('SalesCube', 'TestView', true, 'TestSandbox');
        });

        test('cellset cleanup suppresses 404 only (parity with tm1py @tidy_cellset)', async () => {
            jest.spyOn(cellService, 'createCellsetFromView').mockResolvedValue('CSID-V');
            jest.spyOn(cellService as any, '_extractCellsetForTupleDict').mockResolvedValue({ Axes: [], Cells: [] });
            jest.spyOn(cellService, 'getDimensionNamesForWriting').mockResolvedValue([]);
            const notFound: any = new Error('not found');
            notFound.statusCode = 404;
            jest.spyOn(cellService, 'deleteCellset').mockRejectedValueOnce(notFound);

            // 404 during cleanup must not propagate
            await expect(cellService.execute_view_async('SalesCube', 'V')).resolves.toBeInstanceOf(Map);
        });

        test('cellset cleanup re-raises non-404 errors (parity with tm1py @tidy_cellset)', async () => {
            jest.spyOn(cellService, 'createCellsetFromView').mockResolvedValue('CSID-V');
            jest.spyOn(cellService as any, '_extractCellsetForTupleDict').mockResolvedValue({ Axes: [], Cells: [] });
            jest.spyOn(cellService, 'getDimensionNamesForWriting').mockResolvedValue([]);
            const serverError: any = new Error('server error');
            serverError.statusCode = 500;
            jest.spyOn(cellService, 'deleteCellset').mockRejectedValueOnce(serverError);

            await expect(cellService.execute_view_async('SalesCube', 'V'))
                .rejects.toThrow('server error');
        });

        test('execute_view_async prefers Element.UniqueName when Member only carries Element shape', async () => {
            jest.spyOn(cellService, 'createCellsetFromView').mockResolvedValue('CSID-V');
            // Real TM1 cellset shape with $expand=Members($expand=Element($select=UniqueName)):
            // Member has no top-level UniqueName, only Element.UniqueName.
            jest.spyOn(cellService as any, '_extractCellsetForTupleDict').mockResolvedValue({
                Axes: [{
                    Cardinality: 1,
                    Hierarchies: [{ Dimension: { Name: 'Region' } }],
                    Tuples: [{ Members: [{ Name: 'London', Element: { UniqueName: '[Region].[Region].[London]' } }] }],
                }],
                Cells: [{ Value: 100 }],
            });
            jest.spyOn(cellService, 'getDimensionNamesForWriting').mockResolvedValue(['Region']);
            jest.spyOn(cellService, 'deleteCellset').mockResolvedValue(undefined);

            const result = await cellService.execute_view_async('SalesCube', 'TestView');

            expect(result.get('[Region].[Region].[London]')).toBe(100);
        });
    });

    describe('TM1Service-constructed CellService', () => {
        test('writeAsync does not throw "ProcessService is required" when called via TM1Service constructor (regression for issue #69)', async () => {
            // Reproduces the path TM1Service uses: pass ProcessService into CellService.
            // Without this dependency the new writeAsync (which delegates to writeThroughBlob,
            // which requires ProcessService) would throw at runtime.
            const tm1RestMock: any = {
                post: jest.fn().mockResolvedValue(createMockResponse({})),
                get: jest.fn().mockResolvedValue(createMockResponse({ Dimensions: [] })),
                delete: jest.fn().mockResolvedValue(createMockResponse({})),
                patch: jest.fn().mockResolvedValue(createMockResponse({})),
                put: jest.fn().mockResolvedValue(createMockResponse({})),
            };
            const processServiceLike = new (require('../services/ProcessService').ProcessService)(tm1RestMock);
            const viewServiceLike = new (require('../services/ViewService').ViewService)(tm1RestMock);
            const cs = new CellService(tm1RestMock, processServiceLike, viewServiceLike);

            // Spy on writeThroughBlob to confirm writeAsync routes there without throwing.
            const blobSpy = jest.spyOn(cs, 'writeThroughBlob').mockResolvedValue(undefined);

            await cs.writeAsync('SalesCube', { 'a,b,c': 1 }, { slice_size: 1, max_workers: 1 });

            expect(blobSpy).toHaveBeenCalledTimes(1);
        });
    });
});