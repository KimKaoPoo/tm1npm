/**
 * Comprehensive ProcessService Tests
 * Target: Achieve 80%+ coverage for ProcessService (currently 56%)
 * Testing all process operations including CRUD, execution, debugging, and TI code handling
 */

import { ProcessService } from '../services/ProcessService';
import { RestService } from '../services/RestService';
import { Process } from '../objects/Process';
import { ProcessDebugBreakpoint } from '../objects/ProcessDebugBreakpoint';
import { TM1RestException } from '../exceptions/TM1Exception';

// Mock dependencies
jest.mock('../objects/Process');
jest.mock('../objects/ProcessDebugBreakpoint');

describe('ProcessService - Comprehensive Tests', () => {
    let processService: ProcessService;
    let mockRestService: jest.Mocked<RestService>;
    
    const mockResponse = (data: any) => ({
        data: data,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: { headers: {} }
    } as any);

    const mockProcess = {
        name: 'TestProcess',
        body: {
            Name: 'TestProcess',
            PrologProcedure: 'sTest = "Hello World";',
            MetadataProcedure: '',
            DataProcedure: '',
            EpilogProcedure: 'WriteToMessageLog(INFO, sTest);'
        },
        prologProcedure: 'sTest = "Hello World";',
        metadataProcedure: '',
        dataProcedure: '',
        epilogProcedure: 'WriteToMessageLog(INFO, sTest);'
    } as any;

    const mockProcessDebugBreakpoint = {
        lineNumber: 5,
        procedure: 'Prolog',
        body: {
            LineNumber: 5,
            Procedure: 'Prolog'
        }
    } as any;

    beforeEach(() => {
        mockRestService = {
            get: jest.fn(),
            post: jest.fn(),
            patch: jest.fn(),
            put: jest.fn(),
            delete: jest.fn()
        } as any;

        processService = new ProcessService(mockRestService);
        
        // Mock Process.fromDict
        (Process as any).fromDict = jest.fn().mockReturnValue(mockProcess);
        
        // Mock ProcessDebugBreakpoint.fromDict
        (ProcessDebugBreakpoint as any).fromDict = jest.fn().mockReturnValue(mockProcessDebugBreakpoint);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('Constructor and Initialization', () => {
        test('should initialize ProcessService properly', () => {
            expect(processService).toBeDefined();
            expect(processService).toBeInstanceOf(ProcessService);
        });

        test('should extend ObjectService', () => {
            expect(processService).toBeInstanceOf(ProcessService);
            // Note: ObjectService inheritance tested through functionality
        });
    });

    describe('Process CRUD Operations', () => {
        test('should get process by name', async () => {
            const processData = {
                Name: 'TestProcess',
                PrologProcedure: 'sTest = "Hello";'
            };
            mockRestService.get.mockResolvedValue(mockResponse(processData));

            const result = await processService.get('TestProcess');
            
            expect(Process.fromDict).toHaveBeenCalledWith(processData);
            expect(mockRestService.get).toHaveBeenCalledWith(
                expect.stringContaining("/Processes('TestProcess')?$select=*,UIData,VariablesUIData,")
            );
            expect(result).toEqual(mockProcess);
        });

        test('should get all processes', async () => {
            const processesData = {
                value: [
                    { Name: 'Process1', PrologProcedure: 'test1;' },
                    { Name: 'Process2', PrologProcedure: 'test2;' }
                ]
            };
            mockRestService.get.mockResolvedValue(mockResponse(processesData));

            const result = await processService.getAll();
            
            expect(result).toHaveLength(2);
            expect(Process.fromDict).toHaveBeenCalledTimes(2);
            expect(mockRestService.get).toHaveBeenCalledWith(
                expect.stringContaining("/Processes?$select=*,UIData,VariablesUIData,")
            );
        });

        test('should get all processes excluding control processes', async () => {
            const processesData = {
                value: [
                    { Name: 'Process1', PrologProcedure: 'test1;' },
                    { Name: 'Process2', PrologProcedure: 'test2;' }
                ]
            };
            mockRestService.get.mockResolvedValue(mockResponse(processesData));

            const result = await processService.getAll(true);
            
            expect(result).toHaveLength(2);
            expect(mockRestService.get).toHaveBeenCalledWith(
                expect.stringMatching(/.*&\$filter=startswith\(Name,'\}'\) eq false and startswith\(Name,'\{'\) eq false$/)
            );
        });

        test('should get all process names', async () => {
            const processNamesData = {
                value: [
                    { Name: 'Process1' },
                    { Name: 'Process2' },
                    { Name: '}Control' }
                ]
            };
            mockRestService.get.mockResolvedValue(mockResponse(processNamesData));

            const result = await processService.getAllNames();
            
            expect(result).toEqual(['Process1', 'Process2', '}Control']);
            expect(mockRestService.get).toHaveBeenCalledWith("/Processes?$select=Name");
        });

        test('should get all process names excluding control processes', async () => {
            const processNamesData = {
                value: [
                    { Name: 'Process1' },
                    { Name: 'Process2' }
                ]
            };
            mockRestService.get.mockResolvedValue(mockResponse(processNamesData));

            const result = await processService.getAllNames(true);
            
            expect(result).toEqual(['Process1', 'Process2']);
            expect(mockRestService.get).toHaveBeenCalledWith(
                "/Processes?$select=Name&$filter=startswith(Name,'}') eq false and startswith(Name,'{') eq false"
            );
        });

        test('should create process', async () => {
            mockRestService.post.mockResolvedValue(mockResponse({}));

            const result = await processService.create(mockProcess);
            
            expect(result).toBeDefined();
            expect(mockRestService.post).toHaveBeenCalledWith("/Processes", mockProcess.body);
        });

        test('should update process', async () => {
            mockRestService.patch.mockResolvedValue(mockResponse({}));

            const result = await processService.update(mockProcess);
            
            expect(result).toBeDefined();
            expect(mockRestService.patch).toHaveBeenCalledWith("/Processes('TestProcess')", mockProcess.body);
        });

        test('should delete process', async () => {
            mockRestService.delete.mockResolvedValue(mockResponse({}));

            const result = await processService.delete('TestProcess');
            
            expect(result).toBeDefined();
            expect(mockRestService.delete).toHaveBeenCalledWith("/Processes('TestProcess')");
        });

        test('should check if process exists', async () => {
            mockRestService.get.mockResolvedValue(mockResponse(mockProcess));

            const result = await processService.exists('TestProcess');
            
            expect(result).toBe(true);
        });

        test('should return false when process does not exist', async () => {
            const error = new TM1RestException('Process not found', 404);
            error.statusCode = 404; // Set the statusCode property that ProcessService checks
            mockRestService.get.mockRejectedValue(error);

            const result = await processService.exists('NonExistentProcess');
            
            expect(result).toBe(false);
        });

        test('should throw error for non-404 errors in exists check', async () => {
            const error = new TM1RestException('Server error', 500);
            error.statusCode = 500; // Set the statusCode property that ProcessService checks
            mockRestService.get.mockRejectedValue(error);

            await expect(processService.exists('TestProcess')).rejects.toThrow('Server error');
        });
    });

    describe('Process Execution Operations', () => {
        test('should execute process without parameters', async () => {
            mockRestService.post.mockResolvedValue(mockResponse({}));

            const result = await processService.execute('TestProcess');
            
            expect(result).toBeDefined();
            expect(mockRestService.post).toHaveBeenCalledWith(
                "/Processes('TestProcess')/tm1.Execute",
                "{}"
            );
        });

        test('should execute process with parameters', async () => {
            mockRestService.post.mockResolvedValue(mockResponse({}));

            const parameters = {
                pParam1: 'Value1',
                pParam2: 42,
                pParam3: true
            };

            const result = await processService.execute('TestProcess', parameters);
            
            expect(result).toBeDefined();
            expect(mockRestService.post).toHaveBeenCalledWith(
                "/Processes('TestProcess')/tm1.Execute",
                JSON.stringify({
                    Parameters: [
                        { Name: 'pParam1', Value: 'Value1' },
                        { Name: 'pParam2', Value: 42 },
                        { Name: 'pParam3', Value: true }
                    ]
                })
            );
        });

        test('should execute process with return', async () => {
            const returnData = {
                ProcessExecuteStatusCode: 'CompletedSuccessfully',
                ErrorLogFile: null
            };
            mockRestService.post.mockResolvedValue(mockResponse(returnData));

            const result = await processService.executeWithReturn('TestProcess');
            
            expect(result).toEqual(mockResponse(returnData));
            expect(mockRestService.post).toHaveBeenCalledWith(
                "/Processes('TestProcess')/tm1.ExecuteWithReturn?$expand=*",
                "{}",
                {}
            );
        });

        test('should execute process with return and parameters', async () => {
            const returnData = {
                ProcessExecuteStatusCode: 'CompletedSuccessfully',
                Parameters: [{ Name: 'pParam1', Value: 'Result1' }]
            };
            mockRestService.post.mockResolvedValue(mockResponse(returnData));

            const parameters = { pParam1: 'Input1' };
            const result = await processService.executeWithReturn('TestProcess', parameters);
            
            expect(result).toEqual(mockResponse(returnData));
            expect(mockRestService.post).toHaveBeenCalledWith(
                "/Processes('TestProcess')/tm1.ExecuteWithReturn?$expand=*",
                JSON.stringify({
                    Parameters: [{ Name: 'pParam1', Value: 'Input1' }]
                }),
                {}
            );
        });

        test('should execute process with return and timeout', async () => {
            const returnData = { ProcessExecuteStatusCode: 'CompletedSuccessfully' };
            mockRestService.post.mockResolvedValue(mockResponse(returnData));

            const result = await processService.executeWithReturn('TestProcess', {}, 30);
            
            expect(result).toEqual(mockResponse(returnData));
            expect(mockRestService.post).toHaveBeenCalledWith(
                "/Processes('TestProcess')/tm1.ExecuteWithReturn?$expand=*",
                "{}",
                { timeout: 30000 }
            );
        });

        test('should execute process with return data extraction', async () => {
            const returnData = {
                ProcessExecuteStatusCode: 'CompletedSuccessfully',
                Parameters: [{ Name: 'result', Value: 'success' }]
            };
            mockRestService.post.mockResolvedValue(mockResponse(returnData));

            const result = await processService.executeProcessWithReturn('TestProcess');
            
            expect(result).toEqual(returnData);
        });

        test('should compile process', async () => {
            mockRestService.post.mockResolvedValue(mockResponse({}));

            const result = await processService.compile('TestProcess');
            
            expect(result).toBeDefined();
            expect(mockRestService.post).toHaveBeenCalledWith("/Processes('TestProcess')/tm1.Compile", '{}');
        });
    });

    describe('TI Code Execution Operations', () => {
        test('should execute TI code with all sections', async () => {
            mockRestService.post.mockResolvedValue(mockResponse({}));

            const prologLines = ['sMessage = "Starting";', 'WriteToMessageLog(INFO, sMessage);'];
            const epilogLines = ['sMessage = "Completed";', 'WriteToMessageLog(INFO, sMessage);'];

            const result = await processService.executeTiCode(prologLines, epilogLines);

            expect(result).toBeDefined();
            // Should create temp process, execute, then delete
            expect(mockRestService.post).toHaveBeenCalledTimes(2); // create + execute
            expect(mockRestService.delete).toHaveBeenCalledTimes(1); // cleanup

            // First call: create temp process (name starts with }TM1py)
            const createCall = mockRestService.post.mock.calls[0];
            expect(createCall[0]).toBe('/Processes');

            // Second call: executeWithReturn
            const executeCall = mockRestService.post.mock.calls[1];
            expect(executeCall[0]).toMatch(/\/Processes\('.*'\)\/tm1\.ExecuteWithReturn\?\$expand=\*/);
        });

        test('should execute TI code with parameters', async () => {
            mockRestService.post.mockResolvedValue(mockResponse({}));
            mockRestService.delete.mockResolvedValue(mockResponse({}));

            const prologLines = ['WriteToMessageLog(INFO, pMessage);'];
            const parameters = { pMessage: 'Test Message', pValue: 123 };

            await processService.executeTiCode(prologLines, undefined, parameters);

            // Execute call should include parameters
            const executeCall = mockRestService.post.mock.calls[1];
            const executeBody = JSON.parse(executeCall[1]);
            expect(executeBody.Parameters).toEqual([
                { Name: 'pMessage', Value: 'Test Message' },
                { Name: 'pValue', Value: 123 }
            ]);
        });

        test('should cleanup temp process even on execution failure', async () => {
            mockRestService.post
                .mockResolvedValueOnce(mockResponse({})) // create succeeds
                .mockRejectedValueOnce(new Error('Execution failed')); // execute fails
            mockRestService.delete.mockResolvedValue(mockResponse({}));

            await expect(processService.executeTiCode(['sTest = "fail";'])).rejects.toThrow('Execution failed');

            // Delete should still be called for cleanup
            expect(mockRestService.delete).toHaveBeenCalledTimes(1);
        });

        test('should return execution status from executeTiCode', async () => {
            const executionResult = {
                ProcessExecuteStatusCode: 'CompletedSuccessfully',
                ErrorLogFile: null
            };
            mockRestService.post
                .mockResolvedValueOnce(mockResponse({})) // create
                .mockResolvedValueOnce(mockResponse(executionResult)); // executeWithReturn
            mockRestService.delete.mockResolvedValue(mockResponse({}));

            const result = await processService.executeTiCode(['sTest = "hello";']);

            expect(result).toEqual(executionResult);
        });

        test('should surface failed TI execution status', async () => {
            const failedResult = {
                ProcessExecuteStatusCode: 'Aborted',
                ErrorLogFile: { Filename: 'TM1ProcessError_12345.log' }
            };
            mockRestService.post
                .mockResolvedValueOnce(mockResponse({})) // create
                .mockResolvedValueOnce(mockResponse(failedResult)); // executeWithReturn
            mockRestService.delete.mockResolvedValue(mockResponse({}));

            const result = await processService.executeTiCode(['InvalidFunction();']);

            expect(result.ProcessExecuteStatusCode).toBe('Aborted');
            expect(result.ErrorLogFile).toBeDefined();
        });

        test('should execute TI code with prolog only', async () => {
            mockRestService.post.mockResolvedValue(mockResponse({}));
            mockRestService.delete.mockResolvedValue(mockResponse({}));

            const prologLines = ['sTest = "Prolog only";'];

            const result = await processService.executeTiCode(prologLines);

            expect(result).toBeDefined();
            expect(mockRestService.post).toHaveBeenCalledTimes(2);
            expect(mockRestService.delete).toHaveBeenCalledTimes(1);
        });

        test('should compile single TI statement', async () => {
            const compilationResult = {
                IsValid: true,
                Errors: []
            };
            mockRestService.post.mockResolvedValue(mockResponse(compilationResult));

            const result = await processService.compileSingleStatement('WriteToMessageLog(INFO, "Test");');
            
            expect(result).toEqual(mockResponse(compilationResult));
            expect(mockRestService.post).toHaveBeenCalledWith(
                "/CompileStatement",
                JSON.stringify({
                    Statement: 'WriteToMessageLog(INFO, "Test");'
                })
            );
        });
    });

    describe('Process Search Operations', () => {
        test('should search string in process code using server-side OData filter', async () => {
            const processData = {
                value: [
                    { Name: 'Process1' },
                    { Name: 'Process2' }
                ]
            };
            mockRestService.get.mockResolvedValue(mockResponse(processData));

            const result = await processService.searchStringInCode('WriteToMessageLog');

            expect(result).toEqual(['Process1', 'Process2']);
            const url = mockRestService.get.mock.calls[0][0];
            expect(url).toContain('/Processes?$select=Name&$filter=');
            expect(url).toContain("contains(tolower(replace(PrologProcedure,' ',''))");
            expect(url).toContain("contains(tolower(replace(MetadataProcedure,' ',''))");
            expect(url).toContain("contains(tolower(replace(DataProcedure,' ',''))");
            expect(url).toContain("contains(tolower(replace(EpilogProcedure,' ',''))");
            expect(url).toContain("'writetomessagelog'");
        });

        test('should search string in process code excluding control processes', async () => {
            const processData = {
                value: [{ Name: 'Process1' }]
            };
            mockRestService.get.mockResolvedValue(mockResponse(processData));

            const result = await processService.searchStringInCode('WriteToMessageLog', true);

            expect(result).toEqual(['Process1']);
            const url = mockRestService.get.mock.calls[0][0];
            expect(url).toContain("and (startswith(Name, '}') eq false and startswith(Name, '{') eq false)");
        });

        test('should escape single quotes in search string', async () => {
            mockRestService.get.mockResolvedValue(mockResponse({ value: [] }));

            await processService.searchStringInCode("it's a test");

            const url = mockRestService.get.mock.calls[0][0];
            expect(url).toContain("it''satest");
        });

        test('should search string in process names', async () => {
            const processNamesData = {
                value: [
                    { Name: 'DataLoad_Sales' },
                    { Name: 'DataLoad_Budget' },
                    { Name: 'SecuritySetup' }
                ]
            };
            mockRestService.get.mockResolvedValue(mockResponse(processNamesData));

            const result = await processService.searchStringInName('DataLoad');
            
            expect(result).toEqual(['DataLoad_Sales', 'DataLoad_Budget', 'SecuritySetup']);
            expect(mockRestService.get).toHaveBeenCalledWith(
                "/Processes?$select=Name&$filter=indexof(tolower(Name), 'dataload') ge 0"
            );
        });

        test('should search string in process names excluding control processes', async () => {
            const processNamesData = {
                value: [
                    { Name: 'DataLoad_Sales' }
                ]
            };
            mockRestService.get.mockResolvedValue(mockResponse(processNamesData));

            const result = await processService.searchStringInName('DataLoad', true);
            
            expect(result).toEqual(['DataLoad_Sales']);
            expect(mockRestService.get).toHaveBeenCalledWith(
                "/Processes?$select=Name&$filter=indexof(tolower(Name), 'dataload') ge 0 and not startswith(Name, '}') and not startswith(Name, '{')"
            );
        });
    });

    describe('Process Debug Operations', () => {
        test('should get process debug breakpoints', async () => {
            const breakpointsData = {
                value: [
                    { LineNumber: 5, Procedure: 'Prolog' },
                    { LineNumber: 10, Procedure: 'Epilog' }
                ]
            };
            mockRestService.get.mockResolvedValue(mockResponse(breakpointsData));

            const result = await processService.debugGetBreakpoints('debug-123');

            expect(result).toHaveLength(2);
            expect(ProcessDebugBreakpoint.fromDict).toHaveBeenCalledTimes(2);
            expect(mockRestService.get).toHaveBeenCalledWith("/ProcessDebugContexts('debug-123')/Breakpoints");
        });

        test('should add process debug breakpoint (delegates to debugAddBreakpoints)', async () => {
            mockRestService.post.mockResolvedValue(mockResponse({}));

            const result = await processService.debugAddBreakpoint(
                'debug-123',
                mockProcessDebugBreakpoint
            );

            expect(result).toBeDefined();
            expect(mockRestService.post).toHaveBeenCalledWith(
                "/ProcessDebugContexts('debug-123')/Breakpoints",
                JSON.stringify([mockProcessDebugBreakpoint.bodyAsDict])
            );
        });

        test('should delete process debug breakpoint', async () => {
            mockRestService.delete.mockResolvedValue(mockResponse({}));

            const result = await processService.debugRemoveBreakpoint('debug-123', 5);

            expect(result).toBeDefined();
            expect(mockRestService.delete).toHaveBeenCalledWith("/ProcessDebugContexts('debug-123')/Breakpoints('5')");
        });

        test('should debug step over', async () => {
            const debugData = { ID: 'debug-123', CallStack: [] };
            mockRestService.post.mockResolvedValue(mockResponse({}));
            mockRestService.get.mockResolvedValue(mockResponse(debugData));

            const result = await processService.debugStepOver('debug-123');

            expect(mockRestService.post).toHaveBeenCalledWith(
                "/ProcessDebugContexts('debug-123')/tm1.StepOver",
                '{}'
            );
            expect(result).toEqual(debugData);
        });

        test('should debug step in', async () => {
            const debugData = { ID: 'debug-123', CallStack: [] };
            mockRestService.post.mockResolvedValue(mockResponse({}));
            mockRestService.get.mockResolvedValue(mockResponse(debugData));

            const result = await processService.debugStepIn('debug-123');

            expect(mockRestService.post).toHaveBeenCalledWith(
                "/ProcessDebugContexts('debug-123')/tm1.StepIn",
                '{}'
            );
            expect(result).toEqual(debugData);
        });

        test('should debug step out', async () => {
            const debugData = { ID: 'debug-123', CallStack: [] };
            mockRestService.post.mockResolvedValue(mockResponse({}));
            mockRestService.get.mockResolvedValue(mockResponse(debugData));

            const result = await processService.debugStepOut('debug-123');

            expect(mockRestService.post).toHaveBeenCalledWith(
                "/ProcessDebugContexts('debug-123')/tm1.StepOut",
                '{}'
            );
            expect(result).toEqual(debugData);
        });

        test('should debug continue', async () => {
            const debugData = { ID: 'debug-123', CallStack: [] };
            mockRestService.post.mockResolvedValue(mockResponse({}));
            mockRestService.get.mockResolvedValue(mockResponse(debugData));

            const result = await processService.debugContinue('debug-123');

            expect(mockRestService.post).toHaveBeenCalledWith(
                "/ProcessDebugContexts('debug-123')/tm1.Continue",
                '{}'
            );
            expect(result).toEqual(debugData);
        });
    });

    describe('Error Log Operations', () => {
        test('should get error log file content', async () => {
            const logContent = '2025-01-15 10:00:00 ERROR Process failed at line 5';
            mockRestService.get.mockResolvedValue(mockResponse(logContent));

            const result = await processService.getErrorLogFileContent('TestProcess_20250115.log');
            
            expect(result).toBe(logContent);
            expect(mockRestService.get).toHaveBeenCalledWith("/ErrorLogFiles('TestProcess_20250115.log')/Content");
        });

        test('should get error log filenames', async () => {
            const filesData = {
                value: [
                    { Filename: 'Process1_20250115.log' },
                    { Filename: 'Process2_20250114.log' },
                    { Filename: 'Process3_20250113.log' }
                ]
            };
            mockRestService.get.mockResolvedValue(mockResponse(filesData));

            const result = await processService.getErrorLogFilenames();

            expect(result).toEqual(['Process1_20250115.log', 'Process2_20250114.log', 'Process3_20250113.log']);
            expect(mockRestService.get).toHaveBeenCalledWith(
                "/ErrorLogFiles?select=Filename&$filter=contains(tolower(Filename), tolower(''))"
            );
        });

        test('should get error log filenames with top limit', async () => {
            const filesData = {
                value: [
                    { Filename: 'Process1_20250115.log' },
                    { Filename: 'Process2_20250114.log' }
                ]
            };
            mockRestService.get.mockResolvedValue(mockResponse(filesData));

            const result = await processService.getErrorLogFilenames(undefined, 2);

            expect(result).toEqual(['Process1_20250115.log', 'Process2_20250114.log']);
            expect(mockRestService.get).toHaveBeenCalledWith(
                "/ErrorLogFiles?select=Filename&$filter=contains(tolower(Filename), tolower(''))&$top=2"
            );
        });

        test('should delete error log file', async () => {
            mockRestService.delete.mockResolvedValue(mockResponse({}));

            const result = await processService.deleteErrorLogFile('TestProcess_20250115.log');

            expect(result).toBeDefined();
            expect(mockRestService.delete).toHaveBeenCalledWith("/ErrorLogFiles('TestProcess_20250115.log')");
        });

        test('should get last message from message log', async () => {
            const result = await processService.getLastMessageFromMessagelog('TestProcess');
            
            // This method currently returns empty string as per implementation
            expect(result).toBe('');
        });
    });

    describe('Advanced Process Operations', () => {
        test('should update or create process - update existing', async () => {
            jest.spyOn(processService, 'exists').mockResolvedValue(true);
            jest.spyOn(processService, 'update').mockResolvedValue(mockResponse({}));

            const result = await processService.updateOrCreate(mockProcess);
            
            expect(processService.exists).toHaveBeenCalledWith('TestProcess');
            expect(processService.update).toHaveBeenCalledWith(mockProcess);
            expect(result).toBeDefined();
        });

        test('should update or create process - create new', async () => {
            jest.spyOn(processService, 'exists').mockResolvedValue(false);
            jest.spyOn(processService, 'create').mockResolvedValue(mockResponse({}));

            const result = await processService.updateOrCreate(mockProcess);
            
            expect(processService.exists).toHaveBeenCalledWith('TestProcess');
            expect(processService.create).toHaveBeenCalledWith(mockProcess);
            expect(result).toBeDefined();
        });

        test('should clone process with data', async () => {
            const sourceProcess = { ...mockProcess, name: 'SourceProcess' };
            jest.spyOn(processService, 'get').mockResolvedValue(sourceProcess as any);
            jest.spyOn(processService, 'create').mockResolvedValue(mockResponse({}));

            const result = await processService.clone('SourceProcess', 'TargetProcess', true);
            
            expect(processService.get).toHaveBeenCalledWith('SourceProcess');
            expect(processService.create).toHaveBeenCalledWith(
                expect.objectContaining({ name: 'TargetProcess' })
            );
            expect(result).toBeDefined();
        });

        test('should clone process without data', async () => {
            const sourceProcess = { ...mockProcess, name: 'SourceProcess' };
            jest.spyOn(processService, 'get').mockResolvedValue(sourceProcess as any);
            jest.spyOn(processService, 'create').mockResolvedValue(mockResponse({}));

            const result = await processService.clone('SourceProcess', 'TargetProcess', false);
            
            expect(processService.get).toHaveBeenCalledWith('SourceProcess');
            expect(processService.create).toHaveBeenCalledWith(
                expect.objectContaining({ name: 'TargetProcess' })
            );
            expect(result).toBeDefined();
        });
    });

    describe('Boolean TI Expression Evaluation', () => {
        test('should evaluate boolean TI expression - true result', async () => {
            mockRestService.post.mockResolvedValue(
                mockResponse({ ProcessExecuteStatusCode: 'CompletedSuccessfully' })
            );

            const result = await processService.evaluateBooleanTiExpression('1 = 1');

            expect(result).toBe(true);
            expect(mockRestService.post).toHaveBeenCalledTimes(1);
            expect(mockRestService.post).toHaveBeenCalledWith(
                '/ExecuteProcessWithReturn?$expand=*',
                expect.stringContaining('ProcessQuit')
            );
        });

        test('should send enriched Process payload matching tm1py parity', async () => {
            mockRestService.post.mockResolvedValue(
                mockResponse({ ProcessExecuteStatusCode: 'CompletedSuccessfully' })
            );

            await processService.evaluateBooleanTiExpression('1 = 1');

            const callPayload = JSON.parse(mockRestService.post.mock.calls[0][1]);
            expect(callPayload.Process).toEqual(
                expect.objectContaining({
                    Name: '',
                    MetadataProcedure: '',
                    DataProcedure: '',
                    EpilogProcedure: '',
                    HasSecurityAccess: false,
                    Parameters: []
                })
            );
            expect(callPayload.Process.PrologProcedure).toContain('ProcessQuit');
        });

        test('should evaluate boolean TI expression - false result', async () => {
            mockRestService.post.mockResolvedValue(
                mockResponse({ ProcessExecuteStatusCode: 'QuitCalled' })
            );

            const result = await processService.evaluateBooleanTiExpression('1 = 0');

            expect(result).toBe(false);
        });

        test('should handle unexpected status from evaluation', async () => {
            mockRestService.post.mockResolvedValue(
                mockResponse({ ProcessExecuteStatusCode: 'Aborted' })
            );

            await expect(processService.evaluateBooleanTiExpression('invalid expression'))
                .rejects.toThrow("Unexpected TI return status: 'Aborted'");
        });
    });

    describe('Error Handling', () => {
        test('should handle process retrieval errors', async () => {
            const error = new Error('Process not found');
            mockRestService.get.mockRejectedValue(error);

            await expect(processService.get('NonExistentProcess')).rejects.toThrow('Process not found');
        });

        test('should handle process creation errors', async () => {
            const error = new Error('Process creation failed');
            mockRestService.post.mockRejectedValue(error);

            await expect(processService.create(mockProcess)).rejects.toThrow('Process creation failed');
        });

        test('should handle process execution errors', async () => {
            const error = new Error('Process execution failed');
            mockRestService.post.mockRejectedValue(error);

            await expect(processService.execute('TestProcess')).rejects.toThrow('Process execution failed');
        });

        test('should handle compilation errors', async () => {
            const error = new Error('Compilation failed');
            mockRestService.post.mockRejectedValue(error);

            await expect(processService.compile('TestProcess')).rejects.toThrow('Compilation failed');
        });

        test('should handle debug operation errors', async () => {
            const error = new Error('Debug operation failed');
            mockRestService.post.mockRejectedValue(error);

            await expect(processService.debugStepOver('TestProcess')).rejects.toThrow('Debug operation failed');
        });
    });

    describe('Edge Cases and Special Scenarios', () => {
        test('should handle empty process lists', async () => {
            mockRestService.get.mockResolvedValue(mockResponse({ value: [] }));

            const processes = await processService.getAll();
            const processNames = await processService.getAllNames();
            
            expect(processes).toEqual([]);
            expect(processNames).toEqual([]);
        });

        test('should handle processes with special characters in names', async () => {
            const specialName = "Process's & \"Special\" Name";
            mockRestService.get.mockResolvedValue(mockResponse({ Name: specialName }));

            await processService.get(specialName);
            
            // The formatUrl method encodes special characters
            expect(mockRestService.get).toHaveBeenCalledWith(
                expect.stringContaining("/Processes('Process's%20%26%20%22Special%22%20Name')")
            );
        });

        test('should handle empty parameter objects', async () => {
            mockRestService.post.mockResolvedValue(mockResponse({}));

            await processService.execute('TestProcess', {});
            
            expect(mockRestService.post).toHaveBeenCalledWith(
                "/Processes('TestProcess')/tm1.Execute",
                "{}"
            );
        });

        test('should handle null/undefined parameters gracefully', async () => {
            mockRestService.post.mockResolvedValue(mockResponse({}));

            await processService.execute('TestProcess', undefined);
            await processService.executeWithReturn('TestProcess', null as any);
            
            expect(mockRestService.post).toHaveBeenCalledTimes(2);
        });

        test('should handle search with no matches', async () => {
            mockRestService.get.mockResolvedValue(mockResponse({ value: [] }));

            const result = await processService.searchStringInCode('NonExistentString');

            expect(result).toEqual([]);
        });

        test('should handle large result sets from searchStringInCode', async () => {
            const largeResult = Array.from({ length: 1000 }, (_, i) => ({ Name: `Process${i}` }));
            mockRestService.get.mockResolvedValue(mockResponse({ value: largeResult }));

            const result = await processService.searchStringInCode('WriteToMessageLog');

            expect(result).toHaveLength(1000);
        });
    });

    describe('Debug Session Methods', () => {
        test('debugProcess should POST to tm1.Debug with expand and return data', async () => {
            const debugResponse = {
                ID: 'ctx-001',
                Breakpoints: [],
                Thread: { ID: 'thread-1' },
                CallStack: [{ Variables: [], Process: { Name: 'TestProcess' } }]
            };
            mockRestService.post.mockResolvedValue(mockResponse(debugResponse));

            const result = await processService.debugProcess('TestProcess');

            expect(mockRestService.post).toHaveBeenCalledWith(
                "/Processes('TestProcess')/tm1.Debug?$expand=Breakpoints," +
                "Thread,CallStack($expand=Variables,Process($select=Name))",
                '{}',
                {}
            );
            expect(result).toEqual(debugResponse);
        });

        test('debugProcess should include parameters when provided', async () => {
            const debugResponse = { ID: 'ctx-002', Breakpoints: [], CallStack: [] };
            mockRestService.post.mockResolvedValue(mockResponse(debugResponse));

            const params = { pRegion: 'US', pYear: 2025 };
            await processService.debugProcess('TestProcess', undefined, params);

            const callBody = JSON.parse(mockRestService.post.mock.calls[0][1]);
            expect(callBody.Parameters).toEqual([
                { Name: 'pRegion', Value: 'US' },
                { Name: 'pYear', Value: 2025 }
            ]);
        });

        test('debugProcess should pass timeout config when provided', async () => {
            const debugResponse = { ID: 'ctx-003', Breakpoints: [], CallStack: [] };
            mockRestService.post.mockResolvedValue(mockResponse(debugResponse));

            await processService.debugProcess('TestProcess', 60);

            expect(mockRestService.post).toHaveBeenCalledWith(
                expect.any(String),
                expect.any(String),
                { timeout: 60000 }
            );
        });

        test('debugAddBreakpoints should POST breakpoints array to Breakpoints endpoint', async () => {
            mockRestService.post.mockResolvedValue(mockResponse({}));

            const bp1 = { bodyAsDict: { LineNumber: 1, Procedure: 'Prolog' } } as any;
            const bp2 = { bodyAsDict: { LineNumber: 10, Procedure: 'Epilog' } } as any;

            await processService.debugAddBreakpoints('ctx-001', [bp1, bp2]);

            expect(mockRestService.post).toHaveBeenCalledWith(
                "/ProcessDebugContexts('ctx-001')/Breakpoints",
                JSON.stringify([
                    { LineNumber: 1, Procedure: 'Prolog' },
                    { LineNumber: 10, Procedure: 'Epilog' }
                ])
            );
        });

        test('debugUpdateBreakpoint should PATCH to Breakpoints(id)', async () => {
            mockRestService.patch.mockResolvedValue(mockResponse({}));

            const bp = {
                breakpointId: 7,
                body: JSON.stringify({ ID: 7, Enabled: false })
            } as any;

            await processService.debugUpdateBreakpoint('ctx-001', bp);

            expect(mockRestService.patch).toHaveBeenCalledWith(
                "/ProcessDebugContexts('ctx-001')/Breakpoints('7')",
                bp.body
            );
        });
    });

    describe('Debug Inspection Methods', () => {
        test('debugGetVariableValues should return variables as key-value map', async () => {
            const contextData = {
                CallStack: [{
                    Variables: [
                        { Name: 'sRegion', Value: 'US' },
                        { Name: 'nAmount', Value: '100' }
                    ]
                }]
            };
            mockRestService.get.mockResolvedValue(mockResponse(contextData));

            const result = await processService.debugGetVariableValues('ctx-001');

            expect(mockRestService.get).toHaveBeenCalledWith(
                "/ProcessDebugContexts('ctx-001')?$expand=CallStack($expand=Variables)"
            );
            expect(result).toEqual({ sRegion: 'US', nAmount: '100' });
        });

        test('debugGetVariableValues should return empty object when call stack is empty', async () => {
            mockRestService.get.mockResolvedValue(mockResponse({ CallStack: [] }));

            const result = await processService.debugGetVariableValues('ctx-001');

            expect(result).toEqual({});
        });

        test('debugGetSingleVariableValue should return value for given variable', async () => {
            const contextData = {
                CallStack: [{
                    Variables: [{ Value: 'Europe' }]
                }]
            };
            mockRestService.get.mockResolvedValue(mockResponse(contextData));

            const result = await processService.debugGetSingleVariableValue('ctx-001', 'sRegion');

            expect(mockRestService.get).toHaveBeenCalledWith(
                "/ProcessDebugContexts('ctx-001')?$expand=" +
                "CallStack($expand=Variables($filter=tolower(Name) eq 'sregion';$select=Value))"
            );
            expect(result).toBe('Europe');
        });

        test('debugGetSingleVariableValue should throw when variable not found', async () => {
            mockRestService.get.mockResolvedValue(mockResponse({ CallStack: [] }));

            await expect(
                processService.debugGetSingleVariableValue('ctx-001', 'nMissing')
            ).rejects.toThrow("'nMissing' not found in collection");
        });

        test('debugGetProcessProcedure should return current procedure name', async () => {
            const contextData = { CallStack: [{ Procedure: 'Prolog' }] };
            mockRestService.get.mockResolvedValue(mockResponse(contextData));

            const result = await processService.debugGetProcessProcedure('ctx-001');

            expect(mockRestService.get).toHaveBeenCalledWith(
                "/ProcessDebugContexts('ctx-001')?$expand=CallStack($select=Procedure)"
            );
            expect(result).toBe('Prolog');
        });

        test('debugGetProcessLineNumber should return current line number', async () => {
            const contextData = { CallStack: [{ LineNumber: 42 }] };
            mockRestService.get.mockResolvedValue(mockResponse(contextData));

            const result = await processService.debugGetProcessLineNumber('ctx-001');

            expect(mockRestService.get).toHaveBeenCalledWith(
                "/ProcessDebugContexts('ctx-001')?$expand=CallStack($select=LineNumber)"
            );
            expect(result).toBe(42);
        });

        test('debugGetRecordNumber should return current record number', async () => {
            const contextData = { CallStack: [{ RecordNumber: 15 }] };
            mockRestService.get.mockResolvedValue(mockResponse(contextData));

            const result = await processService.debugGetRecordNumber('ctx-001');

            expect(mockRestService.get).toHaveBeenCalledWith(
                "/ProcessDebugContexts('ctx-001')?$expand=CallStack($select=RecordNumber)"
            );
            expect(result).toBe(15);
        });

        test('debugGetCurrentBreakpoint should return breakpoint from context', async () => {
            const bpData = {
                '@odata.type': '#ibm.tm1.api.v1.ProcessDebugContextLineBreakpoint',
                ID: 3,
                Enabled: true,
                HitMode: 'BreakAlways',
                Expression: '',
                LineNumber: 5,
                Procedure: 'Prolog',
                ProcessName: 'TestProcess',
                HitCount: 0
            };
            mockRestService.get.mockResolvedValue(mockResponse({ CurrentBreakpoint: bpData }));

            const result = await processService.debugGetCurrentBreakpoint('ctx-001');

            expect(mockRestService.get).toHaveBeenCalledWith(
                "/ProcessDebugContexts('ctx-001')?$expand=CurrentBreakpoint"
            );
            expect(ProcessDebugBreakpoint.fromDict).toHaveBeenCalledWith(bpData);
            expect(result).toEqual(mockProcessDebugBreakpoint);
        });
    });

    describe('Process Error Log Methods', () => {
        test('getProcessErrorLogs should GET ErrorLogs from process and return value array', async () => {
            const logsData = {
                value: [
                    { Timestamp: '2025-01-15T10:00:00Z', Message: 'Error at line 5' },
                    { Timestamp: '2025-01-15T11:00:00Z', Message: 'Error at line 12' }
                ]
            };
            mockRestService.get.mockResolvedValue(mockResponse(logsData));

            const result = await processService.getProcessErrorLogs('TestProcess');

            expect(mockRestService.get).toHaveBeenCalledWith("/Processes('TestProcess')/ErrorLogs");
            expect(result).toEqual(logsData.value);
            expect(result).toHaveLength(2);
        });

        test('getProcessErrorLogs should return empty array when no logs', async () => {
            mockRestService.get.mockResolvedValue(mockResponse({ value: [] }));

            const result = await processService.getProcessErrorLogs('CleanProcess');

            expect(result).toEqual([]);
        });

        test('getLastMessageFromProcessErrorLog should return content of latest log', async () => {
            const logsData = {
                value: [
                    { Timestamp: '2025-01-15T10:00:00Z' },
                    { Timestamp: '2025-01-15T11:00:00Z' }
                ]
            };
            const logContent = 'Error: Variable not defined at line 5';

            // First call: getProcessErrorLogs -> GET ErrorLogs
            // Second call: GET Content of latest log
            mockRestService.get
                .mockResolvedValueOnce(mockResponse(logsData))
                .mockResolvedValueOnce(mockResponse(logContent));

            const result = await processService.getLastMessageFromProcessErrorLog('TestProcess');

            expect(mockRestService.get).toHaveBeenCalledWith("/Processes('TestProcess')/ErrorLogs");
            expect(mockRestService.get).toHaveBeenCalledWith(
                "/Processes('TestProcess')/ErrorLogs('2025-01-15T11%3A00%3A00Z')/Content"
            );
            expect(result).toBe(logContent);
        });

        test('getLastMessageFromProcessErrorLog should return undefined when no logs exist', async () => {
            mockRestService.get.mockResolvedValue(mockResponse({ value: [] }));

            const result = await processService.getLastMessageFromProcessErrorLog('CleanProcess');

            expect(result).toBeUndefined();
        });

        test('searchErrorLogFilenames should GET filenames with filter', async () => {
            const filesData = {
                value: [
                    { Filename: 'TM1ProcessError_TestProcess_20250115.log' },
                    { Filename: 'TM1ProcessError_TestProcess_20250116.log' }
                ]
            };
            mockRestService.get.mockResolvedValue(mockResponse(filesData));

            const result = await processService.searchErrorLogFilenames('TestProcess');

            expect(mockRestService.get).toHaveBeenCalledWith(
                "/ErrorLogFiles?select=Filename&$filter=contains(tolower(Filename), tolower('TestProcess'))"
            );
            expect(result).toEqual([
                'TM1ProcessError_TestProcess_20250115.log',
                'TM1ProcessError_TestProcess_20250116.log'
            ]);
        });

        test('searchErrorLogFilenames should append $top when top > 0', async () => {
            mockRestService.get.mockResolvedValue(mockResponse({ value: [{ Filename: 'file.log' }] }));

            await processService.searchErrorLogFilenames('Test', 5);

            expect(mockRestService.get).toHaveBeenCalledWith(
                expect.stringContaining('&$top=5')
            );
        });

        test('searchErrorLogFilenames should append $orderby desc when descending', async () => {
            mockRestService.get.mockResolvedValue(mockResponse({ value: [] }));

            await processService.searchErrorLogFilenames('Test', 0, true);

            expect(mockRestService.get).toHaveBeenCalledWith(
                expect.stringContaining('&$orderby=Filename desc')
            );
        });

        test('searchErrorLogFilenames should combine top and descending', async () => {
            mockRestService.get.mockResolvedValue(mockResponse({ value: [] }));

            await processService.searchErrorLogFilenames('Test', 3, true);

            const url = mockRestService.get.mock.calls[0][0];
            expect(url).toContain('&$top=3');
            expect(url).toContain('&$orderby=Filename desc');
        });
    });

    describe('Integration Patterns', () => {
        test('should support process lifecycle management', async () => {
            mockRestService.post.mockResolvedValue(mockResponse({}));
            mockRestService.patch.mockResolvedValue(mockResponse({}));
            mockRestService.delete.mockResolvedValue(mockResponse({}));
            jest.spyOn(processService, 'exists').mockResolvedValue(true);

            // Create, execute, update, delete workflow
            await processService.create(mockProcess);
            await processService.execute('TestProcess');
            await processService.update(mockProcess);
            await processService.delete('TestProcess');

            expect(mockRestService.post).toHaveBeenCalledTimes(2); // create + execute
            expect(mockRestService.patch).toHaveBeenCalledTimes(1);
            expect(mockRestService.delete).toHaveBeenCalledTimes(1);
        });

        test('should support debug workflow management', async () => {
            const debugData = { ID: 'debug-123', CallStack: [] };
            mockRestService.post.mockResolvedValue(mockResponse({}));
            mockRestService.get.mockResolvedValue(mockResponse(debugData));
            mockRestService.delete.mockResolvedValue(mockResponse({}));

            // Debug workflow: set breakpoint, run debug commands, remove breakpoint
            await processService.debugAddBreakpoint('debug-123', mockProcessDebugBreakpoint);
            await processService.debugStepOver('debug-123');
            await processService.debugContinue('debug-123');
            await processService.debugRemoveBreakpoint('debug-123', 5);

            expect(mockRestService.post).toHaveBeenCalledTimes(3);
            expect(mockRestService.delete).toHaveBeenCalledTimes(1);
        });

        test('should support comprehensive process analysis', async () => {
            mockRestService.get.mockResolvedValue(mockResponse({ value: [] }));

            // Analysis workflow: search code, search names, get error logs
            await processService.searchStringInCode('WriteToMessageLog');
            await processService.searchStringInName('Test');
            await processService.getErrorLogFilenames();

            expect(mockRestService.get).toHaveBeenCalledTimes(3);
        });
    });
});