import { View } from './View';
import { ViewAxisSelection, ViewTitleSelection } from './Axis';
import { AnonymousSubset } from './Subset';
import { caseAndSpaceInsensitiveEquals } from '../utils/Utils';

export class NativeView extends View {
    /** Abstraction of TM1 NativeView (classic cube view)
     *
     *     :Notes:
     *         Complete, functional and tested
     */

    private _suppressEmptyColumns: boolean;
    private _suppressEmptyRows: boolean;
    private _formatString: string;
    private _titles: ViewTitleSelection[];
    private _columns: ViewAxisSelection[];
    private _rows: ViewAxisSelection[];

    constructor(
        cubeName: string,
        viewName: string,
        suppressEmptyColumns: boolean = false,
        suppressEmptyRows: boolean = false,
        formatString: string = "0.#########",
        titles?: Iterable<ViewTitleSelection>,
        columns?: Iterable<ViewAxisSelection>,
        rows?: Iterable<ViewAxisSelection>
    ) {
        super(cubeName, viewName);
        this._suppressEmptyColumns = suppressEmptyColumns;
        this._suppressEmptyRows = suppressEmptyRows;
        this._formatString = formatString;
        this._titles = titles ? Array.from(titles) : [];
        this._columns = columns ? Array.from(columns) : [];
        this._rows = rows ? Array.from(rows) : [];
    }

    public get body(): string {
        return this.constructBody();
    }

    public get rows(): ViewAxisSelection[] {
        return this._rows;
    }

    public get columns(): ViewAxisSelection[] {
        return this._columns;
    }

    public get titles(): ViewTitleSelection[] {
        return this._titles;
    }

    public get mdx(): string {
        return this.asMDX;
    }

    public get MDX(): string {
        return this.asMDX;
    }

    public get asMDX(): string {
        /** Build a valid MDX Query from an Existing cubeview. 
         * Takes Zero suppression into account. 
         * Throws an Exception when no elements are place on the columns.
         * Subsets are referenced in the result-MDX through the TM1SubsetToSet Function
         *
         * :return: String, the MDX Query
         */
        if (!this.columns || this.columns.length === 0) {
            throw new Error("Column selection must not be empty");
        }

        // Basic MDX construction - this would need a full MDX builder implementation
        let mdx = "SELECT ";
        
        // Build column axis
        const columnSets: string[] = [];
        for (const columnSelection of this.columns) {
            const subset = columnSelection.subset;
            if (subset instanceof AnonymousSubset) {
                if (subset.expression) {
                    columnSets.push(subset.expression);
                } else {
                    const members = subset.elements.map(e => `[${subset.dimensionName}].[${e}]`);
                    columnSets.push(`{${members.join(', ')}}`);
                }
            } else {
                columnSets.push(`TM1SubsetToSet([${subset.dimensionName}], "${subset.name}")`);
            }
        }
        
        if (this._suppressEmptyColumns) {
            mdx += `NON EMPTY (${columnSets.join(' * ')}) ON COLUMNS`;
        } else {
            mdx += `(${columnSets.join(' * ')}) ON COLUMNS`;
        }

        // Build row axis if exists
        if (this.rows && this.rows.length > 0) {
            const rowSets: string[] = [];
            for (const rowSelection of this.rows) {
                const subset = rowSelection.subset;
                if (subset instanceof AnonymousSubset) {
                    if (subset.expression) {
                        rowSets.push(subset.expression);
                    } else {
                        const members = subset.elements.map(e => `[${subset.dimensionName}].[${e}]`);
                        rowSets.push(`{${members.join(', ')}}`);
                    }
                } else {
                    rowSets.push(`TM1SubsetToSet([${subset.dimensionName}], "${subset.name}")`);
                }
            }
            
            if (this._suppressEmptyRows) {
                mdx += `, NON EMPTY (${rowSets.join(' * ')}) ON ROWS`;
            } else {
                mdx += `, (${rowSets.join(' * ')}) ON ROWS`;
            }
        }

        mdx += ` FROM [${this.cube}]`;

        // Add WHERE clause for titles
        if (this.titles && this.titles.length > 0) {
            const titleSelections: string[] = [];
            for (const title of this.titles) {
                if (title.selected && title.selected.length > 0) {
                    titleSelections.push(`[${title.dimensionName}].[${title.selected[0]}]`);
                }
            }
            if (titleSelections.length > 0) {
                mdx += ` WHERE (${titleSelections.join(', ')})`;
            }
        }

        return mdx;
    }

    public get suppressEmptyColumns(): boolean {
        return this._suppressEmptyColumns;
    }

    public set suppressEmptyColumns(value: boolean) {
        this._suppressEmptyColumns = value;
    }

    public get suppressEmptyRows(): boolean {
        return this._suppressEmptyRows;
    }

    public set suppressEmptyRows(value: boolean) {
        this._suppressEmptyRows = value;
    }

    public get formatString(): string {
        return this._formatString;
    }

    public set formatString(value: string) {
        this._formatString = value;
    }

    public addTitle(title: ViewTitleSelection): void {
        this._titles.push(title);
    }

    public addColumn(column: ViewAxisSelection): void {
        this._columns.push(column);
    }

    public addRow(row: ViewAxisSelection): void {
        this._rows.push(row);
    }

    public removeTitle(dimensionName: string): boolean {
        const index = this._titles.findIndex(t => 
            caseAndSpaceInsensitiveEquals(t.dimensionName, dimensionName));
        if (index !== -1) {
            this._titles.splice(index, 1);
            return true;
        }
        return false;
    }

    public removeColumn(dimensionName: string): boolean {
        const index = this._columns.findIndex(c => 
            caseAndSpaceInsensitiveEquals(c.subset.dimensionName, dimensionName));
        if (index !== -1) {
            this._columns.splice(index, 1);
            return true;
        }
        return false;
    }

    public removeRow(dimensionName: string): boolean {
        const index = this._rows.findIndex(r => 
            caseAndSpaceInsensitiveEquals(r.subset.dimensionName, dimensionName));
        if (index !== -1) {
            this._rows.splice(index, 1);
            return true;
        }
        return false;
    }

    public static fromJSON(viewAsJson: string, cubeName: string): NativeView {
        const viewAsDict = JSON.parse(viewAsJson);
        return NativeView.fromDict(viewAsDict, cubeName);
    }

    public static fromDict(viewAsDict: any, cubeName: string): NativeView {
        const view = new NativeView(
            cubeName,
            viewAsDict.Name,
            viewAsDict.SuppressEmptyColumns || false,
            viewAsDict.SuppressEmptyRows || false,
            viewAsDict.FormatString || "0.#########"
        );

        // Parse titles
        if (viewAsDict.Titles) {
            for (const titleDict of viewAsDict.Titles) {
                const title = ViewTitleSelection.fromDict(titleDict);
                view.addTitle(title);
            }
        }

        // Parse columns
        if (viewAsDict.Columns) {
            for (const columnDict of viewAsDict.Columns) {
                const column = ViewAxisSelection.fromDict(columnDict);
                view.addColumn(column);
            }
        }

        // Parse rows
        if (viewAsDict.Rows) {
            for (const rowDict of viewAsDict.Rows) {
                const row = ViewAxisSelection.fromDict(rowDict);
                view.addRow(row);
            }
        }

        return view;
    }

    private constructBody(): string {
        const viewAsDict: any = {};
        viewAsDict['@odata.type'] = 'ibm.tm1.api.v1.NativeView';
        viewAsDict['Name'] = this._name;
        viewAsDict['SuppressEmptyColumns'] = this._suppressEmptyColumns;
        viewAsDict['SuppressEmptyRows'] = this._suppressEmptyRows;
        viewAsDict['FormatString'] = this._formatString;

        // Add titles
        viewAsDict['Titles'] = this._titles.map(title => title.bodyAsDict);
        
        // Add columns
        viewAsDict['Columns'] = this._columns.map(column => column.bodyAsDict);
        
        // Add rows
        viewAsDict['Rows'] = this._rows.map(row => row.bodyAsDict);

        return JSON.stringify(viewAsDict);
    }
}