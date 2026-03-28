/**
 * CellService Tests for tm1npm
 * Comprehensive tests for TM1 Cell operations with proper mocking
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

        cellService = new CellService(mockRestService);

        // Default spy: most tests need dimension names for getValue/writeValue/write
        jest.spyOn(cellService, 'getDimensionNamesForWriting').mockResolvedValue(['Period', 'Measure', 'Version']);
        jest.spyOn(cellService, 'executeMdxValues').mockResolvedValue([]);
    });

    describe('Cell Value Operations', () => {
        test('should get cell value by building MDX from coordinates', async () => {
            jest.spyOn(cellService, 'executeMdxValues').mockResolvedValue([1000]);

            const cellAddress = ['Jan', 'Revenue', 'Actual'];
            const cellValue = await cellService.getValue('SalesCube', cellAddress);

            expect(cellValue).toBe(1000);
            expect(cellService.executeMdxValues).toHaveBeenCalledWith(
                expect.stringContaining('SELECT'),
                expect.objectContaining({ sandbox_name: undefined })
            );

            console.log('✅ Cell value retrieved via MDX');
        });

        test('should write single cell value via POST with Tuple@odata.bind', async () => {
            mockRestService.post.mockResolvedValue(createMockResponse({}));

            const cellAddress = ['Jan', 'Revenue', 'Actual'];
            await cellService.writeValue('SalesCube', cellAddress, 1500);

            expect(mockRestService.post).toHaveBeenCalledWith(
                "/Cubes('SalesCube')/tm1.Update",
                expect.stringContaining('Tuple@odata.bind')
            );

            const body = JSON.parse(mockRestService.post.mock.calls[0][1]);
            expect(body.Cells[0].Value).toBe(1500);
            expect(body.Cells[0]['Tuple@odata.bind']).toHaveLength(3);

            console.log('✅ Single cell value written via POST');
        });

        test('should write multiple cell values', async () => {
            mockRestService.post.mockResolvedValue(createMockResponse({}));
            mockRestService.patch.mockResolvedValue(createMockResponse({}));

            const cellData = {
                'Jan:Revenue:Actual': 1000,
                'Feb:Revenue:Actual': 1200,
                'Mar:Revenue:Actual': 1100
            };

            await cellService.writeValues('SalesCube', cellData);

            // writeValues still uses the old pattern (patch) — it's a separate method from write()
            expect(mockRestService.patch).toHaveBeenCalled();

            console.log('✅ Multiple cell values written successfully');
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
                    { Ordinal: 0, Value: 1000, FormattedValue: '1,000' },
                    { Ordinal: 1, Value: 1200, FormattedValue: '1,200' }
                ]
            }));

            const mdxQuery = 'SELECT [Time].[Jan]:[Feb] ON 0 FROM [SalesCube]';
            const result = await cellService.executeMdx(mdxQuery);
            
            expect(result.Axes).toBeDefined();
            expect(result.Cells).toBeDefined();
            expect(result.Cells.length).toBe(2);
            expect(result.Cells[0].Value).toBe(1000);
            expect(mockRestService.post).toHaveBeenCalledWith('/ExecuteMDX', { MDX: mdxQuery });
            
            console.log('✅ MDX query executed successfully');
        });

        test('should handle complex MDX queries', async () => {
            mockRestService.post.mockResolvedValue(createMockResponse({
                Axes: [
                    {
                        Tuples: [
                            { Members: [{ Name: 'Revenue' }] },
                            { Members: [{ Name: 'Expenses' }] }
                        ]
                    },
                    {
                        Tuples: [
                            { Members: [{ Name: 'Jan' }] },
                            { Members: [{ Name: 'Feb' }] }
                        ]
                    }
                ],
                Cells: [
                    { Ordinal: 0, Value: 10000, FormattedValue: '10,000' },
                    { Ordinal: 1, Value: 12000, FormattedValue: '12,000' },
                    { Ordinal: 2, Value: 8000, FormattedValue: '8,000' },
                    { Ordinal: 3, Value: 9000, FormattedValue: '9,000' }
                ]
            }));

            const complexMdx = 'SELECT {[Account].[Revenue], [Account].[Expenses]} ON 0, {[Time].[Jan], [Time].[Feb]} ON 1 FROM [SalesCube]';
            const result = await cellService.executeMdx(complexMdx);
            
            expect(result.Axes.length).toBe(2); // 2 dimensions
            expect(result.Cells.length).toBe(4); // 2x2 matrix
            
            console.log('✅ Complex MDX query handled successfully');
        });
    });

    describe('Cube Operations', () => {
        test('should clear cube data', async () => {
            mockRestService.post.mockResolvedValue(createMockResponse({}));

            await cellService.clearCube('TestCube');
            
            expect(mockRestService.post).toHaveBeenCalledWith("/Cubes('TestCube')/tm1.Clear");
            
            console.log('✅ Cube cleared successfully');
        });
    });

    describe('Cell Error Handling', () => {
        test('should handle invalid cell coordinates gracefully', async () => {
            jest.spyOn(cellService, 'executeMdxValues').mockRejectedValue({
                response: { status: 400, statusText: 'Bad Request' }
            });

            await expect(cellService.getValue('TestCube', ['InvalidElement']))
                .rejects.toMatchObject({
                    response: { status: 400 }
                });

            console.log('✅ Invalid coordinates handled gracefully');
        });

        test('should handle network errors gracefully', async () => {
            jest.spyOn(cellService, 'executeMdxValues').mockRejectedValue({
                code: 'ECONNREFUSED'
            });

            await expect(cellService.getValue('TestCube', ['Jan', 'Revenue']))
                .rejects.toMatchObject({
                    code: 'ECONNREFUSED'
                });

            console.log('✅ Network errors handled gracefully');
        });

        test('should handle authentication errors', async () => {
            mockRestService.post.mockRejectedValue({
                response: { status: 401, statusText: 'Unauthorized' }
            });

            await expect(cellService.writeValue('TestCube', ['Jan', 'Revenue', 'Actual'], 1000))
                .rejects.toMatchObject({
                    response: { status: 401 }
                });

            console.log('✅ Authentication errors handled gracefully');
        });

        test('should handle MDX syntax errors', async () => {
            mockRestService.post.mockRejectedValue({
                response: { status: 400, statusText: 'Bad Request - MDX Syntax Error' }
            });

            await expect(cellService.executeMdx('INVALID MDX QUERY'))
                .rejects.toMatchObject({
                    response: { status: 400 }
                });
            
            console.log('✅ MDX syntax errors handled gracefully');
        });
    });

    describe('Cell Service Edge Cases', () => {
        test('should handle zero and null values', async () => {
            mockRestService.patch.mockResolvedValue(createMockResponse({}));

            // Test zero value
            mockRestService.post.mockResolvedValue(createMockResponse({}));

            await cellService.writeValue('TestCube', ['Jan', 'Revenue', 'Actual'], 0);

            let body = JSON.parse(mockRestService.post.mock.calls[0][1]);
            expect(body.Cells[0].Value).toBe(0);

            // Test null value
            await cellService.writeValue('TestCube', ['Jan', 'Revenue', 'Actual'], null);

            body = JSON.parse(mockRestService.post.mock.calls[1][1]);
            expect(body.Cells[0].Value).toBeNull();

            console.log('✅ Zero and null values handled correctly');
        });

        test('should handle large cell data batches', async () => {
            mockRestService.patch.mockResolvedValue(createMockResponse({}));

            const largeCellSet: { [key: string]: number } = {};
            for (let i = 0; i < 1000; i++) {
                largeCellSet[`Element${i}:Revenue:Actual`] = Math.random() * 10000;
            }

            const startTime = Date.now();
            await cellService.writeValues('TestCube', largeCellSet);
            const endTime = Date.now();
            
            expect(mockRestService.patch).toHaveBeenCalledWith(
                "/Cubes('TestCube')/tm1.Update",
                expect.objectContaining({
                    Cells: expect.arrayContaining([
                        expect.objectContaining({
                            Coordinates: expect.any(Array),
                            Value: expect.any(Number)
                        })
                    ])
                })
            );
            
            expect(endTime - startTime).toBeLessThan(1000); // Should be fast with mocking
            
            console.log('✅ Large cell batches handled efficiently');
        });

        test('should handle concurrent cell operations', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse({ value: 1000 }));
            mockRestService.patch.mockResolvedValue(createMockResponse({}));

            const operations = [
                cellService.getValue('TestCube', ['Jan', 'Revenue', 'Actual']),
                cellService.writeValue('TestCube', ['Feb', 'Revenue', 'Actual'], 2000),
                cellService.getValue('TestCube', ['Mar', 'Revenue', 'Actual'])
            ];

            const results = await Promise.allSettled(operations);
            const successful = results.filter(r => r.status === 'fulfilled');
            
            expect(successful.length).toBe(3);
            
            console.log('✅ Concurrent operations handled successfully');
        });
    });

    describe('Cell Service Integration', () => {
        test('should maintain data consistency in read-write operations', async () => {
            mockRestService.post.mockResolvedValue(createMockResponse({}));

            // Mock MDX values for reads
            jest.spyOn(cellService, 'executeMdxValues')
                .mockResolvedValueOnce([1000])   // Initial read
                .mockResolvedValueOnce([1500]);   // Read after write

            const coordinates = ['Jan', 'Revenue', 'Actual'];

            // Read initial value
            const initialValue = await cellService.getValue('TestCube', coordinates);
            expect(initialValue).toBe(1000);

            // Write new value
            await cellService.writeValue('TestCube', coordinates, 1500);

            // Read updated value
            const updatedValue = await cellService.getValue('TestCube', coordinates);
            expect(updatedValue).toBe(1500);

            console.log('✅ Data consistency maintained in read-write operations');
        });

        test('should handle complex business scenarios', async () => {
            mockRestService.patch.mockResolvedValue(createMockResponse({}));

            // Simulate monthly budget allocation
            const budgetAllocations = {
                'Jan:Salaries:Budget': 50000,
                'Jan:Marketing:Budget': 20000,
                'Jan:Operations:Budget': 30000,
                'Feb:Salaries:Budget': 52000,
                'Feb:Marketing:Budget': 18000,
                'Feb:Operations:Budget': 28000
            };

            await cellService.writeValues('BudgetCube', budgetAllocations);
            
            expect(mockRestService.patch).toHaveBeenCalledWith(
                "/Cubes('BudgetCube')/tm1.Update",
                expect.objectContaining({
                    Cells: expect.arrayContaining([
                        expect.objectContaining({
                            Coordinates: [{ Name: 'Jan' }, { Name: 'Salaries' }, { Name: 'Budget' }],
                            Value: 50000
                        })
                    ])
                })
            );
            
            console.log('✅ Complex business scenarios handled successfully');
        });

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
                    { Ordinal: 0, Value: 15000, FormattedValue: '15,000' }, // Average
                    { Ordinal: 1, Value: 180000, FormattedValue: '180,000' }, // Sum
                    { Ordinal: 2, Value: 12, FormattedValue: '12' } // Count
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
            
            expect(result.Cells[0].Value).toBe(15000); // Average
            expect(result.Cells[1].Value).toBe(180000); // Sum
            expect(result.Cells[2].Value).toBe(12); // Count
            
            console.log('✅ Statistical calculations via MDX working');
        });
    });
});