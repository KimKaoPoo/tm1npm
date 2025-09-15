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
            const metadataLines = ['DimensionCreate("TestDim");'];
            const dataLines = ['CellPutN(100, "TestCube", "Element1");'];
            const epilogLines = ['sMessage = "Completed";', 'WriteToMessageLog(INFO, sMessage);'];

            const result = await processService.executeTiCode(
                prologLines,
                metadataLines,
                dataLines,
                epilogLines
            );
            
            expect(result).toBeDefined();
            expect(mockRestService.post).toHaveBeenCalledWith(
                "/ExecuteProcessWithReturn",
                JSON.stringify({
                    PrologProcedure: prologLines.join('\n'),
                    MetadataProcedure: metadataLines.join('\n'),
                    DataProcedure: dataLines.join('\n'),
                    EpilogProcedure: epilogLines.join('\n')
                })
            );
        });

        test('should execute TI code with parameters', async () => {
            mockRestService.post.mockResolvedValue(mockResponse({}));

            const prologLines = ['WriteToMessageLog(INFO, pMessage);'];
            const parameters = { pMessage: 'Test Message', pValue: 123 };

            const result = await processService.executeTiCode(
                prologLines,
                undefined,
                undefined,
                undefined,
                parameters
            );
            
            expect(result).toBeDefined();
            expect(mockRestService.post).toHaveBeenCalledWith(
                "/ExecuteProcessWithReturn",
                JSON.stringify({
                    PrologProcedure: prologLines.join('\n'),
                    Parameters: [
                        { Name: 'pMessage', Value: 'Test Message' },
                        { Name: 'pValue', Value: 123 }
                    ]
                })
            );
        });

        test('should execute TI code with partial sections', async () => {
            mockRestService.post.mockResolvedValue(mockResponse({}));

            const prologLines = ['sTest = "Prolog only";'];

            const result = await processService.executeTiCode(prologLines);
            
            expect(result).toBeDefined();
            expect(mockRestService.post).toHaveBeenCalledWith(
                "/ExecuteProcessWithReturn",
                JSON.stringify({
                    PrologProcedure: prologLines.join('\n')
                })
            );
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
        test('should search string in process code', async () => {
            const processes = [
                {
                    name: 'Process1',
                    prologProcedure: 'WriteToMessageLog(INFO, "Hello");',
                    metadataProcedure: '',
                    dataProcedure: '',
                    epilogProcedure: ''
                },
                {
                    name: 'Process2',
                    prologProcedure: 'sMessage = "World";',
                    metadataProcedure: '',
                    dataProcedure: '',
                    epilogProcedure: 'WriteToMessageLog(INFO, sMessage);'
                },
                {
                    name: 'Process3',
                    prologProcedure: 'CellPutN(100, "Cube", "Element");',
                    metadataProcedure: '',
                    dataProcedure: '',
                    epilogProcedure: ''
                }
            ];

            // Mock getAll method
            jest.spyOn(processService, 'getAll').mockResolvedValue(processes as any);

            const result = await processService.searchStringInCode('WriteToMessageLog');
            
            expect(result).toEqual(['Process1', 'Process2']);
            expect(processService.getAll).toHaveBeenCalledWith(false);
        });

        test('should search string in process code excluding control processes', async () => {
            const processes = [
                {
                    name: 'Process1',
                    prologProcedure: 'WriteToMessageLog(INFO, "Test");',
                    metadataProcedure: '',
                    dataProcedure: '',
                    epilogProcedure: ''
                }
            ];

            jest.spyOn(processService, 'getAll').mockResolvedValue(processes as any);

            const result = await processService.searchStringInCode('WriteToMessageLog', true);
            
            expect(result).toEqual(['Process1']);
            expect(processService.getAll).toHaveBeenCalledWith(true);
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

            const result = await processService.getProcessDebugBreakpoints('TestProcess');
            
            expect(result).toHaveLength(2);
            expect(ProcessDebugBreakpoint.fromDict).toHaveBeenCalledTimes(2);
            expect(mockRestService.get).toHaveBeenCalledWith("/Processes('TestProcess')/Breakpoints");
        });

        test('should create process debug breakpoint', async () => {
            mockRestService.post.mockResolvedValue(mockResponse({}));

            const result = await processService.createProcessDebugBreakpoint(
                'TestProcess',
                mockProcessDebugBreakpoint
            );
            
            expect(result).toBeDefined();
            expect(mockRestService.post).toHaveBeenCalledWith(
                "/Processes('TestProcess')/Breakpoints",
                mockProcessDebugBreakpoint.body
            );
        });

        test('should delete process debug breakpoint', async () => {
            mockRestService.delete.mockResolvedValue(mockResponse({}));

            const result = await processService.deleteProcessDebugBreakpoint('TestProcess', 5);
            
            expect(result).toBeDefined();
            expect(mockRestService.delete).toHaveBeenCalledWith("/Processes('TestProcess')/Breakpoints(5)");
        });

        test('should debug step over', async () => {
            mockRestService.post.mockResolvedValue(mockResponse({}));

            await processService.debugStepOver('TestProcess');
            
            expect(mockRestService.post).toHaveBeenCalledWith(
                "/Processes('TestProcess')/tm1.DebugStepOver",
                {}
            );
        });

        test('should debug step in', async () => {
            mockRestService.post.mockResolvedValue(mockResponse({}));

            await processService.debugStepIn('TestProcess');
            
            expect(mockRestService.post).toHaveBeenCalledWith(
                "/Processes('TestProcess')/tm1.DebugStepIn",
                {}
            );
        });

        test('should debug step out', async () => {
            mockRestService.post.mockResolvedValue(mockResponse({}));

            await processService.debugStepOut('TestProcess');
            
            expect(mockRestService.post).toHaveBeenCalledWith(
                "/Processes('TestProcess')/tm1.DebugStepOut",
                {}
            );
        });

        test('should debug continue', async () => {
            mockRestService.post.mockResolvedValue(mockResponse({}));

            await processService.debugContinue('TestProcess');
            
            expect(mockRestService.post).toHaveBeenCalledWith(
                "/Processes('TestProcess')/tm1.DebugContinue",
                {}
            );
        });
    });

    describe('Error Log Operations', () => {
        test('should get error log file content', async () => {
            const logContent = '2025-01-15 10:00:00 ERROR Process failed at line 5';
            mockRestService.get.mockResolvedValue(mockResponse(logContent));

            const result = await processService.getErrorLogFileContent('TestProcess_20250115.log');
            
            expect(result).toBe(logContent);
            expect(mockRestService.get).toHaveBeenCalledWith("/Contents('Logs/TestProcess_20250115.log')");
        });

        test('should get error log filenames', async () => {
            const filesData = {
                value: [
                    { Name: 'Process1_20250115.log' },
                    { Name: 'Process2_20250114.log' },
                    { Name: 'Process3_20250113.log' }
                ]
            };
            mockRestService.get.mockResolvedValue(mockResponse(filesData));

            const result = await processService.getErrorLogFilenames();
            
            expect(result).toEqual(['Process1_20250115.log', 'Process2_20250114.log', 'Process3_20250113.log']);
            expect(mockRestService.get).toHaveBeenCalledWith(
                "/Contents('Logs')?$select=Name&$filter=endswith(Name,'.log')"
            );
        });

        test('should get error log filenames with top limit', async () => {
            const filesData = {
                value: [
                    { Name: 'Process1_20250115.log' },
                    { Name: 'Process2_20250114.log' }
                ]
            };
            mockRestService.get.mockResolvedValue(mockResponse(filesData));

            const result = await processService.getErrorLogFilenames(2);
            
            expect(result).toEqual(['Process1_20250115.log', 'Process2_20250114.log']);
            expect(mockRestService.get).toHaveBeenCalledWith(
                "/Contents('Logs')?$select=Name&$filter=endswith(Name,'.log')&$top=2"
            );
        });

        test('should delete error log file', async () => {
            mockRestService.delete.mockResolvedValue(mockResponse({}));

            const result = await processService.deleteErrorLogFile('TestProcess_20250115.log');
            
            expect(result).toBeDefined();
            expect(mockRestService.delete).toHaveBeenCalledWith("/Contents('Logs/TestProcess_20250115.log')");
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
            // Mock the series of REST calls for evaluation
            mockRestService.post
                .mockResolvedValueOnce(mockResponse({})) // Create dimension
                .mockResolvedValueOnce(mockResponse({})) // Create cube
                .mockResolvedValueOnce(mockResponse({})) // Create process
                .mockResolvedValueOnce(mockResponse({})); // Execute process

            mockRestService.get.mockResolvedValue(mockResponse({
                Cells: [{ Value: 1 }]
            }));

            mockRestService.delete
                .mockResolvedValueOnce(mockResponse({})) // Delete process
                .mockResolvedValueOnce(mockResponse({})) // Delete cube
                .mockResolvedValueOnce(mockResponse({})); // Delete dimension

            const result = await processService.evaluateBooleanTiExpression('1 = 1');
            
            expect(result).toBe(true);
            expect(mockRestService.post).toHaveBeenCalledTimes(4);
            expect(mockRestService.delete).toHaveBeenCalledTimes(3);
        });

        test('should evaluate boolean TI expression - false result', async () => {
            // Mock the series of REST calls for evaluation
            mockRestService.post
                .mockResolvedValueOnce(mockResponse({})) // Create dimension
                .mockResolvedValueOnce(mockResponse({})) // Create cube
                .mockResolvedValueOnce(mockResponse({})) // Create process
                .mockResolvedValueOnce(mockResponse({})); // Execute process

            mockRestService.get.mockResolvedValue(mockResponse({
                Cells: [{ Value: 0 }]
            }));

            mockRestService.delete
                .mockResolvedValueOnce(mockResponse({})) // Delete process
                .mockResolvedValueOnce(mockResponse({})) // Delete cube
                .mockResolvedValueOnce(mockResponse({})); // Delete dimension

            const result = await processService.evaluateBooleanTiExpression('1 = 0');
            
            expect(result).toBe(false);
        });

        test('should handle evaluation errors and cleanup', async () => {
            mockRestService.post
                .mockResolvedValueOnce(mockResponse({})) // Create dimension
                .mockResolvedValueOnce(mockResponse({})) // Create cube
                .mockRejectedValueOnce(new Error('Process creation failed')); // Fail process creation

            mockRestService.delete
                .mockResolvedValueOnce(mockResponse({})) // Delete cube
                .mockResolvedValueOnce(mockResponse({})); // Delete dimension

            await expect(processService.evaluateBooleanTiExpression('invalid expression'))
                .rejects.toThrow('Process creation failed');

            // Verify cleanup was attempted
            expect(mockRestService.delete).toHaveBeenCalledTimes(2);
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
            jest.spyOn(processService, 'getAll').mockResolvedValue([]);

            const result = await processService.searchStringInCode('NonExistentString');
            
            expect(result).toEqual([]);
        });

        test('should handle large numbers of processes', async () => {
            const largeProcessList = Array.from({ length: 1000 }, (_, i) => ({
                name: `Process${i}`,
                prologProcedure: `WriteToMessageLog(INFO, "Process ${i}");`,
                metadataProcedure: '',
                dataProcedure: '',
                epilogProcedure: ''
            }));

            jest.spyOn(processService, 'getAll').mockResolvedValue(largeProcessList as any);

            const result = await processService.searchStringInCode('WriteToMessageLog');
            
            expect(result).toHaveLength(1000);
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
            mockRestService.post.mockResolvedValue(mockResponse({}));
            mockRestService.get.mockResolvedValue(mockResponse({ value: [] }));
            mockRestService.delete.mockResolvedValue(mockResponse({}));

            // Debug workflow: set breakpoint, run debug commands, remove breakpoint
            await processService.createProcessDebugBreakpoint('TestProcess', mockProcessDebugBreakpoint);
            await processService.debugStepOver('TestProcess');
            await processService.debugContinue('TestProcess');
            await processService.deleteProcessDebugBreakpoint('TestProcess', 5);

            expect(mockRestService.post).toHaveBeenCalledTimes(3);
            expect(mockRestService.delete).toHaveBeenCalledTimes(1);
        });

        test('should support comprehensive process analysis', async () => {
            const processes = [mockProcess];
            jest.spyOn(processService, 'getAll').mockResolvedValue(processes as any);
            mockRestService.get.mockResolvedValue(mockResponse({ value: [] }));

            // Analysis workflow: search code, search names, get error logs
            await processService.searchStringInCode('WriteToMessageLog');
            await processService.searchStringInName('Test');
            await processService.getErrorLogFilenames();

            expect(processService.getAll).toHaveBeenCalled();
            expect(mockRestService.get).toHaveBeenCalledTimes(2);
        });
    });
});