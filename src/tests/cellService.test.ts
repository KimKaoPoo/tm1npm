/**
 * CellService Tests for tm1npm
 * Tests for TM1 Cell operations matching tm1py parity
 */

import { CellService } from '../services/CellService';
import { RestService } from '../services/RestService';

// Helper function to create mock AxiosResponse
const createMockResponse = (data: any, status: number = 200) => ({
    data,
    status,
    statusText: status === 200 ? 'OK' : status === 201 ? 'Created' : status === 204 ? 'No Content' : 'Error',
    headers: {},
    config: {} as any
});

describe('CellService Tests', () => {
    let cellService: CellService;
    let mockRestService: jest.Mocked<RestService>;

    beforeEach(() => {
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

        cellService = new CellService(mockRestService);
    });

    describe('getValue - builds MDX and delegates to executeMdx', () => {
        test('should get cell value by building MDX from coordinates', async () => {
            // Mock getDimensionNamesForWriting
            mockRestService.get.mockResolvedValueOnce(createMockResponse({
                Dimensions: [
                    { Name: 'Time' },
                    { Name: 'Account' },
                    { Name: 'Version' }
                ]
            }));

            // Mock executeMdxRaw (called internally by executeMdxValues)
            mockRestService.post.mockResolvedValueOnce(createMockResponse({
                Cells: [{ Value: 1000 }]
            }));

            const result = await cellService.getValue('SalesCube', ['Jan', 'Revenue', 'Actual']);

            expect(result).toBe(1000);
            // Should have called POST /ExecuteMDX with MDX query
            expect(mockRestService.post).toHaveBeenCalledWith(
                '/ExecuteMDX',
                expect.objectContaining({
                    MDX: expect.stringContaining('FROM [SalesCube]')
                })
            );
        });

        test('should handle string element input with separator', async () => {
            mockRestService.get.mockResolvedValueOnce(createMockResponse({
                Dimensions: [{ Name: 'Time' }, { Name: 'Account' }]
            }));
            mockRestService.post.mockResolvedValueOnce(createMockResponse({
                Cells: [{ Value: 500 }]
            }));

            const result = await cellService.getValue('SalesCube', 'Jan,Revenue');
            expect(result).toBe(500);
        });

        test('should return null for empty result set', async () => {
            mockRestService.get.mockResolvedValueOnce(createMockResponse({
                Dimensions: [{ Name: 'Time' }, { Name: 'Account' }]
            }));
            mockRestService.post.mockResolvedValueOnce(createMockResponse({
                Cells: []
            }));

            const result = await cellService.getValue('SalesCube', ['Jan', 'Revenue']);
            expect(result).toBeNull();
        });
    });

    describe('writeValue - POST with Tuple@odata.bind', () => {
        test('should write single cell value using POST with correct body format', async () => {
            // Mock getDimensionNamesForWriting
            mockRestService.get.mockResolvedValueOnce(createMockResponse({
                Dimensions: [
                    { Name: 'Time' },
                    { Name: 'Account' },
                    { Name: 'Version' }
                ]
            }));
            mockRestService.post.mockResolvedValue(createMockResponse({}));

            await cellService.writeValue('SalesCube', ['Jan', 'Revenue', 'Actual'], 1500);

            expect(mockRestService.post).toHaveBeenCalledWith(
                "/Cubes('SalesCube')/tm1.Update",
                {
                    Cells: [{
                        'Tuple@odata.bind': [
                            "Dimensions('Time')/Hierarchies('Time')/Elements('Jan')",
                            "Dimensions('Account')/Hierarchies('Account')/Elements('Revenue')",
                            "Dimensions('Version')/Hierarchies('Version')/Elements('Actual')"
                        ]
                    }],
                    Value: '1500'
                }
            );
        });

        test('should write with explicit dimensions (no extra GET call)', async () => {
            mockRestService.post.mockResolvedValue(createMockResponse({}));

            await cellService.writeValue(
                'SalesCube',
                ['Jan', 'Revenue'],
                42,
                ['Time', 'Account']
            );

            // Should NOT call GET for dimensions since they were provided
            expect(mockRestService.get).not.toHaveBeenCalled();
            expect(mockRestService.post).toHaveBeenCalledWith(
                "/Cubes('SalesCube')/tm1.Update",
                expect.objectContaining({
                    Cells: [{
                        'Tuple@odata.bind': [
                            "Dimensions('Time')/Hierarchies('Time')/Elements('Jan')",
                            "Dimensions('Account')/Hierarchies('Account')/Elements('Revenue')"
                        ]
                    }],
                    Value: '42'
                })
            );
        });

        test('should include sandbox parameter in URL', async () => {
            mockRestService.post.mockResolvedValue(createMockResponse({}));

            await cellService.writeValue(
                'SalesCube',
                ['Jan'],
                100,
                ['Time'],
                'MySandbox'
            );

            expect(mockRestService.post).toHaveBeenCalledWith(
                "/Cubes('SalesCube')/tm1.Update?$sandbox=MySandbox",
                expect.any(Object)
            );
        });
    });

    describe('write - POST with Tuple@odata.bind (bulk writes)', () => {
        test('should write multiple cells using POST', async () => {
            // Mock getDimensionNamesForWriting
            mockRestService.get.mockResolvedValueOnce(createMockResponse({
                Dimensions: [
                    { Name: 'Time' },
                    { Name: 'Account' },
                    { Name: 'Version' }
                ]
            }));
            mockRestService.post.mockResolvedValue(createMockResponse({}));

            const cellsetAsDict = {
                'Jan,Revenue,Actual': 1000,
                'Feb,Revenue,Actual': 1200
            };

            await cellService.write('SalesCube', cellsetAsDict);

            expect(mockRestService.post).toHaveBeenCalledWith(
                "/Cubes('SalesCube')/tm1.Update",
                expect.objectContaining({
                    Cells: expect.arrayContaining([
                        expect.objectContaining({
                            'Tuple@odata.bind': expect.arrayContaining([
                                "Dimensions('Time')/Hierarchies('Time')/Elements('Jan')"
                            ])
                        })
                    ]),
                    Values: expect.arrayContaining(['1000', '1200'])
                })
            );
        });
    });

    describe('writeValues - legacy method delegates to write', () => {
        test('should convert colon-separated coordinates and delegate to write', async () => {
            mockRestService.get.mockResolvedValueOnce(createMockResponse({
                Dimensions: [
                    { Name: 'Time' },
                    { Name: 'Account' },
                    { Name: 'Version' }
                ]
            }));
            mockRestService.post.mockResolvedValue(createMockResponse({}));

            const cellData = {
                'Jan:Revenue:Actual': 1000,
                'Feb:Revenue:Actual': 1200
            };

            await cellService.writeValues('SalesCube', cellData);

            // Should use POST (via write -> writeThroughCellset)
            expect(mockRestService.post).toHaveBeenCalledWith(
                "/Cubes('SalesCube')/tm1.Update",
                expect.objectContaining({
                    Cells: expect.any(Array),
                    Values: expect.any(Array)
                })
            );
            // Should NOT use PATCH
            expect(mockRestService.patch).not.toHaveBeenCalled();
        });
    });

    describe('getValues - builds MDX from coordinate sets', () => {
        test('should build MDX tuples and execute', async () => {
            mockRestService.get.mockResolvedValueOnce(createMockResponse({
                Dimensions: [{ Name: 'Time' }, { Name: 'Account' }]
            }));
            mockRestService.post.mockResolvedValueOnce(createMockResponse({
                Cells: [
                    { Value: 100 },
                    { Value: 200 }
                ]
            }));

            const result = await cellService.getValues('SalesCube', [
                ['Jan', 'Revenue'],
                ['Feb', 'Revenue']
            ]);

            expect(result).toEqual([100, 200]);
            expect(mockRestService.post).toHaveBeenCalledWith(
                '/ExecuteMDX',
                expect.objectContaining({
                    MDX: expect.stringContaining('FROM [SalesCube]')
                })
            );
        });

        test('should return empty array for empty element sets', async () => {
            const result = await cellService.getValues('SalesCube', []);
            expect(result).toEqual([]);
        });
    });

    describe('createCellset - posts to /ExecuteMDX', () => {
        test('should POST to /ExecuteMDX and return cellset ID', async () => {
            mockRestService.post.mockResolvedValue(createMockResponse({
                ID: 'abc-123'
            }));

            const result = await cellService.createCellset('SELECT {} ON 0 FROM [Cube]');

            expect(result).toBe('abc-123');
            expect(mockRestService.post).toHaveBeenCalledWith(
                '/ExecuteMDX',
                { MDX: 'SELECT {} ON 0 FROM [Cube]' }
            );
        });

        test('should include sandbox parameter', async () => {
            mockRestService.post.mockResolvedValue(createMockResponse({ ID: 'xyz' }));

            await cellService.createCellset('SELECT {} ON 0 FROM [Cube]', 'MySandbox');

            expect(mockRestService.post).toHaveBeenCalledWith(
                '/ExecuteMDX?$sandbox=MySandbox',
                expect.any(Object)
            );
        });
    });

    describe('MDX Operations', () => {
        test('should execute MDX query', async () => {
            mockRestService.post.mockResolvedValue(createMockResponse({
                Axes: [{
                    Tuples: [
                        { Members: [{ Name: 'Jan' }] },
                        { Members: [{ Name: 'Feb' }] }
                    ]
                }],
                Cells: [
                    { Ordinal: 0, Value: 1000 },
                    { Ordinal: 1, Value: 1200 }
                ]
            }));

            const mdxQuery = 'SELECT [Time].[Jan]:[Feb] ON 0 FROM [SalesCube]';
            const result = await cellService.executeMdx(mdxQuery);

            expect(result.Axes).toBeDefined();
            expect(result.Cells.length).toBe(2);
            expect(result.Cells[0].Value).toBe(1000);
            expect(mockRestService.post).toHaveBeenCalledWith('/ExecuteMDX', { MDX: mdxQuery });
        });
    });

    describe('Cube Operations', () => {
        test('should clear cube data', async () => {
            mockRestService.post.mockResolvedValue(createMockResponse({}));

            await cellService.clearCube('TestCube');

            expect(mockRestService.post).toHaveBeenCalledWith("/Cubes('TestCube')/tm1.Clear");
        });
    });

    describe('Cell Error Handling', () => {
        test('should handle MDX syntax errors', async () => {
            mockRestService.post.mockRejectedValue({
                response: { status: 400, statusText: 'Bad Request - MDX Syntax Error' }
            });

            await expect(cellService.executeMdx('INVALID MDX QUERY'))
                .rejects.toMatchObject({
                    response: { status: 400 }
                });
        });

        test('should handle network errors on getValue', async () => {
            mockRestService.get.mockRejectedValue({
                code: 'ECONNREFUSED'
            });

            await expect(cellService.getValue('TestCube', ['Jan', 'Revenue']))
                .rejects.toMatchObject({
                    code: 'ECONNREFUSED'
                });
        });

        test('should handle authentication errors on writeValue', async () => {
            mockRestService.get.mockResolvedValueOnce(createMockResponse({
                Dimensions: [{ Name: 'Time' }, { Name: 'Account' }]
            }));
            mockRestService.post.mockRejectedValue({
                response: { status: 401, statusText: 'Unauthorized' }
            });

            await expect(cellService.writeValue('TestCube', ['Jan', 'Revenue'], 1000))
                .rejects.toMatchObject({
                    response: { status: 401 }
                });
        });
    });

    describe('Cell Service Edge Cases', () => {
        test('should handle concurrent cell operations', async () => {
            // Mock dimension lookup for getValue
            mockRestService.get.mockResolvedValue(createMockResponse({
                Dimensions: [{ Name: 'Time' }, { Name: 'Account' }]
            }));
            mockRestService.post.mockResolvedValue(createMockResponse({
                Cells: [{ Value: 1000 }]
            }));

            const operations = [
                cellService.getValue('TestCube', ['Jan', 'Revenue']),
                cellService.getValue('TestCube', ['Feb', 'Revenue']),
                cellService.getValue('TestCube', ['Mar', 'Revenue'])
            ];

            const results = await Promise.allSettled(operations);
            const successful = results.filter(r => r.status === 'fulfilled');

            expect(successful.length).toBe(3);
        });
    });

    describe('Cell Service Integration', () => {
        test('should handle statistical calculations via MDX', async () => {
            mockRestService.post.mockResolvedValue(createMockResponse({
                Axes: [{
                    Tuples: [
                        { Members: [{ Name: 'Average' }] },
                        { Members: [{ Name: 'Sum' }] },
                        { Members: [{ Name: 'Count' }] }
                    ]
                }],
                Cells: [
                    { Ordinal: 0, Value: 15000 },
                    { Ordinal: 1, Value: 180000 },
                    { Ordinal: 2, Value: 12 }
                ]
            }));

            const statisticalMdx = `
                WITH
                MEMBER [Measures].[Average] AS AVG([Time].Members, [Measures].[Revenue])
                MEMBER [Measures].[Sum] AS SUM([Time].Members, [Measures].[Revenue])
                MEMBER [Measures].[Count] AS COUNT([Time].Members)
                SELECT {[Measures].[Average], [Measures].[Sum], [Measures].[Count]} ON 0
                FROM [SalesCube]
            `;

            const result = await cellService.executeMdx(statisticalMdx);

            expect(result.Cells[0].Value).toBe(15000);
            expect(result.Cells[1].Value).toBe(180000);
            expect(result.Cells[2].Value).toBe(12);
        });
    });
});
