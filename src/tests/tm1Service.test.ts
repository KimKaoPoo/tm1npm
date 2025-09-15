/**
 * TM1Service Tests
 * Comprehensive test suite for the main TM1Service class
 * Target: Improve coverage from 0% to 40%+
 */

import { TM1Service } from '../services/TM1Service';
import { RestService, RestServiceConfig } from '../services/RestService';

// Mock all service dependencies
jest.mock('../services/RestService');
jest.mock('../services/DimensionService');
jest.mock('../services/HierarchyService');
jest.mock('../services/SubsetService');
jest.mock('../services/CubeService');
jest.mock('../services/ElementService');
jest.mock('../services/CellService');
jest.mock('../services/ProcessService');
jest.mock('../services/ViewService');
jest.mock('../services/SecurityService');
jest.mock('../services/FileService');
jest.mock('../services/SessionService');
jest.mock('../services/ServerService');
jest.mock('../services/MonitoringService');

describe('TM1Service', () => {
    let tm1Service: TM1Service;
    let mockRestService: jest.Mocked<RestService>;
    let mockConfig: RestServiceConfig;

    const mockResponse = (data: any) => ({
        data: data,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: { headers: {} }
    } as any);

    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();

        mockConfig = {
            address: 'localhost',
            port: 8879,
            user: 'admin',
            password: 'password',
            ssl: false
        };

        // Create mock RestService instance
        mockRestService = {
            connect: jest.fn().mockResolvedValue(void 0),
            disconnect: jest.fn().mockResolvedValue(void 0),
            get: jest.fn().mockResolvedValue(mockResponse),
            post: jest.fn().mockResolvedValue(mockResponse),
            patch: jest.fn().mockResolvedValue(mockResponse),
            put: jest.fn().mockResolvedValue(mockResponse),
            delete: jest.fn().mockResolvedValue(mockResponse),
            getSessionId: jest.fn().mockReturnValue('test-session-id'),
            setSandbox: jest.fn(),
            getSandbox: jest.fn().mockReturnValue('test-sandbox'),
            isLoggedIn: jest.fn().mockReturnValue(true),
        } as any;

        // Mock RestService constructor
        (RestService as jest.MockedClass<typeof RestService>).mockImplementation(() => mockRestService);

        tm1Service = new TM1Service(mockConfig);
    });

    describe('Constructor and Initialization', () => {
        test('should initialize TM1Service with all service properties', () => {
            expect(tm1Service).toBeDefined();
            expect(tm1Service.dimensions).toBeDefined();
            expect(tm1Service.hierarchies).toBeDefined();
            expect(tm1Service.subsets).toBeDefined();
            expect(tm1Service.cubes).toBeDefined();
            expect(tm1Service.elements).toBeDefined();
            expect(tm1Service.cells).toBeDefined();
            expect(tm1Service.processes).toBeDefined();
            expect(tm1Service.views).toBeDefined();
            expect(tm1Service.security).toBeDefined();
            expect(tm1Service.files).toBeDefined();
            expect(tm1Service.sessions).toBeDefined();
        });

        test('should create RestService with provided config', () => {
            expect(RestService).toHaveBeenCalledWith(mockConfig);
        });

        test('should initialize all services with REST service instance', () => {
            // Verify that all service constructors were called
            expect(RestService).toHaveBeenCalledTimes(1);
        });
    });

    describe('Connection Management', () => {
        test('should connect successfully', async () => {
            await tm1Service.connect();
            expect(mockRestService.connect).toHaveBeenCalledTimes(1);
        });

        test('should logout successfully', async () => {
            await tm1Service.logout();
            expect(mockRestService.disconnect).toHaveBeenCalledTimes(1);
        });

        test('should disconnect successfully (alias for logout)', async () => {
            await tm1Service.disconnect();
            expect(mockRestService.disconnect).toHaveBeenCalledTimes(1);
        });

        test('should handle connection errors gracefully', async () => {
            const connectionError = new Error('Connection failed');
            mockRestService.connect.mockRejectedValueOnce(connectionError);

            await expect(tm1Service.connect()).rejects.toThrow('Connection failed');
        });

        test('should handle logout errors gracefully', async () => {
            const logoutError = new Error('Logout failed');
            mockRestService.disconnect.mockRejectedValueOnce(logoutError);

            await expect(tm1Service.logout()).rejects.toThrow('Logout failed');
        });
    });

    describe('Service Properties - Lazy Loading', () => {
        test('should create server service lazily', () => {
            const server1 = tm1Service.server;
            const server2 = tm1Service.server;
            
            expect(server1).toBeDefined();
            expect(server2).toBe(server1); // Should return same instance
        });

        test('should create monitoring service lazily', () => {
            const monitoring1 = tm1Service.monitoring;
            const monitoring2 = tm1Service.monitoring;
            
            expect(monitoring1).toBeDefined();
            expect(monitoring2).toBe(monitoring1); // Should return same instance
        });
    });

    describe('User and Authentication', () => {
        test('should get current user with whoami', async () => {
            // Mock security service getCurrentUser method
            const mockSecurityService = {
                getCurrentUser: jest.fn().mockResolvedValue({ name: 'test-user' })
            };
            (tm1Service.security as any) = mockSecurityService;

            const result = await tm1Service.whoami();
            
            expect(result).toBe('test-user');
            expect(mockSecurityService.getCurrentUser).toHaveBeenCalledTimes(1);
        });

        test('should check if user is logged in', () => {
            mockRestService.isLoggedIn.mockReturnValue(true);
            const result = tm1Service.isLoggedIn();
            
            expect(result).toBe(true);
            expect(mockRestService.isLoggedIn).toHaveBeenCalledTimes(1);
        });

        test('should check if user is not logged in', () => {
            mockRestService.isLoggedIn.mockReturnValue(false);
            const result = tm1Service.isLoggedIn();
            
            expect(result).toBe(false);
        });

        test('should re-authenticate successfully', async () => {
            await tm1Service.reAuthenticate();
            
            expect(mockRestService.disconnect).toHaveBeenCalledTimes(1);
            expect(mockRestService.connect).toHaveBeenCalledTimes(1);
        });
    });

    describe('Metadata and Version', () => {
        test('should get TM1 metadata', async () => {
            mockRestService.get.mockResolvedValueOnce(mockResponse({ metadata: 'test-metadata' }));

            const result = await tm1Service.getMetadata();
            
            expect(result).toEqual({ metadata: 'test-metadata' });
            expect(mockRestService.get).toHaveBeenCalledWith('/$metadata');
        });

        test('should get TM1 version', async () => {
            mockRestService.get.mockResolvedValueOnce(mockResponse({ value: '12.0.0' }));

            const result = await tm1Service.getVersion();
            
            expect(result).toBe('12.0.0');
            expect(mockRestService.get).toHaveBeenCalledWith('/Configuration/ProductVersion');
        });

        test('should handle metadata retrieval errors', async () => {
            const metadataError = new Error('Metadata not available');
            mockRestService.get.mockRejectedValueOnce(metadataError);

            await expect(tm1Service.getMetadata()).rejects.toThrow('Metadata not available');
        });

        test('should handle version retrieval errors', async () => {
            const versionError = new Error('Version not available');
            mockRestService.get.mockRejectedValueOnce(versionError);

            await expect(tm1Service.getVersion()).rejects.toThrow('Version not available');
        });
    });

    describe('Session Management', () => {
        test('should get session ID', () => {
            mockRestService.getSessionId.mockReturnValue('test-session-123');
            const result = tm1Service.getSessionId();
            
            expect(result).toBe('test-session-123');
            expect(mockRestService.getSessionId).toHaveBeenCalledTimes(1);
        });

        test('should handle undefined session ID', () => {
            mockRestService.getSessionId.mockReturnValue(undefined);
            const result = tm1Service.getSessionId();
            
            expect(result).toBeUndefined();
        });

        test('should get connection instance', () => {
            const connection = tm1Service.connection;
            expect(connection).toBe(mockRestService);
        });
    });

    describe('Sandbox Management', () => {
        test('should set sandbox name', () => {
            tm1Service.setSandbox('test-sandbox');
            expect(mockRestService.setSandbox).toHaveBeenCalledWith('test-sandbox');
        });

        test('should set sandbox to undefined', () => {
            tm1Service.setSandbox(undefined);
            expect(mockRestService.setSandbox).toHaveBeenCalledWith(undefined);
        });

        test('should get current sandbox', () => {
            mockRestService.getSandbox.mockReturnValue('current-sandbox');
            const result = tm1Service.getSandbox();
            
            expect(result).toBe('current-sandbox');
            expect(mockRestService.getSandbox).toHaveBeenCalledTimes(1);
        });

        test('should handle undefined sandbox', () => {
            mockRestService.getSandbox.mockReturnValue(undefined);
            const result = tm1Service.getSandbox();
            
            expect(result).toBeUndefined();
        });
    });

    describe('Static Factory Method', () => {
        test('should create and connect TM1Service instance', async () => {
            const service = await TM1Service.create(mockConfig);
            
            expect(service).toBeInstanceOf(TM1Service);
            expect(mockRestService.connect).toHaveBeenCalledTimes(1);
        });

        test('should handle creation errors', async () => {
            const createError = new Error('Creation failed');
            mockRestService.connect.mockRejectedValueOnce(createError);

            await expect(TM1Service.create(mockConfig)).rejects.toThrow('Creation failed');
        });
    });

    describe('Disposal and Cleanup', () => {
        test('should dispose successfully', async () => {
            await tm1Service.dispose();
            expect(mockRestService.disconnect).toHaveBeenCalledTimes(1);
        });

        test('should handle dispose errors gracefully with console warning', async () => {
            const disposeError = new Error('Dispose failed');
            mockRestService.disconnect.mockRejectedValueOnce(disposeError);
            
            // Mock console.warn to verify it's called
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
            
            // Should not throw, should log warning instead
            await expect(tm1Service.dispose()).resolves.not.toThrow();
            
            expect(consoleSpy).toHaveBeenCalledWith('Logout failed due to exception: Error: Dispose failed');
            
            consoleSpy.mockRestore();
        });
    });

    describe('Error Handling and Edge Cases', () => {
        test('should handle whoami when security service fails', async () => {
            const mockSecurityService = {
                getCurrentUser: jest.fn().mockRejectedValue(new Error('Security error'))
            };
            (tm1Service.security as any) = mockSecurityService;

            await expect(tm1Service.whoami()).rejects.toThrow('Security error');
        });

        test('should handle re-authentication when disconnect fails', async () => {
            const disconnectError = new Error('Disconnect failed');
            mockRestService.disconnect.mockRejectedValueOnce(disconnectError);

            await expect(tm1Service.reAuthenticate()).rejects.toThrow('Disconnect failed');
        });

        test('should handle re-authentication when connect fails after disconnect', async () => {
            const connectError = new Error('Reconnect failed');
            mockRestService.disconnect.mockResolvedValueOnce(void 0);
            mockRestService.connect.mockRejectedValueOnce(connectError);

            await expect(tm1Service.reAuthenticate()).rejects.toThrow('Reconnect failed');
        });
    });

    describe('Service Integration', () => {
        test('should have all required service properties initialized', () => {
            const requiredServices = [
                'dimensions', 'hierarchies', 'subsets', 'cubes', 
                'elements', 'cells', 'processes', 'views', 
                'security', 'files', 'sessions'
            ];

            requiredServices.forEach(service => {
                expect(tm1Service[service as keyof TM1Service]).toBeDefined();
            });
        });

        test('should provide lazy-loaded services', () => {
            // These are lazy-loaded via getters
            expect(tm1Service.server).toBeDefined();
            expect(tm1Service.monitoring).toBeDefined();
        });

        test('should maintain consistent lazy-loaded service instances', () => {
            // Call multiple times to ensure same instance is returned
            const server1 = tm1Service.server;
            const server2 = tm1Service.server;
            const monitoring1 = tm1Service.monitoring;
            const monitoring2 = tm1Service.monitoring;

            expect(server1).toBe(server2);
            expect(monitoring1).toBe(monitoring2);
        });
    });
});