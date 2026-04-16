import { AxiosResponse } from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { RequestOptions, RestService } from './RestService';
import { ObjectService } from './ObjectService';
import { Process } from '../objects/Process';
import { ProcessDebugBreakpoint, BreakPointType, HitMode } from '../objects/ProcessDebugBreakpoint';
import { TM1RestException, TM1Exception } from '../exceptions/TM1Exception';
import { formatUrl, lowerAndDropSpaces } from '../utils/Utils';
import { OperationStatus, OperationType } from './AsyncOperationService';

export interface CompileSyntaxError {
    LineNumber: number;
    Message: string;
}

export class ProcessService extends ObjectService {
    /** Service to handle Object Updates for TI Processes
     * 
     */

    constructor(rest: RestService) {
        super(rest);
    }

    public async get(nameProcess: string): Promise<Process> {
        /** Get a process from TM1 Server
         *
         * :param name_process:
         * :return: Instance of the .Process
         */
        const url = formatUrl(
            "/Processes('{}')?$select=*,UIData,VariablesUIData," +
            "DataSource/dataSourceNameForServer," +
            "DataSource/dataSourceNameForClient," +
            "DataSource/asciiDecimalSeparator," +
            "DataSource/asciiDelimiterChar," +
            "DataSource/asciiDelimiterType," +
            "DataSource/asciiHeaderRecords," +
            "DataSource/asciiQuoteCharacter," +
            "DataSource/asciiThousandSeparator," +
            "DataSource/view," +
            "DataSource/query," +
            "DataSource/userName," +
            "DataSource/password," +
            "DataSource/usesUnicode," +
            "DataSource/subset," +
            "DataSource/jsonRootPointer," +
            "DataSource/jsonVariableMapping", nameProcess);

        const response = await this.rest.get(url);
        return Process.fromDict(response.data);
    }

    public async getAll(skipControlProcesses: boolean = false): Promise<Process[]> {
        /** Get all processes from TM1 Server
         *
         * :param skip_control_processes: bool, True to exclude processes that begin with "}" or "{"
         * :return: List, instances of the .Process
         */
        const modelProcessFilter = "&$filter=startswith(Name,'}') eq false and startswith(Name,'{') eq false";

        const url = "/Processes?$select=*,UIData,VariablesUIData," +
            "DataSource/dataSourceNameForServer," +
            "DataSource/dataSourceNameForClient," +
            "DataSource/asciiDecimalSeparator," +
            "DataSource/asciiDelimiterChar," +
            "DataSource/asciiDelimiterType," +
            "DataSource/asciiHeaderRecords," +
            "DataSource/asciiQuoteCharacter," +
            "DataSource/asciiThousandSeparator," +
            "DataSource/view," +
            "DataSource/query," +
            "DataSource/userName," +
            "DataSource/password," +
            "DataSource/usesUnicode," +
            "DataSource/subset," +
            "DataSource/jsonRootPointer," +
            "DataSource/jsonVariableMapping" + (skipControlProcesses ? modelProcessFilter : "");

        const response = await this.rest.get(url);
        const responseAsDict = response.data;
        return responseAsDict.value.map((p: any) => Process.fromDict(p));
    }

    public async getAllNames(skipControlProcesses: boolean = false): Promise<string[]> {
        /** Get List with all process names from TM1 Server
         * 
         * :param skip_control_processes: bool, True to exclude processes that begin with "}" or "{"
         * :Returns:
         *     List of Strings
         */
        const modelProcessFilter = "&$filter=startswith(Name,'}') eq false and startswith(Name,'{') eq false";
        const url = "/Processes?$select=Name" + (skipControlProcesses ? modelProcessFilter : "");

        const response = await this.rest.get(url);
        const processes = response.data.value.map((process: any) => process.Name);
        return processes;
    }

    public async searchStringInCode(searchString: string, skipControlProcesses: boolean = false): Promise<string[]> {
        /** Search for a string in all process code (server-side OData filter)
         *
         * :param search_string: case insensitive string to search for
         * :param skip_control_processes: bool, True to exclude processes that begin with "}" or "{"
         * :return: List of process names that contain the search string
         */
        const normalized = lowerAndDropSpaces(searchString).replace(/'/g, "''");
        const fields = ['PrologProcedure', 'MetadataProcedure', 'DataProcedure', 'EpilogProcedure'];
        const codeFilter = fields
            .map(f => `contains(tolower(replace(${f},' ','')), '${normalized}')`)
            .join(' or ');

        let url = `/Processes?$select=Name&$filter=(${codeFilter})`;
        if (skipControlProcesses) {
            url += " and (startswith(Name, '}') eq false and startswith(Name, '{') eq false)";
        }

        const response = await this.rest.get(url);
        return response.data.value.map((p: { Name: string }) => p.Name);
    }

    public async create(process: Process): Promise<AxiosResponse> {
        /** Create a process on TM1 Server
         *
         * :param process: Instance of .Process class
         * :return: response
         */
        const url = "/Processes";
        return await this.rest.post(url, process.body);
    }

    public async update(process: Process): Promise<AxiosResponse> {
        /** Update an existing process on TM1 Server
         *
         * :param process: Instance of .Process class
         * :return: response
         */
        const url = formatUrl("/Processes('{}')", process.name);
        return await this.rest.patch(url, process.body);
    }

    public async delete(processName: string): Promise<AxiosResponse> {
        /** Delete a process from TM1 Server
         *
         * :param process_name: name of the process
         * :return: response
         */
        const url = formatUrl("/Processes('{}')", processName);
        return await this.rest.delete(url);
    }

    public async exists(processName: string): Promise<boolean> {
        /** Check if process exists on TM1 Server
         *
         * :param process_name: name of the process
         * :return: boolean
         */
        try {
            await this.get(processName);
            return true;
        } catch (error) {
            if (error instanceof TM1RestException && error.statusCode === 404) {
                return false;
            }
            throw error;
        }
    }

    public async execute(processName: string, parameters?: Record<string, any>): Promise<any> {
        /** Execute a process on TM1 Server
         *
         * :param process_name: name of the process
         * :param parameters: dictionary of parameters
         * :return: response
         */
        const url = formatUrl("/Processes('{}')/tm1.Execute", processName);
        
        const body: any = {};
        if (parameters && Object.keys(parameters).length > 0) {
            body.Parameters = Object.entries(parameters).map(([name, value]) => ({
                Name: name,
                Value: value
            }));
        }

        return await this.rest.post(url, JSON.stringify(body));
    }

    public async executeWithReturn(
        processName: string, 
        parameters?: Record<string, any>,
        timeout?: number
    ): Promise<any> {
        /** Execute a process on TM1 Server and return execution details
         *
         * :param process_name: name of the process
         * :param parameters: dictionary of parameters
         * :param timeout: Number of seconds that the client will wait to receive the first byte.
         * :return: response including execution details
         */
        const url = formatUrl("/Processes('{}')/tm1.ExecuteWithReturn?$expand=*", processName);
        
        const body: any = {};
        if (parameters && Object.keys(parameters).length > 0) {
            body.Parameters = Object.entries(parameters).map(([name, value]) => ({
                Name: name,
                Value: value
            }));
        }

        const config: RequestOptions = {};
        if (timeout) {
            config.timeout = timeout;
        }

        return await this.rest.post(url, JSON.stringify(body), config);
    }

    public async compile(processName: string): Promise<AxiosResponse> {
        /** Compile a process on TM1 Server
         *
         * :param process_name: name of the process
         * :return: response
         */
        const url = formatUrl("/Processes('{}')/tm1.Compile", processName);
        return await this.rest.post(url, '{}');
    }

    public async compileProcess(process: Process): Promise<CompileSyntaxError[]> {
        /** Compile an unbound process and return syntax errors
         *
         * :param process: Instance of .Process class
         * :return: list of syntax errors (empty if successful)
         */
        const url = '/CompileProcess';
        const payload = { Process: process.bodyAsDict };
        const response = await this.rest.post(url, JSON.stringify(payload));
        return response.data.value;
    }

    /**
     * Poll for async execution result
     *
     * :param asyncId: async operation ID returned from executeWithReturn with returnAsyncId=true
     * :return: tuple of [success, status, errorLogFile] or null if not ready
     */
    public async pollExecuteWithReturn(asyncId: string): Promise<[boolean, string, string | null] | null> {
        try {
            const response = await this.rest.retrieve_async_response(asyncId);
            // tm1py returns None while the async op is still in-flight (status 202).
            if (response.status !== 200 && response.status !== 201) {
                return null;
            }
            // TODO: tm1py handles TM1 < v11 binary-wrapped responses via
            // build_response_from_binary_response. Add support if needed.
            return this._executeWithReturnParseResponse(response.data);
        } catch (error: any) {
            // 404 means the async resource hasn't materialized yet — return null
            // so the caller can retry. This differs from AsyncOperationService
            // which treats 404 as terminal FAILED for locally-tracked operations.
            const status = error?.status ?? error?.response?.status;
            if (status === 404) {
                return null;
            }
            throw error;
        }
    }

    private _executeWithReturnParseResponse(executionSummary: any): [boolean, string, string | null] {
        const success = executionSummary.ProcessExecuteStatusCode === 'CompletedSuccessfully';
        const status = executionSummary.ProcessExecuteStatusCode;
        const errorLogFile = executionSummary.ErrorLogFile?.Filename ?? null;
        return [success, status, errorLogFile];
    }

    public async executeProcessWithReturn(
        processName: string,
        parameters?: Record<string, any>
    ): Promise<any> {
        /** Execute process with return values
         * 
         * :param process_name: name of the process  
         * :param parameters: dictionary of process parameters
         * :return: execution result with return values
         */
        const response = await this.executeWithReturn(processName, parameters);
        return response.data;
    }

    public async getLastMessageFromMessagelog(_processName: string): Promise<string> {
        /** Get the last message from a process execution
         *
         * :param process_name: name of the process
         * :return: last message string
         */
        // This would require MessageLogService integration
        // For now, return empty string
        return '';
    }

    public async debugGetBreakpoints(debugId: string): Promise<ProcessDebugBreakpoint[]> {
        /** Get debug breakpoints for a debug context
         *
         * :param debugId: debug session ID
         * :return: list of ProcessDebugBreakpoint objects
         */
        const url = formatUrl("/ProcessDebugContexts('{}')/Breakpoints", debugId);
        const response = await this.rest.get(url);
        return response.data.value.map((bp: any) => ProcessDebugBreakpoint.fromDict(bp));
    }

    public async debugAddBreakpoint(
        debugId: string,
        breakpoint: ProcessDebugBreakpoint
    ): Promise<AxiosResponse> {
        /** Add a single breakpoint to a debug context (delegates to debugAddBreakpoints)
         *
         * :param debugId: debug session ID
         * :param breakpoint: ProcessDebugBreakpoint object
         * :return: response
         */
        return this.debugAddBreakpoints(debugId, [breakpoint]);
    }

    public async debugRemoveBreakpoint(
        debugId: string,
        breakpointId: number
    ): Promise<AxiosResponse> {
        /** Remove a breakpoint from a debug context
         *
         * :param debugId: debug session ID
         * :param breakpointId: ID of the breakpoint
         * :return: response
         */
        const url = formatUrl("/ProcessDebugContexts('{}')/Breakpoints('{}')", debugId, breakpointId.toString());
        return await this.rest.delete(url);
    }

    /**
     * Add multiple breakpoints to a debug context
     */
    public async debugAddBreakpoints(
        debugId: string,
        breakpoints: ProcessDebugBreakpoint[]
    ): Promise<AxiosResponse> {
        const url = formatUrl("/ProcessDebugContexts('{}')/Breakpoints", debugId);
        const body = JSON.stringify(breakpoints.map(bp => bp.bodyAsDict));
        return await this.rest.post(url, body);
    }

    /**
     * Update an existing breakpoint in a debug context
     */
    public async debugUpdateBreakpoint(
        debugId: string,
        breakpoint: ProcessDebugBreakpoint
    ): Promise<AxiosResponse> {
        const url = formatUrl(
            "/ProcessDebugContexts('{}')/Breakpoints('{}')",
            debugId,
            breakpoint.breakpointId.toString()
        );
        return await this.rest.patch(url, breakpoint.body);
    }

    /**
     * Get all variable values from the current debug call stack
     */
    public async debugGetVariableValues(debugId: string): Promise<Record<string, string>> {
        const url = formatUrl(
            "/ProcessDebugContexts('{}')?$expand=CallStack($expand=Variables)",
            debugId
        );
        const response = await this.rest.get(url);
        const result = response.data;
        const callStack = result.CallStack && result.CallStack.length > 0
            ? result.CallStack[0].Variables
            : [];

        const variables: Record<string, string> = {};
        for (const entry of callStack) {
            variables[entry.Name] = entry.Value;
        }
        return variables;
    }

    /**
     * Get a single variable value from the current debug call stack
     */
    public async debugGetSingleVariableValue(debugId: string, variableName: string): Promise<string> {
        const url = formatUrl(
            "/ProcessDebugContexts('{}')?$expand=" +
            "CallStack($expand=Variables($filter=tolower(Name) eq '{}';$select=Value))",
            debugId,
            variableName.toLowerCase()
        );
        const response = await this.rest.get(url);
        try {
            return response.data.CallStack[0].Variables[0].Value;
        } catch {
            throw new Error(`'${variableName}' not found in collection`);
        }
    }

    /**
     * Get the current procedure name from the debug call stack
     */
    public async debugGetProcessProcedure(debugId: string): Promise<string> {
        const url = formatUrl(
            "/ProcessDebugContexts('{}')?$expand=CallStack($select=Procedure)",
            debugId
        );
        const response = await this.rest.get(url);
        return response.data.CallStack[0].Procedure;
    }

    /**
     * Get the current line number from the debug call stack
     */
    public async debugGetProcessLineNumber(debugId: string): Promise<number> {
        const url = formatUrl(
            "/ProcessDebugContexts('{}')?$expand=CallStack($select=LineNumber)",
            debugId
        );
        const response = await this.rest.get(url);
        return response.data.CallStack[0].LineNumber;
    }

    /**
     * Get the current record number from the debug call stack
     */
    public async debugGetRecordNumber(debugId: string): Promise<number> {
        const url = formatUrl(
            "/ProcessDebugContexts('{}')?$expand=CallStack($select=RecordNumber)",
            debugId
        );
        const response = await this.rest.get(url);
        return response.data.CallStack[0].RecordNumber;
    }

    /**
     * Get the current breakpoint from the debug context
     */
    public async debugGetCurrentBreakpoint(debugId: string): Promise<ProcessDebugBreakpoint> {
        const url = formatUrl(
            "/ProcessDebugContexts('{}')?$expand=CurrentBreakpoint",
            debugId
        );
        const response = await this.rest.get(url);
        return ProcessDebugBreakpoint.fromDict(response.data.CurrentBreakpoint);
    }

    public async executeTiCode(
        linesProlog: string[],
        linesEpilog?: string[],
        parameters?: Record<string, any>
    ): Promise<any> {
        /** Execute lines of code on the TM1 Server
         *
         * :param lines_prolog: list - where each element is a valid statement of TI code.
         * :param lines_epilog: list - where each element is a valid statement of TI code.
         * :param parameters: dictionary of parameters
         * :return: execution result
         */
        const name = `}TM1py${uuidv4()}`;
        const p = new Process(
            name,
            false,
            undefined,
            undefined,
            undefined,
            undefined,
            Process.AUTO_GENERATED_STATEMENTS + linesProlog.join('\r\n'),
            '',
            '',
            linesEpilog ? Process.AUTO_GENERATED_STATEMENTS + linesEpilog.join('\r\n') : ''
        );
        await this.create(p);
        try {
            return await this.executeProcessWithReturn(name, parameters);
        } finally {
            try {
                await this.delete(name);
            } catch (_deleteError) {
                // Cleanup failure should not mask the original execution error
            }
        }
    }

    public async compileSingleStatement(statement: string): Promise<any> {
        /** Compile a single TI statement and return any errors
         *
         * :param statement: TI statement to compile
         * :return: compilation result
         */
        const url = "/CompileStatement";
        const body = {
            Statement: statement
        };
        
        return await this.rest.post(url, JSON.stringify(body));
    }

    public async getErrorLogFileContent(fileName: string): Promise<string> {
        /** Get content of error log file
         *
         * :param file_name: name of the error log file in the TM1 log directory
         * :return: String, content of the file
         */
        const url = formatUrl("/ErrorLogFiles('{}')/Content", fileName);
        const response = await this.rest.get(url);
        return response.data;
    }

    public async searchErrorLogFilenames(
        searchString: string,
        top: number = 0,
        descending: boolean = false
    ): Promise<string[]> {
        /** Search error log filenames for given search string
         *
         * :param searchString: substring to contain in file names
         * :param top: top n filenames
         * :param descending: sort descending (most recent first)
         * :return: list of filenames
         */
        let url = formatUrl(
            "/ErrorLogFiles?select=Filename&$filter=contains(tolower(Filename), tolower('{}'))",
            searchString
        );

        if (top > 0) {
            url += `&$top=${top}`;
        }

        if (descending) {
            url += '&$orderby=Filename desc';
        }

        const response = await this.rest.get(url);
        return response.data.value.map((log: any) => log.Filename);
    }

    public async getErrorLogFilenames(
        processName?: string,
        top: number = 0,
        descending: boolean = false
    ): Promise<string[]> {
        /** Get error log filenames for specified TI process
         *
         * :param processName: valid TI name, leave blank to return all error log filenames
         * :param top: top n filenames
         * :param descending: sort descending (most recent first)
         * :return: list of filenames
         */
        let searchString = '';
        if (processName) {
            if (!(await this.exists(processName))) {
                throw new Error(`'${processName}' is not a valid process`);
            }
            searchString = processName;
        }

        return this.searchErrorLogFilenames(searchString, top, descending);
    }

    public async deleteErrorLogFile(fileName: string): Promise<AxiosResponse> {
        /** Delete a process error log file
         *
         * :param file_name: name of the error log file to delete
         * :return: response
         */
        const url = formatUrl("/ErrorLogFiles('{}')", fileName);
        return await this.rest.delete(url);
    }

    public async getProcessErrorLogs(processName: string): Promise<any[]> {
        /** Get all ProcessErrorLog entries for a process
         *
         * :param processName: name of the process
         * :return: list - Collection of ProcessErrorLogs
         */
        const url = formatUrl("/Processes('{}')/ErrorLogs", processName);
        const response = await this.rest.get(url);
        return response.data.value;
    }

    public async getLastMessageFromProcessErrorLog(processName: string): Promise<string | undefined> {
        /** Get the latest ProcessErrorLog from a process entity
         *
         * :param processName: name of the process
         * :return: String - the error log content, or undefined if no logs exist
         */
        const logs = await this.getProcessErrorLogs(processName);
        if (logs.length > 0) {
            const timestamp = logs[logs.length - 1].Timestamp;
            const url = formatUrl("/Processes('{}')/ErrorLogs('{}')/Content", processName, timestamp);
            const response = await this.rest.get(url);
            return response.data;
        }
        return undefined;
    }

    public async searchStringInName(
        searchString: string, 
        skipControlProcesses: boolean = false
    ): Promise<string[]> {
        /** Search for a string in process names
         *
         * :param search_string: string to search for in process names
         * :param skip_control_processes: bool, True to exclude processes that begin with "}" or "{"
         * :return: List of process names that contain the search string
         */
        let url = "/Processes?$select=Name";
        
        const filters = [`indexof(tolower(Name), '${searchString.toLowerCase()}') ge 0`];
        
        if (skipControlProcesses) {
            filters.push("not startswith(Name, '}')");
            filters.push("not startswith(Name, '{')");
        }
        
        if (filters.length > 0) {
            url += `&$filter=${filters.join(' and ')}`;
        }

        const response = await this.rest.get(url);
        return response.data.value.map((process: any) => process.Name);
    }

    public async updateOrCreate(process: Process): Promise<AxiosResponse> {
        /** Update process if it exists, create it if it doesn't
         *
         * :param process: Instance of .Process class
         * :return: response
         */
        if (await this.exists(process.name)) {
            return await this.update(process);
        }
        return await this.create(process);
    }

    public async clone(
        sourceProcessName: string,
        targetProcessName: string,
        includeData: boolean = true
    ): Promise<AxiosResponse> {
        /** Clone a process with a new name
         *
         * :param source_process_name: name of the source process
         * :param target_process_name: name for the new process
         * :param include_data: whether to include data source settings
         * :return: response
         */
        const sourceProcess = await this.get(sourceProcessName);
        sourceProcess.name = targetProcessName;
        
        if (!includeData) {
            // Clear data source settings - commented out as Process object doesn't have dataSource property
            // sourceProcess.dataSource = undefined;
        }
        
        return await this.create(sourceProcess);
    }

    // ===== DEBUG FUNCTIONS =====

    /**
     * Start debug session for specified process; debug session id is returned in response
     */
    public async debugProcess(
        processName: string,
        timeout?: number,
        parameters?: Record<string, any>
    ): Promise<any> {
        const url = formatUrl(
            "/Processes('{}')/tm1.Debug?$expand=Breakpoints," +
            "Thread,CallStack($expand=Variables,Process($select=Name))",
            processName
        );

        const body: any = {};
        if (parameters && Object.keys(parameters).length > 0) {
            body.Parameters = Object.entries(parameters).map(([name, value]) => ({
                Name: name,
                Value: value
            }));
        }

        const config: RequestOptions = {};
        if (timeout) {
            config.timeout = timeout;
        }

        const response = await this.rest.post(url, JSON.stringify(body), config);
        return response.data;
    }

    /**
     * Runs a single statement in the process.
     * If ExecuteProcess is next function, will NOT debug child process.
     */
    public async debugStepOver(debugId: string): Promise<any> {
        const url = formatUrl("/ProcessDebugContexts('{}')/tm1.StepOver", debugId);
        await this.rest.post(url, '{}');

        // digest time necessary for TM1 <= 11.8
        await new Promise(resolve => setTimeout(resolve, 100));

        const getUrl = formatUrl(
            "/ProcessDebugContexts('{}')?$expand=Breakpoints," +
            "Thread,CallStack($expand=Variables,Process($select=Name))",
            debugId
        );
        const response = await this.rest.get(getUrl);
        return response.data;
    }

    /**
     * Runs a single statement in the process.
     * If ExecuteProcess is next function, will pause at first statement inside child process.
     */
    public async debugStepIn(debugId: string): Promise<any> {
        const url = formatUrl("/ProcessDebugContexts('{}')/tm1.StepIn", debugId);
        await this.rest.post(url, '{}');

        // digest time necessary for TM1 <= 11.8
        await new Promise(resolve => setTimeout(resolve, 100));

        const getUrl = formatUrl(
            "/ProcessDebugContexts('{}')?$expand=Breakpoints," +
            "Thread,CallStack($expand=Variables,Process($select=Name))",
            debugId
        );
        const response = await this.rest.get(getUrl);
        return response.data;
    }

    /**
     * Resumes execution and runs until current process has finished.
     */
    public async debugStepOut(debugId: string): Promise<any> {
        const url = formatUrl("/ProcessDebugContexts('{}')/tm1.StepOut", debugId);
        await this.rest.post(url, '{}');

        // digest time necessary for TM1 <= 11.8
        await new Promise(resolve => setTimeout(resolve, 100));

        const getUrl = formatUrl(
            "/ProcessDebugContexts('{}')?$expand=Breakpoints," +
            "Thread,CallStack($expand=Variables,Process($select=Name))",
            debugId
        );
        const response = await this.rest.get(getUrl);
        return response.data;
    }

    /**
     * Resumes execution until next breakpoint
     */
    public async debugContinue(debugId: string): Promise<any> {
        const url = formatUrl("/ProcessDebugContexts('{}')/tm1.Continue", debugId);
        await this.rest.post(url, '{}');

        // digest time necessary for TM1 <= 11.8
        await new Promise(resolve => setTimeout(resolve, 100));

        const getUrl = formatUrl(
            "/ProcessDebugContexts('{}')?$expand=Breakpoints," +
            "Thread,CallStack($expand=Variables,Process($select=Name))",
            debugId
        );
        const response = await this.rest.get(getUrl);
        return response.data;
    }

    /**
     * Evaluate a boolean TI expression using the ProcessQuit approach
     *
     * Uses ProcessQuit to determine boolean result: if expression is false,
     * ProcessQuit is called (status=QuitCalled), otherwise completes successfully.
     */
    public async evaluateBooleanTiExpression(expression: string): Promise<boolean> {
        const formula = expression.replace(/^;+|;+$/g, '');
        const prologProcedure = `if (~${formula});\n  ProcessQuit;\nendif;`;

        const url = '/ExecuteProcessWithReturn?$expand=*';
        const payload = {
            Process: {
                Name: '',
                PrologProcedure: prologProcedure,
                MetadataProcedure: '',
                DataProcedure: '',
                EpilogProcedure: '',
                HasSecurityAccess: false,
                Parameters: []
            }
        };

        const response = await this.rest.post(url, JSON.stringify(payload));
        const status = response.data.ProcessExecuteStatusCode;

        if (status === 'QuitCalled') {
            return false;
        } else if (status === 'CompletedSuccessfully') {
            return true;
        } else {
            throw new TM1Exception(`Unexpected TI return status: '${status}' for expression: '${expression}'`);
        }
    }

    /**
     * Evaluate a TI expression and return the string result.
     *
     * Creates a temporary process with sFunc = {formula}, compiles it,
     * starts a debug session, adds a data breakpoint on sFunc, continues
     * execution to evaluate, reads the result, and cleans up.
     */
    public async evaluateTiExpression(formula: string): Promise<string> {
        // tm1py uses formula[formula.find("=") + 1:] which greedily strips at the
        // first "=" anywhere in the string. We use a regex to only strip a leading
        // "=" prefix (e.g. "=NOW;" → "NOW;"), avoiding mangling formulas with
        // embedded "=" (e.g. comparisons like "IF(1=1,...)").
        formula = formula.replace(/^\s*=\s*/, '');

        // Ensure semicolon at end
        if (!formula.trim().endsWith(';')) {
            formula += ';';
        }

        const prologList = [`sFunc = ${formula}`, "sDebug='Stop';"];
        const processName = `}TM1py${uuidv4()}`;
        const p = new Process(
            processName,
            false,
            undefined,
            undefined,
            undefined,
            undefined,
            Process.AUTO_GENERATED_STATEMENTS + prologList.join('\r\n'),
            '',
            '',
            ''
        );

        const syntaxErrors = await this.compileProcess(p);
        if (syntaxErrors && syntaxErrors.length > 0) {
            throw new Error(syntaxErrors.map(e => `Line ${e.LineNumber}: ${e.Message}`).join('; '));
        }

        try {
            await this.create(p);
            const debugContext = await this.debugProcess(processName);
            const debugId = debugContext.ID;

            const breakpoint = new ProcessDebugBreakpoint(
                1,
                BreakPointType.PROCESS_DEBUG_CONTEXT_DATA_BREAK_POINT,
                true,
                HitMode.BREAK_ALWAYS,
                0,
                '',
                'sFunc'
            );

            await this.debugAddBreakpoint(debugId, breakpoint);
            await this.debugContinue(debugId);
            const result = await this.debugGetVariableValues(debugId);
            await this.debugContinue(debugId);

            if (!result || !('sFunc' in result)) {
                throw new Error('unknown error: no formula result found');
            }
            return result['sFunc'];

        } finally {
            try {
                await this.delete(processName);
            } catch (_) {
                // Cleanup failure should not mask the original error
            }
        }
    }

    /**
     * Analyze process dependencies (what cubes/dimensions/processes it uses)
     *
     * @param processName - Name of the process
     * @returns Promise<any> - Dependency information
     *
     * @example
     * ```typescript
     * const deps = await processService.analyzeProcessDependencies('ImportData');
     * console.log('Cubes used:', deps.cubes);
     * console.log('Dimensions used:', deps.dimensions);
     * ```
     */
    public async analyzeProcessDependencies(processName: string): Promise<any> {
        // Get process code
        const process = await this.get(processName);

        const dependencies = {
            cubes: [] as string[],
            dimensions: [] as string[],
            processes: [] as string[],
            subsets: [] as string[]
        };

        // Extract all code sections
        const allCode = [
            process.prologProcedure || '',
            process.metadataProcedure || '',
            process.dataProcedure || '',
            process.epilogProcedure || ''
        ].join('\n');

        // Cube references (CellGetN, CellPutN, CubeExists, etc.)
        const cubeMatches = allCode.match(/(?:CellGetN|CellPutN|CubeExists|CubeClear|CubeCreate|CubeDestroy)\s*\(\s*['"]([^'"]+)['"]/gi);
        if (cubeMatches) {
            cubeMatches.forEach(match => {
                const cubeMatch = match.match(/['"]([^'"]+)['"]/);
                if (cubeMatch && cubeMatch[1]) {
                    if (!dependencies.cubes.includes(cubeMatch[1])) {
                        dependencies.cubes.push(cubeMatch[1]);
                    }
                }
            });
        }

        // Dimension references
        const dimMatches = allCode.match(/(?:DimensionCreate|DimensionExists|DimIx)\s*\(\s*['"]([^'"]+)['"]/gi);
        if (dimMatches) {
            dimMatches.forEach(match => {
                const dimMatch = match.match(/['"]([^'"]+)['"]/);
                if (dimMatch && dimMatch[1]) {
                    if (!dependencies.dimensions.includes(dimMatch[1])) {
                        dependencies.dimensions.push(dimMatch[1]);
                    }
                }
            });
        }

        // Process references (ExecuteProcess)
        const processMatches = allCode.match(/ExecuteProcess\s*\(\s*['"]([^'"]+)['"]/gi);
        if (processMatches) {
            processMatches.forEach(match => {
                const procMatch = match.match(/['"]([^'"]+)['"]/);
                if (procMatch && procMatch[1]) {
                    if (!dependencies.processes.includes(procMatch[1])) {
                        dependencies.processes.push(procMatch[1]);
                    }
                }
            });
        }

        return dependencies;
    }

    /**
     * Validate process syntax without executing it
     *
     * @param processName - Name of the process
     * @returns Promise<{isValid: boolean, errors: any[]}> - Validation result
     *
     * @example
     * ```typescript
     * const result = await processService.validateProcessSyntax('MyProcess');
     * if (!result.isValid) {
     *     console.error('Errors:', result.errors);
     * }
     * ```
     */
    public async validateProcessSyntax(processName: string): Promise<{isValid: boolean, errors: any[]}> {
        try {
            const response = await this.compile(processName);
            if (response.status === 200) {
                return { isValid: true, errors: [] };
            }
            return {
                isValid: false,
                errors: [{ line: 0, message: response.statusText || 'Compilation failed', severity: 'Error' }]
            };
        } catch (error: any) {
            const errorMessage = error.response?.data?.error?.message || error.message || 'Validation failed';
            return {
                isValid: false,
                errors: [{ line: 0, message: errorMessage, severity: 'Error' }]
            };
        }
    }

    /**
     * Get process execution plan (estimated resource usage)
     *
     * @param processName - Name of the process
     * @returns Promise<any> - Execution plan information
     *
     * @example
     * ```typescript
     * const plan = await processService.getProcessExecutionPlan('ImportData');
     * console.log('Estimated execution time:', plan.estimatedTime);
     * ```
     */
    public async getProcessExecutionPlan(processName: string): Promise<any> {
        const process = await this.get(processName);

        // Analyze process characteristics
        const plan = {
            processName: process.name,
            hasDataSource: !!(process as any).dataSource,
            dataSourceType: (process as any).dataSource?.type || 'None',
            hasParameters: process.parameters && process.parameters.length > 0,
            parameterCount: process.parameters ? process.parameters.length : 0,
            hasVariables: process.variables && process.variables.length > 0,
            variableCount: process.variables ? process.variables.length : 0,
            procedures: {
                hasPrologProcedure: !!(process.prologProcedure && process.prologProcedure.trim()),
                hasMetadataProcedure: !!(process.metadataProcedure && process.metadataProcedure.trim()),
                hasDataProcedure: !!(process.dataProcedure && process.dataProcedure.trim()),
                hasEpilogProcedure: !!(process.epilogProcedure && process.epilogProcedure.trim())
            },
            estimatedComplexity: 'Unknown'
        };

        // Estimate complexity
        const totalCodeLength =
            (process.prologProcedure?.length || 0) +
            (process.metadataProcedure?.length || 0) +
            (process.dataProcedure?.length || 0) +
            (process.epilogProcedure?.length || 0);

        if (totalCodeLength < 500) {
            plan.estimatedComplexity = 'Low';
        } else if (totalCodeLength < 2000) {
            plan.estimatedComplexity = 'Medium';
        } else {
            plan.estimatedComplexity = 'High';
        }

        return plan;
    }

    /**
     * Execute a process asynchronously with return values
     *
     * @param processName - Name of the process
     * @param parameters - Optional process parameters
     * @returns Promise<string> - Operation ID for tracking
     *
     * @example
     * ```typescript
     * const operationId = await processService.executeWithReturnAsync('MyProcess', {
     *     pParam1: 'value1',
     *     pParam2: 100
     * });
     * // Use AsyncOperationService to poll for completion
     * ```
     */
    public async executeWithReturnAsync(
        processName: string,
        parameters?: Record<string, any>
    ): Promise<string> {
        // Import AsyncOperationService at runtime to avoid circular dependency
        const asyncOps = (this.rest as any).asyncOperationService;
        if (!asyncOps) {
            throw new TM1Exception('AsyncOperationService not available. Please ensure TM1Service is properly initialized.');
        }

        // Create async operation tracking
        const operationId = await asyncOps.createAsyncOperation({
            type: OperationType.PROCESS_EXECUTION,
            name: processName,
            parameters
        });

        // Start the process execution
        asyncOps.updateOperationStatus(operationId, OperationStatus.RUNNING);

        // Execute process asynchronously
        this.executeWithReturn(processName, parameters)
            .then((result: any) => {
                asyncOps.updateOperationStatus(
                    operationId,
                    OperationStatus.COMPLETED,
                    result
                );
            })
            .catch((error: any) => {
                asyncOps.updateOperationStatus(
                    operationId,
                    OperationStatus.FAILED,
                    undefined,
                    error.message || String(error)
                );
            });

        return operationId;
    }

    /**
     * Poll the execution status of a process
     *
     * @param operationId - The operation ID returned from executeWithReturnAsync
     * @returns Promise<OperationStatus> - Current status of the operation
     *
     * @example
     * ```typescript
     * const status = await processService.pollProcessExecution(operationId);
     * if (status === OperationStatus.COMPLETED) {
     *     console.log('Process completed!');
     * }
     * ```
     */
    public async pollProcessExecution(operationId: string): Promise<OperationStatus> {
        const asyncOps = (this.rest as any).asyncOperationService;
        if (!asyncOps) {
            throw new TM1Exception('AsyncOperationService not available');
        }

        return await asyncOps.pollProcessExecution(operationId);
    }

    /**
     * Cancel a running process execution
     *
     * @param operationId - The operation ID to cancel
     * @returns Promise<void>
     *
     * @example
     * ```typescript
     * await processService.cancelProcessExecution(operationId);
     * console.log('Process execution cancelled');
     * ```
     */
    public async cancelProcessExecution(operationId: string): Promise<void> {
        const asyncOps = (this.rest as any).asyncOperationService;
        if (!asyncOps) {
            throw new TM1Exception('AsyncOperationService not available');
        }

        await asyncOps.cancelAsyncOperation(operationId);
    }
}
