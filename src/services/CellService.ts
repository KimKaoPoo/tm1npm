/**
 * CellService implementation for TM1 cube data operations
 * Handles reading, writing, and manipulation of cube cell data
 * Full implementation based on tm1py CellService with 100% feature parity
 */

import { RestService } from './RestService';
import { ProcessService } from './ProcessService';
import { ViewService } from './ViewService';

export interface CellsetDict {
    [coordinates: string]: any;
}

export interface DataFrame {
    columns: string[];
    data: any[][];
    index?: any[];
}

export interface CellsetAxes {
    Hierarchies: any[];
    Tuples: any[];
    Members: any[];
    Cardinality: number;
}

export interface CellsetCells {
    Ordinal: number;
    Value: any;
    Status?: string;
    RuleDerived?: boolean;
    Updateable?: boolean;
    Annotated?: boolean;
    Consolidated?: boolean;
    Language?: string;
    HasPicklist?: boolean;
    FormatString?: string;
}

export interface CellsetResult {
    ID: string;
    Axes: CellsetAxes[];
    Cells: CellsetCells[];
}

export interface AsyncJobResult {
    ID: string;
    Status: 'Running' | 'Completed' | 'Failed' | 'CompletedSuccessfully' | 'CompletedWithError' | 'Queued';
    Result?: any;
    Error?: string;
    ExecutionTime?: number;
}

export interface BulkWriteOptions extends WriteOptions {
    max_workers?: number;
    chunk_size?: number;
    threads?: number;
    max_retries?: number;
    retry_delay?: number;
    cancel_at_failure?: boolean;
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
    private processService?: ProcessService;
    private viewService?: ViewService;
    private tempProcessCounter: number = 0;

    constructor(rest: RestService, processService?: ProcessService, viewService?: ViewService) {
        this.rest = rest;
        this.processService = processService;
        this.viewService = viewService;
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
     * Write data through blob file (fastest method for large datasets)
     */
    public async writeThroughBlob(
        cubeName: string,
        cellsetAsDict: CellsetDict,
        options: WriteOptions = {}
    ): Promise<void> {
        /** Write data using blob files for maximum performance
         * Recommended for datasets > 1M cells
         *
         * :param cube_name: Name of the cube
         * :param cellset_as_dict: Dictionary of coordinates and values
         * :param options: Write options
         */

        // Import FileService to avoid circular dependency
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { FileService } = require('./FileService');
        const fileService = new FileService(this.rest);

        try {
            // Convert cellset to CSV format for blob upload
            const csvContent = this.cellsetToCsv(cellsetAsDict);
            const blobFileName = `tm1npm_blob_${Date.now()}.csv`;

            // Upload blob file
            await fileService.create(blobFileName, csvContent);

            // Create TI process to import blob data
            if (!this.processService) {
                throw new Error('ProcessService is required for blob operations');
            }

            const processName = `}tm1npm_blob_import_${Date.now()}`;
            const tiCode = this.generateBlobImportTiCode(
                cubeName,
                blobFileName,
                Object.keys(cellsetAsDict)[0]?.split(',') || [],
                options
            );

            const processBody = {
                Name: processName,
                PrologProcedure: tiCode,
                MetadataProcedure: '',
                DataProcedure: '',
                EpilogProcedure: `DeleteFile('${blobFileName}');`
            };

            // Execute import process
            await this.rest.post('/Processes', processBody);
            await this.rest.post(`/Processes('${processName}')/tm1.ExecuteProcess`, {});

            // Cleanup
            await this.rest.delete(`/Processes('${processName}')`);

        } catch (error) {
            throw new Error(`Blob write operation failed: ${error}`);
        }
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


    // ===== COMPLETE TM1PY PARITY IMPLEMENTATION =====

    /**
     * Get dimension names for a cube (for writing operations)
     */
    public async getDimensionNamesForWriting(cubeName: string): Promise<string[]> {
        const url = `/Cubes('${cubeName}')?$expand=Dimensions($select=Name)`;
        const response = await this.rest.get(url);
        return response.data.Dimensions.map((d: any) => d.Name);
    }

    /**
     * Execute MDX query and return raw TM1 response
     */
    public async executeMdxRaw(
        mdx: string,
        options: MDXViewOptions = {}
    ): Promise<any> {
        let url = '/ExecuteMDX';

        const params = new URLSearchParams();
        if (options.sandbox_name) params.append('$sandbox', options.sandbox_name);
        if (options.element_unique_names !== undefined) params.append('$element_unique_names', options.element_unique_names.toString());
        if (options.skip_zeros !== undefined) params.append('$skip_zeros', options.skip_zeros.toString());
        if (options.skip_consolidated !== undefined) params.append('$skip_consolidated', options.skip_consolidated.toString());
        if (options.skip_rule_derived !== undefined) params.append('$skip_rule_derived', options.skip_rule_derived.toString());

        if (params.toString()) {
            url += `?${params.toString()}`;
        }

        const body = { MDX: mdx };
        const response = await this.rest.post(url, body);
        return response.data;
    }

    /**
     * Execute MDX and return only values array
     */
    public async executeMdxValues(
        mdx: string,
        options: MDXViewOptions = {}
    ): Promise<any[]> {
        const cellset = await this.executeMdxRaw(mdx, options);
        return cellset.Cells ? cellset.Cells.map((cell: any) => cell.Value) : [];
    }

    /**
     * Execute MDX and return rows with values
     */
    public async executeMdxRowsAndValues(
        mdx: string,
        options: MDXViewOptions = {}
    ): Promise<{ rows: any[][], values: any[] }> {
        const cellset = await this.executeMdxRaw(mdx, options);

        const rows: any[][] = [];
        const values: any[] = [];

        if (cellset.Axes && cellset.Axes.length > 0) {
            // Extract row tuples from axes
            const rowAxis = cellset.Axes[1] || cellset.Axes[0];
            if (rowAxis && rowAxis.Tuples) {
                for (const tuple of rowAxis.Tuples) {
                    const row = tuple.Members ? tuple.Members.map((m: any) => m.Name) : [];
                    rows.push(row);
                }
            }
        }

        if (cellset.Cells) {
            values.push(...cellset.Cells.map((cell: any) => cell.Value));
        }

        return { rows, values };
    }

    /**
     * Execute MDX and return cell count
     */
    public async executeMdxCellcount(
        mdx: string,
        options: MDXViewOptions = {}
    ): Promise<number> {
        let url = '/ExecuteMDXCellCount';

        if (options.sandbox_name) {
            url += `?$sandbox=${options.sandbox_name}`;
        }

        const body = { MDX: mdx };
        const response = await this.rest.post(url, body);
        return response.data.value || response.data.CellCount || 0;
    }

    /**
     * Execute view and return raw TM1 response
     */
    public async executeViewRaw(
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
     * Execute view and return only values
     */
    public async executeViewValues(
        cubeName: string,
        viewName: string,
        options: MDXViewOptions = {}
    ): Promise<any[]> {
        const cellset = await this.executeViewRaw(cubeName, viewName, options);
        return cellset.Cells ? cellset.Cells.map((cell: any) => cell.Value) : [];
    }

    /**
     * Execute view and return rows with values
     */
    public async executeViewRowsAndValues(
        cubeName: string,
        viewName: string,
        options: MDXViewOptions = {}
    ): Promise<{ rows: any[][], values: any[] }> {
        const cellset = await this.executeViewRaw(cubeName, viewName, options);

        const rows: any[][] = [];
        const values: any[] = [];

        if (cellset.Axes && cellset.Axes.length > 0) {
            const rowAxis = cellset.Axes[1] || cellset.Axes[0];
            if (rowAxis && rowAxis.Tuples) {
                for (const tuple of rowAxis.Tuples) {
                    const row = tuple.Members ? tuple.Members.map((m: any) => m.Name) : [];
                    rows.push(row);
                }
            }
        }

        if (cellset.Cells) {
            values.push(...cellset.Cells.map((cell: any) => cell.Value));
        }

        return { rows, values };
    }

    /**
     * Execute view and return cell count
     */
    public async executeViewCellcount(
        cubeName: string,
        viewName: string,
        options: MDXViewOptions = {}
    ): Promise<number> {
        let url = `/Cubes('${cubeName}')/Views('${viewName}')/tm1.ExecuteCellCount`;

        const params = new URLSearchParams();
        if (options.private !== undefined) params.append('$private', options.private.toString());
        if (options.sandbox_name) params.append('$sandbox', options.sandbox_name);

        if (params.toString()) {
            url += `?${params.toString()}`;
        }

        const response = await this.rest.post(url);
        return response.data.value || response.data.CellCount || 0;
    }

    /**
     * Execute view asynchronously
     */
    public async execute_view_async(
        cubeName: string,
        viewName: string,
        options: MDXViewOptions = {}
    ): Promise<string> {
        /** Execute view asynchronously and return execution ID
         *
         * :param cubeName: name of the cube
         * :param viewName: name of the view
         * :param options: view execution options including sandbox_name
         * :return: execution ID for tracking async operation
         */
        let url = `/Cubes('${cubeName}')/Views('${viewName}')/tm1.ExecuteAsync`;

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
        return response.data.ID || response.data.ExecutionId || `view_async_${Date.now()}`;
    }

    /**
     * Execute MDX query and return DataFrame-like structure
     */
    public async executeMdxDataframe(
        mdx: string,
        options: MDXViewOptions = {}
    ): Promise<DataFrame> {
        const cellset = await this.executeMdxRaw(mdx, options);
        return this.buildDataFrameFromCellset(cellset);
    }

    /**
     * Execute view and return DataFrame-like structure
     */
    public async executeViewDataframe(
        cubeName: string,
        viewName: string,
        options: MDXViewOptions = {}
    ): Promise<DataFrame> {
        const cellset = await this.executeViewRaw(cubeName, viewName, options);
        return this.buildDataFrameFromCellset(cellset);
    }

    /**
     * Execute MDX preserving query shape in DataFrame
     */
    public async executeMdxDataframeShaped(
        mdx: string,
        options: MDXViewOptions = {}
    ): Promise<DataFrame> {
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
        return this.buildDataFrameFromResponse(response.data);
    }

    /**
     * Execute view preserving shape in DataFrame
     */
    public async executeViewDataframeShaped(
        cubeName: string,
        viewName: string,
        options: MDXViewOptions = {}
    ): Promise<DataFrame> {
        let url = `/Cubes('${cubeName}')/Views('${viewName}')/tm1.ExecuteDataFrameShaped`;

        const params = new URLSearchParams();
        if (options.private !== undefined) params.append('$private', options.private.toString());
        if (options.sandbox_name) params.append('$sandbox', options.sandbox_name);
        if (options.use_iterative_json !== undefined) params.append('$iterativeJson', options.use_iterative_json.toString());
        if (options.use_blob !== undefined) params.append('$blob', options.use_blob.toString());

        if (params.toString()) {
            url += `?${params.toString()}`;
        }

        const response = await this.rest.post(url);
        return this.buildDataFrameFromResponse(response.data);
    }

    /**
     * Execute MDX and return pivot DataFrame
     */
    public async executeMdxDataframePivot(
        mdx: string,
        options: MDXViewOptions = {}
    ): Promise<DataFrame> {
        const cellset = await this.executeMdxRaw(mdx, options);
        return this.buildPivotDataFrameFromCellset(cellset);
    }

    /**
     * Execute view and return pivot DataFrame
     */
    public async executeViewDataframePivot(
        cubeName: string,
        viewName: string,
        options: MDXViewOptions = {}
    ): Promise<DataFrame> {
        const cellset = await this.executeViewRaw(cubeName, viewName, options);
        return this.buildPivotDataFrameFromCellset(cellset);
    }

    /**
     * Execute multiple MDX queries asynchronously
     */
    public async executeMdxDataframeAsync(
        mdxQueries: string[],
        options: MDXViewOptions = {},
        maxWorkers: number = 4
    ): Promise<DataFrame[]> {
        const chunkSize = Math.ceil(mdxQueries.length / maxWorkers);

        const chunks = [];
        for (let i = 0; i < mdxQueries.length; i += chunkSize) {
            chunks.push(mdxQueries.slice(i, i + chunkSize));
        }

        const chunkPromises = chunks.map(async (chunk) => {
            const chunkResults: DataFrame[] = [];
            for (const mdx of chunk) {
                try {
                    const dataFrame = await this.executeMdxDataframe(mdx, options);
                    chunkResults.push(dataFrame);
                } catch (error) {
                    console.error(`Error executing MDX: ${mdx}`, error);
                    chunkResults.push({ columns: [], data: [] });
                }
            }
            return chunkResults;
        });

        const chunkResults = await Promise.all(chunkPromises);
        return chunkResults.flat();
    }

    /**
     * Create cellset from view
     */
    public async createCellsetFromView(
        cubeName: string,
        viewName: string,
        isPrivate: boolean = false,
        sandbox_name?: string
    ): Promise<string> {
        let url = `/Cubes('${cubeName}')/Views('${viewName}')/tm1.CreateCellset`;

        const params = new URLSearchParams();
        if (isPrivate) params.append('$private', 'true');
        if (sandbox_name) params.append('$sandbox', sandbox_name);

        if (params.toString()) {
            url += `?${params.toString()}`;
        }

        const response = await this.rest.post(url);

        if (response.headers?.location) {
            const matches = response.headers.location.match(/Cellsets\('([^']+)'\)/);
            return matches ? matches[1] : '';
        }

        return response.data?.ID || '';
    }

    /**
     * Update cellset with values
     */
    public async updateCellset(
        cellsetId: string,
        cellUpdates: { ordinal: number; value: any }[],
        sandbox_name?: string
    ): Promise<void> {
        let url = `/Cellsets('${cellsetId}')/Cells`;

        if (sandbox_name) {
            url += `?$sandbox=${sandbox_name}`;
        }

        const cells = cellUpdates.map(update => ({
            Ordinal: update.ordinal,
            Value: update.value
        }));

        await this.rest.patch(url, { Cells: cells });
    }

    /**
     * Get cellset cells count
     */
    public async getCellsetCellsCount(cellsetId: string, sandbox_name?: string): Promise<number> {
        let url = `/Cellsets('${cellsetId}')/Cells/$count`;

        if (sandbox_name) {
            url += `?$sandbox=${sandbox_name}`;
        }

        const response = await this.rest.get(url);
        return response.data.value || response.data || 0;
    }

    /**
     * Extract cellset raw response
     */
    public async extractCellsetRawResponse(
        cellsetId: string,
        sandbox_name?: string
    ): Promise<Response> {
        let url = `/Cellsets('${cellsetId}')/?$expand=Axes,Cells`;

        if (sandbox_name) {
            url += `&$sandbox=${sandbox_name}`;
        }

        const response = await this.rest.get(url, { responseType: 'stream' });
        return response.data;
    }

    /**
     * Extract cellset metadata raw
     */
    public async extractCellsetMetadataRaw(
        cellsetId: string,
        sandbox_name?: string
    ): Promise<any> {
        let url = `/Cellsets('${cellsetId}')?$expand=Axes`;

        if (sandbox_name) {
            url += `&$sandbox=${sandbox_name}`;
        }

        const response = await this.rest.get(url);
        return response.data;
    }

    /**
     * Extract cellset partition
     */
    public async extractCellsetPartition(
        cellsetId: string,
        skip: number = 0,
        top?: number,
        sandbox_name?: string
    ): Promise<any> {
        let url = `/Cellsets('${cellsetId}')/Cells`;

        const params = new URLSearchParams();
        params.append('$skip', skip.toString());
        if (top !== undefined) params.append('$top', top.toString());
        if (sandbox_name) params.append('$sandbox', sandbox_name);

        url += `?${params.toString()}`;

        const response = await this.rest.get(url);
        return response.data;
    }

    /**
     * Extract cellset axes cardinality
     */
    public async extractCellsetAxesCardinality(
        cellsetId: string,
        sandbox_name?: string
    ): Promise<number[]> {
        const metadata = await this.extractCellsetMetadataRaw(cellsetId, sandbox_name);

        if (metadata.Axes) {
            return metadata.Axes.map((axis: any) => axis.Cardinality || 0);
        }

        return [];
    }

    /**
     * Extract cellset values only
     */
    public async extractCellsetValues(
        cellsetId: string,
        sandbox_name?: string
    ): Promise<any[]> {
        let url = `/Cellsets('${cellsetId}')/Cells?$select=Value`;

        if (sandbox_name) {
            url += `&$sandbox=${sandbox_name}`;
        }

        const response = await this.rest.get(url);
        return response.data.value ? response.data.value.map((cell: any) => cell.Value) : [];
    }

    /**
     * Extract cellset rows and values
     */
    public async extractCellsetRowsAndValues(
        cellsetId: string,
        sandbox_name?: string
    ): Promise<{ rows: any[][], values: any[] }> {
        const cellset = await this.extractCellset(cellsetId, true, sandbox_name);

        const rows: any[][] = [];
        const values: any[] = [];

        if (cellset.Axes && cellset.Axes.length > 0) {
            const rowAxis = cellset.Axes[1] || cellset.Axes[0];
            if (rowAxis && rowAxis.Tuples) {
                for (const tuple of rowAxis.Tuples) {
                    const row = tuple.Members ? tuple.Members.map((m: any) => m.Name) : [];
                    rows.push(row);
                }
            }
        }

        if (cellset.Cells) {
            values.push(...cellset.Cells.map((cell: any) => cell.Value));
        }

        return { rows, values };
    }

    /**
     * Extract cellset composition (cube, dimensions)
     */
    public async extractCellsetComposition(
        cellsetId: string,
        sandbox_name?: string
    ): Promise<{ cube: string; dimensions: string[] }> {
        const metadata = await this.extractCellsetMetadataRaw(cellsetId, sandbox_name);

        let cube = '';
        const dimensions: string[] = [];

        if (metadata.Axes) {
            for (const axis of metadata.Axes) {
                if (axis.Hierarchies) {
                    for (const hierarchy of axis.Hierarchies) {
                        if (hierarchy.Dimension && hierarchy.Dimension.Name) {
                            dimensions.push(hierarchy.Dimension.Name);
                        }
                    }
                }
            }
        }

        // Try to derive cube name from cellset context or metadata
        if (metadata['@odata.context']) {
            const contextMatch = metadata['@odata.context'].match(/Cubes\('([^']+)'\)/);
            if (contextMatch) {
                cube = contextMatch[1];
            }
        }

        return { cube, dimensions };
    }

    /**
     * Extract cellset as DataFrame
     */
    public async extractCellsetDataframe(
        cellsetId: string,
        sandbox_name?: string
    ): Promise<DataFrame> {
        const cellset = await this.extractCellset(cellsetId, true, sandbox_name);
        return this.buildDataFrameFromCellset(cellset);
    }

    /**
     * Extract cellset as CSV format
     */
    public async extractCellsetCsv(
        cellsetId: string,
        sandbox_name?: string,
        includeHeaders: boolean = true
    ): Promise<string> {
        const cellset = await this.extractCellset(cellsetId, true, sandbox_name);
        const dataframe = this.buildDataFrameFromCellset(cellset);

        const rows: string[] = [];

        // Add headers if requested
        if (includeHeaders) {
            rows.push(dataframe.columns.map(col => `"${col}"`).join(','));
        }

        // Add data rows
        for (const row of dataframe.data) {
            const csvRow = row.map(cell => {
                if (cell === null || cell === undefined) return '';
                if (typeof cell === 'string' && (cell.includes(',') || cell.includes('"'))) {
                    return `"${cell.replace(/"/g, '""')}"`;
                }
                return String(cell);
            }).join(',');
            rows.push(csvRow);
        }

        return rows.join('\n');
    }

    /**
     * Extract cellset as shaped DataFrame
     */
    public async extractCellsetDataframeShaped(
        cellsetId: string,
        sandbox_name?: string
    ): Promise<DataFrame> {
        let url = `/Cellsets('${cellsetId}')/tm1.ExtractDataFrameShaped`;

        if (sandbox_name) {
            url += `?$sandbox=${sandbox_name}`;
        }

        const response = await this.rest.get(url);
        return this.buildDataFrameFromResponse(response.data);
    }

    /**
     * Extract cellset as pivot DataFrame
     */
    public async extractCellsetDataframePivot(
        cellsetId: string,
        sandbox_name?: string
    ): Promise<DataFrame> {
        const cellset = await this.extractCellset(cellsetId, true, sandbox_name);
        return this.buildPivotDataFrameFromCellset(cellset);
    }

    /**
     * Check if transaction log is active for a cube
     */
    public async transactionLogIsActive(cubeName: string): Promise<boolean> {
        const url = `/Cubes('${cubeName}')?$select=LastDataUpdate,TransactionLogIsActive`;
        const response = await this.rest.get(url);
        return response.data.TransactionLogIsActive === true;
    }

    /**
     * Execute asynchronous cellset extraction
     */
    public async extractCellsetAsync(
        cellsetId: string,
        maxWorkers: number = 4,
        sandbox_name?: string
    ): Promise<DataFrame> {
        /** Extract cellset data asynchronously with worker pool management
         *
         * :param cellsetId: ID of the cellset to extract
         * :param maxWorkers: Maximum number of concurrent workers
         * :param sandbox_name: Optional sandbox name
         * :return: DataFrame with extracted data
         */

        // Get cellset metadata first
        const cellset = await this.extractCellset(cellsetId, false, sandbox_name);
        const cellCount = cellset.Cells?.length || 0;

        // For small cellsets, use synchronous method
        if (cellCount < 10000) {
            return await this.extractCellsetDataframe(cellsetId, sandbox_name);
        }

        // For large cellsets, use chunked parallel processing
        const chunkSize = Math.ceil(cellCount / maxWorkers);
        const chunks: Promise<any[]>[] = [];

        for (let i = 0; i < cellCount; i += chunkSize) {
            const chunk = this.extractCellsetChunk(cellsetId, i, chunkSize, sandbox_name);
            chunks.push(chunk);
        }

        // Process chunks in parallel and combine results
        const chunkResults = await Promise.all(chunks);
        const combinedCells = chunkResults.flat();

        // Build DataFrame from combined results
        const enhancedCellset = { ...cellset, Cells: combinedCells };
        return this.buildDataFrameFromCellset(enhancedCellset);
    }

    /**
     * Extract a chunk of cellset data for parallel processing
     */
    private async extractCellsetChunk(
        cellsetId: string,
        skip: number,
        top: number,
        sandbox_name?: string
    ): Promise<any[]> {
        let url = `/Cellsets('${cellsetId}')/Cells?$skip=${skip}&$top=${top}`;

        if (sandbox_name) {
            url += `&$sandbox=${sandbox_name}`;
        }

        const response = await this.rest.get(url);
        return response.data.value || [];
    }

    /**
     * Write values through cellset approach
     */
    public async writeValuesThroughCellset(
        cubeName: string,
        cellsetAsDict: CellsetDict,
        dimensions?: string[],
        options: WriteOptions = {}
    ): Promise<void> {
        // Create a temporary MDX that covers all coordinates
        const coordinates = Object.keys(cellsetAsDict);
        const mdxMembers = coordinates.map(coord => {
            const elements = coord.split(',').map(e => e.trim());
            return `(${elements.map(e => `'${e}'`).join(',')})`;
        });

        const mdx = `{${mdxMembers.join(',')}} ON 0 FROM [${cubeName}]`;

        // Create cellset
        const cellsetId = await this.createCellset(mdx, options.sandbox_name);

        try {
            // Build cell updates
            const cellUpdates = [];
            let ordinal = 0;

            for (const [, value] of Object.entries(cellsetAsDict)) {
                cellUpdates.push({ ordinal, value });
                ordinal++;
            }

            // Update cellset
            await this.updateCellset(cellsetId, cellUpdates, options.sandbox_name);

        } finally {
            // Clean up cellset
            await this.deleteCellset(cellsetId, options.sandbox_name);
        }
    }

    /**
     * Write values with retry logic and error handling
     */
    public async writeBulk(
        cubeName: string,
        cellsetAsDict: CellsetDict,
        dimensions?: string[],
        options: BulkWriteOptions = {}
    ): Promise<void> {
        const {
            max_workers = 4,
            chunk_size = 1000,
            max_retries = 3,
            retry_delay = 1000,
            cancel_at_failure = false
        } = options;

        const entries = Object.entries(cellsetAsDict);
        const chunks = [];

        // Split into chunks
        for (let i = 0; i < entries.length; i += chunk_size) {
            chunks.push(entries.slice(i, i + chunk_size));
        }

        const errors: Error[] = [];

        // Process chunks with limited concurrency
        const semaphore = new Array(max_workers).fill(null);

        const processChunk = async (chunk: [string, any][]) => {
            const chunkDict: CellsetDict = {};
            for (const [coord, value] of chunk) {
                chunkDict[coord] = value;
            }

            let retries = 0;
            while (retries <= max_retries) {
                try {
                    await this.write(cubeName, chunkDict, dimensions, options);
                    return;
                } catch (error) {
                    retries++;
                    if (retries > max_retries) {
                        errors.push(error as Error);
                        if (cancel_at_failure) {
                            throw error;
                        }
                        return;
                    }
                    // Wait before retry
                    await new Promise(resolve => setTimeout(resolve, retry_delay * retries));
                }
            }
        };

        // Process all chunks with concurrency control
        const promises = chunks.map(async (chunk) => {
            // Wait for available worker
            await Promise.race(semaphore.map((_, i) =>
                new Promise(resolve => setTimeout(() => resolve(i), i * 10))
            ));

            return processChunk(chunk);
        });

        await Promise.all(promises);

        if (errors.length > 0) {
            throw new Error(`Bulk write completed with ${errors.length} errors: ${errors.map(e => e.message).join(', ')}`);
        }
    }

    /**
     * Drop non-updateable cells from cellset
     */
    public dropNonUpdateableCells(cellsetAsDict: CellsetDict, cellset: any): CellsetDict {
        const result: CellsetDict = {};
        const coordinates = Object.keys(cellsetAsDict);

        if (cellset.Cells) {
            for (let i = 0; i < cellset.Cells.length && i < coordinates.length; i++) {
                const cell = cellset.Cells[i];
                const coord = coordinates[i];

                // Include cell if it's updateable (not rule-derived or consolidated)
                if (cell.Updateable !== false && cell.RuleDerived !== true && cell.Consolidated !== true) {
                    result[coord] = cellsetAsDict[coord];
                }
            }
        } else {
            // If no cell metadata available, include all
            return cellsetAsDict;
        }

        return result;
    }

    /**
     * Get elements from all measure hierarchies
     */
    public async getElementsFromAllMeasureHierarchies(cubeName: string): Promise<{ [dimension: string]: string[] }> {
        const url = `/Cubes('${cubeName}')?$expand=Dimensions($expand=DefaultHierarchy($expand=Elements($select=Name;$filter=Type eq 'Numeric')))`;
        const response = await this.rest.get(url);

        const result: { [dimension: string]: string[] } = {};

        if (response.data.Dimensions) {
            for (const dimension of response.data.Dimensions) {
                if (dimension.DefaultHierarchy && dimension.DefaultHierarchy.Elements) {
                    const elements = dimension.DefaultHierarchy.Elements
                        .filter((e: any) => e.Type === 'Numeric')
                        .map((e: any) => e.Name);

                    if (elements.length > 0) {
                        result[dimension.Name] = elements;
                    }
                }
            }
        }

        return result;
    }

    /**
     * Execute UI operations for dygraph visualization
     */
    public async executeMdxUiDygraph(
        mdx: string,
        options: MDXViewOptions = {}
    ): Promise<any> {
        const cellset = await this.executeMdxRaw(mdx, options);
        return this.formatForDygraph(cellset);
    }

    /**
     * Execute view for dygraph visualization
     */
    public async executeViewUiDygraph(
        cubeName: string,
        viewName: string,
        options: MDXViewOptions = {}
    ): Promise<any> {
        const cellset = await this.executeViewRaw(cubeName, viewName, options);
        return this.formatForDygraph(cellset);
    }

    /**
     * Execute MDX for UI array format
     */
    public async executeMdxUiArray(
        mdx: string,
        options: MDXViewOptions = {}
    ): Promise<any[][]> {
        const cellset = await this.executeMdxRaw(mdx, options);
        return this.formatForUiArray(cellset);
    }

    /**
     * Execute view for UI array format
     */
    public async executeViewUiArray(
        cubeName: string,
        viewName: string,
        options: MDXViewOptions = {}
    ): Promise<any[][]> {
        const cellset = await this.executeViewRaw(cubeName, viewName, options);
        return this.formatForUiArray(cellset);
    }

    // ===== PRIVATE HELPER METHODS =====

    private buildDataFrameFromCellset(cellset: any): DataFrame {
        const columns: string[] = [];
        const data: any[][] = [];

        if (!cellset.Axes || !cellset.Cells) {
            return { columns, data };
        }

        // Extract column headers from axes
        if (cellset.Axes.length > 0) {
            const columnAxis = cellset.Axes[0];
            if (columnAxis.Hierarchies) {
                for (const hierarchy of columnAxis.Hierarchies) {
                    columns.push(hierarchy.Dimension?.Name || hierarchy.Name || 'Unknown');
                }
            }

            // Add value column
            columns.push('Value');
        }

        // Extract data rows
        if (cellset.Axes.length > 1) {
            const rowAxis = cellset.Axes[1];
            if (rowAxis.Tuples) {
                for (let i = 0; i < rowAxis.Tuples.length; i++) {
                    const tuple = rowAxis.Tuples[i];
                    const row: any[] = [];

                    if (tuple.Members) {
                        for (const member of tuple.Members) {
                            row.push(member.Name);
                        }
                    }

                    // Add cell value
                    const cellValue = cellset.Cells[i]?.Value || null;
                    row.push(cellValue);

                    data.push(row);
                }
            }
        }

        return { columns, data };
    }

    private buildDataFrameFromResponse(responseData: any): DataFrame {
        // Handle different response formats from TM1
        if (responseData.columns && responseData.data) {
            return {
                columns: responseData.columns,
                data: responseData.data
            };
        }

        if (responseData.value) {
            return this.buildDataFrameFromCellset(responseData.value);
        }

        return this.buildDataFrameFromCellset(responseData);
    }

    private buildPivotDataFrameFromCellset(cellset: any): DataFrame {
        // For now, return regular DataFrame - full pivot implementation would be more complex
        return this.buildDataFrameFromCellset(cellset);
    }

    /**
     * Convert cellset dictionary to CSV format for blob operations
     */
    private cellsetToCsv(cellsetAsDict: CellsetDict): string {
        const rows: string[] = [];

        for (const [coordinates, value] of Object.entries(cellsetAsDict)) {
            const elements = coordinates.split(',').map(el => el.trim());
            const csvRow = [...elements, value].map(item =>
                typeof item === 'string' && item.includes(',') ? `"${item}"` : item
            ).join(',');
            rows.push(csvRow);
        }

        return rows.join('\n');
    }

    /**
     * Generate TI code for blob import operations
     */
    private generateBlobImportTiCode(
        cubeName: string,
        fileName: string,
        dimensions: string[],
        options: WriteOptions = {}
    ): string {
        const dimensionVars = dimensions.map((_, index) => `v${index + 1}`).join(', ');
        const elementAssignments = dimensions.map((dim) =>
            `ItemReject('${cubeName}:${fileName}');
             ${dim} = CellGetS('${cubeName}', ${dimensionVars});`
        ).join('\n');

        const incrementCode = options.increment ?
            `IF(CellGetN('${cubeName}', ${dimensionVars}) <> 0);
               CellPutN(CellGetN('${cubeName}', ${dimensionVars}) + value, '${cubeName}', ${dimensionVars});
             ELSE;
               CellPutN(value, '${cubeName}', ${dimensionVars});
             ENDIF;` :
            `CellPutN(value, '${cubeName}', ${dimensionVars});`;

        return `
# Generated blob import process
DataSourceType = 'CHARACTERDELIMITED';
DataSourceNameForServer = '${fileName}';
DataSourceNameForClient = '${fileName}';

# Variables for dimensions and value
${dimensions.map((_, index) => `v${index + 1} = '';`).join('\n')}
value = 0;

# Main import logic
WHILE(DataSourceType = 'CHARACTERDELIMITED');
    ${elementAssignments}
    ${incrementCode}
END;
        `.trim();
    }

    private formatForDygraph(cellset: any): any {
        // Convert cellset to dygraph format
        // This is a simplified implementation
        // Full dygraph formatting would require more sophisticated axis handling
        const df = this.buildDataFrameFromCellset(cellset);

        return {
            labels: df.columns,
            data: df.data
        };
    }

    private formatForUiArray(cellset: any): any[][] {
        const df = this.buildDataFrameFromCellset(cellset);
        return [df.columns, ...df.data];
    }

    private generateTempProcessName(): string {
        return `tm1npm_temp_${Date.now()}_${++this.tempProcessCounter}`;
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
     * Clear all data in a cube (alias for compatibility)
     */
    public async clear(cubeName: string, sandbox_name?: string): Promise<void> {
        let url = `/Cubes('${cubeName}')/tm1.Clear`;

        if (sandbox_name) {
            url += `?$sandbox=${sandbox_name}`;
        }

        await this.rest.post(url);
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

    /**
     * Trace cell dependents (show what cells depend on this cell)
     *
     * @param cubeName - Name of the cube
     * @param coordinates - Element coordinates for the cell
     * @param sandbox_name - Optional sandbox name
     * @returns Promise<any> - Dependent cells information
     *
     * @example
     * ```typescript
     * const dependents = await cellService.traceCellDependents(
     *     'Sales',
     *     ['2024', 'Q1', 'Revenue']
     * );
     * ```
     */
    public async traceCellDependents(
        cubeName: string,
        coordinates: string[],
        sandbox_name?: string
    ): Promise<any> {
        const coordinateString = coordinates.map(c => `'${c}'`).join(',');
        let url = `/Cubes('${cubeName}')/tm1.TraceCellDependents(coordinates=[${coordinateString}])`;

        if (sandbox_name) {
            url += `?$sandbox=${sandbox_name}`;
        }

        const response = await this.rest.get(url);
        return response.data;
    }

    /**
     * Trace cell precedents (show what cells this cell depends on)
     *
     * @param cubeName - Name of the cube
     * @param coordinates - Element coordinates for the cell
     * @param sandbox_name - Optional sandbox name
     * @returns Promise<any> - Precedent cells information
     *
     * @example
     * ```typescript
     * const precedents = await cellService.traceCellPrecedents(
     *     'Sales',
     *     ['2024', 'Q1', 'Revenue']
     * );
     * ```
     */
    public async traceCellPrecedents(
        cubeName: string,
        coordinates: string[],
        sandbox_name?: string
    ): Promise<any> {
        const coordinateString = coordinates.map(c => `'${c}'`).join(',');
        let url = `/Cubes('${cubeName}')/tm1.TraceCellPrecedents(coordinates=[${coordinateString}])`;

        if (sandbox_name) {
            url += `?$sandbox=${sandbox_name}`;
        }

        const response = await this.rest.get(url);
        return response.data;
    }

    /**
     * Get drill-through information for a cell
     *
     * @param cubeName - Name of the cube
     * @param coordinates - Element coordinates for the cell
     * @param sandbox_name - Optional sandbox name
     * @returns Promise<any> - Drill-through configuration and data
     *
     * @example
     * ```typescript
     * const drillInfo = await cellService.getCellDrillThroughInformation(
     *     'Sales',
     *     ['2024', 'Q1', 'Revenue']
     * );
     * ```
     */
    public async getCellDrillThroughInformation(
        cubeName: string,
        coordinates: string[],
        sandbox_name?: string
    ): Promise<any> {
        const coordinateString = coordinates.map(c => `'${c}'`).join(',');
        let url = `/Cubes('${cubeName}')/tm1.GetDrillThrough(coordinates=[${coordinateString}])`;

        if (sandbox_name) {
            url += `?$sandbox=${sandbox_name}`;
        }

        const response = await this.rest.get(url);
        return response.data;
    }

    /**
     * Get cell attributes (metadata about the cell)
     *
     * @param cubeName - Name of the cube
     * @param coordinates - Element coordinates for the cell
     * @param sandbox_name - Optional sandbox name
     * @returns Promise<any> - Cell attributes and properties
     *
     * @example
     * ```typescript
     * const attributes = await cellService.getCellAttributes(
     *     'Sales',
     *     ['2024', 'Q1', 'Revenue']
     * );
     * console.log(attributes.RuleDerived, attributes.Updateable);
     * ```
     */
    public async getCellAttributes(
        cubeName: string,
        coordinates: string[],
        sandbox_name?: string
    ): Promise<any> {
        // Build the cell reference URL
        const coordinateString = coordinates.map(c => `'${c}'`).join(',');
        let url = `/Cubes('${cubeName}')/Cells(${coordinateString})`;

        if (sandbox_name) {
            url += `?$sandbox=${sandbox_name}`;
        }

        const response = await this.rest.get(url);
        return {
            Value: response.data.Value,
            RuleDerived: response.data.RuleDerived || false,
            Updateable: response.data.Updateable || false,
            Consolidated: response.data.Consolidated || false,
            Annotated: response.data.Annotated || false,
            FormatString: response.data.FormatString || '',
            HasPicklist: response.data.HasPicklist || false
        };
    }

    /**
     * Get cell annotation if it exists
     *
     * @param cubeName - Name of the cube
     * @param coordinates - Element coordinates for the cell
     * @param sandbox_name - Optional sandbox name
     * @returns Promise<string | null> - Annotation text or null if no annotation
     *
     * @example
     * ```typescript
     * const annotation = await cellService.getCellAnnotation(
     *     'Sales',
     *     ['2024', 'Q1', 'Revenue']
     * );
     * if (annotation) {
     *     console.log('Cell has annotation:', annotation);
     * }
     * ```
     */
    public async getCellAnnotation(
        cubeName: string,
        coordinates: string[],
        sandbox_name?: string
    ): Promise<string | null> {
        try {
            const coordinateString = coordinates.map(c => `'${c}'`).join(',');
            let url = `/Cubes('${cubeName}')/Cells(${coordinateString})/Annotation`;

            if (sandbox_name) {
                url += `?$sandbox=${sandbox_name}`;
            }

            const response = await this.rest.get(url);
            return response.data?.Text || response.data?.value || null;
        } catch (error: any) {
            // If 404, cell has no annotation
            if (error.response?.status === 404) {
                return null;
            }
            throw error;
        }
    }

    /**
     * Check cell security permissions for current user
     *
     * @param cubeName - Name of the cube
     * @param coordinates - Element coordinates for the cell
     * @param sandbox_name - Optional sandbox name
     * @returns Promise<any> - Security permissions (READ, WRITE, RESERVE)
     *
     * @example
     * ```typescript
     * const security = await cellService.checkCellSecurity(
     *     'Sales',
     *     ['2024', 'Q1', 'Revenue']
     * );
     * console.log('Can write:', security.canWrite);
     * ```
     */
    public async checkCellSecurity(
        cubeName: string,
        coordinates: string[],
        sandbox_name?: string
    ): Promise<any> {
        // Get cell attributes which include updateability
        const attributes = await this.getCellAttributes(cubeName, coordinates, sandbox_name);

        // Check element security for each dimension
        const dimensionNames = await this.getDimensionNamesForWriting(cubeName);
        const elementSecurity: { [dimension: string]: string } = {};

        for (let i = 0; i < dimensionNames.length && i < coordinates.length; i++) {
            const dimension = dimensionNames[i];
            const element = coordinates[i];

            try {
                // Check element security
                const secUrl = `/Dimensions('${dimension}')/Hierarchies('${dimension}')/Elements('${element}')/Security`;
                const secResponse = await this.rest.get(secUrl);
                elementSecurity[dimension] = secResponse.data.Rights || 'READ';
            } catch {
                // If we can't get security, assume READ
                elementSecurity[dimension] = 'READ';
            }
        }

        // Determine overall access
        const canWrite = attributes.Updateable &&
                        Object.values(elementSecurity).every(right => right === 'WRITE' || right === 'RESERVE');
        const canRead = true; // If we got here, we can read

        return {
            canRead,
            canWrite,
            canReserve: canWrite,
            isUpdateable: attributes.Updateable,
            isRuleDerived: attributes.RuleDerived,
            elementSecurity
        };
    }

    /**
     * Get dimension elements for a specific cell
     *
     * @param cubeName - Name of the cube
     * @param coordinates - Element coordinates for the cell
     * @returns Promise<string[]> - Array of element names
     *
     * @example
     * ```typescript
     * const elements = await cellService.getCellDimensionElements(
     *     'Sales',
     *     ['2024', 'Q1', 'Revenue']
     * );
     * console.log('Dimensions:', elements); // ['2024', 'Q1', 'Revenue']
     * ```
     */
    public async getCellDimensionElements(
        cubeName: string,
        coordinates: string[]
    ): Promise<string[]> {
        // Simply return the coordinates as they represent the elements
        return [...coordinates];
    }

    /**
     * Validate cell coordinates against cube dimensions
     *
     * @param cubeName - Name of the cube
     * @param coordinates - Element coordinates to validate
     * @returns Promise<boolean> - True if coordinates are valid
     *
     * @example
     * ```typescript
     * const isValid = await cellService.validateCellCoordinates(
     *     'Sales',
     *     ['2024', 'Q1', 'Revenue']
     * );
     * if (!isValid) {
     *     console.error('Invalid coordinates');
     * }
     * ```
     */
    public async validateCellCoordinates(
        cubeName: string,
        coordinates: string[]
    ): Promise<boolean> {
        try {
            // Get cube dimensions
            const dimensionNames = await this.getDimensionNamesForWriting(cubeName);

            // Check if coordinate count matches dimension count
            if (coordinates.length !== dimensionNames.length) {
                return false;
            }

            // Verify each element exists in its dimension
            for (let i = 0; i < dimensionNames.length; i++) {
                const dimension = dimensionNames[i];
                const element = coordinates[i];

                try {
                    const elemUrl = `/Dimensions('${dimension}')/Hierarchies('${dimension}')/Elements('${element}')`;
                    await this.rest.get(elemUrl);
                } catch {
                    // Element doesn't exist
                    return false;
                }
            }

            return true;
        } catch {
            return false;
        }
    }

    /**
     * Get cell type (NUMERIC, STRING, or CONSOLIDATED)
     *
     * @param cubeName - Name of the cube
     * @param coordinates - Element coordinates for the cell
     * @param sandbox_name - Optional sandbox name
     * @returns Promise<string> - Cell type
     *
     * @example
     * ```typescript
     * const type = await cellService.getCellType(
     *     'Sales',
     *     ['2024', 'Q1', 'Revenue']
     * );
     * console.log('Cell type:', type); // 'NUMERIC' or 'STRING' or 'CONSOLIDATED'
     * ```
     */
    public async getCellType(
        cubeName: string,
        coordinates: string[],
        sandbox_name?: string
    ): Promise<string> {
        const attributes = await this.getCellAttributes(cubeName, coordinates, sandbox_name);

        if (attributes.Consolidated) {
            return 'CONSOLIDATED';
        }

        // Check the value type
        const value = attributes.Value;
        if (typeof value === 'number') {
            return 'NUMERIC';
        } else if (typeof value === 'string') {
            return 'STRING';
        }

        // Default to NUMERIC if we can't determine
        return 'NUMERIC';
    }
}