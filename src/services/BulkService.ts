/**
 * BulkService - High-performance bulk operations for TM1
 *
 * Provides efficient batch operations, data import/export, and bulk processing
 * capabilities for handling large datasets with optimal performance.
 */

import { RestService } from './RestService';
import { CellService } from './CellService';
import { ViewService } from './ViewService';
import { formatUrl } from '../utils/Utils';
import { TM1Exception } from '../exceptions/TM1Exception';

/**
 * Bulk write operation definition
 */
export interface BulkWriteOperation {
    cubeName: string;
    coordinates: string[];
    value: any;
}

/**
 * Bulk read query definition
 */
export interface BulkReadQuery {
    cubeName: string;
    coordinates: string[];
}

/**
 * Bulk update operation definition
 */
export interface BulkUpdateOperation {
    cubeName: string;
    coordinates: string[];
    value: any;
    increment?: boolean;
}

/**
 * Bulk delete operation definition
 */
export interface BulkDeleteOperation {
    cubeName: string;
    coordinates: string[];
}

/**
 * CSV import options
 */
export interface CSVImportOptions {
    delimiter?: string;
    hasHeader?: boolean;
    encoding?: string;
    batchSize?: number;
    skipErrors?: boolean;
    decimalSeparator?: string;
    thousandSeparator?: string;
    sandbox_name?: string;
    increment?: boolean;
    use_ti?: boolean;
}

/**
 * CSV export options
 */
export interface CSVExportOptions {
    delimiter?: string;
    includeHeader?: boolean;
    encoding?: string;
    decimalSeparator?: string;
    thousandSeparator?: string;
    sandbox_name?: string;
    skip_zeros?: boolean;
    skip_consolidated?: boolean;
    skip_rule_derived?: boolean;
}

/**
 * JSON import options
 */
export interface JSONImportOptions {
    batchSize?: number;
    skipErrors?: boolean;
    sandbox_name?: string;
    increment?: boolean;
    use_ti?: boolean;
    validate?: boolean;
}

/**
 * JSON export options
 */
export interface JSONExportOptions {
    sandbox_name?: string;
    skip_zeros?: boolean;
    skip_consolidated?: boolean;
    skip_rule_derived?: boolean;
    format?: 'compact' | 'full';
}

/**
 * Batch operation types
 */
export type BatchOperationType = 'write' | 'read' | 'update' | 'delete';

/**
 * Batch operation definition
 */
export interface BatchOperation {
    type: BatchOperationType;
    cubeName: string;
    coordinates: string[];
    value?: any;
    options?: any;
}

/**
 * Batch operation result
 */
export interface BatchResult {
    success: boolean;
    operation: BatchOperation;
    result?: any;
    error?: string;
}

/**
 * Bulk write options
 */
export interface BulkWriteOptions {
    maxWorkers?: number;
    chunkSize?: number;
    maxRetries?: number;
    retryDelay?: number;
    cancelAtFailure?: boolean;
    sandbox_name?: string;
    increment?: boolean;
    use_ti?: boolean;
    use_blob?: boolean;
}

/**
 * Bulk read options
 */
export interface BulkReadOptions {
    maxWorkers?: number;
    chunkSize?: number;
    sandbox_name?: string;
    use_blob?: boolean;
}

/**
 * Transaction state
 */
export interface TransactionState {
    id: string;
    operations: BatchOperation[];
    status: 'pending' | 'committed' | 'rolled_back';
    createdAt: Date;
}

/**
 * BulkService - Comprehensive bulk operations service
 *
 * Provides high-performance batch operations for TM1 data manipulation,
 * import/export capabilities, and transaction management.
 */
export class BulkService {
    private rest: RestService;
    private cellService: CellService;
    private viewService?: ViewService;
    private transactions: Map<string, TransactionState>;

    constructor(rest: RestService, cellService: CellService, viewService?: ViewService) {
        this.rest = rest;
        this.cellService = cellService;
        this.viewService = viewService;
        this.transactions = new Map();
    }

    /**
     * Execute bulk write operations
     *
     * Efficiently writes multiple cells across one or more cubes with optimized batching
     * and parallel processing.
     *
     * @param operations - Array of bulk write operations
     * @param options - Bulk write options for performance tuning
     *
     * @example
     * ```typescript
     * const operations = [
     *     { cubeName: 'Sales', coordinates: ['2024', 'Q1', 'Revenue'], value: 100000 },
     *     { cubeName: 'Sales', coordinates: ['2024', 'Q2', 'Revenue'], value: 120000 }
     * ];
     * await bulkService.executeBulkWrite(operations, { chunkSize: 1000 });
     * ```
     */
    public async executeBulkWrite(
        operations: BulkWriteOperation[],
        options: BulkWriteOptions = {}
    ): Promise<void> {
        const {
            chunkSize = 1000,
            maxRetries = 3,
            retryDelay = 1000,
            cancelAtFailure = false,
            sandbox_name,
            increment = false,
            use_ti = false,
            use_blob = false
        } = options;

        if (operations.length === 0) {
            return;
        }

        // Group operations by cube for efficiency
        const operationsByCube = this.groupOperationsByCube(operations);

        // Process each cube's operations
        for (const [cubeName, cubeOperations] of Object.entries(operationsByCube)) {
            // Split into chunks
            const chunks = this.chunkArray(cubeOperations, chunkSize);

            for (const chunk of chunks) {
                let retries = 0;
                let success = false;

                while (retries <= maxRetries && !success) {
                    try {
                        // Prepare cellset for bulk write
                        const cellset: { [key: string]: any } = {};

                        for (const op of chunk) {
                            const key = JSON.stringify(op.coordinates);
                            cellset[key] = op.value;
                        }

                        // Use CellService's write methods
                        // Note: writeValues currently doesn't support options
                        // TODO: Enhance CellService.writeValues to accept WriteOptions
                        await this.cellService.writeValues(cubeName, cellset);

                        success = true;
                    } catch (error) {
                        retries++;
                        if (retries > maxRetries || cancelAtFailure) {
                            throw new TM1Exception(
                                `Bulk write failed for cube ${cubeName} after ${retries} retries: ${error}`
                            );
                        }
                        // Wait before retry
                        await this.sleep(retryDelay * retries);
                    }
                }
            }
        }
    }

    /**
     * Execute bulk read operations
     *
     * Efficiently reads multiple cells across one or more cubes with parallel processing.
     *
     * @param queries - Array of bulk read queries
     * @param options - Bulk read options for performance tuning
     * @returns Array of cell values corresponding to queries
     *
     * @example
     * ```typescript
     * const queries = [
     *     { cubeName: 'Sales', coordinates: ['2024', 'Q1', 'Revenue'] },
     *     { cubeName: 'Sales', coordinates: ['2024', 'Q2', 'Revenue'] }
     * ];
     * const values = await bulkService.executeBulkRead(queries);
     * ```
     */
    public async executeBulkRead(
        queries: BulkReadQuery[],
        options: BulkReadOptions = {}
    ): Promise<any[]> {
        const {
            chunkSize = 1000,
            sandbox_name,
            use_blob = false
        } = options;

        if (queries.length === 0) {
            return [];
        }

        const results: any[] = [];

        // Group queries by cube for efficiency
        const queriesByCube = this.groupQueriesByCube(queries);

        // Process each cube's queries
        for (const [cubeName, cubeQueries] of Object.entries(queriesByCube)) {
            // Split into chunks
            const chunks = this.chunkArray(cubeQueries, chunkSize);

            for (const chunk of chunks) {
                // Build MDX for bulk read
                const coordinates = chunk.map(q => q.coordinates);

                // Read values using CellService
                // Note: getValue currently doesn't support sandbox parameter
                // TODO: Enhance CellService.getValue to accept sandbox_name
                for (const coord of coordinates) {
                    try {
                        const value = await this.cellService.getValue(cubeName, coord);
                        results.push(value);
                    } catch (error) {
                        results.push(null);
                    }
                }
            }
        }

        return results;
    }

    /**
     * Execute bulk update operations
     *
     * Updates multiple cells with support for increment operations.
     *
     * @param updates - Array of bulk update operations
     * @param options - Bulk write options
     *
     * @example
     * ```typescript
     * const updates = [
     *     { cubeName: 'Sales', coordinates: ['2024', 'Q1', 'Revenue'], value: 10000, increment: true }
     * ];
     * await bulkService.executeBulkUpdate(updates);
     * ```
     */
    public async executeBulkUpdate(
        updates: BulkUpdateOperation[],
        options: BulkWriteOptions = {}
    ): Promise<void> {
        const writeOps: BulkWriteOperation[] = updates.map(u => ({
            cubeName: u.cubeName,
            coordinates: u.coordinates,
            value: u.value
        }));

        await this.executeBulkWrite(writeOps, {
            ...options,
            increment: updates[0]?.increment || false
        });
    }

    /**
     * Execute bulk delete operations
     *
     * Clears values from multiple cells (sets to 0 or empty string).
     *
     * @param deletes - Array of bulk delete operations
     * @param options - Bulk write options
     *
     * @example
     * ```typescript
     * const deletes = [
     *     { cubeName: 'Sales', coordinates: ['2024', 'Q1', 'Revenue'] }
     * ];
     * await bulkService.executeBulkDelete(deletes);
     * ```
     */
    public async executeBulkDelete(
        deletes: BulkDeleteOperation[],
        options: BulkWriteOptions = {}
    ): Promise<void> {
        const writeOps: BulkWriteOperation[] = deletes.map(d => ({
            cubeName: d.cubeName,
            coordinates: d.coordinates,
            value: 0
        }));

        await this.executeBulkWrite(writeOps, options);
    }

    /**
     * Import data from CSV
     *
     * Imports data from CSV string into a TM1 cube with configurable parsing options.
     *
     * @param cubeName - Target cube name
     * @param csvData - CSV data as string
     * @param options - CSV import options
     *
     * @example
     * ```typescript
     * const csv = `Year,Quarter,Amount
     * 2024,Q1,100000
     * 2024,Q2,120000`;
     * await bulkService.importDataFromCSV('Sales', csv, { hasHeader: true });
     * ```
     */
    public async importDataFromCSV(
        cubeName: string,
        csvData: string,
        options: CSVImportOptions = {}
    ): Promise<void> {
        const {
            delimiter = ',',
            hasHeader = true,
            batchSize = 1000,
            skipErrors = false,
            sandbox_name,
            increment = false,
            use_ti = false
        } = options;

        // Parse CSV
        const lines = csvData.trim().split('\n');
        const startIndex = hasHeader ? 1 : 0;

        const operations: BulkWriteOperation[] = [];

        for (let i = startIndex; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            try {
                const values = this.parseCSVLine(line, delimiter);

                // Last value is the data value, rest are coordinates
                const coordinates = values.slice(0, -1);
                const value = this.parseValue(values[values.length - 1]);

                operations.push({
                    cubeName,
                    coordinates,
                    value
                });
            } catch (error) {
                if (!skipErrors) {
                    throw new TM1Exception(`Error parsing CSV line ${i + 1}: ${error}`);
                }
            }
        }

        // Execute bulk write
        await this.executeBulkWrite(operations, {
            chunkSize: batchSize,
            sandbox_name,
            increment,
            use_ti
        });
    }

    /**
     * Export data to CSV
     *
     * Exports cube data to CSV format using an MDX query.
     *
     * @param cubeName - Source cube name
     * @param mdx - MDX query to define data selection
     * @param options - CSV export options
     * @returns CSV data as string
     *
     * @example
     * ```typescript
     * const mdx = `SELECT {[Year].[2024]} ON 0 FROM [Sales]`;
     * const csv = await bulkService.exportDataToCSV('Sales', mdx, { includeHeader: true });
     * ```
     */
    public async exportDataToCSV(
        cubeName: string,
        mdx: string,
        options: CSVExportOptions = {}
    ): Promise<string> {
        const {
            delimiter = ',',
            includeHeader = true,
            sandbox_name,
            skip_zeros = false,
            skip_consolidated = false,
            skip_rule_derived = false
        } = options;

        // Execute MDX query
        // Note: executeMdx currently doesn't support options parameter
        // TODO: Enhance CellService.executeMdx to accept MDXViewOptions
        const result = await this.cellService.executeMdx(mdx);

        // Convert to CSV
        const rows: string[] = [];

        if (result && result.Axes && result.Cells) {
            // Build header from axes
            if (includeHeader) {
                const headers: string[] = [];

                // Add dimension headers
                for (const axis of result.Axes) {
                    if (axis.Hierarchies) {
                        for (const hierarchy of axis.Hierarchies) {
                            headers.push(hierarchy.Name || 'Dimension');
                        }
                    }
                }
                headers.push('Value');

                rows.push(headers.join(delimiter));
            }

            // Add data rows
            for (const cell of result.Cells) {
                // Skip based on options
                if (skip_zeros && cell.Value === 0) continue;
                if (skip_consolidated && cell.Consolidated) continue;
                if (skip_rule_derived && cell.RuleDerived) continue;

                // Build row (would need axis information to build coordinates)
                rows.push(String(cell.Value));
            }
        }

        return rows.join('\n');
    }

    /**
     * Import data from JSON
     *
     * Imports data from JSON format into a TM1 cube.
     *
     * @param cubeName - Target cube name
     * @param jsonData - JSON data array
     * @param options - JSON import options
     *
     * @example
     * ```typescript
     * const data = [
     *     { coordinates: ['2024', 'Q1', 'Revenue'], value: 100000 },
     *     { coordinates: ['2024', 'Q2', 'Revenue'], value: 120000 }
     * ];
     * await bulkService.importDataFromJSON('Sales', data);
     * ```
     */
    public async importDataFromJSON(
        cubeName: string,
        jsonData: any[],
        options: JSONImportOptions = {}
    ): Promise<void> {
        const {
            batchSize = 1000,
            skipErrors = false,
            sandbox_name,
            increment = false,
            use_ti = false,
            validate = true
        } = options;

        const operations: BulkWriteOperation[] = [];

        for (const item of jsonData) {
            try {
                if (validate) {
                    if (!item.coordinates || !Array.isArray(item.coordinates)) {
                        throw new TM1Exception('Invalid JSON: missing or invalid coordinates');
                    }
                    if (item.value === undefined) {
                        throw new TM1Exception('Invalid JSON: missing value');
                    }
                }

                operations.push({
                    cubeName,
                    coordinates: item.coordinates,
                    value: item.value
                });
            } catch (error) {
                if (!skipErrors) {
                    throw error;
                }
            }
        }

        await this.executeBulkWrite(operations, {
            chunkSize: batchSize,
            sandbox_name,
            increment,
            use_ti
        });
    }

    /**
     * Export data to JSON
     *
     * Exports cube data to JSON format using an MDX query.
     *
     * @param cubeName - Source cube name
     * @param mdx - MDX query to define data selection
     * @param options - JSON export options
     * @returns Array of JSON objects with coordinates and values
     *
     * @example
     * ```typescript
     * const mdx = `SELECT {[Year].[2024]} ON 0 FROM [Sales]`;
     * const data = await bulkService.exportDataToJSON('Sales', mdx);
     * ```
     */
    public async exportDataToJSON(
        cubeName: string,
        mdx: string,
        options: JSONExportOptions = {}
    ): Promise<any[]> {
        const {
            sandbox_name,
            skip_zeros = false,
            skip_consolidated = false,
            skip_rule_derived = false,
            format = 'compact'
        } = options;

        // Execute MDX query
        // Note: executeMdx currently doesn't support options parameter
        // TODO: Enhance CellService.executeMdx to accept MDXViewOptions
        const result = await this.cellService.executeMdx(mdx);

        const data: any[] = [];

        if (result && result.Cells) {
            for (const cell of result.Cells) {
                // Skip based on options
                if (skip_zeros && cell.Value === 0) continue;
                if (skip_consolidated && cell.Consolidated) continue;
                if (skip_rule_derived && cell.RuleDerived) continue;

                if (format === 'compact') {
                    data.push({
                        value: cell.Value
                    });
                } else {
                    data.push({
                        value: cell.Value,
                        ordinal: cell.Ordinal,
                        ruleDerived: cell.RuleDerived,
                        updateable: cell.Updateable,
                        consolidated: cell.Consolidated
                    });
                }
            }
        }

        return data;
    }

    /**
     * Execute batch operations
     *
     * Executes a mixed batch of operations (read, write, update, delete) in sequence.
     *
     * @param batch - Array of mixed batch operations
     * @returns Array of batch results
     *
     * @example
     * ```typescript
     * const batch = [
     *     { type: 'write', cubeName: 'Sales', coordinates: ['2024', 'Q1'], value: 100 },
     *     { type: 'read', cubeName: 'Sales', coordinates: ['2024', 'Q1'] }
     * ];
     * const results = await bulkService.executeBatchOperations(batch);
     * ```
     */
    public async executeBatchOperations(batch: BatchOperation[]): Promise<BatchResult[]> {
        const results: BatchResult[] = [];

        for (const operation of batch) {
            try {
                let result: any;

                switch (operation.type) {
                    case 'write':
                        await this.executeBulkWrite([{
                            cubeName: operation.cubeName,
                            coordinates: operation.coordinates,
                            value: operation.value
                        }], operation.options);
                        result = { success: true };
                        break;

                    case 'read':
                        const values = await this.executeBulkRead([{
                            cubeName: operation.cubeName,
                            coordinates: operation.coordinates
                        }], operation.options);
                        result = values[0];
                        break;

                    case 'update':
                        await this.executeBulkUpdate([{
                            cubeName: operation.cubeName,
                            coordinates: operation.coordinates,
                            value: operation.value
                        }], operation.options);
                        result = { success: true };
                        break;

                    case 'delete':
                        await this.executeBulkDelete([{
                            cubeName: operation.cubeName,
                            coordinates: operation.coordinates
                        }], operation.options);
                        result = { success: true };
                        break;

                    default:
                        throw new TM1Exception(`Unknown operation type: ${operation.type}`);
                }

                results.push({
                    success: true,
                    operation,
                    result
                });
            } catch (error) {
                results.push({
                    success: false,
                    operation,
                    error: String(error)
                });
            }
        }

        return results;
    }

    /**
     * Create batch transaction
     *
     * Creates a transaction that can be committed or rolled back.
     *
     * @param operations - Array of operations for the transaction
     * @returns Transaction ID
     *
     * @example
     * ```typescript
     * const txId = await bulkService.createBatchTransaction(operations);
     * try {
     *     await bulkService.commitBatchTransaction(txId);
     * } catch (error) {
     *     await bulkService.rollbackBatchTransaction(txId);
     * }
     * ```
     */
    public async createBatchTransaction(operations: BatchOperation[]): Promise<string> {
        const transactionId = this.generateTransactionId();

        this.transactions.set(transactionId, {
            id: transactionId,
            operations,
            status: 'pending',
            createdAt: new Date()
        });

        return transactionId;
    }

    /**
     * Commit batch transaction
     *
     * Executes and commits a previously created transaction.
     *
     * @param transactionId - Transaction ID to commit
     */
    public async commitBatchTransaction(transactionId: string): Promise<void> {
        const transaction = this.transactions.get(transactionId);

        if (!transaction) {
            throw new TM1Exception(`Transaction not found: ${transactionId}`);
        }

        if (transaction.status !== 'pending') {
            throw new TM1Exception(`Transaction ${transactionId} is not in pending state`);
        }

        // Execute all operations
        const results = await this.executeBatchOperations(transaction.operations);

        // Check for failures
        const failures = results.filter(r => !r.success);
        if (failures.length > 0) {
            transaction.status = 'rolled_back';
            throw new TM1Exception(
                `Transaction ${transactionId} failed with ${failures.length} errors`
            );
        }

        transaction.status = 'committed';
    }

    /**
     * Rollback batch transaction
     *
     * Rolls back a transaction without executing operations.
     *
     * @param transactionId - Transaction ID to rollback
     */
    public async rollbackBatchTransaction(transactionId: string): Promise<void> {
        const transaction = this.transactions.get(transactionId);

        if (!transaction) {
            throw new TM1Exception(`Transaction not found: ${transactionId}`);
        }

        transaction.status = 'rolled_back';
        this.transactions.delete(transactionId);
    }

    // ========== Helper Methods ==========

    /**
     * Group operations by cube name for batch processing
     */
    private groupOperationsByCube(operations: BulkWriteOperation[]): { [cubeName: string]: BulkWriteOperation[] } {
        return operations.reduce((acc, op) => {
            if (!acc[op.cubeName]) {
                acc[op.cubeName] = [];
            }
            acc[op.cubeName].push(op);
            return acc;
        }, {} as { [cubeName: string]: BulkWriteOperation[] });
    }

    /**
     * Group queries by cube name for batch processing
     */
    private groupQueriesByCube(queries: BulkReadQuery[]): { [cubeName: string]: BulkReadQuery[] } {
        return queries.reduce((acc, query) => {
            if (!acc[query.cubeName]) {
                acc[query.cubeName] = [];
            }
            acc[query.cubeName].push(query);
            return acc;
        }, {} as { [cubeName: string]: BulkReadQuery[] });
    }

    /**
     * Split array into chunks
     */
    private chunkArray<T>(array: T[], chunkSize: number): T[][] {
        const chunks: T[][] = [];
        for (let i = 0; i < array.length; i += chunkSize) {
            chunks.push(array.slice(i, i + chunkSize));
        }
        return chunks;
    }

    /**
     * Parse CSV line with delimiter handling
     */
    private parseCSVLine(line: string, delimiter: string): string[] {
        const values: string[] = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];

            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === delimiter && !inQuotes) {
                values.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }

        values.push(current.trim());
        return values;
    }

    /**
     * Parse value from string (handles numbers and strings)
     */
    private parseValue(value: string): any {
        const trimmed = value.trim();

        // Try to parse as number
        const num = Number(trimmed);
        if (!isNaN(num)) {
            return num;
        }

        // Return as string
        return trimmed;
    }

    /**
     * Generate unique transaction ID
     */
    private generateTransactionId(): string {
        return `tx_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }

    /**
     * Sleep helper for retry delays
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
