import { TM1Object } from './TM1Object';
import { formatUrl, readObjectNameFromUrl } from '../utils/Utils';

export class Subset extends TM1Object {
    /** Abstraction of the TM1 Subset (dynamic and static)
     */

    private _dimensionName: string;
    private _hierarchyName: string;
    private _subsetName: string;
    private _alias?: string;
    private _expression?: string;
    private _elements: string[];

    constructor(
        subsetName: string,
        dimensionName: string,
        hierarchyName?: string,
        alias?: string,
        expression?: string,
        elements?: string[]
    ) {
        /**
         * :param subset_name: String
         * :param dimension_name: String
         * :param hierarchy_name: String
         * :param alias: String, alias that is active in this subset.
         * :param expression: String
         * :param elements: List, element names
         */
        super();
        this._dimensionName = dimensionName;
        this._hierarchyName = hierarchyName || dimensionName;
        this._subsetName = subsetName;
        this._alias = alias;
        this._expression = expression;
        this._elements = elements || [];
    }

    public get dimensionName(): string {
        return this._dimensionName;
    }

    public set dimensionName(value: string) {
        this._dimensionName = value;
    }

    public get hierarchyName(): string {
        return this._hierarchyName;
    }

    public set hierarchyName(value: string) {
        this._hierarchyName = value;
    }

    public get name(): string {
        return this._subsetName;
    }

    public set name(value: string) {
        this._subsetName = value;
    }

    public get alias(): string | undefined {
        return this._alias;
    }

    public set alias(value: string | undefined) {
        this._alias = value;
    }

    public get expression(): string | undefined {
        return this._expression;
    }

    public set expression(value: string | undefined) {
        this._expression = value;
    }

    public get elements(): string[] {
        return this._elements;
    }

    public set elements(value: string[]) {
        this._elements = value;
    }

    public get type(): string {
        if (this.expression) {
            return 'dynamic';
        }
        return 'static';
    }

    public get isDynamic(): boolean {
        return Boolean(this.expression);
    }

    public get isStatic(): boolean {
        return !this.isDynamic;
    }

    public static fromJSON(subsetAsJson: string): Subset {
        /** Alternative constructor
         *        :Parameters:
         *            `subset_as_json` : string, JSON
         *                representation of Subset as specified in CSDL
         *
         *        :Returns:
         *            `Subset` : an instance of this class
         */
        const subsetAsDict = JSON.parse(subsetAsJson);
        return Subset.fromDict(subsetAsDict);
    }

    public static fromDict(subsetAsDict: Record<string, any>): Subset {
        return new Subset(
            subsetAsDict['Name'],
            subsetAsDict["UniqueName"].substring(1, subsetAsDict["UniqueName"].indexOf('].[', 1)),
            subsetAsDict.Hierarchy?.Name,
            subsetAsDict.Alias,
            subsetAsDict.Expression,
            !subsetAsDict.Expression ? 
                (subsetAsDict.Elements || []).map((element: any) => element.Name) : 
                undefined
        );
    }

    public get body(): string {
        /** same logic here as in TM1 : when subset has expression its dynamic, otherwise static
         */
        return JSON.stringify(this.bodyAsDict);
    }

    public get bodyAsDict(): Record<string, any> {
        /** same logic here as in TM1 : when subset has expression its dynamic, otherwise static
         */
        if (this._expression) {
            return this.constructBodyDynamic();
        } else {
            return this.constructBodyStatic();
        }
    }

    public addElements(elements: string[]): void {
        /** add Elements to static subsets
         *    :Parameters:
         *        `elements` : list of element names
         */
        this._elements = this._elements.concat(elements);
    }

    protected constructBodyDynamic(): Record<string, any> {
        const bodyAsDict: Record<string, any> = {};
        bodyAsDict['Name'] = this._subsetName;
        if (this.alias) {
            bodyAsDict['Alias'] = this._alias;
        }
        bodyAsDict['Hierarchy@odata.bind'] = formatUrl(
            "Dimensions('{}')/Hierarchies('{}')",
            this._dimensionName,
            this._hierarchyName
        );
        bodyAsDict['Expression'] = this._expression;
        return bodyAsDict;
    }

    protected constructBodyStatic(): Record<string, any> {
        const bodyAsDict: Record<string, any> = {};
        bodyAsDict['Name'] = this._subsetName;
        if (this.alias) {
            bodyAsDict['Alias'] = this._alias;
        }
        bodyAsDict['Hierarchy@odata.bind'] = formatUrl(
            "Dimensions('{}')/Hierarchies('{}')",
            this._dimensionName,
            this.hierarchyName
        );
        if (this.elements && this.elements.length > 0) {
            bodyAsDict['Elements@odata.bind'] = this.elements.map(element =>
                formatUrl(
                    "Dimensions('{}')/Hierarchies('{}')/Elements('{}')",
                    this.dimensionName,
                    this.hierarchyName,
                    element
                )
            );
        }
        return bodyAsDict;
    }
}


export class AnonymousSubset extends Subset {
    /** Abstraction of unregistered Subsets used in NativeViews (Check .ViewAxisSelection)
     */

    constructor(
        dimensionName: string,
        hierarchyName?: string,
        expression?: string,
        elements?: string[],
        alias: string = ''
    ) {
        super(
            '', // subset_name is empty for anonymous subsets
            dimensionName,
            hierarchyName || dimensionName,
            alias,
            expression,
            elements
        );
    }

    public static fromJSON(subsetAsJson: string): AnonymousSubset {
        /** Alternative constructor
         *        :Parameters:
         *            `subset_as_json` : string, JSON
         *                representation of Subset as specified in CSDL
         *
         *        :Returns:
         *            `Subset` : an instance of this class
         */
        const subsetAsDict = JSON.parse(subsetAsJson);
        return AnonymousSubset.fromDict(subsetAsDict);
    }

    public static fromDict(subsetAsDict: Record<string, any>): AnonymousSubset {
        /**Alternative constructor
         * 
         * :param subset_as_dict: dictionary, representation of Subset as specified in CSDL
         * :return: an instance of this class
         */
        let dimensionName: string;
        let hierarchyName: string;

        if ("Hierarchy" in subsetAsDict) {
            dimensionName = subsetAsDict["Hierarchy"]["Dimension"]["Name"];
            hierarchyName = subsetAsDict["Hierarchy"]["Name"];
        } else if ("Hierarchy@odata.bind" in subsetAsDict) {
            const hierarchyOdata = subsetAsDict["Hierarchy@odata.bind"];

            dimensionName = readObjectNameFromUrl(hierarchyOdata);
            hierarchyName = readObjectNameFromUrl(hierarchyOdata);

            if (!dimensionName || !hierarchyName) {
                throw new Error(
                    `Unexpected value for 'Hierarchy@odata.bind' property in subset dict: '${hierarchyOdata}'`
                );
            }
        } else {
            throw new Error("Subset dict must contain 'Hierarchy' or 'Hierarchy@odata.bind' as key");
        }

        let elements: string[] | undefined;

        if ("Elements" in subsetAsDict) {
            elements = subsetAsDict['Elements'].map((element: any) => element.Name);
        } else if ("Elements@odata.bind" in subsetAsDict) {
            elements = [];
            const elementsOdata = subsetAsDict["Elements@odata.bind"];
            const pattern = /Dimensions\('.*?'\)\/Hierarchies\('.*?'\)\/Elements\('(.+?)'\)/;
            
            for (const elementOdata of elementsOdata) {
                const matches = elementOdata.match(pattern);
                const element = matches ? matches[1] : null;
                if (!element) {
                    throw new Error(
                        `Unexpected entry '${elementOdata}' for 'Elements@odata.bind' property in subset dict`
                    );
                }
                elements.push(element);
            }
        } else {
            elements = undefined;
        }

        return new AnonymousSubset(
            dimensionName,
            hierarchyName,
            subsetAsDict.Expression || undefined,
            !subsetAsDict.Expression ? elements : undefined,
            subsetAsDict.Alias || undefined
        );
    }

    protected constructBodyDynamic(): Record<string, any> {
        const bodyAsDict: Record<string, any> = {};
        bodyAsDict['Hierarchy@odata.bind'] = formatUrl(
            "Dimensions('{}')/Hierarchies('{}')",
            this.dimensionName,
            this.hierarchyName
        );
        if (this.alias) {
            bodyAsDict['Alias'] = this.alias;
        }
        bodyAsDict['Expression'] = this.expression;
        return bodyAsDict;
    }

    protected constructBodyStatic(): Record<string, any> {
        const bodyAsDict: Record<string, any> = {};
        bodyAsDict['Hierarchy@odata.bind'] = formatUrl(
            "Dimensions('{}')/Hierarchies('{}')",
            this.dimensionName,
            this.hierarchyName
        );
        if (this.alias) {
            bodyAsDict['Alias'] = this.alias;
        }
        if (this.elements && this.elements.length > 0) {
            bodyAsDict['Elements@odata.bind'] = this.elements.map(element =>
                formatUrl(
                    "Dimensions('{}')/Hierarchies('{}')/Elements('{}')",
                    this.dimensionName,
                    this.hierarchyName,
                    element
                )
            );
        }
        return bodyAsDict;
    }
}