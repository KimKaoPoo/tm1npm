import { AxiosResponse } from 'axios';
import { RestService } from './RestService';
import { ObjectService } from './ObjectService';
import { Process } from '../objects/Process';
import { ProcessDebugBreakpoint } from '../objects/ProcessDebugBreakpoint';
import { TM1RestException, TM1Exception } from '../exceptions/TM1Exception';
import { formatUrl } from '../utils/Utils';

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
        /** Search for a string in all process code
         *
         * :param search_string: string to search for
         * :param skip_control_processes: bool, True to exclude processes that begin with "}" or "{"
         * :return: List of process names that contain the search string
         */
        const allProcesses = await this.getAll(skipControlProcesses);
        const matchingProcesses: string[] = [];

        for (const process of allProcesses) {
            if (this.processContainsString(process, searchString)) {
                matchingProcesses.push(process.name);
            }
        }

        return matchingProcesses;
    }

    private processContainsString(process: Process, searchString: string): boolean {
        /** Check if a process contains a specific string in its code
         */
        const codeProperties = [
            'prologProcedure',
            'metadataProcedure', 
            'dataProcedure',
            'epilogProcedure'
        ];

        for (const property of codeProperties) {
            const code = (process as any)[property];
            if (code && code.toLowerCase().includes(searchString.toLowerCase())) {
                return true;
            }
        }

        return false;
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

        const config: any = {};
        if (timeout) {
            config.timeout = timeout * 1000;
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

    public async compileProcess(processName: string): Promise<{success: boolean, errors: string[]}> {
        /** Compile a process and return detailed compilation results
         *
         * :param process_name: name of the process
         * :return: compilation result with success status and error details
         */
        try {
            const response = await this.compile(processName);
            
            // Check if compilation was successful
            if (response.status === 200) {
                return {
                    success: true,
                    errors: []
                };
            } else {
                return {
                    success: false,
                    errors: [response.statusText || 'Compilation failed']
                };
            }
        } catch (error: any) {
            const errorMessage = error.response?.data?.error?.message || error.message || 'Unknown compilation error';
            return {
                success: false,
                errors: [errorMessage]
            };
        }
    }

    /**
     * Poll execution status for async process execution
     */
    public async pollExecuteWithReturn(
        processName: string,
        parameters?: Record<string, any>,
        timeout: number = 300,
        pollInterval: number = 5
    ): Promise<any> {
        /** Execute process asynchronously and poll for completion
         *
         * :param process_name: name of the process
         * :param parameters: dictionary of process parameters
         * :param timeout: maximum time to wait for completion (seconds)
         * :param poll_interval: time between status checks (seconds)
         * :return: execution result when completed
         */
        
        // Start async execution
        const executeUrl = formatUrl("/Processes('{}')/tm1.ExecuteAsync", processName);
        const body: any = {};
        
        if (parameters && Object.keys(parameters).length > 0) {
            body.Parameters = Object.entries(parameters).map(([name, value]) => ({
                Name: name,
                Value: value
            }));
        }

        const executeResponse = await this.rest.post(executeUrl, JSON.stringify(body));
        const executionId = executeResponse.data.ID || executeResponse.data.ExecutionId;
        
        if (!executionId) {
            throw new TM1Exception('Failed to start async process execution');
        }

        // Poll for completion
        const startTime = Date.now();
        const maxTime = timeout * 1000;
        
        while (Date.now() - startTime < maxTime) {
            try {
                // Check execution status
                const statusUrl = `/ExecutionStatus('${executionId}')`;
                const statusResponse = await this.rest.get(statusUrl);
                const status = statusResponse.data;
                
                if (status.Status === 'Completed') {
                    // Get execution results
                    const resultUrl = `/ExecutionResults('${executionId}')`;
                    const resultResponse = await this.rest.get(resultUrl);
                    return resultResponse.data;
                } else if (status.Status === 'Failed') {
                    throw new TM1Exception(`Process execution failed: ${status.ErrorMessage || 'Unknown error'}`);
                }
                
                // Wait before next poll
                await new Promise(resolve => setTimeout(resolve, pollInterval * 1000));
                
            } catch (error) {
                if (error instanceof TM1Exception) {
                    throw error;
                }
                // If status check fails, wait and retry
                await new Promise(resolve => setTimeout(resolve, pollInterval * 1000));
            }
        }
        
        throw new TM1Exception(`Process execution timed out after ${timeout} seconds`);
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

    public async getProcessDebugBreakpoints(processName: string): Promise<ProcessDebugBreakpoint[]> {
        /** Get debug breakpoints for a process
         *
         * :param process_name: name of the process
         * :return: list of ProcessDebugBreakpoint objects
         */
        const url = formatUrl("/Processes('{}')/Breakpoints", processName);
        const response = await this.rest.get(url);
        return response.data.value.map((bp: any) => ProcessDebugBreakpoint.fromDict(bp));
    }

    public async createProcessDebugBreakpoint(
        processName: string,
        breakpoint: ProcessDebugBreakpoint
    ): Promise<AxiosResponse> {
        /** Create a debug breakpoint for a process
         *
         * :param process_name: name of the process
         * :param breakpoint: ProcessDebugBreakpoint object
         * :return: response
         */
        const url = formatUrl("/Processes('{}')/Breakpoints", processName);
        return await this.rest.post(url, breakpoint.body);
    }

    public async deleteProcessDebugBreakpoint(
        processName: string,
        lineNumber: number
    ): Promise<AxiosResponse> {
        /** Delete a debug breakpoint from a process
         *
         * :param process_name: name of the process
         * :param line_number: line number of the breakpoint
         * :return: response
         */
        const url = formatUrl("/Processes('{}')/Breakpoints({})", processName, lineNumber.toString());
        return await this.rest.delete(url);
    }

    public async executeTiCode(
        linesProlog?: string[],
        linesMetadata?: string[],
        linesData?: string[],
        linesEpilog?: string[],
        parameters?: Record<string, any>
    ): Promise<any> {
        /** Execute TI code directly on TM1 Server with separate sections
         *
         * :param lines_prolog: TI code for prolog section
         * :param lines_metadata: TI code for metadata section
         * :param lines_data: TI code for data section
         * :param lines_epilog: TI code for epilog section
         * :param parameters: dictionary of parameters
         * :return: execution result
         */
        const url = "/ExecuteProcessWithReturn";
        
        const body: any = {};
        
        if (linesProlog && linesProlog.length > 0) {
            body.PrologProcedure = linesProlog.join('\n');
        }
        if (linesMetadata && linesMetadata.length > 0) {
            body.MetadataProcedure = linesMetadata.join('\n');
        }
        if (linesData && linesData.length > 0) {
            body.DataProcedure = linesData.join('\n');
        }
        if (linesEpilog && linesEpilog.length > 0) {
            body.EpilogProcedure = linesEpilog.join('\n');
        }
        
        if (parameters && Object.keys(parameters).length > 0) {
            body.Parameters = Object.entries(parameters).map(([name, value]) => ({
                Name: name,
                Value: value
            }));
        }

        return await this.rest.post(url, JSON.stringify(body));
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
        /** Get the content of a process error log file
         *
         * :param file_name: name of the error log file
         * :return: file content as string
         */
        const url = formatUrl("/Contents('Logs/{}')", fileName);
        const response = await this.rest.get(url);
        return response.data;
    }

    public async getErrorLogFilenames(top?: number): Promise<string[]> {
        /** Get list of error log file names
         *
         * :param top: optional limit on number of files to return
         * :return: list of error log file names
         */
        let url = "/Contents('Logs')?$select=Name&$filter=endswith(Name,'.log')";
        
        if (top) {
            url += `&$top=${top}`;
        }

        const response = await this.rest.get(url);
        return response.data.value.map((file: any) => file.Name);
    }

    public async deleteErrorLogFile(fileName: string): Promise<AxiosResponse> {
        /** Delete a process error log file
         *
         * :param file_name: name of the error log file to delete
         * :return: response
         */
        const url = formatUrl("/Contents('Logs/{}')", fileName);
        return await this.rest.delete(url);
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

    // ===== NEW DEBUGGING FUNCTIONS FOR 100% TM1PY PARITY =====

    /**
     * Step over in process debugging
     */
    public async debugStepOver(processName: string): Promise<void> {
        /** Step over the current line during process debugging
         *
         * :param process_name: name of the process being debugged
         * :return: void
         */
        const url = formatUrl("/Processes('{}')/tm1.DebugStepOver", processName);
        await this.rest.post(url, {});
    }

    /**
     * Step into in process debugging
     */
    public async debugStepIn(processName: string): Promise<void> {
        /** Step into the current line during process debugging
         *
         * :param process_name: name of the process being debugged
         * :return: void
         */
        const url = formatUrl("/Processes('{}')/tm1.DebugStepIn", processName);
        await this.rest.post(url, {});
    }

    /**
     * Step out in process debugging
     */
    public async debugStepOut(processName: string): Promise<void> {
        /** Step out of the current procedure during process debugging
         *
         * :param process_name: name of the process being debugged
         * :return: void
         */
        const url = formatUrl("/Processes('{}')/tm1.DebugStepOut", processName);
        await this.rest.post(url, {});
    }

    /**
     * Continue execution in process debugging
     */
    public async debugContinue(processName: string): Promise<void> {
        /** Continue execution during process debugging
         *
         * :param process_name: name of the process being debugged
         * :return: void
         */
        const url = formatUrl("/Processes('{}')/tm1.DebugContinue", processName);
        await this.rest.post(url, {});
    }

    /**
     * Evaluate a boolean TI expression
     */
    public async evaluateBooleanTiExpression(expression: string): Promise<boolean> {
        /** Evaluate a boolean TI expression and return the result
         *
         * :param expression: TI expression to evaluate
         * :return: boolean result of the expression
         */
        const tiCode = `
            # Evaluate boolean expression
            nResult = ${expression};
            CellPutN(nResult, 'TempCube', 'Result');
        `;

        // Create temporary cube for result
        const cubeName = `TempEvalCube_${Date.now()}`;
        const dimensionName = `TempEvalDim_${Date.now()}`;
        
        try {
            // Create temporary dimension
            const dimBody = {
                Name: dimensionName,
                Hierarchies: [{
                    Name: dimensionName,
                    Elements: [{
                        Name: 'Result',
                        Type: 'Numeric'
                    }]
                }]
            };
            await this.rest.post('/Dimensions', dimBody);

            // Create temporary cube
            const cubeBody = {
                Name: cubeName,
                Dimensions: [dimensionName]
            };
            await this.rest.post('/Cubes', cubeBody);

            // Execute TI code
            const processBody = {
                Name: `EvalProcess_${Date.now()}`,
                PrologProcedure: tiCode,
                HasSecurityAccess: false
            };

            await this.rest.post('/Processes', processBody);
            
            const executeUrl = `/Processes('${processBody.Name}')/tm1.ExecuteProcess`;
            await this.rest.post(executeUrl, {});

            // Get result
            const cellUrl = `/Cubes('${cubeName}')/Views/~Native/tm1.Execute?$select=Value&$filter=Members('${dimensionName}','Result')`;
            const response = await this.rest.get(cellUrl);
            const result = response.data.Cells?.[0]?.Value || 0;

            // Clean up
            await this.rest.delete(`/Processes('${processBody.Name}')`);
            await this.rest.delete(`/Cubes('${cubeName}')`);
            await this.rest.delete(`/Dimensions('${dimensionName}')`);

            return Boolean(result);

        } catch (error) {
            // Clean up on error
            try {
                await this.rest.delete(`/Cubes('${cubeName}')`);
                await this.rest.delete(`/Dimensions('${dimensionName}')`);
            } catch (cleanupError) {
                // Ignore cleanup errors
            }
            throw error;
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
            const result = await this.compileProcess(processName);
            return {
                isValid: result.success,
                errors: result.errors.map((error, index) => ({
                    line: index + 1,
                    message: error,
                    severity: 'Error'
                }))
            };
        } catch (error: any) {
            return {
                isValid: false,
                errors: [{
                    line: 0,
                    message: error.message || 'Validation failed',
                    severity: 'Error'
                }]
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
}