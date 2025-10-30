/**
 * Unit tests for DataFrameService
 */

import { DataFrameService, DataFrameQuery } from '../services/DataFrameService';
import { RestService } from '../services/RestService';
import { DataFrame } from '../utils/DataFrame';
import { AxiosResponse } from 'axios';

// Mock RestService
jest.mock('../services/RestService');

// Helper to create mock AxiosResponse
const createMockResponse = <T>(data: T): AxiosResponse<T> => ({
    data,
    status: 200,
    statusText: 'OK',
    headers: {},
    config: {} as any
});

describe('DataFrameService', () => {
    let dataframeService: DataFrameService;
    let mockRestService: jest.Mocked<RestService>;

    beforeEach(() => {
        mockRestService = new RestService({
            address: 'localhost',
            port: 8001,
            user: 'admin',
            password: 'apple'
        }) as jest.Mocked<RestService>;

        dataframeService = new DataFrameService(mockRestService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('mdxToPandasDataFrame', () => {
        it('should execute MDX and return DataFrame', async () => {
            const mockCellset = {
                Axes: [
                    {},
                    {
                        Hierarchies: [
                            { Name: 'Time' },
                            { Name: 'Account' }
                        ]
                    }
                ],
                Cells: [
                    {
                        Members: [
                            { Name: 'Jan' },
                            { Name: 'Revenue' }
                        ],
                        Value: 1000
                    },
                    {
                        Members: [
                            { Name: 'Feb' },
                            { Name: 'Revenue' }
                        ],
                        Value: 1100
                    }
                ]
            };

            mockRestService.post.mockResolvedValue(createMockResponse(mockCellset));

            const mdx = 'SELECT [Time].Members ON 0, [Account].Members ON 1 FROM [Budget]';
            const df = await dataframeService.mdxToPandasDataFrame(mdx);

            expect(mockRestService.post).toHaveBeenCalledWith(
                '/ExecuteMDX',
                { MDX: mdx }
            );
            expect(df).toBeInstanceOf(DataFrame);
            expect(df.shape).toEqual([2, 3]); // 2 rows, 3 columns (Time, Account, Value)
            expect(df.columns).toEqual(['Time', 'Account', 'Value']);
        });

        it('should execute MDX with shaped option', async () => {
            const mockShapedResponse = {
                Columns: [
                    { Name: 'Time' },
                    { Name: 'Account' },
                    { Name: 'Value' }
                ],
                Values: [
                    ['Jan', 'Revenue', 1000],
                    ['Feb', 'Revenue', 1100]
                ]
            };

            mockRestService.post.mockResolvedValue(createMockResponse(mockShapedResponse));

            const mdx = 'SELECT [Time].Members ON 0 FROM [Budget]';
            const df = await dataframeService.mdxToPandasDataFrame(mdx, { shaped: true });

            expect(mockRestService.post).toHaveBeenCalledWith(
                '/ExecuteMDXDataFrameShaped',
                { MDX: mdx }
            );
            expect(df).toBeInstanceOf(DataFrame);
            expect(df.columns).toEqual(['Time', 'Account', 'Value']);
        });

        it('should execute MDX with pivot option', async () => {
            mockRestService.post.mockResolvedValue(createMockResponse({
                Axes: [
                    {},
                    { Hierarchies: [{ Name: 'Account' }] }
                ],
                Cells: [
                    { Members: [{ Name: 'Revenue' }], Value: 1000 }
                ]
            }));

            const mdx = 'SELECT NON EMPTY [Time].Members ON 0 FROM [Budget]';
            const df = await dataframeService.mdxToPandasDataFrame(mdx, { pivot: true });

            expect(mockRestService.post).toHaveBeenCalledWith(
                '/ExecuteMDXPivot',
                { MDX: mdx }
            );
            expect(df).toBeInstanceOf(DataFrame);
        });
    });

    describe('viewToPandasDataFrame', () => {
        it('should execute public view and return DataFrame', async () => {
            const mockCellset = {
                Axes: [
                    {},
                    { Hierarchies: [{ Name: 'Time' }] }
                ],
                Cells: [
                    { Members: [{ Name: 'Jan' }], Value: 1000 }
                ]
            };

            mockRestService.post.mockResolvedValue(createMockResponse(mockCellset));

            const df = await dataframeService.viewToPandasDataFrame('Budget', 'YearlySummary');

            expect(mockRestService.post).toHaveBeenCalledWith(
                "/Cubes('Budget')/Views('YearlySummary')/tm1.Execute",
                {}
            );
            expect(df).toBeInstanceOf(DataFrame);
        });

        it('should execute private view', async () => {
            const mockCellset = {
                Axes: [
                    {},
                    { Hierarchies: [{ Name: 'Account' }] }
                ],
                Cells: [
                    { Members: [{ Name: 'Revenue' }], Value: 2000 }
                ]
            };

            mockRestService.post.mockResolvedValue(createMockResponse(mockCellset));

            const df = await dataframeService.viewToPandasDataFrame(
                'Budget',
                'MyView',
                { private: true }
            );

            expect(mockRestService.post).toHaveBeenCalledWith(
                "/Cubes('Budget')/PrivateViews('MyView')/tm1.Execute",
                {}
            );
            expect(df).toBeInstanceOf(DataFrame);
        });

        it('should execute view with options', async () => {
            mockRestService.post.mockResolvedValue(createMockResponse({
                Axes: [
                    {},
                    { Hierarchies: [{ Name: 'Time' }] }
                ],
                Cells: []
            }));

            await dataframeService.viewToPandasDataFrame('Budget', 'TestView', {
                sandbox: 'Development',
                skip_zeros: true,
                skip_consolidated: false
            });

            const callUrl = mockRestService.post.mock.calls[0][0] as string;
            expect(callUrl).toContain('$sandbox=Development');
            expect(callUrl).toContain('$skip_zeros=true');
            expect(callUrl).toContain('$skip_consolidated=false');
        });
    });

    describe('writeDataFrame', () => {
        it('should write DataFrame to cube', async () => {
            const df = new DataFrame(
                [
                    ['Jan', 'Revenue', 1000],
                    ['Feb', 'Revenue', 1100]
                ],
                { columns: ['Time', 'Account', 'Value'] }
            );

            mockRestService.post.mockResolvedValue(createMockResponse({}));

            await dataframeService.writeDataFrame('Budget', df);

            expect(mockRestService.post).toHaveBeenCalledWith(
                "/Cubes('Budget')/tm1.Update",
                expect.objectContaining({
                    Cells: expect.arrayContaining([
                        expect.objectContaining({
                            Tuple: expect.stringContaining('Jan'),
                            Value: 1000
                        })
                    ])
                })
            );
        });

        it('should write DataFrame with sandbox option', async () => {
            const df = new DataFrame(
                [['Jan', 'Revenue', 1000]],
                { columns: ['Time', 'Account', 'Value'] }
            );

            mockRestService.post.mockResolvedValue(createMockResponse({}));

            await dataframeService.writeDataFrame('Budget', df, {
                sandbox: 'Development'
            });

            const callUrl = mockRestService.post.mock.calls[0][0] as string;
            expect(callUrl).toContain('$sandbox=Development');
        });

        it('should handle transaction log deactivation/reactivation', async () => {
            const df = new DataFrame(
                [['Jan', 'Revenue', 1000]],
                { columns: ['Time', 'Account', 'Value'] }
            );

            mockRestService.post.mockResolvedValue(createMockResponse({}));

            await dataframeService.writeDataFrame('Budget', df, {
                deactivate_transaction_log: true,
                reactivate_transaction_log: true
            });

            expect(mockRestService.post).toHaveBeenCalledWith(
                "/Cubes('Budget')/tm1.DisableTransactionLog",
                {}
            );
            expect(mockRestService.post).toHaveBeenCalledWith(
                "/Cubes('Budget')/tm1.EnableTransactionLog",
                {}
            );
        });

        it('should throw error if DataFrame missing Value column', async () => {
            const df = new DataFrame(
                [['Jan', 'Revenue']],
                { columns: ['Time', 'Account'] }
            );

            await expect(
                dataframeService.writeDataFrame('Budget', df)
            ).rejects.toThrow('DataFrame must have a "Value" column');
        });
    });

    describe('executeDataFrameQuery', () => {
        it('should execute query with MDX', async () => {
            mockRestService.post.mockResolvedValue(createMockResponse({
                Axes: [
                    {},
                    { Hierarchies: [{ Name: 'Time' }] }
                ],
                Cells: []
            }));

            const query: DataFrameQuery = {
                mdx: 'SELECT [Time].Members ON 0 FROM [Budget]',
                skip_zeros: true
            };

            const df = await dataframeService.executeDataFrameQuery(query);

            expect(df).toBeInstanceOf(DataFrame);
            expect(mockRestService.post).toHaveBeenCalled();
        });

        it('should execute query with view', async () => {
            mockRestService.post.mockResolvedValue(createMockResponse({
                Axes: [
                    {},
                    { Hierarchies: [{ Name: 'Account' }] }
                ],
                Cells: []
            }));

            const query: DataFrameQuery = {
                cubeName: 'Budget',
                viewName: 'TestView',
                private: true
            };

            const df = await dataframeService.executeDataFrameQuery(query);

            expect(df).toBeInstanceOf(DataFrame);
            expect(mockRestService.post).toHaveBeenCalled();
        });

        it('should throw error if query is invalid', async () => {
            const query: DataFrameQuery = {
                skip_zeros: true
            };

            await expect(
                dataframeService.executeDataFrameQuery(query)
            ).rejects.toThrow('Query must specify either mdx or both cubeName and viewName');
        });
    });

    describe('executeMdxDataFrameShaped', () => {
        it('should execute MDX with shaped format', async () => {
            const mockShapedResponse = {
                Columns: [{ Name: 'Time' }, { Name: 'Value' }],
                Values: [['Jan', 1000], ['Feb', 1100]]
            };

            mockRestService.post.mockResolvedValue(createMockResponse(mockShapedResponse));

            const df = await dataframeService.executeMdxDataFrameShaped(
                'SELECT [Time].Members ON 0 FROM [Budget]'
            );

            expect(mockRestService.post).toHaveBeenCalledWith(
                '/ExecuteMDXDataFrameShaped',
                expect.objectContaining({ MDX: expect.any(String) })
            );
            expect(df).toBeInstanceOf(DataFrame);
        });
    });

    describe('executeMdxDataFramePivot', () => {
        it('should execute MDX with pivot format', async () => {
            mockRestService.post.mockResolvedValue(createMockResponse({
                Axes: [
                    {},
                    { Hierarchies: [{ Name: 'Account' }] }
                ],
                Cells: [
                    { Members: [{ Name: 'Revenue' }], Value: 5000 }
                ]
            }));

            const df = await dataframeService.executeMdxDataFramePivot(
                'SELECT [Account].Members ON 0 FROM [Budget]'
            );

            expect(mockRestService.post).toHaveBeenCalledWith(
                '/ExecuteMDXPivot',
                expect.objectContaining({ MDX: expect.any(String) })
            );
            expect(df).toBeInstanceOf(DataFrame);
        });
    });

    describe('executeViewDataFrameShaped', () => {
        it('should execute view with shaped format', async () => {
            const mockShapedResponse = {
                Columns: [{ Name: 'Time' }, { Name: 'Value' }],
                Values: [['Q1', 3000]]
            };

            mockRestService.post.mockResolvedValue(createMockResponse(mockShapedResponse));

            const df = await dataframeService.executeViewDataFrameShaped(
                'Budget',
                'QuarterlyView'
            );

            expect(df).toBeInstanceOf(DataFrame);
        });
    });

    describe('executeViewDataFramePivot', () => {
        it('should execute view with pivot format', async () => {
            mockRestService.post.mockResolvedValue(createMockResponse({
                Axes: [
                    {},
                    { Hierarchies: [{ Name: 'Version' }] }
                ],
                Cells: [
                    { Members: [{ Name: 'Actual' }], Value: 8000 }
                ]
            }));

            const df = await dataframeService.executeViewDataFramePivot(
                'Budget',
                'VersionView'
            );

            expect(df).toBeInstanceOf(DataFrame);
        });
    });

    describe('buildDataFrameFromResponse', () => {
        it('should build DataFrame from shaped response', () => {
            const shapedData = {
                Columns: [{ Name: 'A' }, { Name: 'B' }],
                Values: [[1, 2], [3, 4]]
            };

            // Access private method via type assertion for testing
            const df = (dataframeService as any).buildDataFrameFromResponse(shapedData);

            expect(df).toBeInstanceOf(DataFrame);
            expect(df.shape).toEqual([2, 2]);
            expect(df.columns).toEqual(['A', 'B']);
        });

        it('should handle empty response', () => {
            const df = (dataframeService as any).buildDataFrameFromResponse(null);

            expect(df).toBeInstanceOf(DataFrame);
            expect(df.shape).toEqual([0, 0]);
        });
    });

    describe('dataFrameToCellset', () => {
        it('should convert DataFrame to cellset format', () => {
            const df = new DataFrame(
                [
                    ['Jan', 'Revenue', 1000],
                    ['Feb', 'Revenue', 1100]
                ],
                { columns: ['Time', 'Account', 'Value'] }
            );

            const cellset = (dataframeService as any).dataFrameToCellset(df, 'Budget');

            expect(cellset).toHaveProperty('Cells');
            expect(cellset.Cells).toHaveLength(2);
            expect(cellset.Cells[0]).toMatchObject({
                Tuple: expect.stringContaining('Jan'),
                Value: 1000
            });
        });

        it('should throw error if Value column missing', () => {
            const df = new DataFrame(
                [['Jan', 'Revenue']],
                { columns: ['Time', 'Account'] }
            );

            expect(() => {
                (dataframeService as any).dataFrameToCellset(df, 'Budget');
            }).toThrow('DataFrame must have a "Value" column');
        });
    });

    describe('Integration with DataFrame operations', () => {
        it('should work with DataFrame filter and sort', async () => {
            const mockCellset = {
                Axes: [
                    {},
                    { Hierarchies: [{ Name: 'Time' }, { Name: 'Account' }] }
                ],
                Cells: [
                    { Members: [{ Name: 'Jan' }, { Name: 'Revenue' }], Value: 1000 },
                    { Members: [{ Name: 'Feb' }, { Name: 'Revenue' }], Value: 1500 },
                    { Members: [{ Name: 'Mar' }, { Name: 'Revenue' }], Value: 800 }
                ]
            };

            mockRestService.post.mockResolvedValue(createMockResponse(mockCellset));

            const df = await dataframeService.mdxToPandasDataFrame(
                'SELECT [Time].Members ON 0 FROM [Budget]'
            );

            // Filter values > 900
            const filtered = df.filter((row) => row[2] > 900);
            expect(filtered.shape[0]).toBe(2);

            // Sort by value
            const sorted = df.sortBy('Value', false); // descending
            expect(sorted.data[0][2]).toBe(1500);
        });
    });
});
