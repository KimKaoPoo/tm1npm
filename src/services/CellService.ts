/**
 * CellService implementation for TM1 cube data operations
 * Handles reading, writing, and manipulation of cube cell data
 */

import { RestService } from './RestService';

export interface CellsetDict {
    [coordinates: string]: any;
}

export interface WriteOptions {
    increment?: boolean;
    sandbox_name?: string;
    use_ti?: boolean;
    use_blob?: boolean;
    precision?: number;
    skip_non_updateable?: boolean;
    measure_dimension_elements?: { [key: string]: any };
    allow_spread?: boolean;
    deactivate_transaction_log?: boolean;
    reactivate_transaction_log?: boolean;
    use_changeset?: boolean;
}

export interface MDXViewOptions {
    private?: boolean;
    use_iterative_json?: boolean;
    use_blob?: boolean;
    element_unique_names?: boolean;
    skip_zeros?: boolean;
    skip_consolidated?: boolean;
    skip_rule_derived?: boolean;
    csv_dialect?: any;
    sandbox_name?: string;
    use_compact_json?: boolean;
    mdx_headers?: boolean;
}

export class CellService {
    private rest: RestService;

    constructor(rest: RestService) {
        this.rest = rest;
    }

    /**
     * Read a single cell value from a cube
     */
    public async getValue(cubeName: string, coordinates: string[]): Promise<any> {
        const url = `/Cubes('${cubeName}')/tm1.GetCellValue(coordinates=[${coordinates.map(c => `'${c}'`).join(',')}])`;
        const response = await this.rest.get(url);
        return response.data.value;
    }

    /**
     * Write a single cell value to a cube
     */
    public async writeValue(cubeName: string, coordinates: string[], value: any): Promise<void> {
        const url = `/Cubes('${cubeName}')/tm1.Update`;
        const body = {
            Cells: [{
                Coordinates: coordinates.map(c => ({ Name: c })),
                Value: value
            }]
        };
        await this.rest.patch(url, body);
    }

    /**
     * Read multiple cell values from a cube based on coordinate sets
     */
    public async getValues(
        cubeName: string, 
        elementSets: string[][], 
        dimensions?: string[],
        sandbox_name?: string
    ): Promise<any[]> {
        if (!elementSets || elementSets.length === 0) {
            return [];
        }

        // Build coordinate tuples for bulk read
        const coordinateTuples = elementSets.map(elements => 
            elements.map(element => `'${element}'`).join(',')
        );

        let url = `/Cubes('${cubeName}')/tm1.GetCellValues(coordinates=[${coordinateTuples.join('],[')}])`;
        
        if (sandbox_name) {
            url += `?$sandbox=${sandbox_name}`;
        }

        const response = await this.rest.get(url);
        return response.data.value || [];
    }

    /**
     * Write multiple cell values using dictionary format
     * {coordinate_string: value} format for bulk writes
     */
    public async write(
        cubeName: string, 
        cellsetAsDict: CellsetDict, 
        dimensions?: string[],
        options: WriteOptions = {}
    ): Promise<void> {
        const cells = Object.entries(cellsetAsDict).map(([coordinates, value]) => {
            const elementArray = coordinates.split(',').map(s => s.trim());
            return {
                Coordinates: elementArray.map(element => ({ Name: element })),
                Value: value
            };
        });

        let url = `/Cubes('${cubeName}')/tm1.Update`;
        
        if (options.sandbox_name) {
            url += `?$sandbox=${options.sandbox_name}`;
        }

        const body = {
            Cells: cells,
            ...(options.increment && { Increment: true }),
            ...(options.allow_spread && { AllowSpread: true })
        };

        await this.rest.patch(url, body);
    }

    /**
     * Execute a view and return the data
     */
    public async executeView(
        cubeName: string, 
        viewName: string, 
        options: MDXViewOptions = {}
    ): Promise<any> {
        let url = `/Cubes('${cubeName}')/Views('${viewName}')/tm1.Execute`;
        
        const params = new URLSearchParams();
        if (options.private !== undefined) params.append('$private', options.private.toString());
        if (options.sandbox_name) params.append('$sandbox', options.sandbox_name);
        if (options.element_unique_names !== undefined) params.append('$element_unique_names', options.element_unique_names.toString());
        if (options.skip_zeros !== undefined) params.append('$skip_zeros', options.skip_zeros.toString());
        if (options.skip_consolidated !== undefined) params.append('$skip_consolidated', options.skip_consolidated.toString());
        if (options.skip_rule_derived !== undefined) params.append('$skip_rule_derived', options.skip_rule_derived.toString());

        if (params.toString()) {
            url += `?${params.toString()}`;
        }

        const response = await this.rest.post(url);
        return response.data;
    }

    /**
     * Execute MDX and return structured data (DataFrame-like)
     */
    public async executeMdxDataFrame(
        mdx: string, 
        options: MDXViewOptions = {}
    ): Promise<any> {
        let url = '/ExecuteMDXDataFrameShaped';
        
        const params = new URLSearchParams();
        if (options.sandbox_name) params.append('$sandbox', options.sandbox_name);
        if (options.element_unique_names !== undefined) params.append('$element_unique_names', options.element_unique_names.toString());
        if (options.skip_zeros !== undefined) params.append('$skip_zeros', options.skip_zeros.toString());
        if (options.use_compact_json !== undefined) params.append('$use_compact_json', options.use_compact_json.toString());

        if (params.toString()) {
            url += `?${params.toString()}`;
        }

        const body = { 
            MDX: mdx,
            ...(options.mdx_headers !== undefined && { MDXHeaders: options.mdx_headers })
        };
        
        const response = await this.rest.post(url, body);
        return response.data;
    }

    /**
     * Execute MDX and return CSV data
     */
    public async executeMdxCsv(
        mdx: string, 
        options: MDXViewOptions = {}
    ): Promise<string> {
        let url = '/ExecuteMDXCSV';
        
        const params = new URLSearchParams();
        if (options.sandbox_name) params.append('$sandbox', options.sandbox_name);
        if (options.element_unique_names !== undefined) params.append('$element_unique_names', options.element_unique_names.toString());
        if (options.skip_zeros !== undefined) params.append('$skip_zeros', options.skip_zeros.toString());

        if (params.toString()) {
            url += `?${params.toString()}`;
        }

        const body = { MDX: mdx };
        const response = await this.rest.post(url, body);
        return response.data;
    }

    /**
     * Execute view and return CSV data
     */
    public async executeViewCsv(
        cubeName: string, 
        viewName: string, 
        options: MDXViewOptions = {}
    ): Promise<string> {
        let url = `/Cubes('${cubeName}')/Views('${viewName}')/tm1.ExecuteCSV`;
        
        const params = new URLSearchParams();
        if (options.private !== undefined) params.append('$private', options.private.toString());
        if (options.sandbox_name) params.append('$sandbox', options.sandbox_name);
        if (options.element_unique_names !== undefined) params.append('$element_unique_names', options.element_unique_names.toString());
        if (options.skip_zeros !== undefined) params.append('$skip_zeros', options.skip_zeros.toString());

        if (params.toString()) {
            url += `?${params.toString()}`;
        }

        const response = await this.rest.post(url);
        return response.data;
    }

    /**
     * Create a cellset for advanced operations
     */
    public async createCellset(mdx: string, sandbox_name?: string): Promise<string> {
        let url = '/Cellsets';
        
        if (sandbox_name) {
            url += `?$sandbox=${sandbox_name}`;
        }

        const body = { MDX: mdx };
        const response = await this.rest.post(url, body);
        
        // Extract cellset ID from response location or data
        if (response.headers?.location) {
            const matches = response.headers.location.match(/Cellsets\('([^']+)'\)/);
            return matches ? matches[1] : '';
        }
        
        return response.data?.ID || '';
    }

    /**
     * Delete a cellset
     */
    public async deleteCellset(cellsetId: string, sandbox_name?: string): Promise<void> {
        let url = `/Cellsets('${cellsetId}')`;
        
        if (sandbox_name) {
            url += `?$sandbox=${sandbox_name}`;
        }

        await this.rest.delete(url);
    }

    /**
     * Extract data from cellset
     */
    public async extractCellset(
        cellsetId: string, 
        expand_axes: boolean = true,
        sandbox_name?: string
    ): Promise<any> {
        let url = `/Cellsets('${cellsetId}')`;
        
        const params = new URLSearchParams();
        if (expand_axes) params.append('$expand', 'Axes,Cells');
        if (sandbox_name) params.append('$sandbox', sandbox_name);

        if (params.toString()) {
            url += `?${params.toString()}`;
        }

        const response = await this.rest.get(url);
        return response.data;
    }

    /**
     * Clear cube data with MDX filter
     */
    public async clearWithMdx(cubeName: string, mdx: string, sandbox_name?: string): Promise<void> {
        let url = `/Cubes('${cubeName}')/tm1.Clear`;
        
        if (sandbox_name) {
            url += `?$sandbox=${sandbox_name}`;
        }

        const body = { MDX: mdx };
        await this.rest.post(url, body);
    }

    /**
     * Trace cell calculation (show contributing factors)
     */
    public async traceCellCalculation(
        cubeName: string, 
        coordinates: string[],
        sandbox_name?: string
    ): Promise<any> {
        const coordinateString = coordinates.map(c => `'${c}'`).join(',');
        let url = `/Cubes('${cubeName}')/tm1.TraceCellCalculation(coordinates=[${coordinateString}])`;
        
        if (sandbox_name) {
            url += `?$sandbox=${sandbox_name}`;
        }

        const response = await this.rest.get(url);
        return response.data;
    }

    /**
     * Trace cell feeders (show what feeds into a cell)
     */
    public async traceCellFeeders(
        cubeName: string, 
        coordinates: string[],
        sandbox_name?: string
    ): Promise<any> {
        const coordinateString = coordinates.map(c => `'${c}'`).join(',');
        let url = `/Cubes('${cubeName}')/tm1.TraceCellFeeders(coordinates=[${coordinateString}])`;
        
        if (sandbox_name) {
            url += `?$sandbox=${sandbox_name}`;
        }

        const response = await this.rest.get(url);
        return response.data;
    }

    /**
     * Begin a changeset for grouped write operations
     */
    public async beginChangeset(): Promise<string> {
        const url = '/BeginChangeset';
        const response = await this.rest.post(url);
        return response.data.ID || response.data.id || '';
    }

    /**
     * End a changeset
     */
    public async endChangeset(changesetId: string): Promise<void> {
        const url = `/EndChangeset('${changesetId}')`;
        await this.rest.post(url);
    }

    /**
     * Undo a changeset
     */
    public async undoChangeset(changesetId: string): Promise<void> {
        const url = `/UndoChangeset('${changesetId}')`;
        await this.rest.post(url);
    }

    /**
     * Activate transaction log for a cube
     */
    public async activateTransactionlog(cubeName: string): Promise<void> {
        const url = `/Cubes('${cubeName}')/tm1.ActivateTransactionLog`;
        await this.rest.post(url);
    }

    /**
     * Deactivate transaction log for a cube
     */
    public async deactivateTransactionlog(cubeName: string): Promise<void> {
        const url = `/Cubes('${cubeName}')/tm1.DeactivateTransactionLog`;
        await this.rest.post(url);
    }

    /**
     * Write data through DataFrame format
     */
    public async writeDataframe(
        cubeName: string, 
        dataFrame: any[][],  // Array of arrays representing tabular data
        dimensions: string[],
        options: WriteOptions = {}
    ): Promise<void> {
        const cells = dataFrame.map(row => ({
            Coordinates: row.slice(0, dimensions.length).map(coord => ({ Name: coord })),
            Value: row[dimensions.length] // Last column is the value
        }));

        let url = `/Cubes('${cubeName}')/tm1.Update`;
        
        if (options.sandbox_name) {
            url += `?$sandbox=${options.sandbox_name}`;
        }

        const body = {
            Cells: cells,
            ...(options.increment && { Increment: true }),
            ...(options.allow_spread && { AllowSpread: true })
        };

        await this.rest.patch(url, body);
    }

    /**
     * Write data asynchronously
     */
    public async writeAsync(
        cubeName: string,
        cellsetAsDict: CellsetDict,
        dimensions?: string[],
        options: WriteOptions = {}
    ): Promise<string> {
        const cells = Object.entries(cellsetAsDict).map(([coordinates, value]) => {
            const elementArray = coordinates.split(',').map(s => s.trim());
            return {
                Coordinates: elementArray.map(element => ({ Name: element })),
                Value: value
            };
        });

        let url = `/Cubes('${cubeName}')/tm1.UpdateAsync`;
        
        if (options.sandbox_name) {
            url += `?$sandbox=${options.sandbox_name}`;
        }

        const body = { Cells: cells };
        const response = await this.rest.patch(url, body);
        
        // Return async operation ID
        return response.data.ID || response.headers['async-id'] || '';
    }

    /**
     * Write through unbound process (TI-based writing)
     */
    public async writeThroughUnboundProcess(
        cubeName: string,
        cellsetAsDict: CellsetDict,
        processName?: string,
        options: WriteOptions = {}
    ): Promise<any> {
        // Create TI statements for bulk writing
        let tiStatements = '';
        
        for (const [coordinates, value] of Object.entries(cellsetAsDict)) {
            const coords = coordinates.split(',').map(s => `'${s.trim()}'`).join(',');
            tiStatements += `CubeDataSet('${cubeName}', ${coords}, ${value});\n`;
        }

        const tempProcessName = processName || `tm1npm_write_${Date.now()}`;
        
        // Execute TI code directly
        const url = "/ExecuteProcessWithReturn";
        const body = {
            Name: tempProcessName,
            PrologProcedure: tiStatements,
            ...(options.sandbox_name && { Sandbox: options.sandbox_name })
        };

        return await this.rest.post(url, body);
    }

    /**
     * Write through blob upload (for large datasets)
     */
    public async writeThroughBlob(
        cubeName: string,
        csvData: string,
        options: WriteOptions = {}
    ): Promise<any> {
        // First upload CSV data as blob
        const blobUrl = '/Blobs';
        const blobResponse = await this.rest.post(blobUrl, csvData, {
            headers: { 'Content-Type': 'text/csv' }
        });
        
        const blobId = blobResponse.data.ID;
        
        // Then execute cube load from blob
        let url = `/Cubes('${cubeName}')/tm1.LoadFromBlob`;
        
        if (options.sandbox_name) {
            url += `?$sandbox=${options.sandbox_name}`;
        }

        const body = { BlobId: blobId };
        return await this.rest.post(url, body);
    }

    /**
     * Execute MDX and return element-value dictionary
     */
    public async executeMdxElementsValueDict(
        mdx: string,
        sandbox_name?: string
    ): Promise<{ [element: string]: any }> {
        let url = '/ExecuteMDXElementsValue';
        
        if (sandbox_name) {
            url += `?$sandbox=${sandbox_name}`;
        }

        const body = { MDX: mdx };
        const response = await this.rest.post(url, body);
        
        return response.data || {};
    }

    /**
     * Clear data based on DataFrame coordinates
     */
    public async clearWithDataframe(
        cubeName: string,
        dataFrame: any[][],
        dimensions: string[],
        sandbox_name?: string
    ): Promise<void> {
        // Build MDX filter from DataFrame coordinates
        const coordinates = dataFrame.map(row => 
            row.slice(0, dimensions.length).map(coord => `'${coord}'`).join(',')
        );
        
        const mdxFilter = coordinates.map(coord => `(${coord})`).join(',');
        const mdx = `{${mdxFilter}}`;
        
        await this.clearWithMdx(cubeName, mdx, sandbox_name);
    }

    /**
     * Execute proportional spread
     */
    public async relativeProportionalSpread(
        cubeName: string,
        targetCoordinates: string[],
        value: number,
        options: MDXViewOptions = {}
    ): Promise<void> {
        const coordinateString = targetCoordinates.map(c => `'${c}'`).join(',');
        let url = `/Cubes('${cubeName}')/tm1.ProportionalSpread(coordinates=[${coordinateString}],value=${value})`;
        
        if (options.sandbox_name) {
            url += `?$sandbox=${options.sandbox_name}`;
        }

        await this.rest.post(url);
    }

    /**
     * Execute clear spread
     */
    public async clearSpread(
        cubeName: string,
        targetCoordinates: string[],
        options: MDXViewOptions = {}
    ): Promise<void> {
        const coordinateString = targetCoordinates.map(c => `'${c}'`).join(',');
        let url = `/Cubes('${cubeName}')/tm1.ClearSpread(coordinates=[${coordinateString}])`;
        
        if (options.sandbox_name) {
            url += `?$sandbox=${options.sandbox_name}`;
        }

        await this.rest.post(url);
    }

    /**
     * Check cell feeders
     */
    public async checkCellFeeders(
        cubeName: string,
        coordinates: string[],
        sandbox_name?: string
    ): Promise<boolean> {
        const coordinateString = coordinates.map(c => `'${c}'`).join(',');
        let url = `/Cubes('${cubeName}')/tm1.CheckCellFeeders(coordinates=[${coordinateString}])`;
        
        if (sandbox_name) {
            url += `?$sandbox=${sandbox_name}`;
        }

        const response = await this.rest.get(url);
        return response.data.value === true;
    }
    /**
     * Write multiple cell values to a cube (legacy method name for compatibility)
     */
    public async writeValues(cubeName: string, cellset: { [key: string]: any }): Promise<void> {
        const cells = Object.entries(cellset).map(([key, value]) => {
            const coordinates = key.split(':');
            return {
                Coordinates: coordinates.map(c => ({ Name: c })),
                Value: value
            };
        });

        const url = `/Cubes('${cubeName}')/tm1.Update`;
        const body = { Cells: cells };
        await this.rest.patch(url, body);
    }

    /**
     * Execute an MDX query
     */
    public async executeMdx(mdx: string): Promise<any> {
        const url = '/ExecuteMDX';
        const body = { MDX: mdx };
        const response = await this.rest.post(url, body);
        return response.data;
    }

    /**
     * Clear all data in a cube
     */
    public async clearCube(cubeName: string): Promise<void> {
        const url = `/Cubes('${cubeName}')/tm1.Clear`;
        await this.rest.post(url);
    }

    /**
     * Execute MDX query and return data in DataFrame shape
     */
    public async executeMdxDataFrameShaped(mdx: string): Promise<any> {
        const url = '/ExecuteMDXDataFrameShaped';
        const body = { MDX: mdx };
        const response = await this.rest.post(url, body);
        return response.data;
    }

    /**
     * Execute view and return data in DataFrame shape
     */
    public async executeViewDataFrameShaped(
        cubeName: string, 
        viewName: string, 
        isPrivate?: boolean, 
        useIterativeJson?: boolean, 
        useBlob?: boolean
    ): Promise<any> {
        let url = `/Cubes('${cubeName}')/Views('${viewName}')/tm1.ExecuteDataFrameShaped`;
        
        const params = [];
        if (isPrivate !== undefined) params.push(`$private=${isPrivate}`);
        if (useIterativeJson !== undefined) params.push(`$iterativeJson=${useIterativeJson}`);
        if (useBlob !== undefined) params.push(`$blob=${useBlob}`);
        
        if (params.length > 0) {
            url += `?${params.join('&')}`;
        }
        
        const response = await this.rest.post(url);
        return response.data;
    }

    // ===== NEW ASYNC FUNCTIONS FOR 100% TM1PY PARITY =====

    /**
     * Write DataFrame data asynchronously for better performance
     */
    public async writeDataframeAsync(
        cubeName: string, 
        dataFrame: any[][], 
        dimensions: string[], 
        options: WriteOptions = {}
    ): Promise<string> {
        /** Write DataFrame data asynchronously and return execution ID
         *
         * :param cubeName: name of the cube
         * :param dataFrame: 2D array with data to write
         * :param dimensions: array of dimension names
         * :param options: write options including sandbox_name
         * :return: execution ID for tracking async operation
         */
        
        // Convert DataFrame to cellset format
        const headers = dataFrame[0];
        const cellsetAsDict: CellsetDict = {};

        for (let i = 1; i < dataFrame.length; i++) {
            const row = dataFrame[i];
            const coordinates: string[] = [];
            let value: any = null;

            for (let j = 0; j < dimensions.length; j++) {
                coordinates.push(String(row[j]));
            }
            
            // Last column is typically the value
            value = row[row.length - 1];
            
            const coordinateKey = coordinates.join(',');
            cellsetAsDict[coordinateKey] = value;
        }

        // Use async write through process
        const processName = `AsyncWrite_${Date.now()}`;
        const tiCode = `
            # Async DataFrame write
            ${Object.entries(cellsetAsDict).map(([coords, value]) => {
                const coordArray = coords.split(',').map(c => `'${c}'`).join(',');
                return `CellPutN(${value}, '${cubeName}', ${coordArray});`;
            }).join('\n')}
        `;

        const processBody = {
            Name: processName,
            PrologProcedure: tiCode,
            HasSecurityAccess: false
        };

        // Create and execute process asynchronously
        await this.rest.post('/Processes', processBody);
        
        const executeUrl = `/Processes('${processName}')/tm1.ExecuteProcessAsync`;
        const execResponse = await this.rest.post(executeUrl, {
            sandbox_name: options.sandbox_name
        });

        // Return execution ID for polling
        return execResponse.data.ID || processName;
    }

    /**
     * Execute MDX query asynchronously
     */
    public async executeMdxAsync(mdx: string, sandbox_name?: string): Promise<string> {
        /** Execute MDX query asynchronously and return execution ID
         *
         * :param mdx: MDX query to execute
         * :param sandbox_name: optional sandbox name
         * :return: execution ID for tracking async operation
         */
        const url = '/ExecuteMDXAsync';
        const body = { 
            MDX: mdx,
            sandbox_name: sandbox_name 
        };
        
        const response = await this.rest.post(url, body);
        return response.data.ID || response.data.ExecutionId || `async_${Date.now()}`;
    }

    /**
     * Poll execution status for async operations
     */
    public async pollExecuteWithReturn(executionId: string): Promise<any> {
        /** Poll the status of an async execution and return results when complete
         *
         * :param executionId: ID of the async execution to poll
         * :return: execution results when complete
         */
        const maxPollingAttempts = 100;
        const pollingInterval = 1000; // 1 second
        
        for (let attempt = 0; attempt < maxPollingAttempts; attempt++) {
            try {
                // Check if it's a process execution
                const statusUrl = `/Processes('${executionId}')/tm1.ExecutionStatus`;
                const statusResponse = await this.rest.get(statusUrl);
                
                const status = statusResponse.data.Status;
                
                if (status === 'CompletedSuccessfully') {
                    // Get results
                    const resultUrl = `/Processes('${executionId}')/tm1.ExecutionResult`;
                    const resultResponse = await this.rest.get(resultUrl);
                    
                    // Clean up process
                    await this.rest.delete(`/Processes('${executionId}')`);
                    
                    return resultResponse.data;
                } else if (status === 'Failed' || status === 'CompletedWithError') {
                    // Get error information
                    const errorUrl = `/Processes('${executionId}')/tm1.ExecutionError`;
                    const errorResponse = await this.rest.get(errorUrl);
                    
                    // Clean up process
                    await this.rest.delete(`/Processes('${executionId}')`);
                    
                    throw new Error(`Async execution failed: ${errorResponse.data.Message || 'Unknown error'}`);
                } else if (status === 'Running' || status === 'Queued') {
                    // Still running, wait and poll again
                    await new Promise(resolve => setTimeout(resolve, pollingInterval));
                    continue;
                }
            } catch (error) {
                // Try alternative polling for MDX executions
                try {
                    const mdxStatusUrl = `/MDXExecutions('${executionId}')`;
                    const mdxStatusResponse = await this.rest.get(mdxStatusUrl);
                    
                    if (mdxStatusResponse.data.Status === 'Completed') {
                        return mdxStatusResponse.data.Result;
                    } else if (mdxStatusResponse.data.Status === 'Failed') {
                        throw new Error(`MDX execution failed: ${mdxStatusResponse.data.Error || 'Unknown error'}`);
                    }
                } catch (mdxError) {
                    // If both polling methods fail, wait and try again
                    await new Promise(resolve => setTimeout(resolve, pollingInterval));
                    continue;
                }
            }
        }
        
        throw new Error(`Async execution ${executionId} timed out after ${maxPollingAttempts} polling attempts`);
    }
}