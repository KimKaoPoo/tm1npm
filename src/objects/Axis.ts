import { TM1Object } from './TM1Object';
import { Subset, AnonymousSubset } from './Subset';
import { formatUrl, parseODataBindUrl } from '../utils/Utils';

export class ViewAxisSelection extends TM1Object {
    /** Describes what is selected in a dimension on an axis. Can be a Registered Subset or an Anonymous Subset
     */

    private _subset: Subset | AnonymousSubset;
    private _dimensionName: string;
    private _hierarchyName: string;

    constructor(dimensionName: string, subset: Subset | AnonymousSubset) {
        /**
         *    :Parameters:
         *        `dimension_name` : String
         *        `subset` : Subset or AnonymousSubset
         */
        super();
        this._subset = subset;
        this._dimensionName = dimensionName;
        this._hierarchyName = subset.hierarchyName || dimensionName;
    }

    public get subset(): Subset | AnonymousSubset {
        return this._subset;
    }

    public get dimensionName(): string {
        return this._dimensionName;
    }

    public get hierarchyName(): string {
        return this._hierarchyName;
    }

    public get body(): string {
        return JSON.stringify(this.constructBody());
    }

    public get bodyAsDict(): Record<string, any> {
        return this.constructBody();
    }

    public static fromDict(data: Record<string, any>): ViewAxisSelection {
        if ('Subset' in data) {
            const subset = AnonymousSubset.fromDict(data['Subset']);
            return new ViewAxisSelection(subset.dimensionName, subset);
        } else if ('Subset@odata.bind' in data) {
            const parts = parseODataBindUrl(data['Subset@odata.bind']);
            const dimName = parts[0] || '';
            const hierName = parts[1] || '';
            const subsetName = parts[2] || '';
            const subset = new Subset(subsetName, dimName, hierName);
            return new ViewAxisSelection(dimName, subset);
        }
        throw new Error("ViewAxisSelection dict must contain 'Subset' or 'Subset@odata.bind'");
    }

    private constructBody(): Record<string, any> {
        /** construct the ODATA conform JSON represenation for the ViewAxisSelection entity.
         *
         * :return: dictionary
         */
        const bodyAsDict: Record<string, any> = {};

        if (this._subset instanceof AnonymousSubset) {
            bodyAsDict['Subset'] = JSON.parse(this._subset.body);
        } else if (this._subset instanceof Subset) {
            const subsetPath = formatUrl(
                "Dimensions('{}')/Hierarchies('{}')/Subsets('{}')",
                this._dimensionName,
                this._hierarchyName,
                this._subset.name
            );
            bodyAsDict['Subset@odata.bind'] = subsetPath;
        }

        return bodyAsDict;
    }
}


export class ViewTitleSelection {
    /** Describes what is selected in a dimension on the view title.
     *    Can be a Registered Subset or an Anonymous Subset
     */

    private _dimensionName: string;
    private _hierarchyName: string;
    private _subset: AnonymousSubset | Subset;
    private _selected: string;

    constructor(dimensionName: string, subset: AnonymousSubset | Subset, selected: string) {
        this._dimensionName = dimensionName;
        this._hierarchyName = subset.hierarchyName || dimensionName;
        this._subset = subset;
        this._selected = selected;
    }

    public get subset(): Subset | AnonymousSubset {
        return this._subset;
    }

    public set subset(value: Subset | AnonymousSubset) {
        this._subset = value;
    }

    public get dimensionName(): string {
        return this._dimensionName;
    }

    public get hierarchyName(): string {
        return this._hierarchyName;
    }

    public get selected(): string {
        return this._selected;
    }

    public set selected(value: string) {
        this._selected = value;
    }

    public get body(): string {
        return JSON.stringify(this.constructBody());
    }

    public get bodyAsDict(): Record<string, any> {
        return this.constructBody();
    }

    public static fromDict(data: Record<string, any>): ViewTitleSelection {
        let subset: AnonymousSubset | Subset;
        let dimName: string;

        if ('Subset' in data) {
            subset = AnonymousSubset.fromDict(data['Subset']);
            dimName = subset.dimensionName;
        } else if ('Subset@odata.bind' in data) {
            const parts = parseODataBindUrl(data['Subset@odata.bind']);
            dimName = parts[0] || '';
            const hierName = parts[1] || '';
            const subsetName = parts[2] || '';
            subset = new Subset(subsetName, dimName, hierName);
        } else {
            throw new Error("ViewTitleSelection dict must contain 'Subset' or 'Subset@odata.bind'");
        }

        let selected: string;
        if ('Selected@odata.bind' in data) {
            // URL format: Dimensions('D')/Hierarchies('H')/Elements('E')
            const parts = parseODataBindUrl(data['Selected@odata.bind']);
            selected = parts[2] || '';
        } else if ('Selected' in data && data['Selected']) {
            selected = data['Selected'].Name || '';
        } else {
            selected = '';
        }

        return new ViewTitleSelection(dimName, subset, selected);
    }

    private constructBody(): Record<string, any> {
        /** construct the ODATA conform JSON represenation for the ViewTitleSelection entity.
         *
         * :return: string, the valid JSON
         */
        const bodyAsDict: Record<string, any> = {};

        if (this._subset instanceof AnonymousSubset) {
            bodyAsDict['Subset'] = JSON.parse(this._subset.body);
        } else if (this._subset instanceof Subset) {
            const subsetPath = formatUrl(
                "Dimensions('{}')/Hierarchies('{}')/Subsets('{}')",
                this._dimensionName,
                this._hierarchyName,
                this._subset.name
            );
            bodyAsDict['Subset@odata.bind'] = subsetPath;
        }

        const elementPath = formatUrl(
            "Dimensions('{}')/Hierarchies('{}')/Elements('{}')",
            this._dimensionName,
            this._hierarchyName,
            this._selected
        );
        bodyAsDict['Selected@odata.bind'] = elementPath;

        return bodyAsDict;
    }
}
