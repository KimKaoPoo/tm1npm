/**
 * Unit tests for DebuggerService (Issue #13)
 * Tests debug session management, variable inspection, and process analysis
 */

import { DebuggerService } from '../services/DebuggerService';
import { ProcessService } from '../services/ProcessService';
import { RestService } from '../services/RestService';
import { AxiosResponse } from 'axios';

// Mock RestService
jest.mock('../services/RestService');

// Helper to create mock AxiosResponse
const createMockResponse = <T>(data: T): AxiosResponse<T> => ({
    data,
    status: 200,
    statusText: 'OK',
    headers: {},
    config: {} as any
});

describe('DebuggerService and Enhanced Process Debugging (Issue #13)', () => {
    let debuggerService: DebuggerService;
    let processService: ProcessService;
    let mockRestService: jest.Mocked<RestService>;

    beforeEach(() => {
        mockRestService = new RestService({
            address: 'localhost',
            port: 8001,
            user: 'admin',
            password: 'apple'
        }) as jest.Mocked<RestService>;

        debuggerService = new DebuggerService(mockRestService);
        processService = new ProcessService(mockRestService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('DebuggerService - Session Management', () => {
        describe('createDebugSession', () => {
            it('should create a debug session successfully', async () => {
                mockRestService.post.mockResolvedValue(createMockResponse({
                    ID: 'debug-session-123'
                }));

                const sessionId = await debuggerService.createDebugSession('MyProcess');

                expect(sessionId).toBeDefined();
                expect(mockRestService.post).toHaveBeenCalledWith(
                    "/Processes('MyProcess')/tm1.BeginDebug",
                    {}
                );
            });

            it('should track the created session', async () => {
                mockRestService.post.mockResolvedValue(createMockResponse({
                    ID: 'debug-session-456'
                }));

                const sessionId = await debuggerService.createDebugSession('TestProcess');
                const sessionInfo = debuggerService.getSessionInfo(sessionId);

                expect(sessionInfo).toBeDefined();
                expect(sessionInfo?.processName).toBe('TestProcess');
                expect(sessionInfo?.status).toBe('Paused');
            });
        });

        describe('terminateDebugSession', () => {
            it('should terminate a debug session', async () => {
                mockRestService.post.mockResolvedValueOnce(createMockResponse({ ID: 'session-789' }));
                mockRestService.post.mockResolvedValueOnce(createMockResponse({}));

                const sessionId = await debuggerService.createDebugSession('MyProcess');
                await debuggerService.terminateDebugSession(sessionId);

                expect(mockRestService.post).toHaveBeenCalledWith(
                    "/Processes('MyProcess')/tm1.EndDebug",
                    {}
                );

                const sessionInfo = debuggerService.getSessionInfo(sessionId);
                expect(sessionInfo).toBeUndefined();
            });

            it('should throw error if session not found', async () => {
                await expect(
                    debuggerService.terminateDebugSession('non-existent')
                ).rejects.toThrow('Debug session non-existent not found');
            });
        });

        describe('listActiveSessions', () => {
            it('should list all active debug sessions', async () => {
                mockRestService.post
                    .mockResolvedValueOnce(createMockResponse({ ID: 'session-1' }))
                    .mockResolvedValueOnce(createMockResponse({ ID: 'session-2' }));

                await debuggerService.createDebugSession('Process1');
                await debuggerService.createDebugSession('Process2');

                const sessions = debuggerService.listActiveSessions();

                expect(sessions).toHaveLength(2);
                expect(sessions.some(s => s.processName === 'Process1')).toBe(true);
                expect(sessions.some(s => s.processName === 'Process2')).toBe(true);
            });
        });
    });

    describe('DebuggerService - Debug Control', () => {
        let sessionId: string;

        beforeEach(async () => {
            mockRestService.post.mockResolvedValue(createMockResponse({ ID: 'test-session' }));
            sessionId = await debuggerService.createDebugSession('MyProcess');
        });

        describe('stepInto', () => {
            it('should step into next line', async () => {
                mockRestService.post.mockResolvedValue(createMockResponse({}));

                await debuggerService.stepInto(sessionId);

                expect(mockRestService.post).toHaveBeenCalledWith(
                    "/Processes('MyProcess')/tm1.DebugStepIn",
                    {}
                );
            });

            it('should throw error if session not found', async () => {
                await expect(
                    debuggerService.stepInto('invalid-session')
                ).rejects.toThrow('Debug session invalid-session not found');
            });
        });

        describe('stepOver', () => {
            it('should step over next line', async () => {
                mockRestService.post.mockResolvedValue(createMockResponse({}));

                await debuggerService.stepOver(sessionId);

                expect(mockRestService.post).toHaveBeenCalledWith(
                    "/Processes('MyProcess')/tm1.DebugStepOver",
                    {}
                );
            });
        });

        describe('stepOut', () => {
            it('should step out of current function', async () => {
                mockRestService.post.mockResolvedValue(createMockResponse({}));

                await debuggerService.stepOut(sessionId);

                expect(mockRestService.post).toHaveBeenCalledWith(
                    "/Processes('MyProcess')/tm1.DebugStepOut",
                    {}
                );
            });
        });

        describe('continueExecution', () => {
            it('should continue execution', async () => {
                mockRestService.post.mockResolvedValue(createMockResponse({}));

                await debuggerService.continueExecution(sessionId);

                expect(mockRestService.post).toHaveBeenCalledWith(
                    "/Processes('MyProcess')/tm1.DebugContinue",
                    {}
                );

                const sessionInfo = debuggerService.getSessionInfo(sessionId);
                expect(sessionInfo?.status).toBe('Running');
            });
        });
    });

    describe('DebuggerService - Variable Inspection', () => {
        let sessionId: string;

        beforeEach(async () => {
            mockRestService.post.mockResolvedValue(createMockResponse({ ID: 'test-session' }));
            sessionId = await debuggerService.createDebugSession('MyProcess');
        });

        describe('getProcessVariables', () => {
            it('should get all process variables', async () => {
                mockRestService.get.mockResolvedValue(createMockResponse({
                    value: [
                        { Name: 'vCounter', Value: 10, Type: 'Numeric', Scope: 'Local' },
                        { Name: 'vName', Value: 'Test', Type: 'String', Scope: 'Local' },
                        { Name: 'pYear', Value: 2024, Type: 'Numeric', Scope: 'Parameter' }
                    ]
                }));

                const variables = await debuggerService.getProcessVariables(sessionId);

                expect(variables).toHaveLength(3);
                expect(variables[0]).toMatchObject({
                    name: 'vCounter',
                    value: 10,
                    type: 'Numeric',
                    scope: 'Local'
                });
            });
        });

        describe('setProcessVariable', () => {
            it('should set a process variable value', async () => {
                mockRestService.patch.mockResolvedValue(createMockResponse({}));

                await debuggerService.setProcessVariable(sessionId, 'vCounter', 20);

                expect(mockRestService.patch).toHaveBeenCalledWith(
                    "/Processes('MyProcess')/Variables('vCounter')",
                    { Value: 20 }
                );
            });
        });

        describe('evaluateExpression', () => {
            it('should evaluate a TM1 expression', async () => {
                mockRestService.post.mockResolvedValue(createMockResponse({
                    Result: 30
                }));

                const result = await debuggerService.evaluateExpression(
                    sessionId,
                    'vCounter + 10'
                );

                expect(result).toBe(30);
                expect(mockRestService.post).toHaveBeenCalledWith(
                    "/Processes('MyProcess')/tm1.Evaluate",
                    { Expression: 'vCounter + 10' }
                );
            });
        });

        describe('getCallStack', () => {
            it('should get the call stack', async () => {
                mockRestService.get.mockResolvedValue(createMockResponse({
                    value: [
                        { ProcedureName: 'Main', LineNumber: 10 },
                        { ProcedureName: 'Prolog', LineNumber: 5 }
                    ]
                }));

                const callStack = await debuggerService.getCallStack(sessionId);

                expect(callStack).toHaveLength(2);
                expect(callStack[0].procedureName).toBe('Main');
                expect(callStack[0].lineNumber).toBe(10);
            });

            it('should return basic info if call stack API not available', async () => {
                mockRestService.get.mockRejectedValue({ response: { status: 404 } });

                const callStack = await debuggerService.getCallStack(sessionId);

                expect(callStack).toHaveLength(1);
                expect(callStack[0].procedureName).toBe('MyProcess');
            });
        });
    });

    describe('ProcessService - Enhanced Debugging', () => {
        describe('analyzeProcessDependencies', () => {
            it('should analyze process dependencies', async () => {
                mockRestService.get.mockResolvedValue(createMockResponse({
                    Name: 'ImportData',
                    PrologProcedure: `
                        IF(CubeExists('Sales') = 0);
                            CubeCreate('Sales', 'Year', 'Month', 'Value');
                        ENDIF;
                        ExecuteProcess('SetupDimensions');
                    `,
                    DataProcedure: `
                        vValue = CellGetN('Budget', '2024', 'Jan');
                        CellPutN(vValue, 'Sales', '2024', 'Jan');
                    `,
                    EpilogProcedure: '',
                    MetadataProcedure: '',
                    Parameters: [],
                    Variables: []
                }));

                const deps = await processService.analyzeProcessDependencies('ImportData');

                expect(deps.cubes).toContain('Sales');
                expect(deps.cubes).toContain('Budget');
                expect(deps.processes).toContain('SetupDimensions');
            });
        });

        describe('validateProcessSyntax', () => {
            it('should return valid for correct syntax', async () => {
                mockRestService.get.mockResolvedValue(createMockResponse({
                    Name: 'ValidProcess',
                    PrologProcedure: 'vCounter = 1;',
                    DataProcedure: '',
                    EpilogProcedure: '',
                    MetadataProcedure: '',
                    Parameters: [],
                    Variables: []
                }));

                mockRestService.post.mockResolvedValue(createMockResponse({}));

                const result = await processService.validateProcessSyntax('ValidProcess');

                expect(result.isValid).toBe(true);
                expect(result.errors).toHaveLength(0);
            });

            it('should return errors for invalid syntax', async () => {
                mockRestService.get.mockResolvedValue(createMockResponse({
                    Name: 'InvalidProcess',
                    PrologProcedure: 'INVALID SYNTAX;',
                    DataProcedure: '',
                    EpilogProcedure: '',
                    MetadataProcedure: '',
                    Parameters: [],
                    Variables: []
                }));

                mockRestService.post.mockRejectedValue({
                    response: {
                        status: 400,
                        data: {
                            error: {
                                message: 'Syntax error on line 1'
                            }
                        }
                    }
                });

                const result = await processService.validateProcessSyntax('InvalidProcess');

                expect(result.isValid).toBe(false);
                expect(result.errors.length).toBeGreaterThan(0);
            });
        });

        describe('getProcessExecutionPlan', () => {
            it('should analyze process execution plan', async () => {
                mockRestService.get.mockResolvedValue(createMockResponse({
                    Name: 'ComplexProcess',
                    PrologProcedure: 'A'.repeat(600),
                    DataProcedure: 'B'.repeat(800),
                    EpilogProcedure: 'C'.repeat(400),
                    MetadataProcedure: '',
                    Parameters: [{ Name: 'pYear', Type: 'Numeric' }],
                    Variables: [{ Name: 'vCounter', Type: 'Numeric' }]
                }));

                const plan = await processService.getProcessExecutionPlan('ComplexProcess');

                expect(plan.processName).toBe('ComplexProcess');
                expect(plan.hasParameters).toBe(true);
                expect(plan.parameterCount).toBe(1);
                expect(plan.hasVariables).toBe(true);
                expect(plan.variableCount).toBe(1);
                expect(plan.procedures.hasPrologProcedure).toBe(true);
                expect(plan.estimatedComplexity).toBe('Medium');
            });
        });
    });
});
