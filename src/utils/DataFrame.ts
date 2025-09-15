/**
 * DataFrame-like data structure for tm1npm
 * Provides pandas-like functionality for JavaScript/TypeScript
 */

export interface DataFrameOptions {
    columns?: string[];
    index?: any[];
}

export class DataFrame {
    private _data: any[][];
    private _columns: string[];
    private _index: any[];

    constructor(data: any[][] = [], options: DataFrameOptions = {}) {
        this._data = data;
        this._columns = options.columns || this.generateColumnNames(data);
        this._index = options.index || this.generateIndex(data);
    }

    private generateColumnNames(data: any[][]): string[] {
        if (data.length === 0) return [];
        const colCount = Math.max(...data.map(row => row.length));
        return Array.from({ length: colCount }, (_, i) => `col_${i}`);
    }

    private generateIndex(data: any[][]): any[] {
        return Array.from({ length: data.length }, (_, i) => i);
    }

    /**
     * Get column names
     */
    get columns(): string[] {
        return [...this._columns];
    }

    /**
     * Get index values
     */
    get index(): any[] {
        return [...this._index];
    }

    /**
     * Get raw data
     */
    get data(): any[][] {
        return this._data.map(row => [...row]);
    }

    /**
     * Get DataFrame shape [rows, columns]
     */
    get shape(): [number, number] {
        return [this._data.length, this._columns.length];
    }

    /**
     * Get number of rows
     */
    get length(): number {
        return this._data.length;
    }

    /**
     * Add a new column
     */
    public addColumn(name: string, values: any[]): DataFrame {
        const newColumns = [...this._columns, name];
        const newData = this._data.map((row, i) => [...row, values[i] || null]);
        return new DataFrame(newData, { columns: newColumns, index: this._index });
    }

    /**
     * Select specific columns
     */
    public select(columnNames: string[]): DataFrame {
        const columnIndices = columnNames.map(name => this._columns.indexOf(name));
        const newData = this._data.map(row => columnIndices.map(i => i >= 0 ? row[i] : null));
        return new DataFrame(newData, { columns: columnNames, index: this._index });
    }

    /**
     * Filter rows based on condition
     */
    public filter(predicate: (row: any[], index: number) => boolean): DataFrame {
        const filteredData: any[][] = [];
        const filteredIndex: any[] = [];
        
        this._data.forEach((row, i) => {
            if (predicate(row, i)) {
                filteredData.push([...row]);
                filteredIndex.push(this._index[i]);
            }
        });
        
        return new DataFrame(filteredData, { columns: this._columns, index: filteredIndex });
    }

    /**
     * Sort by column
     */
    public sortBy(columnName: string, ascending: boolean = true): DataFrame {
        const columnIndex = this._columns.indexOf(columnName);
        if (columnIndex === -1) {
            throw new Error(`Column '${columnName}' not found`);
        }

        const sortedIndices = Array.from({ length: this._data.length }, (_, i) => i);
        sortedIndices.sort((a, b) => {
            const valA = this._data[a][columnIndex];
            const valB = this._data[b][columnIndex];
            
            if (valA < valB) return ascending ? -1 : 1;
            if (valA > valB) return ascending ? 1 : -1;
            return 0;
        });

        const sortedData = sortedIndices.map(i => [...this._data[i]]);
        const sortedIndex = sortedIndices.map(i => this._index[i]);
        
        return new DataFrame(sortedData, { columns: this._columns, index: sortedIndex });
    }

    /**
     * Group by column and aggregate
     */
    public groupBy(columnName: string): GroupBy {
        const columnIndex = this._columns.indexOf(columnName);
        if (columnIndex === -1) {
            throw new Error(`Column '${columnName}' not found`);
        }

        const groups: { [key: string]: number[] } = {};
        this._data.forEach((row, i) => {
            const key = String(row[columnIndex]);
            if (!groups[key]) groups[key] = [];
            groups[key].push(i);
        });

        return new GroupBy(this, groups, columnName);
    }

    /**
     * Convert to CSV string
     */
    public toCsv(separator: string = ','): string {
        const rows: string[] = [];
        
        // Add header
        rows.push(this._columns.join(separator));
        
        // Add data rows
        this._data.forEach(row => {
            const csvRow = row.map(cell => {
                const str = String(cell || '');
                return str.includes(separator) ? `"${str.replace(/"/g, '""')}"` : str;
            }).join(separator);
            rows.push(csvRow);
        });
        
        return rows.join('\n');
    }

    /**
     * Convert to JSON array
     */
    public toJson(): any[] {
        return this._data.map((row, i) => {
            const obj: any = {};
            this._columns.forEach((col, j) => {
                obj[col] = row[j];
            });
            return obj;
        });
    }

    /**
     * Get row by index
     */
    public getRow(index: number): any[] | null {
        return index >= 0 && index < this._data.length ? [...this._data[index]] : null;
    }

    /**
     * Get column values by name
     */
    public getColumn(columnName: string): any[] {
        const columnIndex = this._columns.indexOf(columnName);
        if (columnIndex === -1) {
            throw new Error(`Column '${columnName}' not found`);
        }
        return this._data.map(row => row[columnIndex]);
    }

    /**
     * Create DataFrame from TM1 cellset data
     */
    public static fromTM1Cellset(cellset: any): DataFrame {
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
     * Create DataFrame from JSON array
     */
    public static fromJson(jsonArray: any[]): DataFrame {
        if (!jsonArray || jsonArray.length === 0) {
            return new DataFrame();
        }

        const columns = Object.keys(jsonArray[0]);
        const data = jsonArray.map(obj => columns.map(col => obj[col]));
        
        return new DataFrame(data, { columns });
    }

    /**
     * Create DataFrame from CSV string
     */
    public static fromCsv(csvString: string, separator: string = ','): DataFrame {
        const lines = csvString.trim().split('\n');
        if (lines.length === 0) {
            return new DataFrame();
        }

        const columns = lines[0].split(separator).map(col => col.replace(/^"|"$/g, ''));
        const data = lines.slice(1).map(line => {
            return line.split(separator).map(cell => {
                // Remove quotes and handle escaped quotes
                const cleaned = cell.replace(/^"|"$/g, '').replace(/""/g, '"');
                // Try to parse as number
                const num = Number(cleaned);
                return isNaN(num) ? cleaned : num;
            });
        });

        return new DataFrame(data, { columns });
    }
}

/**
 * GroupBy class for aggregation operations
 */
export class GroupBy {
    private dataFrame: DataFrame;
    private groups: { [key: string]: number[] };
    private groupColumn: string;

    constructor(dataFrame: DataFrame, groups: { [key: string]: number[] }, groupColumn: string) {
        this.dataFrame = dataFrame;
        this.groups = groups;
        this.groupColumn = groupColumn;
    }

    /**
     * Sum aggregation
     */
    public sum(columnName: string): DataFrame {
        return this.aggregate(columnName, values => values.reduce((a, b) => a + b, 0));
    }

    /**
     * Count aggregation
     */
    public count(): DataFrame {
        const data: any[][] = [];
        Object.entries(this.groups).forEach(([key, indices]) => {
            data.push([key, indices.length]);
        });
        return new DataFrame(data, { columns: [this.groupColumn, 'count'] });
    }

    /**
     * Mean aggregation
     */
    public mean(columnName: string): DataFrame {
        return this.aggregate(columnName, values => values.reduce((a, b) => a + b, 0) / values.length);
    }

    /**
     * Generic aggregation function
     */
    private aggregate(columnName: string, aggregator: (values: number[]) => number): DataFrame {
        const columnIndex = this.dataFrame.columns.indexOf(columnName);
        if (columnIndex === -1) {
            throw new Error(`Column '${columnName}' not found`);
        }

        const data: any[][] = [];
        Object.entries(this.groups).forEach(([key, indices]) => {
            const values = indices.map(i => Number(this.dataFrame.data[i][columnIndex]) || 0);
            const result = aggregator(values);
            data.push([key, result]);
        });

        return new DataFrame(data, { columns: [this.groupColumn, columnName] });
    }
}