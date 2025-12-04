/**
 * AsyncOperationService Tests
 * Comprehensive test suite for async operation management
 */

import { AsyncOperationService, OperationStatus, OperationType, AsyncOperation } from '../services/AsyncOperationService';
import { RestService } from '../services/RestService';
import { TM1Exception } from '../exceptions/TM1Exception';

// Mock RestService
jest.mock('../services/RestService');

describe('AsyncOperationService', () => {
    let asyncService: AsyncOperationService;
    let mockRestService: jest.Mocked<RestService>;

    beforeEach(() => {
        mockRestService = new RestService({
            address: 'localhost',
            port: 12345,
            user: 'admin',
            password: 'apple',
            ssl: false
        }) as jest.Mocked<RestService>;

        asyncService = new AsyncOperationService(mockRestService);
    });

    afterEach(() => {
        asyncService.cleanup();
        jest.clearAllMocks();
    });

    describe('Operation Creation', () => {
        test('should create a new async operation', async () => {
            const operationId = await asyncService.createAsyncOperation({
                type: OperationType.PROCESS_EXECUTION,
                name: 'TestProcess',
                parameters: { param1: 'value1' }
            });

            expect(operationId).toBeDefined();
            expect(operationId).toMatch(/^async-op-/);

            const operation = asyncService.getOperation(operationId);
            expect(operation).toBeDefined();
            expect(operation?.type).toBe(OperationType.PROCESS_EXECUTION);
            expect(operation?.name).toBe('TestProcess');
            expect(operation?.status).toBe(OperationStatus.PENDING);
        });

        test('should create operation with metadata', async () => {
            const metadata = { user: 'admin', priority: 'high' };
            const operationId = await asyncService.createAsyncOperation({
                type: OperationType.MDX_QUERY,
                name: 'TestQuery',
                metadata
            });

            const operation = asyncService.getOperation(operationId);
            expect(operation?.metadata).toEqual(metadata);
        });

        test('should generate unique operation IDs', async () => {
            const id1 = await asyncService.createAsyncOperation({
                type: OperationType.PROCESS_EXECUTION,
                name: 'Op1'
            });

            const id2 = await asyncService.createAsyncOperation({
                type: OperationType.PROCESS_EXECUTION,
                name: 'Op2'
            });

            expect(id1).not.toBe(id2);
        });
    });

    describe('Operation Status Management', () => {
        test('should update operation status', async () => {
            const operationId = await asyncService.createAsyncOperation({
                type: OperationType.PROCESS_EXECUTION,
                name: 'TestProcess'
            });

            asyncService.updateOperationStatus(operationId, OperationStatus.RUNNING);
            let operation = asyncService.getOperation(operationId);
            expect(operation?.status).toBe(OperationStatus.RUNNING);

            asyncService.updateOperationStatus(
                operationId,
                OperationStatus.COMPLETED,
                { success: true }
            );
            operation = asyncService.getOperation(operationId);
            expect(operation?.status).toBe(OperationStatus.COMPLETED);
            expect(operation?.result).toEqual({ success: true });
            expect(operation?.endTime).toBeDefined();
        });

        test('should set error message on failure', async () => {
            const operationId = await asyncService.createAsyncOperation({
                type: OperationType.PROCESS_EXECUTION,
                name: 'TestProcess'
            });

            const errorMessage = 'Process execution failed';
            asyncService.updateOperationStatus(
                operationId,
                OperationStatus.FAILED,
                undefined,
                errorMessage
            );

            const operation = asyncService.getOperation(operationId);
            expect(operation?.status).toBe(OperationStatus.FAILED);
            expect(operation?.error).toBe(errorMessage);
        });

        test('should throw error for non-existent operation', () => {
            expect(() => {
                asyncService.updateOperationStatus(
                    'non-existent-id',
                    OperationStatus.COMPLETED
                );
            }).toThrow(TM1Exception);
        });
    });

    describe('Operation Polling', () => {
        test('should poll operation status and detect completion', async () => {
            const operationId = await asyncService.createAsyncOperation({
                type: OperationType.PROCESS_EXECUTION,
                name: 'TestProcess'
            });

            // Start as running, then complete it
            asyncService.updateOperationStatus(operationId, OperationStatus.RUNNING);

            // First call returns running
            mockRestService.get = jest.fn()
                .mockResolvedValueOnce({ data: { Status: 'Running' } })
                .mockResolvedValueOnce({ data: { Status: 'CompletedSuccessfully' } });

            // Manually complete after first poll
            setTimeout(() => {
                asyncService.updateOperationStatus(
                    operationId,
                    OperationStatus.COMPLETED,
                    { result: 'success' }
                );
            }, 50);

            const status = await asyncService.pollProcessExecution(operationId, {
                interval: 100,
                maxAttempts: 5
            });
            expect(status).toBe(OperationStatus.COMPLETED);
        });

        test('should return completed status immediately for terminal operations', async () => {
            const operationId = await asyncService.createAsyncOperation({
                type: OperationType.PROCESS_EXECUTION,
                name: 'TestProcess'
            });

            asyncService.updateOperationStatus(
                operationId,
                OperationStatus.COMPLETED,
                { result: 'success' }
            );

            // No need to poll - should return immediately
            const status = await asyncService.getAsyncOperationStatus(operationId);
            expect(status).toBe(OperationStatus.COMPLETED);
        });

        test('should handle polling timeout', async () => {
            const operationId = await asyncService.createAsyncOperation({
                type: OperationType.PROCESS_EXECUTION,
                name: 'TestProcess'
            });

            asyncService.updateOperationStatus(operationId, OperationStatus.RUNNING);

            mockRestService.get = jest.fn().mockResolvedValue({
                data: { Status: 'Running' }
            });

            await expect(
                asyncService.pollProcessExecution(operationId, {
                    interval: 10,
                    timeout: 50,
                    maxAttempts: 2
                })
            ).rejects.toThrow(TM1Exception);
        });
    });

    describe('Operation Cancellation', () => {
        test('should cancel a running operation', async () => {
            const operationId = await asyncService.createAsyncOperation({
                type: OperationType.PROCESS_EXECUTION,
                name: 'TestProcess'
            });

            asyncService.updateOperationStatus(operationId, OperationStatus.RUNNING);

            mockRestService.post = jest.fn().mockResolvedValue({ data: {} });

            await asyncService.cancelAsyncOperation(operationId);

            const operation = asyncService.getOperation(operationId);
            expect(operation?.status).toBe(OperationStatus.CANCELLED);
            expect(operation?.endTime).toBeDefined();
        });

        test('should throw error when cancelling non-existent operation', async () => {
            await expect(
                asyncService.cancelAsyncOperation('non-existent-id')
            ).rejects.toThrow(TM1Exception);
        });

        test('should throw error when cancelling completed operation', async () => {
            const operationId = await asyncService.createAsyncOperation({
                type: OperationType.PROCESS_EXECUTION,
                name: 'TestProcess'
            });

            asyncService.updateOperationStatus(operationId, OperationStatus.COMPLETED);

            await expect(
                asyncService.cancelAsyncOperation(operationId)
            ).rejects.toThrow(TM1Exception);
        });
    });

    describe('Wait for Operation', () => {
        test('should wait for operation completion', async () => {
            const operationId = await asyncService.createAsyncOperation({
                type: OperationType.PROCESS_EXECUTION,
                name: 'TestProcess'
            });

            asyncService.updateOperationStatus(operationId, OperationStatus.RUNNING);

            // Simulate completion after 100ms
            setTimeout(() => {
                asyncService.updateOperationStatus(
                    operationId,
                    OperationStatus.COMPLETED,
                    { result: 'success' }
                );
            }, 100);

            mockRestService.get = jest.fn().mockImplementation(() => {
                const op = asyncService.getOperation(operationId);
                return Promise.resolve({
                    data: {
                        Status: op?.status === OperationStatus.COMPLETED
                            ? 'CompletedSuccessfully'
                            : 'Running'
                    }
                });
            });

            const result = await asyncService.waitForAsyncOperation(operationId, 5000);
            expect(result).toEqual({ result: 'success' });
        });

        test('should reject when operation fails', async () => {
            const operationId = await asyncService.createAsyncOperation({
                type: OperationType.PROCESS_EXECUTION,
                name: 'TestProcess'
            });

            asyncService.updateOperationStatus(operationId, OperationStatus.RUNNING);

            setTimeout(() => {
                asyncService.updateOperationStatus(
                    operationId,
                    OperationStatus.FAILED,
                    undefined,
                    'Process failed'
                );
            }, 100);

            mockRestService.get = jest.fn().mockImplementation(() => {
                const op = asyncService.getOperation(operationId);
                return Promise.resolve({
                    data: {
                        Status: op?.status === OperationStatus.FAILED
                            ? 'CompletedWithErrors'
                            : 'Running'
                    }
                });
            });

            await expect(
                asyncService.waitForAsyncOperation(operationId, 5000)
            ).rejects.toThrow(TM1Exception);
        });

        test('should timeout if operation takes too long', async () => {
            const operationId = await asyncService.createAsyncOperation({
                type: OperationType.PROCESS_EXECUTION,
                name: 'TestProcess'
            });

            asyncService.updateOperationStatus(operationId, OperationStatus.RUNNING);

            mockRestService.get = jest.fn().mockResolvedValue({
                data: { Status: 'Running' }
            });

            await expect(
                asyncService.waitForAsyncOperation(operationId, 100)
            ).rejects.toThrow('Operation timed out');

            const operation = asyncService.getOperation(operationId);
            expect(operation?.status).toBe(OperationStatus.TIMEOUT);
        });
    });

    describe('Monitor Operation', () => {
        test('should monitor operation with progress callback', async () => {
            const operationId = await asyncService.createAsyncOperation({
                type: OperationType.PROCESS_EXECUTION,
                name: 'TestProcess'
            });

            asyncService.updateOperationStatus(operationId, OperationStatus.RUNNING);

            const progressUpdates: OperationStatus[] = [];
            const callback = jest.fn((operation: AsyncOperation) => {
                progressUpdates.push(operation.status);
            });

            setTimeout(() => {
                asyncService.updateOperationStatus(
                    operationId,
                    OperationStatus.COMPLETED,
                    { result: 'success' }
                );
            }, 100);

            mockRestService.get = jest.fn().mockImplementation(() => {
                const op = asyncService.getOperation(operationId);
                return Promise.resolve({
                    data: {
                        Status: op?.status === OperationStatus.COMPLETED
                            ? 'CompletedSuccessfully'
                            : 'Running'
                    }
                });
            });

            const result = await asyncService.monitorAsyncOperation(operationId, callback);
            expect(result).toEqual({ result: 'success' });
            expect(callback).toHaveBeenCalled();
        });
    });

    describe('List Active Operations', () => {
        test('should list all active operations', async () => {
            const id1 = await asyncService.createAsyncOperation({
                type: OperationType.PROCESS_EXECUTION,
                name: 'Process1'
            });
            asyncService.updateOperationStatus(id1, OperationStatus.RUNNING);

            const id2 = await asyncService.createAsyncOperation({
                type: OperationType.MDX_QUERY,
                name: 'Query1'
            });
            asyncService.updateOperationStatus(id2, OperationStatus.RUNNING);

            const id3 = await asyncService.createAsyncOperation({
                type: OperationType.VIEW_EXECUTION,
                name: 'View1'
            });
            asyncService.updateOperationStatus(id3, OperationStatus.COMPLETED);

            mockRestService.get = jest.fn().mockResolvedValue({
                data: { Status: 'Running' }
            });

            const activeOps = await asyncService.listActiveAsyncOperations();
            expect(activeOps.length).toBe(2);
            expect(activeOps.every(op => op.status === OperationStatus.RUNNING)).toBe(true);
        });

        test('should return empty array when no active operations', async () => {
            const activeOps = await asyncService.listActiveAsyncOperations();
            expect(activeOps).toEqual([]);
        });
    });

    describe('Get Operation', () => {
        test('should retrieve operation by ID', async () => {
            const operationId = await asyncService.createAsyncOperation({
                type: OperationType.PROCESS_EXECUTION,
                name: 'TestProcess',
                parameters: { key: 'value' }
            });

            const operation = asyncService.getOperation(operationId);
            expect(operation).toBeDefined();
            expect(operation?.id).toBe(operationId);
            expect(operation?.name).toBe('TestProcess');
            expect(operation?.parameters).toEqual({ key: 'value' });
        });

        test('should return undefined for non-existent operation', () => {
            const operation = asyncService.getOperation('non-existent-id');
            expect(operation).toBeUndefined();
        });
    });

    describe('Get All Operations', () => {
        test('should return all operations', async () => {
            await asyncService.createAsyncOperation({
                type: OperationType.PROCESS_EXECUTION,
                name: 'Process1'
            });

            await asyncService.createAsyncOperation({
                type: OperationType.MDX_QUERY,
                name: 'Query1'
            });

            await asyncService.createAsyncOperation({
                type: OperationType.VIEW_EXECUTION,
                name: 'View1'
            });

            const allOps = asyncService.getAllOperations();
            expect(allOps.length).toBe(3);
        });
    });

    describe('Cleanup Operations', () => {
        test('should clean up old completed operations', async () => {
            const id1 = await asyncService.createAsyncOperation({
                type: OperationType.PROCESS_EXECUTION,
                name: 'Process1'
            });
            asyncService.updateOperationStatus(id1, OperationStatus.COMPLETED);

            const operation = asyncService.getOperation(id1);
            if (operation && operation.endTime) {
                // Set endTime to 2 hours ago
                operation.endTime = new Date(Date.now() - 7200000);
            }

            const id2 = await asyncService.createAsyncOperation({
                type: OperationType.MDX_QUERY,
                name: 'Query1'
            });
            asyncService.updateOperationStatus(id2, OperationStatus.RUNNING);

            // Clean up operations older than 1 hour
            asyncService.cleanupCompletedOperations(3600000);

            const op1 = asyncService.getOperation(id1);
            const op2 = asyncService.getOperation(id2);

            expect(op1).toBeUndefined(); // Should be cleaned up
            expect(op2).toBeDefined(); // Should still exist
        });

        test('should not clean up recent operations', async () => {
            const operationId = await asyncService.createAsyncOperation({
                type: OperationType.PROCESS_EXECUTION,
                name: 'Process1'
            });
            asyncService.updateOperationStatus(operationId, OperationStatus.COMPLETED);

            asyncService.cleanupCompletedOperations(3600000);

            const operation = asyncService.getOperation(operationId);
            expect(operation).toBeDefined();
        });
    });

    describe('Cleanup Service', () => {
        test('should stop all polling intervals', () => {
            asyncService.cleanup();
            // No assertion needed - just ensuring no errors
        });
    });

    describe('Error Handling', () => {
        test('should handle server errors gracefully', async () => {
            const operationId = await asyncService.createAsyncOperation({
                type: OperationType.PROCESS_EXECUTION,
                name: 'TestProcess'
            });

            asyncService.updateOperationStatus(operationId, OperationStatus.RUNNING);

            mockRestService.get = jest.fn().mockRejectedValue(new Error('Server error'));

            // Should return cached status instead of throwing
            const status = await asyncService.getAsyncOperationStatus(operationId);
            expect(status).toBe(OperationStatus.RUNNING);
        });
    });
});
