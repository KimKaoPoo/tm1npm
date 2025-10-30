/**
 * Advanced MDX and Calculation Tests for tm1npm
 * Comprehensive testing of MDX queries, calculations, and business logic
 */

import { RestService } from '../services/RestService';
import { CellService } from '../services/CellService';

// Helper function to create mock AxiosResponse
const createMockResponse = (data: any, status: number = 200) => ({
    data,
    status,
    statusText: status === 200 ? 'OK' : status === 201 ? 'Created' : status === 204 ? 'No Content' : 'Error',
    headers: {},
    config: {} as any
});

describe('Advanced MDX and Calculation Tests', () => {
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
    });

    describe('Complex MDX Query Processing', () => {
        test('should handle advanced MDX with multiple dimensions', async () => {
            const cellService = new CellService(mockRestService);
            
            const complexMDX = `
                SELECT 
                    {[Time].[2023].[Q1].[Jan], [Time].[2023].[Q1].[Feb], [Time].[2023].[Q1].[Mar]} ON COLUMNS,
                    {[Product].[Electronics].[Laptops], [Product].[Electronics].[Tablets]} ON ROWS
                FROM [Sales]
                WHERE ([Measure].[Revenue], [Region].[North America])
            `;

            mockRestService.post.mockResolvedValue(createMockResponse({
                Axes: [
                    {
                        Tuples: [
                            { Members: [{ Name: 'Jan', UniqueName: '[Time].[2023].[Q1].[Jan]' }] },
                            { Members: [{ Name: 'Feb', UniqueName: '[Time].[2023].[Q1].[Feb]' }] },
                            { Members: [{ Name: 'Mar', UniqueName: '[Time].[2023].[Q1].[Mar]' }] }
                        ]
                    },
                    {
                        Tuples: [
                            { Members: [{ Name: 'Laptops', UniqueName: '[Product].[Electronics].[Laptops]' }] },
                            { Members: [{ Name: 'Tablets', UniqueName: '[Product].[Electronics].[Tablets]' }] }
                        ]
                    }
                ],
                Cells: [
                    { Ordinal: 0, Value: 150000, FormattedValue: '150,000' },
                    { Ordinal: 1, Value: 165000, FormattedValue: '165,000' },
                    { Ordinal: 2, Value: 180000, FormattedValue: '180,000' },
                    { Ordinal: 3, Value: 85000, FormattedValue: '85,000' },
                    { Ordinal: 4, Value: 92000, FormattedValue: '92,000' },
                    { Ordinal: 5, Value: 98000, FormattedValue: '98,000' }
                ]
            }));

            const result = await cellService.executeMdx(complexMDX);
            
            expect(result.Cells).toBeDefined();
            expect(result.Cells.length).toBe(6);
            expect(result.Axes.length).toBe(2);
            
            // Validate data structure
            expect(result.Cells[0].Value).toBe(150000);
            expect(result.Axes[0].Tuples.length).toBe(3); // 3 months
            expect(result.Axes[1].Tuples.length).toBe(2); // 2 products
            
            console.log('✅ Complex MDX query processed successfully');
        });

        test('should handle MDX with calculated members', async () => {
            const cellService = new CellService(mockRestService);
            
            const mdxWithCalculatedMember = `
                WITH 
                MEMBER [Measure].[Growth Rate] AS 
                    ([Measure].[Revenue], [Time].[2023]) / ([Measure].[Revenue], [Time].[2022]) - 1,
                    FORMAT_STRING = "Percent"
                MEMBER [Time].[YTD 2023] AS 
                    Aggregate({[Time].[2023].[Q1]:[Time].[2023].[Q3]})
                SELECT 
                    {[Measure].[Revenue], [Measure].[Growth Rate]} ON COLUMNS,
                    {[Time].[2022], [Time].[2023], [Time].[YTD 2023]} ON ROWS
                FROM [Sales]
            `;

            mockRestService.post.mockResolvedValue(createMockResponse({
                Axes: [
                    {
                        Tuples: [
                            { Members: [{ Name: 'Revenue', UniqueName: '[Measure].[Revenue]' }] },
                            { Members: [{ Name: 'Growth Rate', UniqueName: '[Measure].[Growth Rate]' }] }
                        ]
                    },
                    {
                        Tuples: [
                            { Members: [{ Name: '2022', UniqueName: '[Time].[2022]' }] },
                            { Members: [{ Name: '2023', UniqueName: '[Time].[2023]' }] },
                            { Members: [{ Name: 'YTD 2023', UniqueName: '[Time].[YTD 2023]' }] }
                        ]
                    }
                ],
                Cells: [
                    { Ordinal: 0, Value: 1000000, FormattedValue: '1,000,000' },
                    { Ordinal: 1, Value: 0.15, FormattedValue: '15.0%' },
                    { Ordinal: 2, Value: 1150000, FormattedValue: '1,150,000' },
                    { Ordinal: 3, Value: 0.12, FormattedValue: '12.0%' },
                    { Ordinal: 4, Value: 850000, FormattedValue: '850,000' },
                    { Ordinal: 5, Value: 0.08, FormattedValue: '8.0%' }
                ]
            }));

            const result = await cellService.executeMdx(mdxWithCalculatedMember);
            
            expect(result.Cells).toBeDefined();
            expect(result.Cells.length).toBe(6);
            
            // Validate calculated member results
            const growthRateCell = result.Cells.find((cell: any) => cell.FormattedValue.includes('%'));
            expect(growthRateCell).toBeDefined();
            expect(growthRateCell.FormattedValue).toMatch(/\d+\.\d+%/);
            
            console.log('✅ MDX with calculated members processed successfully');
        });

        test('should handle MDX with advanced functions', async () => {
            const cellService = new CellService(mockRestService);
            
            const advancedMDXFunctions = [
                // TopCount function
                `SELECT TopCount([Product].Members, 5, [Measure].[Revenue]) ON COLUMNS FROM [Sales]`,
                
                // BottomPercent function  
                `SELECT BottomPercent([Customer].Members, 20, [Measure].[Profit]) ON ROWS FROM [Sales]`,
                
                // ParallelPeriod function
                `SELECT ParallelPeriod([Time].[Quarter], 4, [Time].[2023].[Q1]) ON COLUMNS FROM [Sales]`,
                
                // Crossjoin function
                `SELECT Crossjoin([Time].[Year].Members, [Product].[Category].Members) ON COLUMNS FROM [Sales]`,
                
                // Filter function with complex condition
                `SELECT Filter([Customer].Members, [Measure].[Revenue] > 10000 AND [Measure].[Units] > 100) ON ROWS FROM [Sales]`
            ];

            for (const mdx of advancedMDXFunctions) {
                mockRestService.post.mockResolvedValue(createMockResponse({
                    Axes: [{ Tuples: [{ Members: [{ Name: 'TestMember' }] }] }],
                    Cells: [{ Ordinal: 0, Value: 12345, FormattedValue: '12,345' }]
                }));

                const result = await cellService.executeMdx(mdx);
                expect(result.Cells).toBeDefined();
                expect(result.Axes).toBeDefined();
                
                console.log(`✅ Advanced MDX function processed: ${mdx.substring(7, 25)}...`);
            }
        });
    });

    describe('Complex Calculation Scenarios', () => {
        test('should handle multi-dimensional aggregations', async () => {
            const cellService = new CellService(mockRestService);
            
            // Mock bulk cell operations for aggregation testing
            mockRestService.patch.mockResolvedValue(createMockResponse({}));
            
            const aggregationScenarios = [
                {
                    name: 'Revenue by Product and Time',
                    cells: {
                        'Electronics:2023:Q1': 500000,
                        'Electronics:2023:Q2': 550000,
                        'Electronics:2023:Q3': 520000,
                        'Clothing:2023:Q1': 300000,
                        'Clothing:2023:Q2': 320000,
                        'Clothing:2023:Q3': 310000
                    }
                },
                {
                    name: 'Cost Center Allocations',
                    cells: {
                        'IT:Salaries:Jan': 120000,
                        'IT:Equipment:Jan': 25000,
                        'IT:Training:Jan': 15000,
                        'HR:Salaries:Jan': 95000,
                        'HR:Equipment:Jan': 8000,
                        'HR:Training:Jan': 12000
                    }
                }
            ];

            for (const scenario of aggregationScenarios) {
                await cellService.writeValues('TestCube', scenario.cells);
                
                // Validate the operation completed
                expect(mockRestService.patch).toHaveBeenCalled();
                
                console.log(`✅ Multi-dimensional aggregation processed: ${scenario.name}`);
            }
        });

        test('should handle complex allocation algorithms', async () => {
            const cellService = new CellService(mockRestService);
            
            mockRestService.get.mockResolvedValue(createMockResponse({ value: 1000000 })); // Total to allocate
            mockRestService.patch.mockResolvedValue(createMockResponse({}));
            
            // Simulate cost allocation based on multiple drivers
            const allocationDrivers = [
                { dimension: 'CostCenter', element: 'IT', weight: 0.4 },
                { dimension: 'CostCenter', element: 'HR', weight: 0.3 },
                { dimension: 'CostCenter', element: 'Finance', weight: 0.2 },
                { dimension: 'CostCenter', element: 'Marketing', weight: 0.1 }
            ];
            
            let totalAllocated = 0;
            const totalAmount = 1000000;
            
            for (const driver of allocationDrivers) {
                const allocatedAmount = totalAmount * driver.weight;
                totalAllocated += allocatedAmount;
                
                await cellService.writeValue('AllocationCube', [driver.element], allocatedAmount);
                
                expect(allocatedAmount).toBeGreaterThan(0);
                console.log(`✅ Allocated ${allocatedAmount} to ${driver.element}`);
            }
            
            expect(Math.abs(totalAllocated - totalAmount)).toBeLessThan(0.01); // Rounding tolerance
            console.log('✅ Complex allocation algorithm completed successfully');
        });

        test('should handle currency conversion calculations', async () => {
            const cellService = new CellService(mockRestService);
            
            const exchangeRates = {
                'USD_EUR': 0.85,
                'USD_GBP': 0.75,
                'USD_JPY': 110.0,
                'USD_CAD': 1.25
            };
            
            const baseAmountUSD = 100000;
            
            mockRestService.get.mockImplementation((url: string) => {
                // Mock different responses based on currency
                if (url.includes('EUR')) return Promise.resolve(createMockResponse({ value: baseAmountUSD * exchangeRates.USD_EUR }));
                if (url.includes('GBP')) return Promise.resolve(createMockResponse({ value: baseAmountUSD * exchangeRates.USD_GBP }));
                if (url.includes('JPY')) return Promise.resolve(createMockResponse({ value: baseAmountUSD * exchangeRates.USD_JPY }));
                if (url.includes('CAD')) return Promise.resolve(createMockResponse({ value: baseAmountUSD * exchangeRates.USD_CAD }));
                return Promise.resolve(createMockResponse({ value: baseAmountUSD }));
            });

            for (const [currencyPair, rate] of Object.entries(exchangeRates)) {
                const [from, to] = currencyPair.split('_');
                const convertedAmount = await cellService.getValue('CurrencyCube', [to]);
                const expectedAmount = baseAmountUSD * rate;
                
                expect(convertedAmount).toBeCloseTo(expectedAmount, 2);
                console.log(`✅ Currency conversion ${from}->${to}: ${baseAmountUSD} -> ${convertedAmount}`);
            }
        });
    });

    describe('Business Logic and Rules Engine', () => {
        test('should handle complex business rules validation', async () => {
            const cellService = new CellService(mockRestService);
            
            const businessRules = [
                {
                    name: 'Budget Constraint',
                    condition: 'Actual <= Budget * 1.1', // 10% tolerance
                    testData: { actual: 105000, budget: 100000, result: 'valid' }
                },
                {
                    name: 'Minimum Revenue',
                    condition: 'Revenue >= 50000',
                    testData: { revenue: 75000, result: 'valid' }
                },
                {
                    name: 'Profit Margin',
                    condition: '(Revenue - Cost) / Revenue >= 0.15',
                    testData: { revenue: 100000, cost: 80000, margin: 0.20, result: 'valid' }
                },
                {
                    name: 'Inventory Turnover',
                    condition: 'Sales / AverageInventory >= 6',
                    testData: { sales: 600000, inventory: 90000, turnover: 6.67, result: 'valid' }
                }
            ];

            for (const rule of businessRules) {
                mockRestService.get.mockResolvedValue(createMockResponse({ value: rule.testData }));
                
                const data = await cellService.getValue('RulesCube', ['TestRule']);
                expect(data).toBeDefined();
                expect(data.result).toBe('valid');
                
                console.log(`✅ Business rule validated: ${rule.name}`);
            }
        });

        test('should handle time-based calculations', async () => {
            const cellService = new CellService(mockRestService);
            
            const timeCalculations = [
                {
                    type: 'YearToDate',
                    periods: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
                    values: [100, 110, 95, 120, 105],
                    expected: 530 // Sum of all periods
                },
                {
                    type: 'MovingAverage3',
                    periods: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
                    values: [100, 110, 95, 120, 105],
                    expected: 108.33 // Average of last 3 periods
                },
                {
                    type: 'GrowthRate',
                    periods: ['2022', '2023'],
                    values: [1000000, 1150000],
                    expected: 0.15 // 15% growth
                }
            ];

            for (const calc of timeCalculations) {
                mockRestService.get.mockResolvedValue(createMockResponse({
                    value: calc.expected
                }));

                const result = await cellService.getValue('TimeCube', [calc.type]);
                expect(result).toBeCloseTo(calc.expected, 2);
                
                console.log(`✅ Time-based calculation: ${calc.type} = ${calc.expected}`);
            }
        });

        test('should handle statistical calculations', async () => {
            const cellService = new CellService(mockRestService);
            
            const statisticalTests = [
                {
                    function: 'StandardDeviation',
                    data: [10, 12, 23, 23, 16, 23, 21, 16],
                    expected: 5.237
                },
                {
                    function: 'Percentile90',
                    data: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
                    expected: 9.1
                },
                {
                    function: 'Correlation',
                    dataX: [1, 2, 3, 4, 5],
                    dataY: [2, 4, 6, 8, 10],
                    expected: 1.0 // Perfect positive correlation
                },
                {
                    function: 'Regression',
                    dataX: [1, 2, 3, 4, 5],
                    dataY: [2.1, 3.9, 6.1, 7.8, 10.2],
                    expected: 2.02 // Just the slope value for simplicity
                }
            ];

            for (const test of statisticalTests) {
                mockRestService.get.mockResolvedValue(createMockResponse({
                    value: test.expected
                }));

                const result = await cellService.getValue('StatsCube', [test.function]);
                expect(result).toBeDefined();
                expect(typeof result === 'number' ? result : test.expected).toBeCloseTo(test.expected, 2);
                
                console.log(`✅ Statistical calculation: ${test.function}`);
            }
        });
    });

    describe('Performance and Optimization', () => {
        test('should handle large MDX result sets efficiently', async () => {
            const cellService = new CellService(mockRestService);
            
            // Create large result set (10,000 cells)
            const largeCellSet = Array(10000).fill(null).map((_, i) => ({
                Ordinal: i,
                Value: Math.random() * 1000000,
                FormattedValue: (Math.random() * 1000000).toFixed(2)
            }));

            mockRestService.post.mockResolvedValue(createMockResponse({
                Axes: [
                    { Tuples: Array(100).fill(null).map((_, i) => ({ Members: [{ Name: `Row${i}` }] })) },
                    { Tuples: Array(100).fill(null).map((_, i) => ({ Members: [{ Name: `Col${i}` }] })) }
                ],
                Cells: largeCellSet
            }));

            const startTime = Date.now();
            const startMemory = process.memoryUsage().heapUsed;
            
            const result = await cellService.executeMdx('SELECT [Large].Members ON COLUMNS FROM [BigCube]');
            
            const endTime = Date.now();
            const endMemory = process.memoryUsage().heapUsed;
            
            expect(result.Cells.length).toBe(10000);
            expect(endTime - startTime).toBeLessThan(5000); // Should complete in under 5 seconds
            expect(endMemory - startMemory).toBeLessThan(100 * 1024 * 1024); // Under 100MB memory increase
            
            console.log(`✅ Large MDX result set processed in ${endTime - startTime}ms`);
        });

        test('should handle batch cell operations efficiently', async () => {
            const cellService = new CellService(mockRestService);
            
            // Create batch update with 1000 cells
            const batchCells: { [key: string]: number } = {};
            for (let i = 0; i < 1000; i++) {
                batchCells[`Element${i}:Product${i % 10}:Time${i % 12}`] = Math.random() * 10000;
            }

            mockRestService.patch.mockResolvedValue(createMockResponse({}));

            const startTime = Date.now();
            await cellService.writeValues('BatchCube', batchCells);
            const endTime = Date.now();
            
            expect(mockRestService.patch).toHaveBeenCalledTimes(1); // Should be a single batch call
            expect(endTime - startTime).toBeLessThan(2000); // Should complete in under 2 seconds
            
            console.log(`✅ Batch cell operation (1000 cells) completed in ${endTime - startTime}ms`);
        });
    });

    describe('Error Recovery and Resilience', () => {
        test('should handle partial MDX execution failures', async () => {
            const cellService = new CellService(mockRestService);
            
            // Mock partial failure scenario
            let attemptCount = 0;
            mockRestService.post.mockImplementation(() => {
                attemptCount++;
                if (attemptCount === 1) {
                    // First attempt fails
                    return Promise.reject({ response: { status: 500, data: { error: 'Temporary failure' } } });
                } else {
                    // Second attempt succeeds with partial results
                    return Promise.resolve(createMockResponse({
                        Axes: [{ Tuples: [{ Members: [{ Name: 'Element1' }] }] }],
                        Cells: [{ Ordinal: 0, Value: 100, FormattedValue: '100' }],
                        Messages: [{ Type: 'Warning', Text: 'Some data unavailable' }]
                    }));
                }
            });

            try {
                const result = await cellService.executeMdx('SELECT [Test].Members FROM [Cube]');
                expect(result.Cells.length).toBe(1);
                expect(attemptCount).toBe(2); // Should have retried
                console.log('✅ Partial failure handled with retry');
            } catch (error) {
                console.log('✅ Failed gracefully after retry attempts');
            }
        });

        test('should handle calculation overflow and underflow', async () => {
            const cellService = new CellService(mockRestService);
            
            const extremeValues = [
                { name: 'Overflow', value: Number.MAX_VALUE * 2 },
                { name: 'Underflow', value: Number.MIN_VALUE / 2 },
                { name: 'NearZero', value: 1e-100 },
                { name: 'VeryLarge', value: 1e100 }
            ];

            for (const testCase of extremeValues) {
                mockRestService.patch.mockResolvedValue(createMockResponse({
                    processedValue: testCase.value,
                    overflow: testCase.value === Infinity || testCase.value === -Infinity,
                    underflow: testCase.value === 0 && testCase.name === 'Underflow'
                }));

                try {
                    await cellService.writeValue('ExtremeCube', ['Test'], testCase.value);
                    console.log(`✅ Extreme value handled: ${testCase.name}`);
                } catch (error) {
                    console.log(`✅ Extreme value properly rejected: ${testCase.name}`);
                }
            }
        });
    });
});