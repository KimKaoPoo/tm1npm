import { ObjectService } from './ObjectService';
import { RestService } from './RestService';
import { DataFrame } from '../utils/DataFrame';
import { formatUrl } from '../utils/Utils';

/**
 * DataFrame query configuration
 */
export interface DataFrameQuery {
    mdx?: string;
    cubeName?: string;
    viewName?: string;
    private?: boolean;
    sandbox?: string;
    skip_zeros?: boolean;
    skip_consolidated?: boolean;
    skip_rule_derived?: boolean;
    element_unique_names?: boolean;
    shaped?: boolean;
    pivot?: boolean;
}

/**
 * DataFrameService - Dedicated service for pandas-like DataFrame operations
 *
 * Provides a centralized service for handling TM1 data in DataFrame format,
 * achieving feature parity with tm1py's DataFrame functionality.
 */
export class DataFrameService extends ObjectService {
    constructor(rest: RestService) {
        super(rest);
    }

    /**
     * Execute MDX query and return as pandas-like DataFrame
     *
     * @param mdx - MDX query string
     * @param options - Query execution options
     * @returns Promise<DataFrame> - DataFrame with query results
     *
     * @example
     * ```typescript
     * const df = await tm1.dataframes.mdxToPandasDataFrame(
     *     'SELECT [Time].Members ON 0, [Account].Members ON 1 FROM [Budget]',
     *     { skip_zeros: true }
     * );
     * console.log(df.shape); // [rows, columns]
     * ```
     */
    public async mdxToPandasDataFrame(
        mdx: string,
        options: Partial<DataFrameQuery> = {}
    ): Promise<DataFrame> {
        const url = this.buildMdxDataFrameUrl(options);
        const body = { MDX: mdx };

        const response = await this.rest.post(url, body);
        return this.buildDataFrameFromResponse(response.data);
    }

    /**
     * Execute cube view and return as pandas-like DataFrame
     *
     * @param cubeName - Name of the cube
     * @param viewName - Name of the view
     * @param options - Query execution options
     * @returns Promise<DataFrame> - DataFrame with view results
     *
     * @example
     * ```typescript
     * const df = await tm1.dataframes.viewToPandasDataFrame(
     *     'Budget',
     *     'YearlySummary',
     *     { private: true, skip_zeros: true }
     * );
     * ```
     */
    public async viewToPandasDataFrame(
        cubeName: string,
        viewName: string,
        options: Partial<DataFrameQuery> = {}
    ): Promise<DataFrame> {
        const privateView = options.private !== undefined ? options.private : false;
        const viewType = privateView ? 'PrivateViews' : 'Views';

        let url = formatUrl(
            "/Cubes('{}')/{}('{}')/tm1.Execute",
            cubeName,
            viewType,
            viewName
        );

        // Add query parameters
        url = this.addQueryParameters(url, options);

        const response = await this.rest.post(url, {});

        // Handle different response formats
        if (options.shaped) {
            return this.buildDataFrameFromResponse(response.data);
        } else {
            return this.buildDataFrameFromCellset(response.data);
        }
    }

    /**
     * Write DataFrame data to TM1 cube
     *
     * @param cubeName - Name of the target cube
     * @param df - DataFrame containing data to write
     * @param options - Write operation options
     * @returns Promise<void>
     *
     * @example
     * ```typescript
     * const df = new DataFrame(
     *     [['Jan', 'Revenue', 1000], ['Feb', 'Revenue', 1100]],
     *     { columns: ['Time', 'Account', 'Value'] }
     * );
     * await tm1.dataframes.writeDataFrame('Budget', df, {
     *     sandbox: 'Development'
     * });
     * ```
     */
    public async writeDataFrame(
        cubeName: string,
        df: DataFrame,
        options: {
            sandbox?: string;
            changeset?: string;
            deactivate_transaction_log?: boolean;
            reactivate_transaction_log?: boolean;
            increment?: boolean;
        } = {}
    ): Promise<void> {
        // Convert DataFrame to TM1 cellset format
        const cellset = this.dataFrameToCellset(df, cubeName);

        // Build URL with options
        let url = `/Cubes('${cubeName}')/tm1.Update`;

        const params: string[] = [];
        if (options.sandbox) {
            params.push(`$sandbox=${options.sandbox}`);
        }
        if (options.changeset) {
            params.push(`$changeset=${options.changeset}`);
        }

        if (params.length > 0) {
            url += '?' + params.join('&');
        }

        // Apply transaction log options if specified
        if (options.deactivate_transaction_log) {
            await this.rest.post(`/Cubes('${cubeName}')/tm1.DisableTransactionLog`, {});
        }

        try {
            await this.rest.post(url, cellset);
        } finally {
            if (options.reactivate_transaction_log) {
                await this.rest.post(`/Cubes('${cubeName}')/tm1.EnableTransactionLog`, {});
            }
        }
    }

    /**
     * Execute a DataFrame query with flexible options
     *
     * @param query - DataFrameQuery configuration
     * @returns Promise<DataFrame> - DataFrame with query results
     *
     * @example
     * ```typescript
     * const df = await tm1.dataframes.executeDataFrameQuery({
     *     cubeName: 'Budget',
     *     viewName: 'YearlySummary',
     *     private: true,
     *     skip_zeros: true,
     *     shaped: true
     * });
     * ```
     */
    public async executeDataFrameQuery(query: DataFrameQuery): Promise<DataFrame> {
        if (query.mdx) {
            return this.mdxToPandasDataFrame(query.mdx, query);
        } else if (query.cubeName && query.viewName) {
            return this.viewToPandasDataFrame(query.cubeName, query.viewName, query);
        } else {
            throw new Error('Query must specify either mdx or both cubeName and viewName');
        }
    }

    /**
     * Execute MDX with shaped DataFrame result (preserves query structure)
     *
     * @param mdx - MDX query string
     * @param options - Query execution options
     * @returns Promise<DataFrame> - Shaped DataFrame
     */
    public async executeMdxDataFrameShaped(
        mdx: string,
        options: Partial<DataFrameQuery> = {}
    ): Promise<DataFrame> {
        return this.mdxToPandasDataFrame(mdx, { ...options, shaped: true });
    }

    /**
     * Execute MDX with pivot DataFrame result
     *
     * @param mdx - MDX query string
     * @param options - Query execution options
     * @returns Promise<DataFrame> - Pivoted DataFrame
     */
    public async executeMdxDataFramePivot(
        mdx: string,
        options: Partial<DataFrameQuery> = {}
    ): Promise<DataFrame> {
        return this.mdxToPandasDataFrame(mdx, { ...options, pivot: true });
    }

    /**
     * Execute view with shaped DataFrame result
     *
     * @param cubeName - Cube name
     * @param viewName - View name
     * @param options - Query execution options
     * @returns Promise<DataFrame> - Shaped DataFrame
     */
    public async executeViewDataFrameShaped(
        cubeName: string,
        viewName: string,
        options: Partial<DataFrameQuery> = {}
    ): Promise<DataFrame> {
        return this.viewToPandasDataFrame(cubeName, viewName, { ...options, shaped: true });
    }

    /**
     * Execute view with pivot DataFrame result
     *
     * @param cubeName - Cube name
     * @param viewName - View name
     * @param options - Query execution options
     * @returns Promise<DataFrame> - Pivoted DataFrame
     */
    public async executeViewDataFramePivot(
        cubeName: string,
        viewName: string,
        options: Partial<DataFrameQuery> = {}
    ): Promise<DataFrame> {
        return this.viewToPandasDataFrame(cubeName, viewName, { ...options, pivot: true });
    }

    /**
     * Build MDX DataFrame URL with options
     * @private
     */
    private buildMdxDataFrameUrl(options: Partial<DataFrameQuery>): string {
        if (options.shaped) {
            return '/ExecuteMDXDataFrameShaped';
        } else if (options.pivot) {
            return '/ExecuteMDXPivot';
        } else {
            return '/ExecuteMDX';
        }
    }

    /**
     * Add query parameters to URL
     * @private
     */
    private addQueryParameters(url: string, options: Partial<DataFrameQuery>): string {
        const params: string[] = [];

        if (options.sandbox) {
            params.push(`$sandbox=${options.sandbox}`);
        }
        if (options.skip_zeros !== undefined) {
            params.push(`$skip_zeros=${options.skip_zeros}`);
        }
        if (options.skip_consolidated !== undefined) {
            params.push(`$skip_consolidated=${options.skip_consolidated}`);
        }
        if (options.skip_rule_derived !== undefined) {
            params.push(`$skip_rule_derived=${options.skip_rule_derived}`);
        }
        if (options.element_unique_names !== undefined) {
            params.push(`$element_unique_names=${options.element_unique_names}`);
        }

        if (params.length > 0) {
            url += (url.includes('?') ? '&' : '?') + params.join('&');
        }

        return url;
    }

    /**
     * Build DataFrame from TM1 response data
     * @private
     */
    private buildDataFrameFromResponse(data: any): DataFrame {
        if (!data) {
            return new DataFrame();
        }

        // Handle shaped DataFrame response
        if (data.Columns && data.Values) {
            const columns = data.Columns.map((col: any) => col.Name || col);
            const values = data.Values;
            return new DataFrame(values, { columns });
        }

        // Handle standard cellset response
        return this.buildDataFrameFromCellset(data);
    }

    /**
     * Build DataFrame from TM1 cellset
     * @private
     */
    private buildDataFrameFromCellset(cellset: any): DataFrame {
        if (!cellset || !cellset.Axes || !cellset.Cells) {
            return new DataFrame();
        }

        const columns: string[] = [];
        const data: any[][] = [];

        // Extract dimension names from axes
        if (cellset.Axes[1] && cellset.Axes[1].Hierarchies) {
            cellset.Axes[1].Hierarchies.forEach((hierarchy: any) => {
                columns.push(hierarchy.Name);
            });
        }
        columns.push('Value');

        // Extract cell data
        if (cellset.Cells) {
            cellset.Cells.forEach((cell: any) => {
                const row: any[] = [];

                // Add dimension values
                if (cell.Members) {
                    cell.Members.forEach((member: any) => {
                        row.push(member.Name);
                    });
                }

                // Add cell value
                row.push(cell.Value);
                data.push(row);
            });
        }

        return new DataFrame(data, { columns });
    }

    /**
     * Convert DataFrame to TM1 cellset format
     * @private
     */
    private dataFrameToCellset(df: DataFrame, cubeName: string): any {
        const cells: any[] = [];
        const columns = df.columns;
        const valueColumnIndex = columns.indexOf('Value');

        if (valueColumnIndex === -1) {
            throw new Error('DataFrame must have a "Value" column');
        }

        // Build cell array
        df.data.forEach((row) => {
            const coordinates: string[] = [];

            // Extract coordinates (all columns except Value)
            columns.forEach((col, index) => {
                if (index !== valueColumnIndex) {
                    coordinates.push(String(row[index]));
                }
            });

            // Add cell with coordinates and value
            cells.push({
                Tuple: `(${coordinates.map(c => `'${c}'`).join(',')})`,
                Value: row[valueColumnIndex]
            });
        });

        return {
            Cells: cells
        };
    }
}
