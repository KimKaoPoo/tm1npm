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
         * Throws an Exception when no elements are placed on the columns.
         * Subsets are referenced in the result-MDX through the TM1SubsetToSet Function
         *
         * :return: String, the MDX Query
         */
        if (!this.columns || this.columns.length === 0) {
            throw new Error("Column selection must not be empty");
        }

        const buildAxisMdx = (selections: ViewAxisSelection[], axisOrdinal: number, suppress: boolean): string => {
            const sets: string[] = [];
            for (const sel of selections) {
                const subset = sel.subset;
                if (subset instanceof AnonymousSubset) {
                    if (subset.expression) {
                        sets.push(subset.expression);
                    } else {
                        const members = subset.elements.map(e =>
                            `[${subset.dimensionName}].[${subset.hierarchyName}].[${e}]`
                        );
                        sets.push(`{${members.join(', ')}}`);
                    }
                } else {
                    sets.push(`TM1SubsetToSet([${subset.dimensionName}].[${subset.hierarchyName}], "${subset.name}")`);
                }
            }
            const combined = sets.join(' * ');
            const prefix = suppress ? 'NON EMPTY ' : '';
            return `${prefix}{${combined}} DIMENSION PROPERTIES MEMBER_NAME ON ${axisOrdinal}`;
        };

        const axisParts: string[] = [];
        axisParts.push(buildAxisMdx(this.columns, 0, this._suppressEmptyColumns));

        if (this.rows && this.rows.length > 0) {
            axisParts.push(buildAxisMdx(this.rows, 1, this._suppressEmptyRows));
        }

        let mdx = `SELECT ${axisParts.join(',\n')} FROM [${this.cube}]`;

        if (this.titles && this.titles.length > 0) {
            const titleSelections: string[] = [];
            for (const title of this.titles) {
                if (title.selected) {
                    titleSelections.push(`[${title.dimensionName}].[${title.hierarchyName}].[${title.selected}]`);
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

    public get suppressEmptyCells(): boolean {
        return this._suppressEmptyColumns && this._suppressEmptyRows;
    }

    public set suppressEmptyCells(value: boolean) {
        this._suppressEmptyColumns = value;
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

    public substituteTitle(dimension: string, element: string): void {
        /** Substitute the title element for a given dimension
         *
         * :param dimension: str, name of dimension
         * :param element: str, name of element
         */
        for (const title of this._titles) {
            if (caseAndSpaceInsensitiveEquals(title.dimensionName, dimension)) {
                title.selected = element;
                return;
            }
        }
        throw new Error(`No title with dimension: '${dimension}'`);
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
