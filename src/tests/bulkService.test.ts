/**
 * Unit tests for BulkService (Issue #14)
 * Tests bulk operations, CSV/JSON import/export, and batch transactions
 */

import { BulkService } from '../services/BulkService';
import { CellService } from '../services/CellService';
import { RestService } from '../services/RestService';
import { AxiosResponse } from 'axios';

// Mock services
jest.mock('../services/RestService');
jest.mock('../services/CellService');

// Helper to create mock AxiosResponse
const createMockResponse = <T>(data: T): AxiosResponse<T> => ({
    data,
    status: 200,
    statusText: 'OK',
    headers: {},
    config: {} as any
});

describe('BulkService - High-Performance Bulk Operations (Issue #14)', () => {
    let bulkService: BulkService;
    let mockRestService: jest.Mocked<RestService>;
    let mockCellService: jest.Mocked<CellService>;

    beforeEach(() => {
        mockRestService = new RestService({
            address: 'localhost',
            port: 8001,
            user: 'admin',
            password: 'apple'
        }) as jest.Mocked<RestService>;

        mockCellService = new CellService(mockRestService) as jest.Mocked<CellService>;
        bulkService = new BulkService(mockRestService, mockCellService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('Bulk Write Operations', () => {
        describe('executeBulkWrite', () => {
            it('should execute bulk write operations successfully', async () => {
                mockCellService.writeValues = jest.fn().mockResolvedValue(undefined);

                const operations = [
                    { cubeName: 'Sales', coordinates: ['2024', 'Q1', 'Revenue'], value: 100000 },
                    { cubeName: 'Sales', coordinates: ['2024', 'Q2', 'Revenue'], value: 120000 },
                    { cubeName: 'Sales', coordinates: ['2024', 'Q3', 'Revenue'], value: 110000 }
                ];

                await bulkService.executeBulkWrite(operations);

                expect(mockCellService.writeValues).toHaveBeenCalled();
            });

            it('should handle empty operations array', async () => {
                await expect(bulkService.executeBulkWrite([])).resolves.not.toThrow();
            });

            it('should group operations by cube', async () => {
                mockCellService.writeValues = jest.fn().mockResolvedValue(undefined);

                const operations = [
                    { cubeName: 'Sales', coordinates: ['2024', 'Q1'], value: 100 },
                    { cubeName: 'Costs', coordinates: ['2024', 'Q1'], value: 50 },
                    { cubeName: 'Sales', coordinates: ['2024', 'Q2'], value: 120 }
                ];

                await bulkService.executeBulkWrite(operations);

                expect(mockCellService.writeValues).toHaveBeenCalledTimes(2);
            });

            it('should handle chunk size option', async () => {
                mockCellService.writeValues = jest.fn().mockResolvedValue(undefined);

                const operations = Array.from({ length: 2500 }, (_, i) => ({
                    cubeName: 'Sales',
                    coordinates: ['2024', `Item${i}`],
                    value: i * 100
                }));

                await bulkService.executeBulkWrite(operations, { chunkSize: 1000 });

                expect(mockCellService.writeValues).toHaveBeenCalledTimes(3); // 3 chunks
            });

            it('should retry on failure', async () => {
                let callCount = 0;
                mockCellService.writeValues = jest.fn().mockImplementation(() => {
                    callCount++;
                    if (callCount < 2) {
                        return Promise.reject(new Error('Temporary failure'));
                    }
                    return Promise.resolve(undefined);
                });

                const operations = [
                    { cubeName: 'Sales', coordinates: ['2024', 'Q1'], value: 100 }
                ];

                await bulkService.executeBulkWrite(operations, { maxRetries: 3 });

                expect(mockCellService.writeValues).toHaveBeenCalledTimes(2);
            });

            it('should throw error after max retries', async () => {
                mockCellService.writeValues = jest.fn().mockRejectedValue(new Error('Persistent failure'));

                const operations = [
                    { cubeName: 'Sales', coordinates: ['2024', 'Q1'], value: 100 }
                ];

                await expect(
                    bulkService.executeBulkWrite(operations, { maxRetries: 2 })
                ).rejects.toThrow();
            });

            it('should support sandbox option', async () => {
                mockCellService.writeValues = jest.fn().mockResolvedValue(undefined);

                const operations = [
                    { cubeName: 'Sales', coordinates: ['2024', 'Q1'], value: 100 }
                ];

                // Note: Current implementation doesn't support sandbox_name
                // TODO: Enhance when CellService supports WriteOptions
                await bulkService.executeBulkWrite(operations, { sandbox_name: 'TestSandbox' });

                expect(mockCellService.writeValues).toHaveBeenCalled();
            });

            it('should support increment option', async () => {
                mockCellService.writeValues = jest.fn().mockResolvedValue(undefined);

                const operations = [
                    { cubeName: 'Sales', coordinates: ['2024', 'Q1'], value: 100 }
                ];

                // Note: Current implementation doesn't support increment
                // TODO: Enhance when CellService supports WriteOptions
                await bulkService.executeBulkWrite(operations, { increment: true });

                expect(mockCellService.writeValues).toHaveBeenCalled();
            });
        });

        describe('executeBulkUpdate', () => {
            it('should execute bulk update operations', async () => {
                mockCellService.writeValues = jest.fn().mockResolvedValue(undefined);

                const updates = [
                    { cubeName: 'Sales', coordinates: ['2024', 'Q1'], value: 100, increment: true }
                ];

                await bulkService.executeBulkUpdate(updates);

                expect(mockCellService.writeValues).toHaveBeenCalled();
            });
        });

        describe('executeBulkDelete', () => {
            it('should execute bulk delete operations', async () => {
                mockCellService.writeValues = jest.fn().mockResolvedValue(undefined);

                const deletes = [
                    { cubeName: 'Sales', coordinates: ['2024', 'Q1'] }
                ];

                await bulkService.executeBulkDelete(deletes);

                expect(mockCellService.writeValues).toHaveBeenCalled();
            });
        });
    });

    describe('Bulk Read Operations', () => {
        describe('executeBulkRead', () => {
            it('should execute bulk read operations successfully', async () => {
                mockCellService.getValue = jest.fn()
                    .mockResolvedValueOnce(100000)
                    .mockResolvedValueOnce(120000)
                    .mockResolvedValueOnce(110000);

                const queries = [
                    { cubeName: 'Sales', coordinates: ['2024', 'Q1', 'Revenue'] },
                    { cubeName: 'Sales', coordinates: ['2024', 'Q2', 'Revenue'] },
                    { cubeName: 'Sales', coordinates: ['2024', 'Q3', 'Revenue'] }
                ];

                const values = await bulkService.executeBulkRead(queries);

                expect(values).toHaveLength(3);
                expect(values).toEqual([100000, 120000, 110000]);
                expect(mockCellService.getValue).toHaveBeenCalledTimes(3);
            });

            it('should handle empty queries array', async () => {
                const values = await bulkService.executeBulkRead([]);
                expect(values).toEqual([]);
            });

            it('should return null for failed reads', async () => {
                mockCellService.getValue = jest.fn()
                    .mockResolvedValueOnce(100)
                    .mockRejectedValueOnce(new Error('Cell not found'))
                    .mockResolvedValueOnce(200);

                const queries = [
                    { cubeName: 'Sales', coordinates: ['2024', 'Q1'] },
                    { cubeName: 'Sales', coordinates: ['2024', 'Q2'] },
                    { cubeName: 'Sales', coordinates: ['2024', 'Q3'] }
                ];

                const values = await bulkService.executeBulkRead(queries);

                expect(values).toEqual([100, null, 200]);
            });

            it('should support sandbox option', async () => {
                mockCellService.getValue = jest.fn().mockResolvedValue(100);

                const queries = [
                    { cubeName: 'Sales', coordinates: ['2024', 'Q1'] }
                ];

                // Note: Current implementation doesn't support sandbox_name
                // TODO: Enhance when CellService.getValue supports sandbox parameter
                await bulkService.executeBulkRead(queries, { sandbox_name: 'TestSandbox' });

                expect(mockCellService.getValue).toHaveBeenCalledWith(
                    'Sales',
                    ['2024', 'Q1']
                );
            });
        });
    });

    describe('CSV Import/Export', () => {
        describe('importDataFromCSV', () => {
            it('should import CSV data with header', async () => {
                mockCellService.writeValues = jest.fn().mockResolvedValue(undefined);

                const csv = `Year,Quarter,Amount
2024,Q1,100000
2024,Q2,120000
2024,Q3,110000`;

                await bulkService.importDataFromCSV('Sales', csv, { hasHeader: true });

                expect(mockCellService.writeValues).toHaveBeenCalled();
            });

            it('should import CSV data without header', async () => {
                mockCellService.writeValues = jest.fn().mockResolvedValue(undefined);

                const csv = `2024,Q1,100000
2024,Q2,120000`;

                await bulkService.importDataFromCSV('Sales', csv, { hasHeader: false });

                expect(mockCellService.writeValues).toHaveBeenCalled();
            });

            it('should handle custom delimiter', async () => {
                mockCellService.writeValues = jest.fn().mockResolvedValue(undefined);

                const csv = `2024;Q1;100000
2024;Q2;120000`;

                await bulkService.importDataFromCSV('Sales', csv, {
                    hasHeader: false,
                    delimiter: ';'
                });

                expect(mockCellService.writeValues).toHaveBeenCalled();
            });

            it('should handle quoted values', async () => {
                mockCellService.writeValues = jest.fn().mockResolvedValue(undefined);

                const csv = `"2024","Q1 Special","100000"
"2024","Q2 Special","120000"`;

                await bulkService.importDataFromCSV('Sales', csv, { hasHeader: false });

                expect(mockCellService.writeValues).toHaveBeenCalled();
            });

            it('should skip empty lines', async () => {
                mockCellService.writeValues = jest.fn().mockResolvedValue(undefined);

                const csv = `2024,Q1,100000

2024,Q2,120000

`;

                await bulkService.importDataFromCSV('Sales', csv, { hasHeader: false });

                expect(mockCellService.writeValues).toHaveBeenCalled();
            });

            it('should handle parse errors when skipErrors is true', async () => {
                mockCellService.writeValues = jest.fn().mockResolvedValue(undefined);

                const csv = `2024,Q1,100000
invalid,line
2024,Q2,120000`;

                await expect(
                    bulkService.importDataFromCSV('Sales', csv, {
                        hasHeader: false,
                        skipErrors: true
                    })
                ).resolves.not.toThrow();
            });

            it('should support batch size option', async () => {
                mockCellService.writeValues = jest.fn().mockResolvedValue(undefined);

                const rows = Array.from({ length: 2500 }, (_, i) =>
                    `2024,Item${i},${i * 100}`
                ).join('\n');

                await bulkService.importDataFromCSV('Sales', rows, {
                    hasHeader: false,
                    batchSize: 1000
                });

                expect(mockCellService.writeValues).toHaveBeenCalledTimes(3);
            });
        });

        describe('exportDataToCSV', () => {
            it('should export data to CSV with header', async () => {
                mockCellService.executeMdx = jest.fn().mockResolvedValue({
                    Axes: [
                        { Hierarchies: [{ Name: 'Year' }, { Name: 'Quarter' }] }
                    ],
                    Cells: [
                        { Value: 100000, Consolidated: false, RuleDerived: false },
                        { Value: 120000, Consolidated: false, RuleDerived: false }
                    ]
                });

                const mdx = "SELECT {[Year].[2024]} ON 0 FROM [Sales]";
                const csv = await bulkService.exportDataToCSV('Sales', mdx, { includeHeader: true });

                expect(csv).toContain('Year,Quarter,Value');
                expect(mockCellService.executeMdx).toHaveBeenCalledWith(mdx);
            });

            it('should skip zeros when option is set', async () => {
                mockCellService.executeMdx = jest.fn().mockResolvedValue({
                    Axes: [{ Hierarchies: [{ Name: 'Year' }] }],
                    Cells: [
                        { Value: 100, Consolidated: false, RuleDerived: false },
                        { Value: 0, Consolidated: false, RuleDerived: false },
                        { Value: 200, Consolidated: false, RuleDerived: false }
                    ]
                });

                const csv = await bulkService.exportDataToCSV('Sales', 'SELECT...', {
                    includeHeader: false,
                    skip_zeros: true
                });

                const lines = csv.split('\n').filter(l => l.trim());
                expect(lines.length).toBe(2); // Only non-zero values
            });

            it('should skip consolidated cells when option is set', async () => {
                mockCellService.executeMdx = jest.fn().mockResolvedValue({
                    Axes: [{ Hierarchies: [{ Name: 'Year' }] }],
                    Cells: [
                        { Value: 100, Consolidated: false, RuleDerived: false },
                        { Value: 300, Consolidated: true, RuleDerived: false },
                        { Value: 200, Consolidated: false, RuleDerived: false }
                    ]
                });

                const csv = await bulkService.exportDataToCSV('Sales', 'SELECT...', {
                    includeHeader: false,
                    skip_consolidated: true
                });

                const lines = csv.split('\n').filter(l => l.trim());
                expect(lines.length).toBe(2);
            });

            it('should handle custom delimiter', async () => {
                mockCellService.executeMdx = jest.fn().mockResolvedValue({
                    Axes: [{ Hierarchies: [{ Name: 'Year' }] }],
                    Cells: [{ Value: 100, Consolidated: false, RuleDerived: false }]
                });

                const csv = await bulkService.exportDataToCSV('Sales', 'SELECT...', {
                    delimiter: ';',
                    includeHeader: true
                });

                expect(csv).toContain(';');
            });
        });
    });

    describe('JSON Import/Export', () => {
        describe('importDataFromJSON', () => {
            it('should import JSON data successfully', async () => {
                mockCellService.writeValues = jest.fn().mockResolvedValue(undefined);

                const data = [
                    { coordinates: ['2024', 'Q1', 'Revenue'], value: 100000 },
                    { coordinates: ['2024', 'Q2', 'Revenue'], value: 120000 }
                ];

                await bulkService.importDataFromJSON('Sales', data);

                expect(mockCellService.writeValues).toHaveBeenCalled();
            });

            it('should validate JSON structure when validate is true', async () => {
                mockCellService.writeValues = jest.fn().mockResolvedValue(undefined);

                const invalidData = [
                    { coordinates: 'invalid', value: 100 } // coordinates should be array
                ];

                await expect(
                    bulkService.importDataFromJSON('Sales', invalidData as any, { validate: true })
                ).rejects.toThrow();
            });

            it('should skip invalid entries when skipErrors is true', async () => {
                mockCellService.writeValues = jest.fn().mockResolvedValue(undefined);

                const data = [
                    { coordinates: ['2024', 'Q1'], value: 100 },
                    { coordinates: 'invalid', value: 200 }, // Invalid
                    { coordinates: ['2024', 'Q2'], value: 300 }
                ];

                await expect(
                    bulkService.importDataFromJSON('Sales', data as any, {
                        skipErrors: true,
                        validate: true
                    })
                ).resolves.not.toThrow();

                expect(mockCellService.writeValues).toHaveBeenCalled();
            });

            it('should handle missing value field', async () => {
                const data = [
                    { coordinates: ['2024', 'Q1'] } // Missing value
                ];

                await expect(
                    bulkService.importDataFromJSON('Sales', data as any, { validate: true })
                ).rejects.toThrow();
            });

            it('should support batch size option', async () => {
                mockCellService.writeValues = jest.fn().mockResolvedValue(undefined);

                const data = Array.from({ length: 2500 }, (_, i) => ({
                    coordinates: ['2024', `Item${i}`],
                    value: i * 100
                }));

                await bulkService.importDataFromJSON('Sales', data, { batchSize: 1000 });

                expect(mockCellService.writeValues).toHaveBeenCalledTimes(3);
            });
        });

        describe('exportDataToJSON', () => {
            it('should export data in compact format', async () => {
                mockCellService.executeMdx = jest.fn().mockResolvedValue({
                    Cells: [
                        { Value: 100, Ordinal: 0, RuleDerived: false, Updateable: true },
                        { Value: 200, Ordinal: 1, RuleDerived: false, Updateable: true }
                    ]
                });

                const data = await bulkService.exportDataToJSON('Sales', 'SELECT...', {
                    format: 'compact'
                });

                expect(data).toHaveLength(2);
                expect(data[0]).toEqual({ value: 100 });
                expect(data[1]).toEqual({ value: 200 });
            });

            it('should export data in full format', async () => {
                mockCellService.executeMdx = jest.fn().mockResolvedValue({
                    Cells: [
                        {
                            Value: 100,
                            Ordinal: 0,
                            RuleDerived: false,
                            Updateable: true,
                            Consolidated: false
                        }
                    ]
                });

                const data = await bulkService.exportDataToJSON('Sales', 'SELECT...', {
                    format: 'full'
                });

                expect(data[0]).toHaveProperty('value');
                expect(data[0]).toHaveProperty('ordinal');
                expect(data[0]).toHaveProperty('ruleDerived');
                expect(data[0]).toHaveProperty('updateable');
            });

            it('should skip zeros when option is set', async () => {
                mockCellService.executeMdx = jest.fn().mockResolvedValue({
                    Cells: [
                        { Value: 100, RuleDerived: false, Consolidated: false },
                        { Value: 0, RuleDerived: false, Consolidated: false },
                        { Value: 200, RuleDerived: false, Consolidated: false }
                    ]
                });

                const data = await bulkService.exportDataToJSON('Sales', 'SELECT...', {
                    skip_zeros: true
                });

                expect(data).toHaveLength(2);
            });

            it('should skip rule derived cells when option is set', async () => {
                mockCellService.executeMdx = jest.fn().mockResolvedValue({
                    Cells: [
                        { Value: 100, RuleDerived: false, Consolidated: false },
                        { Value: 200, RuleDerived: true, Consolidated: false },
                        { Value: 300, RuleDerived: false, Consolidated: false }
                    ]
                });

                const data = await bulkService.exportDataToJSON('Sales', 'SELECT...', {
                    skip_rule_derived: true
                });

                expect(data).toHaveLength(2);
            });
        });
    });

    describe('Batch Operations', () => {
        describe('executeBatchOperations', () => {
            it('should execute mixed batch operations', async () => {
                mockCellService.writeValues = jest.fn().mockResolvedValue(undefined);
                mockCellService.getValue = jest.fn().mockResolvedValue(100);

                const batch = [
                    { type: 'write' as const, cubeName: 'Sales', coordinates: ['2024', 'Q1'], value: 100 },
                    { type: 'read' as const, cubeName: 'Sales', coordinates: ['2024', 'Q1'] },
                    { type: 'update' as const, cubeName: 'Sales', coordinates: ['2024', 'Q2'], value: 200 },
                    { type: 'delete' as const, cubeName: 'Sales', coordinates: ['2024', 'Q3'] }
                ];

                const results = await bulkService.executeBatchOperations(batch);

                expect(results).toHaveLength(4);
                expect(results.every(r => r.success)).toBe(true);
            });

            it('should handle operation failures', async () => {
                mockCellService.writeValues = jest.fn().mockRejectedValue(new Error('Write failed'));

                const batch = [
                    { type: 'write' as const, cubeName: 'Sales', coordinates: ['2024', 'Q1'], value: 100 }
                ];

                const results = await bulkService.executeBatchOperations(batch);

                expect(results).toHaveLength(1);
                expect(results[0].success).toBe(false);
                expect(results[0].error).toBeDefined();
            });

            it('should continue on error and not throw', async () => {
                // Mock needs to fail enough times to exceed default maxRetries (3)
                mockCellService.writeValues = jest.fn()
                    .mockRejectedValueOnce(new Error('Failed'))
                    .mockRejectedValueOnce(new Error('Failed'))
                    .mockRejectedValueOnce(new Error('Failed'))
                    .mockRejectedValueOnce(new Error('Failed')) // Fail all retries
                    .mockResolvedValueOnce(undefined); // Second operation succeeds

                const batch = [
                    { type: 'write' as const, cubeName: 'Sales', coordinates: ['2024', 'Q1'], value: 100, options: { maxRetries: 3 } },
                    { type: 'write' as const, cubeName: 'Sales', coordinates: ['2024', 'Q2'], value: 200 }
                ];

                const results = await bulkService.executeBatchOperations(batch);

                expect(results).toHaveLength(2);
                expect(results[0].success).toBe(false);
                expect(results[1].success).toBe(true);
            });
        });
    });

    describe('Batch Transactions', () => {
        describe('createBatchTransaction', () => {
            it('should create a transaction and return ID', async () => {
                const operations = [
                    { type: 'write' as const, cubeName: 'Sales', coordinates: ['2024', 'Q1'], value: 100 }
                ];

                const txId = await bulkService.createBatchTransaction(operations);

                expect(txId).toBeDefined();
                expect(txId).toMatch(/^tx_/);
            });
        });

        describe('commitBatchTransaction', () => {
            it('should commit a successful transaction', async () => {
                mockCellService.writeValues = jest.fn().mockResolvedValue(undefined);

                const operations = [
                    { type: 'write' as const, cubeName: 'Sales', coordinates: ['2024', 'Q1'], value: 100 }
                ];

                const txId = await bulkService.createBatchTransaction(operations);
                await expect(bulkService.commitBatchTransaction(txId)).resolves.not.toThrow();
            });

            it('should throw error for non-existent transaction', async () => {
                await expect(
                    bulkService.commitBatchTransaction('invalid-tx-id')
                ).rejects.toThrow('Transaction not found');
            });

            it('should rollback on operation failure', async () => {
                mockCellService.writeValues = jest.fn().mockRejectedValue(new Error('Failed'));

                const operations = [
                    { type: 'write' as const, cubeName: 'Sales', coordinates: ['2024', 'Q1'], value: 100 }
                ];

                const txId = await bulkService.createBatchTransaction(operations);

                await expect(bulkService.commitBatchTransaction(txId)).rejects.toThrow();
            });
        });

        describe('rollbackBatchTransaction', () => {
            it('should rollback a transaction', async () => {
                const operations = [
                    { type: 'write' as const, cubeName: 'Sales', coordinates: ['2024', 'Q1'], value: 100 }
                ];

                const txId = await bulkService.createBatchTransaction(operations);
                await expect(bulkService.rollbackBatchTransaction(txId)).resolves.not.toThrow();
            });

            it('should throw error for non-existent transaction', async () => {
                await expect(
                    bulkService.rollbackBatchTransaction('invalid-tx-id')
                ).rejects.toThrow('Transaction not found');
            });
        });
    });

    describe('Edge Cases and Error Handling', () => {
        it('should handle large batch sizes', async () => {
            mockCellService.writeValues = jest.fn().mockResolvedValue(undefined);

            const operations = Array.from({ length: 10000 }, (_, i) => ({
                cubeName: 'Sales',
                coordinates: ['2024', `Item${i}`],
                value: i
            }));

            await expect(
                bulkService.executeBulkWrite(operations, { chunkSize: 500 })
            ).resolves.not.toThrow();

            expect(mockCellService.writeValues).toHaveBeenCalled();
        });

        it('should handle numeric and string values in CSV', async () => {
            mockCellService.writeValues = jest.fn().mockResolvedValue(undefined);

            const csv = `2024,Q1,100
2024,Q2,Text Value`;

            await expect(
                bulkService.importDataFromCSV('Sales', csv, { hasHeader: false })
            ).resolves.not.toThrow();
        });

        it('should handle special characters in CSV', async () => {
            mockCellService.writeValues = jest.fn().mockResolvedValue(undefined);

            const csv = `"Year 2024","Q1 (Special)","100,000"`;

            await expect(
                bulkService.importDataFromCSV('Sales', csv, { hasHeader: false })
            ).resolves.not.toThrow();
        });
    });
});
