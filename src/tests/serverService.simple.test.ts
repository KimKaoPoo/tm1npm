/**
 * Simple ServerService Tests
 * Testing actual methods available in ServerService based on real implementation
 */

import { ServerService, LogLevel } from '../services/ServerService';
import { RestService } from '../services/RestService';
import { TransactionLogService } from '../services/TransactionLogService';
import { MessageLogService } from '../services/MessageLogService';
import { AuditLogService } from '../services/AuditLogService';
import { LoggerService } from '../services/LoggerService';
import { ConfigurationService } from '../services/ConfigurationService';

// Mock dependencies
jest.mock('../services/TransactionLogService');
jest.mock('../services/MessageLogService');
jest.mock('../services/AuditLogService');
jest.mock('../services/LoggerService');
jest.mock('../services/ConfigurationService');

describe('ServerService - Simple Tests', () => {
    let serverService: ServerService;
    let mockRestService: jest.Mocked<RestService>;
    let mockTransactionLogService: jest.Mocked<TransactionLogService>;
    let mockMessageLogService: jest.Mocked<MessageLogService>;
    let mockAuditLogService: jest.Mocked<AuditLogService>;
    
    const mockResponse = (data: any) => ({
        data: data,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: { headers: {} }
    } as any);

    beforeEach(() => {
        // Suppress console.warn for constructor
        jest.spyOn(console, 'warn').mockImplementation();

        mockRestService = {
            get: jest.fn(),
            post: jest.fn(),
            patch: jest.fn(),
            put: jest.fn(),
            delete: jest.fn()
        } as any;

        mockTransactionLogService = {
            initializeDeltaRequests: jest.fn(),
            executeDeltaRequest: jest.fn()
        } as any;

        mockMessageLogService = {
            initializeDeltaRequests: jest.fn(),
            executeDeltaRequest: jest.fn(),
            getEntries: jest.fn()
        } as any;

        mockAuditLogService = {
            initializeDeltaRequests: jest.fn(),
            executeDeltaRequest: jest.fn()
        } as any;

        (TransactionLogService as jest.MockedClass<typeof TransactionLogService>).mockImplementation(() => mockTransactionLogService);
        (MessageLogService as jest.MockedClass<typeof MessageLogService>).mockImplementation(() => mockMessageLogService);
        (AuditLogService as jest.MockedClass<typeof AuditLogService>).mockImplementation(() => mockAuditLogService);

        serverService = new ServerService(mockRestService);
    });

    afterEach(() => {
        jest.clearAllMocks();
        jest.restoreAllMocks();
    });

    describe('Constructor and Initialization', () => {
        test('should initialize ServerService properly', () => {
            expect(serverService).toBeDefined();
            expect(serverService).toBeInstanceOf(ServerService);
        });

        test('should show deprecation warning', () => {
            expect(console.warn).toHaveBeenCalledWith(
                "Server Service will be moved to a new location in a future version"
            );
        });

        test('should initialize service dependencies', () => {
            expect(serverService.transactionLogs).toBeDefined();
            expect(serverService.messageLogs).toBeDefined();
            expect(serverService.configuration).toBeDefined();
            expect(serverService.auditLogs).toBeDefined();
            expect(serverService.loggers).toBeDefined();
        });
    });

    describe('Transaction Log Operations', () => {
        test('should initialize transaction log delta requests', async () => {
            mockTransactionLogService.initializeDeltaRequests.mockResolvedValue(undefined);

            await serverService.initializeTransactionLogDeltaRequests('filter');
            
            expect(mockTransactionLogService.initializeDeltaRequests).toHaveBeenCalledWith('filter');
        });

        test('should execute transaction log delta request', async () => {
            const logData = [{ timestamp: '2025-01-15', user: 'admin' }];
            mockTransactionLogService.executeDeltaRequest.mockResolvedValue(logData);

            const result = await serverService.executeTransactionLogDeltaRequest();
            
            expect(result).toEqual(logData);
            expect(mockTransactionLogService.executeDeltaRequest).toHaveBeenCalled();
        });
    });

    describe('Message Log Operations', () => {
        test('should initialize message log delta requests', async () => {
            mockMessageLogService.initializeDeltaRequests.mockResolvedValue(undefined);

            await serverService.initializeMessageLogDeltaRequests('filter');
            
            expect(mockMessageLogService.initializeDeltaRequests).toHaveBeenCalledWith('filter');
        });

        test('should execute message log delta request', async () => {
            const logData = [{ message: 'Test log entry' }];
            mockMessageLogService.executeDeltaRequest.mockResolvedValue(logData);

            const result = await serverService.executeMessageLogDeltaRequest();
            
            expect(result).toEqual(logData);
            expect(mockMessageLogService.executeDeltaRequest).toHaveBeenCalled();
        });

        test('should get message log entries with default parameters', async () => {
            const logEntries = [{ level: 'INFO', message: 'Test message' }];
            mockMessageLogService.getEntries.mockResolvedValue(logEntries);

            const result = await serverService.getMessageLogEntries();
            
            expect(result).toEqual(logEntries);
            expect(mockMessageLogService.getEntries).toHaveBeenCalledWith(
                true, // reverse
                undefined, // since
                undefined, // until
                undefined, // top
                undefined, // logger
                undefined, // level
                undefined, // msgContains
                'and' // msgContainsOperator
            );
        });

        test('should get message log entries with custom parameters', async () => {
            const logEntries = [{ level: 'ERROR', message: 'Error message' }];
            mockMessageLogService.getEntries.mockResolvedValue(logEntries);

            const since = new Date('2025-01-01');
            const until = new Date('2025-01-15');

            const result = await serverService.getMessageLogEntries(
                false, // reverse
                since,
                until,
                100, // top
                'TM1.Server', // logger
                'ERROR', // level
                ['error', 'fail'], // msgContains
                'or' // msgContainsOperator
            );
            
            expect(result).toEqual(logEntries);
            expect(mockMessageLogService.getEntries).toHaveBeenCalledWith(
                false,
                since,
                until,
                100,
                'TM1.Server',
                'ERROR',
                ['error', 'fail'],
                'or'
            );
        });
    });

    describe('Audit Log Operations', () => {
        test('should initialize audit log delta requests', async () => {
            mockAuditLogService.initializeDeltaRequests.mockResolvedValue(undefined);

            await serverService.initializeAuditLogDeltaRequests('filter');
            
            expect(mockAuditLogService.initializeDeltaRequests).toHaveBeenCalledWith('filter');
        });

        test('should execute audit log delta request', async () => {
            const auditData = [{ user: 'admin', action: 'LOGIN' }];
            mockAuditLogService.executeDeltaRequest.mockResolvedValue(auditData);

            const result = await serverService.executeAuditLogDeltaRequest();
            
            expect(result).toEqual(auditData);
            expect(mockAuditLogService.executeDeltaRequest).toHaveBeenCalled();
        });
    });

    describe('LogLevel Enum', () => {
        test('should have all required log levels', () => {
            expect(LogLevel.FATAL).toBe('fatal');
            expect(LogLevel.ERROR).toBe('error');
            expect(LogLevel.WARNING).toBe('warning');
            expect(LogLevel.INFO).toBe('info');
            expect(LogLevel.DEBUG).toBe('debug');
            expect(LogLevel.OFF).toBe('off');
        });

        test('should contain exactly 6 log levels', () => {
            const logLevels = Object.values(LogLevel);
            expect(logLevels).toHaveLength(6);
        });
    });

    describe('Error Handling', () => {
        test('should handle transaction log errors', async () => {
            const error = new Error('Transaction log failed');
            mockTransactionLogService.initializeDeltaRequests.mockRejectedValue(error);

            await expect(serverService.initializeTransactionLogDeltaRequests()).rejects.toThrow('Transaction log failed');
        });

        test('should handle message log errors', async () => {
            const error = new Error('Message log failed');
            mockMessageLogService.getEntries.mockRejectedValue(error);

            await expect(serverService.getMessageLogEntries()).rejects.toThrow('Message log failed');
        });

        test('should handle audit log errors', async () => {
            const error = new Error('Audit log failed');
            mockAuditLogService.executeDeltaRequest.mockRejectedValue(error);

            await expect(serverService.executeAuditLogDeltaRequest()).rejects.toThrow('Audit log failed');
        });
    });

    describe('Integration Patterns', () => {
        test('should support log monitoring workflow', async () => {
            const transactionLogs = [{ user: 'admin' }];
            const messageLogs = [{ message: 'info' }];
            const auditLogs = [{ action: 'LOGIN' }];
            
            mockTransactionLogService.initializeDeltaRequests.mockResolvedValue(undefined);
            mockTransactionLogService.executeDeltaRequest.mockResolvedValue(transactionLogs);
            mockMessageLogService.initializeDeltaRequests.mockResolvedValue(undefined);
            mockMessageLogService.executeDeltaRequest.mockResolvedValue(messageLogs);
            mockAuditLogService.initializeDeltaRequests.mockResolvedValue(undefined);
            mockAuditLogService.executeDeltaRequest.mockResolvedValue(auditLogs);

            // Initialize all log streams
            await serverService.initializeTransactionLogDeltaRequests();
            await serverService.initializeMessageLogDeltaRequests();
            await serverService.initializeAuditLogDeltaRequests();

            // Execute log requests
            const txLogs = await serverService.executeTransactionLogDeltaRequest();
            const msgLogs = await serverService.executeMessageLogDeltaRequest();
            const audLogs = await serverService.executeAuditLogDeltaRequest();

            expect(txLogs).toEqual(transactionLogs);
            expect(msgLogs).toEqual(messageLogs);
            expect(audLogs).toEqual(auditLogs);
        });

        test('should support concurrent log operations', async () => {
            mockTransactionLogService.executeDeltaRequest.mockResolvedValue([]);
            mockMessageLogService.executeDeltaRequest.mockResolvedValue([]);
            mockAuditLogService.executeDeltaRequest.mockResolvedValue([]);

            const operations = [
                serverService.executeTransactionLogDeltaRequest(),
                serverService.executeMessageLogDeltaRequest(),
                serverService.executeAuditLogDeltaRequest()
            ];

            const results = await Promise.all(operations);

            expect(results).toHaveLength(3);
            expect(mockTransactionLogService.executeDeltaRequest).toHaveBeenCalledTimes(1);
            expect(mockMessageLogService.executeDeltaRequest).toHaveBeenCalledTimes(1);
            expect(mockAuditLogService.executeDeltaRequest).toHaveBeenCalledTimes(1);
        });
    });
});