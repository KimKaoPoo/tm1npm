import { ObjectService } from './ObjectService';
import { RestService } from './RestService';
import { formatUrl } from '../utils/Utils';

/**
 * Debug session information
 */
export interface DebugSession {
    id: string;
    processName: string;
    status: 'Running' | 'Paused' | 'Completed' | 'Failed';
    currentLine?: number;
    variables?: { [key: string]: any };
}

/**
 * Process variable information
 */
export interface ProcessVariable {
    name: string;
    value: any;
    type: 'String' | 'Numeric' | 'Unknown';
    scope: 'Local' | 'Global' | 'Parameter';
}

/**
 * Call stack frame
 */
export interface CallStackFrame {
    procedureName: string;
    lineNumber: number;
    source?: string;
}

/**
 * Process validation result
 */
export interface ValidationResult {
    isValid: boolean;
    errors: Array<{
        line: number;
        message: string;
        severity: 'Error' | 'Warning';
    }>;
}

/**
 * DebuggerService - Comprehensive TM1 process debugging service
 *
 * Provides advanced debugging capabilities including session management,
 * variable inspection, expression evaluation, and call stack analysis.
 */
export class DebuggerService extends ObjectService {
    private activeSessions: Map<string, DebugSession> = new Map();

    constructor(rest: RestService) {
        super(rest);
    }

    /**
     * Create a new debug session for a process
     *
     * @param processName - Name of the process to debug
     * @returns Promise<string> - Debug session ID
     *
     * @example
     * ```typescript
     * const sessionId = await debuggerService.createDebugSession('MyProcess');
     * ```
     */
    public async createDebugSession(processName: string): Promise<string> {
        const url = formatUrl("/Processes('{}')/tm1.BeginDebug", processName);
        const response = await this.rest.post(url, {});

        const sessionId = response.data.ID || response.data.SessionId || this.generateSessionId();

        // Track the session
        this.activeSessions.set(sessionId, {
            id: sessionId,
            processName,
            status: 'Paused',
            currentLine: 0
        });

        return sessionId;
    }

    /**
     * Terminate an active debug session
     *
     * @param sessionId - Debug session ID
     * @returns Promise<void>
     *
     * @example
     * ```typescript
     * await debuggerService.terminateDebugSession(sessionId);
     * ```
     */
    public async terminateDebugSession(sessionId: string): Promise<void> {
        const session = this.activeSessions.get(sessionId);
        if (!session) {
            throw new Error(`Debug session ${sessionId} not found`);
        }

        const url = formatUrl("/Processes('{}')/tm1.EndDebug", session.processName);

        try {
            await this.rest.post(url, {});
        } finally {
            this.activeSessions.delete(sessionId);
        }
    }

    /**
     * Step into the next line (enter function calls)
     *
     * @param sessionId - Debug session ID
     * @returns Promise<void>
     *
     * @example
     * ```typescript
     * await debuggerService.stepInto(sessionId);
     * ```
     */
    public async stepInto(sessionId: string): Promise<void> {
        const session = this.activeSessions.get(sessionId);
        if (!session) {
            throw new Error(`Debug session ${sessionId} not found`);
        }

        const url = formatUrl("/Processes('{}')/tm1.DebugStepIn", session.processName);
        await this.rest.post(url, {});

        session.status = 'Paused';
        if (session.currentLine !== undefined) {
            session.currentLine++;
        }
    }

    /**
     * Step over the next line (don't enter function calls)
     *
     * @param sessionId - Debug session ID
     * @returns Promise<void>
     *
     * @example
     * ```typescript
     * await debuggerService.stepOver(sessionId);
     * ```
     */
    public async stepOver(sessionId: string): Promise<void> {
        const session = this.activeSessions.get(sessionId);
        if (!session) {
            throw new Error(`Debug session ${sessionId} not found`);
        }

        const url = formatUrl("/Processes('{}')/tm1.DebugStepOver", session.processName);
        await this.rest.post(url, {});

        session.status = 'Paused';
        if (session.currentLine !== undefined) {
            session.currentLine++;
        }
    }

    /**
     * Step out of current function
     *
     * @param sessionId - Debug session ID
     * @returns Promise<void>
     *
     * @example
     * ```typescript
     * await debuggerService.stepOut(sessionId);
     * ```
     */
    public async stepOut(sessionId: string): Promise<void> {
        const session = this.activeSessions.get(sessionId);
        if (!session) {
            throw new Error(`Debug session ${sessionId} not found`);
        }

        const url = formatUrl("/Processes('{}')/tm1.DebugStepOut", session.processName);
        await this.rest.post(url, {});

        session.status = 'Paused';
    }

    /**
     * Continue execution until next breakpoint or completion
     *
     * @param sessionId - Debug session ID
     * @returns Promise<void>
     *
     * @example
     * ```typescript
     * await debuggerService.continueExecution(sessionId);
     * ```
     */
    public async continueExecution(sessionId: string): Promise<void> {
        const session = this.activeSessions.get(sessionId);
        if (!session) {
            throw new Error(`Debug session ${sessionId} not found`);
        }

        const url = formatUrl("/Processes('{}')/tm1.DebugContinue", session.processName);
        await this.rest.post(url, {});

        session.status = 'Running';
    }

    /**
     * Get all process variables in current debug session
     *
     * @param sessionId - Debug session ID
     * @returns Promise<ProcessVariable[]> - Array of process variables
     *
     * @example
     * ```typescript
     * const variables = await debuggerService.getProcessVariables(sessionId);
     * console.log(variables);
     * ```
     */
    public async getProcessVariables(sessionId: string): Promise<ProcessVariable[]> {
        const session = this.activeSessions.get(sessionId);
        if (!session) {
            throw new Error(`Debug session ${sessionId} not found`);
        }

        const url = formatUrl("/Processes('{}')/Variables", session.processName);
        const response = await this.rest.get(url);

        const variables: ProcessVariable[] = [];

        if (response.data.value) {
            for (const variable of response.data.value) {
                variables.push({
                    name: variable.Name,
                    value: variable.Value !== undefined ? variable.Value : null,
                    type: variable.Type || 'Unknown',
                    scope: variable.Scope || 'Local'
                });
            }
        }

        // Update session cache
        session.variables = variables.reduce((acc, v) => {
            acc[v.name] = v.value;
            return acc;
        }, {} as { [key: string]: any });

        return variables;
    }

    /**
     * Set a process variable value during debugging
     *
     * @param sessionId - Debug session ID
     * @param variable - Variable name
     * @param value - New value
     * @returns Promise<void>
     *
     * @example
     * ```typescript
     * await debuggerService.setProcessVariable(sessionId, 'vCounter', 10);
     * ```
     */
    public async setProcessVariable(
        sessionId: string,
        variable: string,
        value: any
    ): Promise<void> {
        const session = this.activeSessions.get(sessionId);
        if (!session) {
            throw new Error(`Debug session ${sessionId} not found`);
        }

        const url = formatUrl("/Processes('{}')/Variables('{}')", session.processName, variable);
        await this.rest.patch(url, { Value: value });

        // Update session cache
        if (session.variables) {
            session.variables[variable] = value;
        }
    }

    /**
     * Evaluate a TM1 expression in the debug context
     *
     * @param sessionId - Debug session ID
     * @param expression - TM1 expression to evaluate
     * @returns Promise<any> - Evaluation result
     *
     * @example
     * ```typescript
     * const result = await debuggerService.evaluateExpression(
     *     sessionId,
     *     'vCounter + 10'
     * );
     * console.log('Result:', result);
     * ```
     */
    public async evaluateExpression(sessionId: string, expression: string): Promise<any> {
        const session = this.activeSessions.get(sessionId);
        if (!session) {
            throw new Error(`Debug session ${sessionId} not found`);
        }

        const url = formatUrl("/Processes('{}')/tm1.Evaluate", session.processName);
        const response = await this.rest.post(url, { Expression: expression });

        return response.data.Result !== undefined ? response.data.Result : response.data.value;
    }

    /**
     * Get the current call stack
     *
     * @param sessionId - Debug session ID
     * @returns Promise<CallStackFrame[]> - Call stack frames
     *
     * @example
     * ```typescript
     * const callStack = await debuggerService.getCallStack(sessionId);
     * callStack.forEach(frame => {
     *     console.log(`${frame.procedureName} at line ${frame.lineNumber}`);
     * });
     * ```
     */
    public async getCallStack(sessionId: string): Promise<CallStackFrame[]> {
        const session = this.activeSessions.get(sessionId);
        if (!session) {
            throw new Error(`Debug session ${sessionId} not found`);
        }

        const url = formatUrl("/Processes('{}')/tm1.GetCallStack", session.processName);

        try {
            const response = await this.rest.get(url);

            if (response.data.value) {
                return response.data.value.map((frame: any) => ({
                    procedureName: frame.ProcedureName || frame.Name,
                    lineNumber: frame.LineNumber || 0,
                    source: frame.Source
                }));
            }
        } catch (error: any) {
            // If call stack API not available, return basic info
            if (error.response?.status === 404) {
                return [{
                    procedureName: session.processName,
                    lineNumber: session.currentLine || 0
                }];
            }
            throw error;
        }

        return [];
    }

    /**
     * Get debug session info
     *
     * @param sessionId - Debug session ID
     * @returns DebugSession | undefined - Session information
     *
     * @example
     * ```typescript
     * const session = debuggerService.getSessionInfo(sessionId);
     * console.log('Status:', session?.status);
     * ```
     */
    public getSessionInfo(sessionId: string): DebugSession | undefined {
        return this.activeSessions.get(sessionId);
    }

    /**
     * List all active debug sessions
     *
     * @returns DebugSession[] - Array of active sessions
     *
     * @example
     * ```typescript
     * const sessions = debuggerService.listActiveSessions();
     * console.log(`${sessions.length} active sessions`);
     * ```
     */
    public listActiveSessions(): DebugSession[] {
        return Array.from(this.activeSessions.values());
    }

    /**
     * Generate a unique session ID
     * @private
     */
    private generateSessionId(): string {
        return `debug_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}
