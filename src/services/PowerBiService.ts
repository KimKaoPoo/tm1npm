/**
 * PowerBiService - Business Intelligence Integration for TM1
 *
 * Provides comprehensive integration between TM1 data and Microsoft Power BI,
 * including dataset generation, schema creation, data export, and formatting.
 */

import { RestService } from './RestService';
import { CellService } from './CellService';
import { ElementService } from './ElementService';
import { CubeService } from './CubeService';
import { DimensionService } from './DimensionService';
import { ViewService } from './ViewService';
import { v4 as uuidv4 } from 'uuid';

/**
 * Power BI column data types
 */
export type PowerBIDataType = 'string' | 'number' | 'boolean' | 'datetime' | 'decimal';

/**
 * Power BI column definition
 */
export interface PowerBIColumn {
    name: string;
    dataType: PowerBIDataType;
    isNullable?: boolean;
    description?: string;
    formatString?: string;
}

/**
 * Power BI table definition
 */
export interface PowerBITable {
    name: string;
    columns: PowerBIColumn[];
    rows?: any[];
    description?: string;
    isHidden?: boolean;
}

/**
 * Power BI relationship definition
 */
export interface PowerBIRelationship {
    name: string;
    fromTable: string;
    fromColumn: string;
    toTable: string;
    toColumn: string;
    crossFilteringBehavior?: 'oneDirection' | 'bothDirections' | 'automatic';
    isActive?: boolean;
    securityFilteringBehavior?: 'oneDirection' | 'bothDirections';
}

/**
 * Power BI measure definition
 */
export interface PowerBIMeasure {
    name: string;
    expression: string;
    formatString?: string;
    description?: string;
    isHidden?: boolean;
}

/**
 * Power BI dataset definition
 */
export interface PowerBIDataset {
    id?: string;
    name: string;
    tables: PowerBITable[];
    relationships?: PowerBIRelationship[];
    measures?: PowerBIMeasure[];
    description?: string;
    defaultMode?: 'push' | 'streaming' | 'pushStreaming';
    createdAt?: Date;
    updatedAt?: Date;
}

/**
 * Power BI connection configuration
 */
export interface PowerBIConfig {
    workspaceId?: string;
    datasetName: string;
    refreshSchedule?: PowerBIRefreshSchedule;
    connectionTimeout?: number;
    maxRows?: number;
}

/**
 * Power BI refresh schedule
 */
export interface PowerBIRefreshSchedule {
    enabled: boolean;
    days?: ('Sunday' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday')[];
    times?: string[];
    localTimeZoneId?: string;
    notifyOption?: 'noNotification' | 'mailOnFailure' | 'mailOnCompletion';
}

/**
 * Power BI schema definition
 */
export interface PowerBISchema {
    tables: PowerBITableSchema[];
    relationships: PowerBIRelationship[];
    measures?: PowerBIMeasure[];
}

/**
 * Power BI table schema
 */
export interface PowerBITableSchema {
    name: string;
    columns: PowerBIColumn[];
    sourceQuery?: string;
    sourceCube?: string;
    sourceView?: string;
}

/**
 * Power BI export options
 */
export interface PowerBIExportOptions {
    includeMetadata?: boolean;
    flattenHierarchies?: boolean;
    skipConsolidations?: boolean;
    skipZeros?: boolean;
    skipRuleDerived?: boolean;
    maxRows?: number;
    dateFormat?: string;
    decimalPlaces?: number;
    includeAttributes?: string[];
    sandbox_name?: string;
}

/**
 * Power BI data format options
 */
export interface PowerBIFormatOptions {
    dateFormat?: string;
    numberFormat?: string;
    booleanFormat?: { true: string; false: string };
    nullValue?: any;
    trimStrings?: boolean;
    convertEmptyToNull?: boolean;
}

/**
 * Dimension metadata for Power BI
 */
export interface DimensionMetadata {
    name: string;
    hierarchyName: string;
    elementCount: number;
    hasAttributes: boolean;
    attributes: string[];
    levels?: number;
}

/**
 * Cube metadata for Power BI
 */
export interface CubeMetadata {
    name: string;
    dimensions: DimensionMetadata[];
    hasRules: boolean;
    lastDataUpdate?: string;
    measureDimension?: string;
}

/**
 * Connection tracking for Power BI datasets
 */
interface PowerBIConnectionTracker {
    id: string;
    config: PowerBIConfig;
    dataset?: PowerBIDataset;
    status: 'active' | 'inactive' | 'error';
    lastRefresh?: Date;
    errorMessage?: string;
}

export class PowerBiService {
    private _tm1Rest: RestService;
    private cells: CellService;
    private elements: ElementService;
    private cubes: CubeService;
    private dimensions: DimensionService;
    private views: ViewService;
    private connections: Map<string, PowerBIConnectionTracker>;
    private datasets: Map<string, PowerBIDataset>;

    // Constants
    private static readonly DEFAULT_MAX_ROWS = 100000;
    private static readonly MEASURE_DIMENSION_THRESHOLD = 50;

    constructor(tm1Rest: RestService) {
        this._tm1Rest = tm1Rest;
        this.cells = new CellService(tm1Rest);
        this.elements = new ElementService(tm1Rest);
        this.cubes = new CubeService(tm1Rest);
        this.dimensions = new DimensionService(tm1Rest);
        this.views = new ViewService(tm1Rest);
        this.connections = new Map();
        this.datasets = new Map();
    }

    // ==================== Dataset Management ====================

    /**
     * Generate a Power BI dataset from TM1 cubes
     * @param cubeNames - Array of cube names to include in the dataset
     * @param datasetName - Name for the Power BI dataset
     * @param options - Export options for data retrieval
     * @returns Power BI dataset definition with tables and relationships
     */
    public async generatePowerBIDataset(
        cubeNames: string[],
        datasetName?: string,
        options?: PowerBIExportOptions
    ): Promise<PowerBIDataset> {
        // Input validation
        if (!Array.isArray(cubeNames)) {
            throw new Error('cubeNames must be an array');
        }

        const tables: PowerBITable[] = [];
        const relationships: PowerBIRelationship[] = [];
        const dimensionTables = new Map<string, PowerBITable>();

        for (const cubeName of cubeNames) {
            // Get cube metadata
            const cube = await this.cubes.get(cubeName);
            const cubeDimensions = cube.dimensions;

            // Create dimension tables
            for (const dimName of cubeDimensions) {
                if (!dimensionTables.has(dimName)) {
                    const dimTable = await this.createDimensionTable(dimName, options);
                    dimensionTables.set(dimName, dimTable);
                    tables.push(dimTable);
                }
            }

            // Create fact table for the cube
            const factTable = await this.createFactTable(cubeName, cubeDimensions, options);
            tables.push(factTable);

            // Create relationships between fact and dimension tables
            for (const dimName of cubeDimensions) {
                const relationship: PowerBIRelationship = {
                    name: `${cubeName}_${dimName}`,
                    fromTable: cubeName,
                    fromColumn: dimName,
                    toTable: dimName,
                    toColumn: 'Name',
                    crossFilteringBehavior: 'bothDirections',
                    isActive: true
                };
                relationships.push(relationship);
            }
        }

        const dataset: PowerBIDataset = {
            id: this.generateDatasetId(),
            name: datasetName || `TM1_Dataset_${Date.now()}`,
            tables,
            relationships,
            defaultMode: 'push',
            createdAt: new Date(),
            updatedAt: new Date()
        };

        // Store dataset for tracking
        this.datasets.set(dataset.id!, dataset);

        return dataset;
    }

    /**
     * Create a Power BI connection configuration
     * @param config - Power BI connection configuration
     * @returns Connection ID for tracking
     */
    public async createPowerBIConnection(config: PowerBIConfig): Promise<string> {
        // Input validation
        if (!config.datasetName || config.datasetName.trim() === '') {
            throw new Error('config.datasetName is required and cannot be empty');
        }

        const connectionId = this.generateConnectionId();

        const tracker: PowerBIConnectionTracker = {
            id: connectionId,
            config,
            status: 'active',
            lastRefresh: new Date()
        };

        this.connections.set(connectionId, tracker);

        return connectionId;
    }

    /**
     * Refresh a Power BI dataset with latest TM1 data
     * @param datasetId - Dataset ID to refresh
     * @param options - Export options for data retrieval
     */
    public async refreshPowerBIDataset(
        datasetId: string,
        options?: PowerBIExportOptions
    ): Promise<PowerBIDataset> {
        const dataset = this.datasets.get(datasetId);
        if (!dataset) {
            throw new Error(`Dataset not found: ${datasetId}`);
        }

        // Refresh data for each table
        for (const table of dataset.tables) {
            if (table.name.startsWith('Fact_') || !table.name.includes('_')) {
                // This is a fact table - refresh from cube
                const cubeName = table.name.replace('Fact_', '');
                const cubeExists = await this.cubes.exists(cubeName);
                if (cubeExists) {
                    const refreshedData = await this.exportCubeForPowerBI(cubeName, undefined, options);
                    table.rows = refreshedData;
                }
            } else {
                // This is a dimension table - refresh elements
                const dimName = table.name;
                const dimExists = await this.dimensions.exists(dimName);
                if (dimExists) {
                    const elements = await this.elements.getElementsDataframe(dimName, dimName);
                    table.rows = this.formatDataForPowerBI(elements.data || [], elements.columns || []);
                }
            }
        }

        dataset.updatedAt = new Date();
        return dataset;
    }

    /**
     * Delete a Power BI dataset
     * @param datasetId - Dataset ID to delete
     */
    public async deletePowerBIDataset(datasetId: string): Promise<void> {
        if (!this.datasets.has(datasetId)) {
            throw new Error(`Dataset not found: ${datasetId}`);
        }

        this.datasets.delete(datasetId);

        // Also clean up any associated connections
        for (const [connId, conn] of this.connections) {
            if (conn.dataset?.id === datasetId) {
                this.connections.delete(connId);
            }
        }
    }

    /**
     * Get a Power BI dataset by ID
     * @param datasetId - Dataset ID
     * @returns Power BI dataset or undefined
     */
    public getDataset(datasetId: string): PowerBIDataset | undefined {
        return this.datasets.get(datasetId);
    }

    /**
     * List all Power BI datasets
     * @returns Array of Power BI datasets
     */
    public listDatasets(): PowerBIDataset[] {
        return Array.from(this.datasets.values());
    }

    // ==================== Data Export ====================

    /**
     * Export cube data formatted for Power BI consumption
     * @param cubeName - Name of the cube to export
     * @param viewName - Optional view name (uses default view if not specified)
     * @param options - Export options
     * @returns Array of formatted data rows
     */
    public async exportCubeForPowerBI(
        cubeName: string,
        viewName?: string,
        options?: PowerBIExportOptions
    ): Promise<any[]> {
        // Input validation
        if (!cubeName || cubeName.trim() === '') {
            throw new Error('cubeName is required and cannot be empty');
        }

        const opts = {
            includeMetadata: false,
            flattenHierarchies: true,
            skipConsolidations: true,
            skipZeros: true,
            skipRuleDerived: false,
            maxRows: PowerBiService.DEFAULT_MAX_ROWS,
            ...options
        };

        let data: any[];

        if (viewName) {
            data = await this.executeView(cubeName, viewName, false, false, false);
        } else {
            // Build MDX to get all data from cube
            const cube = await this.cubes.get(cubeName);
            const mdx = this.buildCubeMDX(cubeName, cube.dimensions, opts);
            data = await this.executeMdx(mdx);
        }

        // Apply Power BI formatting
        return this.optimizeForPowerBI(data, opts);
    }

    /**
     * Export view data formatted for Power BI
     * @param cubeName - Name of the cube
     * @param viewName - Name of the view
     * @param isPrivate - Whether the view is private
     * @param options - Export options
     * @returns Array of formatted data rows
     */
    public async exportViewForPowerBI(
        cubeName: string,
        viewName: string,
        isPrivate: boolean = false,
        options?: PowerBIExportOptions
    ): Promise<any[]> {
        const data = await this.executeView(cubeName, viewName, isPrivate, false, false);
        return this.optimizeForPowerBI(data, options);
    }

    /**
     * Generate Power BI schema from TM1 cubes
     * @param cubeNames - Array of cube names
     * @returns Power BI schema definition
     */
    public async generatePowerBISchema(cubeNames: string[]): Promise<PowerBISchema> {
        const tables: PowerBITableSchema[] = [];
        const relationships: PowerBIRelationship[] = [];
        const processedDimensions = new Set<string>();

        for (const cubeName of cubeNames) {
            const cube = await this.cubes.get(cubeName);
            const cubeDimensions = cube.dimensions;

            // Create dimension table schemas
            for (const dimName of cubeDimensions) {
                if (!processedDimensions.has(dimName)) {
                    const dimSchema = await this.createDimensionSchema(dimName);
                    tables.push(dimSchema);
                    processedDimensions.add(dimName);
                }
            }

            // Create fact table schema
            const factSchema = this.createFactTableSchema(cubeName, cubeDimensions);
            tables.push(factSchema);

            // Create relationships
            for (const dimName of cubeDimensions) {
                relationships.push({
                    name: `rel_${cubeName}_${dimName}`,
                    fromTable: cubeName,
                    fromColumn: dimName,
                    toTable: dimName,
                    toColumn: 'Name',
                    crossFilteringBehavior: 'bothDirections',
                    isActive: true
                });
            }
        }

        return { tables, relationships };
    }

    // ==================== Power BI Formatting ====================

    /**
     * Format raw data for Power BI consumption
     * @param data - Raw data array
     * @param columns - Column names
     * @param options - Format options
     * @returns Formatted data array
     */
    public formatDataForPowerBI(
        data: any[],
        columns: string[],
        options?: PowerBIFormatOptions
    ): any[] {
        const opts: PowerBIFormatOptions = {
            dateFormat: 'YYYY-MM-DD',
            trimStrings: true,
            convertEmptyToNull: true,
            ...options
        };

        return data.map(row => {
            const formattedRow: any = {};

            if (Array.isArray(row)) {
                columns.forEach((col, index) => {
                    formattedRow[col] = this.formatValue(row[index], opts);
                });
            } else {
                for (const col of columns) {
                    formattedRow[col] = this.formatValue(row[col], opts);
                }
            }

            return formattedRow;
        });
    }

    /**
     * Create Power BI relationships between cubes based on shared dimensions
     * @param cubeNames - Array of cube names
     * @returns Array of Power BI relationships
     */
    public async createPowerBIRelationships(cubeNames: string[]): Promise<PowerBIRelationship[]> {
        const relationships: PowerBIRelationship[] = [];
        const cubeDimensionsMap = new Map<string, string[]>();

        // Get dimensions for each cube
        for (const cubeName of cubeNames) {
            const cube = await this.cubes.get(cubeName);
            cubeDimensionsMap.set(cubeName, cube.dimensions);
        }

        // Create relationships to dimension tables
        for (const [cubeName, dimensions] of cubeDimensionsMap) {
            for (const dimName of dimensions) {
                relationships.push({
                    name: `${cubeName}_to_${dimName}`,
                    fromTable: cubeName,
                    fromColumn: dimName,
                    toTable: dimName,
                    toColumn: 'Name',
                    crossFilteringBehavior: 'bothDirections',
                    isActive: true
                });
            }
        }

        // Find shared dimensions between cubes for cross-cube relationships
        const cubeList = Array.from(cubeDimensionsMap.keys());
        for (let i = 0; i < cubeList.length; i++) {
            for (let j = i + 1; j < cubeList.length; j++) {
                const cube1 = cubeList[i];
                const cube2 = cubeList[j];
                const dims1 = cubeDimensionsMap.get(cube1)!;
                const dims2 = cubeDimensionsMap.get(cube2)!;

                // Find shared dimensions
                const sharedDims = dims1.filter(d => dims2.includes(d));

                for (const sharedDim of sharedDims) {
                    relationships.push({
                        name: `${cube1}_${cube2}_via_${sharedDim}`,
                        fromTable: cube1,
                        fromColumn: sharedDim,
                        toTable: cube2,
                        toColumn: sharedDim,
                        crossFilteringBehavior: 'bothDirections',
                        isActive: false // Inactive by default to avoid ambiguity
                    });
                }
            }
        }

        return relationships;
    }

    /**
     * Optimize data structure for Power BI performance
     * @param data - Raw data array
     * @param options - Export options
     * @returns Optimized data array
     */
    public optimizeForPowerBI(data: any[], options?: PowerBIExportOptions): any[] {
        const opts = {
            skipZeros: true,
            skipConsolidations: true,
            maxRows: PowerBiService.DEFAULT_MAX_ROWS,
            ...options
        };

        let optimizedData = [...data];

        // Filter out zero values if requested
        if (opts.skipZeros) {
            optimizedData = optimizedData.filter(row => {
                const keys = Object.keys(row);
                const lastKey = keys.length > 0 ? keys[keys.length - 1] : undefined;
                const value = row.Value ?? row.value ?? (lastKey ? row[lastKey] : undefined);
                return value !== 0 && value !== '0' && value !== null && value !== undefined;
            });
        }

        // Limit rows
        if (opts.maxRows && optimizedData.length > opts.maxRows) {
            optimizedData = optimizedData.slice(0, opts.maxRows);
        }

        // Convert data types for Power BI compatibility
        optimizedData = optimizedData.map(row => {
            const newRow: any = {};
            for (const [key, value] of Object.entries(row)) {
                newRow[key] = this.convertToCompatibleType(value);
            }
            return newRow;
        });

        return optimizedData;
    }

    // ==================== Original Methods (Maintained for Compatibility) ====================

    /**
     * Execute MDX and return data as array
     * @param mdx - MDX query string
     * @returns Array of data rows
     */
    public async executeMdx(mdx: string): Promise<any[]> {
        return await this.cells.executeMdxDataFrameShaped(mdx);
    }

    /**
     * Execute view and return data as array
     * @param cubeName - Cube name
     * @param viewName - View name
     * @param isPrivate - Whether view is private
     * @param useIterativeJson - Use iterative JSON parsing
     * @param useBlob - Use blob for large datasets
     * @returns Array of data rows
     */
    public async executeView(
        cubeName: string,
        viewName: string,
        isPrivate: boolean,
        useIterativeJson: boolean = false,
        useBlob: boolean = false
    ): Promise<any[]> {
        return await this.cells.executeViewDataFrameShaped(
            cubeName,
            viewName,
            isPrivate,
            useIterativeJson,
            useBlob
        );
    }

    /**
     * Get member properties for Power BI dimension table
     * @param dimensionName - Dimension name
     * @param hierarchyName - Hierarchy name
     * @param memberSelection - Member selection (array or MDX)
     * @param skipConsolidations - Skip consolidated elements
     * @param attributes - Attributes to include
     * @param skipParents - Skip parent columns
     * @param levelNames - Custom level names
     * @param parentAttribute - Attribute for parent display
     * @param skipWeights - Skip weight columns
     * @param useBlob - Use blob for large datasets
     * @returns Array of member properties
     */
    public async getMemberProperties(
        dimensionName?: string,
        hierarchyName?: string,
        memberSelection?: string[] | string,
        skipConsolidations: boolean = true,
        attributes?: string[],
        skipParents: boolean = false,
        levelNames?: string[],
        parentAttribute?: string,
        skipWeights: boolean = true,
        useBlob: boolean = false
    ): Promise<any[]> {
        if (!skipWeights && skipParents) {
            throw new Error("skip_weights must not be false if skip_parents is true");
        }

        if (!dimensionName) {
            throw new Error("dimensionName is required");
        }

        const dataframe = await this.elements.getElementsDataframe(
            dimensionName,
            hierarchyName,
            memberSelection,
            {
                skip_consolidations: skipConsolidations,
                attributes,
                skip_parents: skipParents,
                level_names: levelNames,
                parent_attribute: parentAttribute,
                skip_weights: skipWeights,
                use_blob: useBlob
            }
        );

        // Convert DataFrame to array format for PowerBI compatibility
        const result: any[] = [];

        if (dataframe.columns) {
            result.push(dataframe.columns);
        }

        if (dataframe.data) {
            result.push(...dataframe.data);
        }

        return result;
    }

    // ==================== Cube Metadata ====================

    /**
     * Get cube metadata for Power BI schema generation
     * @param cubeName - Cube name
     * @returns Cube metadata
     */
    public async getCubeMetadata(cubeName: string): Promise<CubeMetadata> {
        const cube = await this.cubes.get(cubeName);
        const dimensions: DimensionMetadata[] = [];

        for (const dimName of cube.dimensions) {
            const dimMeta = await this.getDimensionMetadata(dimName);
            dimensions.push(dimMeta);
        }

        let lastDataUpdate: string | undefined;
        try {
            lastDataUpdate = await this.cubes.getLastDataUpdate(cubeName);
        } catch (error) {
            console.warn(`Failed to get last data update for cube '${cubeName}':`, error);
        }

        return {
            name: cube.name,
            dimensions,
            hasRules: cube.rules !== undefined && cube.rules !== null,
            lastDataUpdate,
            measureDimension: this.identifyMeasureDimension(dimensions)
        };
    }

    /**
     * Get dimension metadata for Power BI
     * @param dimensionName - Dimension name
     * @returns Dimension metadata
     */
    public async getDimensionMetadata(dimensionName: string): Promise<DimensionMetadata> {
        const dimension = await this.dimensions.get(dimensionName);
        const hierarchyName = dimension.defaultHierarchy?.name || dimensionName;

        let attributes: string[] = [];
        try {
            const attrs = await this.elements.getElementAttributes(dimensionName, hierarchyName);
            attributes = attrs.map((a: any) => typeof a === 'string' ? a : (a.name || String(a)));
        } catch (error) {
            console.warn(`Failed to get attributes for dimension '${dimensionName}' in getDimensionMetadata:`, error);
        }

        let elementCount = 0;
        try {
            elementCount = await this.elements.getNumberOfElements(dimensionName, hierarchyName);
        } catch (error) {
            console.warn(`Failed to get element count for dimension '${dimensionName}':`, error);
        }

        return {
            name: dimensionName,
            hierarchyName,
            elementCount,
            hasAttributes: attributes.length > 0,
            attributes
        };
    }

    // ==================== Private Helper Methods ====================

    private generateDatasetId(): string {
        return `ds_${Date.now()}_${uuidv4().substring(0, 8)}`;
    }

    private generateConnectionId(): string {
        return `conn_${Date.now()}_${uuidv4().substring(0, 8)}`;
    }

    /**
     * Helper method to safely get element attributes
     * @param dimensionName - Dimension name
     * @param hierarchyName - Hierarchy name
     * @returns Array of attribute names or empty array
     */
    private async safeGetAttributes(dimensionName: string, hierarchyName: string): Promise<string[]> {
        try {
            const attrs = await this.elements.getElementAttributes(dimensionName, hierarchyName);
            return attrs.map((a: any) => typeof a === 'string' ? a : (a.name || String(a)));
        } catch (error) {
            console.warn(`Failed to get attributes for dimension '${dimensionName}':`, error);
            return [];
        }
    }

    private async createDimensionTable(
        dimensionName: string,
        options?: PowerBIExportOptions
    ): Promise<PowerBITable> {
        const columns: PowerBIColumn[] = [
            { name: 'Name', dataType: 'string', isNullable: false }
        ];

        // Get dimension attributes
        const attrs = await this.safeGetAttributes(dimensionName, dimensionName);
        for (const attrName of attrs) {
            columns.push({
                name: attrName,
                dataType: this.inferAttributeDataType(attrName),
                isNullable: true
            });
        }

        // Get element data
        let rows: any[] = [];
        try {
            const dataframe = await this.elements.getElementsDataframe(
                dimensionName,
                dimensionName,
                undefined,
                {
                    skip_consolidations: options?.skipConsolidations ?? true,
                    attributes: options?.includeAttributes
                }
            );
            rows = this.formatDataForPowerBI(dataframe.data || [], dataframe.columns || []);
        } catch (error) {
            console.warn(`Failed to get elements for dimension '${dimensionName}':`, error);
        }

        return {
            name: dimensionName,
            columns,
            rows,
            description: `Dimension table for ${dimensionName}`
        };
    }

    private async createFactTable(
        cubeName: string,
        dimensions: string[],
        options?: PowerBIExportOptions
    ): Promise<PowerBITable> {
        const columns: PowerBIColumn[] = [];

        // Add dimension columns (foreign keys)
        for (const dimName of dimensions) {
            columns.push({
                name: dimName,
                dataType: 'string',
                isNullable: false
            });
        }

        // Add value column
        columns.push({
            name: 'Value',
            dataType: 'decimal',
            isNullable: true
        });

        // Get cube data
        let rows: any[] = [];
        try {
            rows = await this.exportCubeForPowerBI(cubeName, undefined, options);
        } catch (error) {
            console.warn(`Failed to export cube data for '${cubeName}':`, error);
        }

        return {
            name: cubeName,
            columns,
            rows,
            description: `Fact table for cube ${cubeName}`
        };
    }

    private async createDimensionSchema(dimensionName: string): Promise<PowerBITableSchema> {
        const columns: PowerBIColumn[] = [
            { name: 'Name', dataType: 'string', isNullable: false },
            { name: 'Type', dataType: 'string', isNullable: true }
        ];

        // Get attributes
        const attrs = await this.safeGetAttributes(dimensionName, dimensionName);
        for (const attrName of attrs) {
            columns.push({
                name: attrName,
                dataType: this.inferAttributeDataType(attrName),
                isNullable: true
            });
        }

        return {
            name: dimensionName,
            columns,
            sourceQuery: `SELECT * FROM [${dimensionName}]`
        };
    }

    private createFactTableSchema(cubeName: string, dimensions: string[]): PowerBITableSchema {
        const columns: PowerBIColumn[] = [];

        for (const dimName of dimensions) {
            columns.push({
                name: dimName,
                dataType: 'string',
                isNullable: false
            });
        }

        columns.push({
            name: 'Value',
            dataType: 'decimal',
            isNullable: true
        });

        return {
            name: cubeName,
            columns,
            sourceCube: cubeName
        };
    }

    private buildCubeMDX(
        cubeName: string,
        dimensions: string[],
        options: PowerBIExportOptions
    ): string {
        const rowDims = dimensions.slice(0, -1);
        const colDim = dimensions[dimensions.length - 1];

        const rowMembers = rowDims.map(d =>
            options.skipConsolidations
                ? `{TM1FILTERBYLEVEL({TM1SUBSETALL([${d}])}, 0)}`
                : `{TM1SUBSETALL([${d}])}`
        ).join(' * ');

        const colMembers = options.skipConsolidations
            ? `{TM1FILTERBYLEVEL({TM1SUBSETALL([${colDim}])}, 0)}`
            : `{TM1SUBSETALL([${colDim}])}`;

        return `
            SELECT ${colMembers} ON COLUMNS,
                   NON EMPTY ${rowMembers} ON ROWS
            FROM [${cubeName}]
        `.trim();
    }

    private formatValue(value: any, options: PowerBIFormatOptions): any {
        if (value === null || value === undefined) {
            return options.nullValue ?? null;
        }

        if (typeof value === 'string') {
            let formatted = value;
            if (options.trimStrings) {
                formatted = formatted.trim();
            }
            if (options.convertEmptyToNull && formatted === '') {
                return null;
            }
            return formatted;
        }

        if (typeof value === 'boolean' && options.booleanFormat) {
            return value ? options.booleanFormat.true : options.booleanFormat.false;
        }

        return value;
    }

    private convertToCompatibleType(value: any): any {
        if (value === null || value === undefined) {
            return null;
        }

        // Handle BigInt
        if (typeof value === 'bigint') {
            return Number(value);
        }

        // Handle Date objects
        if (value instanceof Date) {
            return value.toISOString();
        }

        // Handle NaN and Infinity
        if (typeof value === 'number' && (!Number.isFinite(value) || Number.isNaN(value))) {
            return null;
        }

        return value;
    }

    private inferAttributeDataType(attr: any): PowerBIDataType {
        if (typeof attr === 'string') {
            const lowerAttr = attr.toLowerCase();
            if (lowerAttr.includes('date') || lowerAttr.includes('time')) {
                return 'datetime';
            }
            if (lowerAttr.includes('amount') || lowerAttr.includes('value') || lowerAttr.includes('price')) {
                return 'decimal';
            }
            return 'string';
        }

        const attrType = attr.attributeType || attr.type || '';
        const attrName = (attr.name || '').toLowerCase();

        if (attrType.toLowerCase().includes('numeric') || attrType.toLowerCase().includes('number')) {
            return 'decimal';
        }

        if (attrName.includes('date') || attrName.includes('time')) {
            return 'datetime';
        }

        if (attrName.includes('amount') || attrName.includes('value') || attrName.includes('price')) {
            return 'decimal';
        }

        return 'string';
    }

    private identifyMeasureDimension(dimensions: DimensionMetadata[]): string | undefined {
        // Common measure dimension patterns
        const measurePatterns = ['measure', 'metric', 'account', 'indicator', 'kpi'];

        for (const dim of dimensions) {
            const lowerName = dim.name.toLowerCase();
            for (const pattern of measurePatterns) {
                if (lowerName.includes(pattern)) {
                    return dim.name;
                }
            }
        }

        // If no pattern match, assume the smallest dimension is the measure dimension
        if (dimensions.length > 0) {
            const sorted = [...dimensions].sort((a, b) => a.elementCount - b.elementCount);
            if (sorted[0].elementCount < PowerBiService.MEASURE_DIMENSION_THRESHOLD) {
                return sorted[0].name;
            }
        }

        return undefined;
    }

    // ==================== Connection Management ====================

    /**
     * Get connection status
     * @param connectionId - Connection ID
     * @returns Connection tracker or undefined
     */
    public getConnectionStatus(connectionId: string): PowerBIConnectionTracker | undefined {
        return this.connections.get(connectionId);
    }

    /**
     * List all connections
     * @returns Array of connection trackers
     */
    public listConnections(): PowerBIConnectionTracker[] {
        return Array.from(this.connections.values());
    }

    /**
     * Close a connection
     * @param connectionId - Connection ID to close
     */
    public closeConnection(connectionId: string): void {
        const conn = this.connections.get(connectionId);
        if (conn) {
            conn.status = 'inactive';
            this.connections.delete(connectionId);
        }
    }

    /**
     * Update connection configuration
     * @param connectionId - Connection ID
     * @param config - New configuration
     */
    public updateConnectionConfig(connectionId: string, config: Partial<PowerBIConfig>): void {
        const conn = this.connections.get(connectionId);
        if (conn) {
            conn.config = { ...conn.config, ...config };
        }
    }
}
