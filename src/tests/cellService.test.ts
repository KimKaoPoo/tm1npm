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
    });

    describe('Cell Value Operations', () => {
        test('should get cell value from cube', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse({
                value: 1000
            }));

            const cellAddress = ['Jan', 'Revenue', 'Actual'];
            const cellValue = await cellService.getValue('SalesCube', cellAddress);
            
            expect(cellValue).toBe(1000);
            expect(mockRestService.get).toHaveBeenCalledWith(
                "/Cubes('SalesCube')/tm1.GetCellValue(coordinates=['Jan','Revenue','Actual'])"
            );
            
            console.log('✅ Cell value retrieved successfully');
        });

        test('should write single cell value', async () => {
            mockRestService.patch.mockResolvedValue(createMockResponse({}));

            const cellAddress = ['Jan', 'Revenue', 'Actual'];
            await cellService.writeValue('SalesCube', cellAddress, 1500);
            
            expect(mockRestService.patch).toHaveBeenCalledWith(
                "/Cubes('SalesCube')/tm1.Update",
                {
                    Cells: [{
                        Coordinates: [
                            { Name: 'Jan' },
                            { Name: 'Revenue' }, 
                            { Name: 'Actual' }
                        ],
                        Value: 1500
                    }]
                }
            );
            
            console.log('✅ Single cell value written successfully');
        });

        test('should write multiple cell values', async () => {
            mockRestService.patch.mockResolvedValue(createMockResponse({}));

            const cellData = {
                'Jan:Revenue:Actual': 1000,
                'Feb:Revenue:Actual': 1200,
                'Mar:Revenue:Actual': 1100
            };

            await cellService.writeValues('SalesCube', cellData);
            
            expect(mockRestService.patch).toHaveBeenCalledWith(
                "/Cubes('SalesCube')/tm1.Update",
                {
                    Cells: [
                        {
                            Coordinates: [{ Name: 'Jan' }, { Name: 'Revenue' }, { Name: 'Actual' }],
                            Value: 1000
                        },
                        {
                            Coordinates: [{ Name: 'Feb' }, { Name: 'Revenue' }, { Name: 'Actual' }],
                            Value: 1200
                        },
                        {
                            Coordinates: [{ Name: 'Mar' }, { Name: 'Revenue' }, { Name: 'Actual' }],
                            Value: 1100
                        }
                    ]
                }
            );
            
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
            mockRestService.get.mockRejectedValue({
                response: { status: 400, statusText: 'Bad Request' }
            });

            await expect(cellService.getValue('TestCube', ['InvalidElement']))
                .rejects.toMatchObject({
                    response: { status: 400 }
                });
            
            console.log('✅ Invalid coordinates handled gracefully');
        });

        test('should handle network errors gracefully', async () => {
            mockRestService.get.mockRejectedValue({
                code: 'ECONNREFUSED'
            });

            await expect(cellService.getValue('TestCube', ['Jan', 'Revenue']))
                .rejects.toMatchObject({
                    code: 'ECONNREFUSED'
                });
            
            console.log('✅ Network errors handled gracefully');
        });

        test('should handle authentication errors', async () => {
            mockRestService.patch.mockRejectedValue({
                response: { status: 401, statusText: 'Unauthorized' }
            });

            await expect(cellService.writeValue('TestCube', ['Jan', 'Revenue'], 1000))
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
            await cellService.writeValue('TestCube', ['Jan', 'Revenue'], 0);
            
            expect(mockRestService.patch).toHaveBeenCalledWith(
                "/Cubes('TestCube')/tm1.Update",
                expect.objectContaining({
                    Cells: [expect.objectContaining({ Value: 0 })]
                })
            );

            // Test null value
            await cellService.writeValue('TestCube', ['Jan', 'Revenue'], null);
            
            expect(mockRestService.patch).toHaveBeenCalledWith(
                "/Cubes('TestCube')/tm1.Update",
                expect.objectContaining({
                    Cells: [expect.objectContaining({ Value: null })]
                })
            );
            
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
                cellService.getValue('TestCube', ['Jan', 'Revenue']),
                cellService.writeValue('TestCube', ['Feb', 'Revenue'], 2000),
                cellService.getValue('TestCube', ['Mar', 'Revenue'])
            ];

            const results = await Promise.allSettled(operations);
            const successful = results.filter(r => r.status === 'fulfilled');
            
            expect(successful.length).toBe(3);
            
            console.log('✅ Concurrent operations handled successfully');
        });
    });

    describe('Cell Service Integration', () => {
        test('should maintain data consistency in read-write operations', async () => {
            // Mock sequence: read -> write -> read
            mockRestService.get
                .mockResolvedValueOnce(createMockResponse({ value: 1000 }))  // Initial read
                .mockResolvedValueOnce(createMockResponse({ value: 1500 })); // Read after write
            
            mockRestService.patch.mockResolvedValue(createMockResponse({})); // Write

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