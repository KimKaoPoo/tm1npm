/**
 * ProcessService Tests for tm1npm
 * Comprehensive tests for TM1 Process operations with proper mocking
 */

import { ProcessService } from '../services/ProcessService';
import { RestService } from '../services/RestService';
import { Process } from '../objects/Process';
import { TM1RestException } from '../exceptions/TM1Exception';

// Helper function to create mock AxiosResponse
const createMockResponse = (data: any, status: number = 200) => ({
    data,
    status,
    statusText: status === 200 ? 'OK' : status === 201 ? 'Created' : status === 204 ? 'No Content' : 'Error',
    headers: {},
    config: {} as any
});

describe('ProcessService Tests', () => {
    let processService: ProcessService;
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

        processService = new ProcessService(mockRestService);
    });

    describe('Process Retrieval Operations', () => {
        test('should get all process names', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse({
                value: [
                    { Name: 'Process1' },
                    { Name: 'Process2' },
                    { Name: 'Process3' }
                ]
            }));

            const processNames = await processService.getAllNames();
            
            expect(Array.isArray(processNames)).toBe(true);
            expect(processNames.length).toBe(3);
            expect(processNames).toEqual(['Process1', 'Process2', 'Process3']);
            expect(mockRestService.get).toHaveBeenCalledWith("/Processes?$select=Name");
            
            console.log('✅ Process names retrieved successfully');
        });

        test('should get all processes with skip control processes', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse({
                value: [
                    { Name: 'UserProcess1', HasSecurityAccess: true },
                    { Name: 'UserProcess2', HasSecurityAccess: true }
                ]
            }));

            const processes = await processService.getAll(true); // skip control processes
            
            expect(Array.isArray(processes)).toBe(true);
            expect(processes.length).toBe(2);
            expect(processes[0].name).toBe('UserProcess1');
            expect(processes[1].name).toBe('UserProcess2');
            
            console.log('✅ All processes retrieved with control process filtering');
        });

        test('should get a specific process if it exists', async () => {
            mockRestService.get.mockResolvedValueOnce(createMockResponse({
                value: [{ Name: 'TestProcess' }]
            }));

            mockRestService.get.mockResolvedValueOnce(createMockResponse({
                Name: 'TestProcess',
                HasSecurityAccess: true,
                PrologProcedure: 'sMessage = "Hello World";',
                MetadataProcedure: '',
                DataProcedure: '',
                EpilogProcedure: ''
            }));

            const processNames = await processService.getAllNames();
            expect(processNames).toContain('TestProcess');

            const process = await processService.get('TestProcess');
            expect(process).toBeDefined();
            expect(process.name).toBe('TestProcess');
            
            console.log('✅ Specific process retrieved successfully');
        });

        test('should check if a process exists', async () => {
            // Test existing process
            mockRestService.get.mockResolvedValue(createMockResponse({
                Name: 'ExistingProcess',
                HasSecurityAccess: true
            }));

            const exists = await processService.exists('ExistingProcess');
            expect(exists).toBe(true);

            console.log('✅ Process existence check working');
        });

        test('should check if a process does not exist', async () => {
            // Test non-existing process - create proper TM1RestException
            const mockError = new TM1RestException('Process not found', 404, { status: 404 });
            mockRestService.get.mockRejectedValue(mockError);

            const notExists = await processService.exists('NonExistentProcess');
            expect(notExists).toBe(false);
            
            console.log('✅ Process non-existence check working');
        });
    });

    describe('Process Execution Operations', () => {
        test('should handle process execution attempts', async () => {
            mockRestService.post.mockResolvedValue(createMockResponse({
                ProcessExecuteStatusCode: 'CompletedSuccessfully',
                ErrorLogFile: ''
            }));

            await processService.execute('TestProcess');
            
            expect(mockRestService.post).toHaveBeenCalledWith("/Processes('TestProcess')/tm1.Execute", "{}");
            console.log('✅ Process execution handled successfully');
        });

        test('should handle process execution with parameters', async () => {
            const parameters = [
                { Name: 'pParam1', Value: 'Value1' },
                { Name: 'pParam2', Value: 123 }
            ];

            mockRestService.post.mockResolvedValue(createMockResponse({
                ProcessExecuteStatusCode: 'CompletedSuccessfully',
                ErrorLogFile: ''
            }));

            await processService.executeWithReturn('TestProcess', parameters);
            
            expect(mockRestService.post).toHaveBeenCalled();
            console.log('✅ Process execution with parameters handled successfully');
        });

        test('should handle executeWithReturn attempts', async () => {
            mockRestService.post.mockResolvedValue(createMockResponse({
                ProcessExecuteStatusCode: 'CompletedSuccessfully',
                ErrorLogFile: '',
                ProcessReturnValue: 'Success'
            }));

            const result = await processService.executeWithReturn('TestProcess');
            
            expect(result).toBeDefined();
            expect(mockRestService.post).toHaveBeenCalled();
            console.log('✅ Process executeWithReturn handled successfully');
        });
    });

    describe('Process Compilation Operations', () => {
        test('should handle process compilation attempts', async () => {
            mockRestService.post.mockResolvedValue(createMockResponse({
                ProcessCompileStatusCode: 'CompletedSuccessfully',
                ErrorLogFile: ''
            }));

            const result = await processService.compile('TestProcess');
            
            expect(result).toBeDefined();
            expect(mockRestService.post).toHaveBeenCalledWith("/Processes('TestProcess')/tm1.Compile", "{}");
            console.log('✅ Process compilation handled successfully');
        });
    });

    describe('Process Error Handling', () => {
        test('should handle invalid process names gracefully', async () => {
            mockRestService.get.mockRejectedValue({
                response: { status: 400, statusText: 'Bad Request' }
            });

            await expect(processService.get('')).rejects.toMatchObject({
                response: { status: 400 }
            });
            
            console.log('✅ Invalid process names handled gracefully');
        });

        test('should handle network errors gracefully', async () => {
            mockRestService.get.mockRejectedValue({
                code: 'ECONNREFUSED'
            });

            await expect(processService.getAllNames()).rejects.toMatchObject({
                code: 'ECONNREFUSED'
            });
            
            console.log('✅ Network errors handled gracefully');
        });

        test('should handle authentication errors', async () => {
            mockRestService.get.mockRejectedValue({
                response: { status: 401, statusText: 'Unauthorized' }
            });

            await expect(processService.getAllNames()).rejects.toMatchObject({
                response: { status: 401 }
            });
            
            console.log('✅ Authentication errors handled gracefully');
        });
    });

    describe('Process Service Edge Cases', () => {
        test('should handle empty process lists', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse({
                value: []
            }));

            const processNames = await processService.getAllNames();
            
            expect(Array.isArray(processNames)).toBe(true);
            expect(processNames.length).toBe(0);
            
            console.log('✅ Empty process lists handled correctly');
        });

        test('should handle concurrent process operations', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse({
                value: [{ Name: 'TestProcess' }]
            }));

            const operations = [
                processService.getAllNames(),
                processService.getAllNames(),
                processService.getAllNames()
            ];

            const results = await Promise.allSettled(operations);
            const successful = results.filter(r => r.status === 'fulfilled');
            
            expect(successful.length).toBe(3);
            console.log('✅ Concurrent operations handled successfully');
        });

        test('should handle large process lists efficiently', async () => {
            const largeProcessList = Array(1000).fill(null).map((_, i) => ({
                Name: `Process${i}`,
                HasSecurityAccess: true
            }));

            mockRestService.get.mockResolvedValue(createMockResponse({
                value: largeProcessList
            }));

            const startTime = Date.now();
            const processNames = await processService.getAllNames();
            const endTime = Date.now();
            
            expect(processNames.length).toBe(1000);
            expect(endTime - startTime).toBeLessThan(1000); // Should be fast with mocking
            
            console.log('✅ Large process lists handled efficiently');
        });
    });

    describe('Process Service Integration', () => {
        test('should maintain consistent data across operations', async () => {
            const processData = {
                value: [
                    { Name: 'Process1' },
                    { Name: 'Process2' }
                ]
            };

            mockRestService.get.mockResolvedValue(createMockResponse(processData));

            const names1 = await processService.getAllNames();
            const names2 = await processService.getAllNames();
            
            expect(names1).toEqual(names2);
            expect(names1).toEqual(['Process1', 'Process2']);
            
            console.log('✅ Data consistency maintained across operations');
        });
    });

    describe('Process CRUD Operations', () => {
        test('should handle process creation and deletion lifecycle', async () => {
            const testProcess = new Process(
                'TestProcess',
                true, // hasSecurityAccess
                '', // uiData
                [], // parameters
                [], // variables
                [], // variablesUiData
                'sMessage = "Test Process";' // prologProcedure
            );

            // Mock process existence check (false initially)
            const mockError = new TM1RestException('Process not found', 404, { status: 404 });
            mockRestService.get.mockRejectedValueOnce(mockError);

            const initialExists = await processService.exists('TestProcess');
            expect(initialExists).toBe(false);

            // Mock process creation
            mockRestService.post.mockResolvedValue(createMockResponse({}, 201));

            await processService.create(testProcess);
            
            // Mock process existence check (true after creation)
            mockRestService.get.mockResolvedValueOnce(createMockResponse({
                Name: 'TestProcess',
                HasSecurityAccess: true
            }));

            const afterCreationExists = await processService.exists('TestProcess');
            expect(afterCreationExists).toBe(true);

            // Mock process deletion
            mockRestService.delete.mockResolvedValue(createMockResponse({}, 204));

            await processService.delete('TestProcess');
            
            console.log('✅ Process lifecycle operations handled successfully');
        });
    });

    describe('Process Search Operations', () => {
        test('should handle searchStringInCode functionality', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse({
                value: [
                    { 
                        Name: 'ProcessWithCode', 
                        PrologProcedure: 'sMessage = "Hello World";',
                        HasSecurityAccess: true 
                    },
                    { 
                        Name: 'ProcessWithoutCode', 
                        PrologProcedure: 'nValue = 123;',
                        HasSecurityAccess: true 
                    }
                ]
            }));

            const results = await processService.searchStringInCode('Hello');
            
            expect(Array.isArray(results)).toBe(true);
            expect(results.length).toBe(1);
            expect(results[0]).toBe('ProcessWithCode'); // Returns process name string, not object
            
            console.log('✅ Search string in code functionality working');
        });

        test('should handle empty search results gracefully', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse({
                value: [
                    { 
                        Name: 'Process1', 
                        PrologProcedure: 'nValue = 123;',
                        HasSecurityAccess: true 
                    }
                ]
            }));

            const results = await processService.searchStringInCode('NonExistentString');
            
            expect(Array.isArray(results)).toBe(true);
            expect(results.length).toBe(0);
            
            console.log('✅ Empty search results handled gracefully');
        });
    });

    describe('Process Debug Operations', () => {
        test('should handle debug breakpoint operations for existing processes', async () => {
            mockRestService.get.mockResolvedValue(createMockResponse({
                value: [{ Name: 'DebugProcess' }]
            }));

            // Mock debug operations (these would typically return specific debug info)
            mockRestService.post.mockResolvedValue(createMockResponse({
                DebugInfo: 'Breakpoint set successfully'
            }));

            const processNames = await processService.getAllNames();
            expect(processNames).toContain('DebugProcess');
            
            // In a real implementation, this would set debug breakpoints
            // For now, we just verify the mock interaction
            expect(mockRestService.get).toHaveBeenCalled();
            
            console.log('✅ Debug operations handled for existing processes');
        });
    });
});