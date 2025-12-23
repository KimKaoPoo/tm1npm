import { RestService } from './RestService';
import { formatUrl } from '../utils/Utils';
import { TM1Exception, TM1RestException } from '../exceptions/TM1Exception';

/**
 * Enum representing the status of an async operation
 */
export enum OperationStatus {
    PENDING = 'Pending',
    RUNNING = 'Running',
    COMPLETED = 'Completed',
    FAILED = 'Failed',
    CANCELLED = 'Cancelled',
    TIMEOUT = 'Timeout'
}

/**
 * Enum representing the type of async operation
 */
export enum OperationType {
    PROCESS_EXECUTION = 'ProcessExecution',
    MDX_QUERY = 'MdxQuery',
    VIEW_EXECUTION = 'ViewExecution',
    BULK_OPERATION = 'BulkOperation',
    CUSTOM = 'Custom'
}

/**
 * Interface for async operation definition
 */
export interface AsyncOperationDefinition {
    type: OperationType;
    name: string;
    parameters?: Record<string, any>;
    timeout?: number;
    retryAttempts?: number;
    metadata?: Record<string, any>;
}

/**
 * Interface for async operation tracking
 */
export interface AsyncOperation {
    id: string;
    type: OperationType;
    name: string;
    status: OperationStatus;
    progress?: number;
    startTime: Date;
    endTime?: Date;
    error?: string;
    result?: any;
    parameters?: Record<string, any>;
    metadata?: Record<string, any>;
}

/**
 * Interface for schedule configuration
 */
export interface Schedule {
    frequency: 'once' | 'daily' | 'weekly' | 'monthly' | 'hourly';
    startTime?: Date;
    interval?: number;
    endTime?: Date;
    daysOfWeek?: number[];
    daysOfMonth?: number[];
}

/**
 * Type for progress callback function
 */
export type ProgressCallback = (operation: AsyncOperation) => void | Promise<void>;

/**
 * Interface for operation polling options
 */
export interface PollingOptions {
    interval?: number;
    timeout?: number;
    maxAttempts?: number;
}

/**
 * Service for managing async operations in TM1
 */
export class AsyncOperationService {
    private rest: RestService;
    private operations: Map<string, AsyncOperation>;
    private pollingIntervals: Map<string, NodeJS.Timeout>;
    private defaultPollingInterval: number = 1000; // 1 second
    private defaultTimeout: number = 300000; // 5 minutes

    constructor(rest: RestService) {
        this.rest = rest;
        this.operations = new Map();
        this.pollingIntervals = new Map();
    }

    /**
     * Get the status of an async operation
     *
     * @param operationId - The ID of the operation
     * @returns Promise resolving to the operation status
     */
    public async getAsyncOperationStatus(operationId: string): Promise<OperationStatus> {
        const operation = this.operations.get(operationId);
        if (!operation) {
            throw new TM1Exception(`Operation with ID ${operationId} not found`);
        }

        // If operation is already in terminal state, return cached status
        if (this.isTerminalStatus(operation.status)) {
            return operation.status;
        }

        // Poll TM1 server for updated status
        try {
            const url = formatUrl("/AsyncOperations('{}')", operationId);
            const response = await this.rest.get(url);
            const serverStatus = this.mapServerStatus(response.data.Status);

            // Update operation status
            operation.status = serverStatus;
            if (this.isTerminalStatus(serverStatus)) {
                operation.endTime = new Date();
                if (serverStatus === OperationStatus.COMPLETED && response.data.Result) {
                    operation.result = response.data.Result;
                } else if (serverStatus === OperationStatus.FAILED && response.data.Error) {
                    operation.error = response.data.Error;
                }
            }

            return serverStatus;
        } catch (error) {
            // If server doesn't support AsyncOperations endpoint, return cached status
            return operation.status;
        }
    }

    /**
     * List all active async operations
     *
     * @returns Promise resolving to array of active operations
     */
    public async listActiveAsyncOperations(): Promise<AsyncOperation[]> {
        const activeOperations: AsyncOperation[] = [];

        for (const operation of this.operations.values()) {
            if (!this.isTerminalStatus(operation.status)) {
                // Update status from server
                await this.getAsyncOperationStatus(operation.id);
                if (!this.isTerminalStatus(operation.status)) {
                    activeOperations.push(operation);
                }
            }
        }

        return activeOperations;
    }

    /**
     * Cancel an async operation
     *
     * @param operationId - The ID of the operation to cancel
     * @returns Promise that resolves when operation is cancelled
     */
    public async cancelAsyncOperation(operationId: string): Promise<void> {
        const operation = this.operations.get(operationId);
        if (!operation) {
            throw new TM1Exception(`Operation with ID ${operationId} not found`);
        }

        if (this.isTerminalStatus(operation.status)) {
            throw new TM1Exception(`Operation ${operationId} is already in terminal state: ${operation.status}`);
        }

        // Stop polling if active
        this.stopPolling(operationId);

        try {
            // Try to cancel on server if supported
            const url = formatUrl("/AsyncOperations('{}')/Cancel", operationId);
            await this.rest.post(url, {});
        } catch (error) {
            // If server doesn't support cancellation, just mark as cancelled locally
        }

        // Update operation status
        operation.status = OperationStatus.CANCELLED;
        operation.endTime = new Date();
    }

    /**
     * Wait for an async operation to complete
     *
     * @param operationId - The ID of the operation
     * @param timeout - Optional timeout in milliseconds
     * @returns Promise resolving to the operation result
     */
    public async waitForAsyncOperation(operationId: string, timeout?: number): Promise<any> {
        const operation = this.operations.get(operationId);
        if (!operation) {
            throw new TM1Exception(`Operation with ID ${operationId} not found`);
        }

        const timeoutMs = timeout || this.defaultTimeout;
        const startTime = Date.now();

        return new Promise((resolve, reject) => {
            const checkStatus = async () => {
                try {
                    const status = await this.getAsyncOperationStatus(operationId);

                    if (status === OperationStatus.COMPLETED) {
                        resolve(operation.result);
                    } else if (status === OperationStatus.FAILED) {
                        reject(new TM1Exception(`Operation failed: ${operation.error}`));
                    } else if (status === OperationStatus.CANCELLED) {
                        reject(new TM1Exception('Operation was cancelled'));
                    } else if (Date.now() - startTime > timeoutMs) {
                        operation.status = OperationStatus.TIMEOUT;
                        operation.endTime = new Date();
                        reject(new TM1Exception('Operation timed out'));
                    } else {
                        // Continue polling
                        setTimeout(checkStatus, this.defaultPollingInterval);
                    }
                } catch (error) {
                    reject(error);
                }
            };

            checkStatus();
        });
    }

    /**
     * Create and track a new async operation
     *
     * @param definition - The operation definition
     * @returns Promise resolving to the operation ID
     */
    public async createAsyncOperation(definition: AsyncOperationDefinition): Promise<string> {
        const operationId = this.generateOperationId();

        const operation: AsyncOperation = {
            id: operationId,
            type: definition.type,
            name: definition.name,
            status: OperationStatus.PENDING,
            startTime: new Date(),
            parameters: definition.parameters,
            metadata: definition.metadata
        };

        this.operations.set(operationId, operation);
        return operationId;
    }

    /**
     * Monitor an async operation with progress callbacks
     *
     * @param operationId - The ID of the operation
     * @param callback - Optional callback function for progress updates
     * @returns Promise resolving to the operation result
     */
    public async monitorAsyncOperation(
        operationId: string,
        callback?: ProgressCallback
    ): Promise<any> {
        const operation = this.operations.get(operationId);
        if (!operation) {
            throw new TM1Exception(`Operation with ID ${operationId} not found`);
        }

        return new Promise((resolve, reject) => {
            const intervalId = setInterval(async () => {
                try {
                    await this.getAsyncOperationStatus(operationId);

                    // Call progress callback if provided
                    if (callback) {
                        await callback(operation);
                    }

                    if (this.isTerminalStatus(operation.status)) {
                        clearInterval(intervalId);
                        this.pollingIntervals.delete(operationId);

                        if (operation.status === OperationStatus.COMPLETED) {
                            resolve(operation.result);
                        } else if (operation.status === OperationStatus.FAILED) {
                            reject(new TM1Exception(`Operation failed: ${operation.error}`));
                        } else if (operation.status === OperationStatus.CANCELLED) {
                            reject(new TM1Exception('Operation was cancelled'));
                        } else if (operation.status === OperationStatus.TIMEOUT) {
                            reject(new TM1Exception('Operation timed out'));
                        }
                    }
                } catch (error) {
                    clearInterval(intervalId);
                    this.pollingIntervals.delete(operationId);
                    reject(error);
                }
            }, this.defaultPollingInterval);

            this.pollingIntervals.set(operationId, intervalId);
        });
    }

    /**
     * Schedule an async operation for future execution
     *
     * @param operation - The operation definition
     * @param schedule - The schedule configuration
     * @returns Promise resolving to the scheduled operation ID
     */
    public async scheduleAsyncOperation(
        operation: AsyncOperationDefinition,
        schedule: Schedule
    ): Promise<string> {
        // This is a placeholder for scheduling functionality
        // In a real implementation, this would integrate with TM1 Chores or an external scheduler
        throw new TM1Exception('Scheduled operations are not yet implemented');
    }

    /**
     * Poll a process execution for completion
     *
     * @param operationId - The operation ID
     * @param options - Polling options
     * @returns Promise resolving to the operation status
     */
    public async pollProcessExecution(
        operationId: string,
        options?: PollingOptions
    ): Promise<OperationStatus> {
        const interval = options?.interval || this.defaultPollingInterval;
        const timeout = options?.timeout || this.defaultTimeout;
        const maxAttempts = options?.maxAttempts || Math.floor(timeout / interval);

        let attempts = 0;

        while (attempts < maxAttempts) {
            const status = await this.getAsyncOperationStatus(operationId);

            if (this.isTerminalStatus(status)) {
                return status;
            }

            await this.sleep(interval);
            attempts++;
        }

        throw new TM1Exception(`Polling timed out after ${attempts} attempts`);
    }

    /**
     * Update an operation's status manually
     *
     * @param operationId - The operation ID
     * @param status - The new status
     * @param result - Optional result data
     * @param error - Optional error message
     */
    public updateOperationStatus(
        operationId: string,
        status: OperationStatus,
        result?: any,
        error?: string
    ): void {
        const operation = this.operations.get(operationId);
        if (!operation) {
            throw new TM1Exception(`Operation with ID ${operationId} not found`);
        }

        operation.status = status;
        if (this.isTerminalStatus(status)) {
            operation.endTime = new Date();
        }
        if (result !== undefined) {
            operation.result = result;
        }
        if (error !== undefined) {
            operation.error = error;
        }
    }

    /**
     * Get an operation by ID
     *
     * @param operationId - The operation ID
     * @returns The operation object or undefined
     */
    public getOperation(operationId: string): AsyncOperation | undefined {
        return this.operations.get(operationId);
    }

    /**
     * Clean up completed operations older than specified age
     *
     * @param maxAgeMs - Maximum age in milliseconds (default: 1 hour)
     */
    public cleanupCompletedOperations(maxAgeMs: number = 3600000): void {
        const now = Date.now();
        const operationsToDelete: string[] = [];

        for (const [id, operation] of this.operations.entries()) {
            if (this.isTerminalStatus(operation.status) && operation.endTime) {
                const age = now - operation.endTime.getTime();
                if (age > maxAgeMs) {
                    operationsToDelete.push(id);
                }
            }
        }

        for (const id of operationsToDelete) {
            this.operations.delete(id);
            this.stopPolling(id);
        }
    }

    /**
     * Get all operations
     *
     * @returns Array of all operations
     */
    public getAllOperations(): AsyncOperation[] {
        return Array.from(this.operations.values());
    }

    // Private helper methods

    private generateOperationId(): string {
        return `async-op-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    }

    private isTerminalStatus(status: OperationStatus): boolean {
        return status === OperationStatus.COMPLETED ||
               status === OperationStatus.FAILED ||
               status === OperationStatus.CANCELLED ||
               status === OperationStatus.TIMEOUT;
    }

    private mapServerStatus(serverStatus: string): OperationStatus {
        const statusMap: Record<string, OperationStatus> = {
            'Pending': OperationStatus.PENDING,
            'Running': OperationStatus.RUNNING,
            'CompletedSuccessfully': OperationStatus.COMPLETED,
            'CompletedWithErrors': OperationStatus.FAILED,
            'Cancelled': OperationStatus.CANCELLED,
            'Timeout': OperationStatus.TIMEOUT
        };

        return statusMap[serverStatus] || OperationStatus.PENDING;
    }

    private stopPolling(operationId: string): void {
        const intervalId = this.pollingIntervals.get(operationId);
        if (intervalId) {
            clearInterval(intervalId);
            this.pollingIntervals.delete(operationId);
        }
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Cleanup all polling intervals
     */
    public cleanup(): void {
        for (const intervalId of this.pollingIntervals.values()) {
            clearInterval(intervalId);
        }
        this.pollingIntervals.clear();
    }
}
