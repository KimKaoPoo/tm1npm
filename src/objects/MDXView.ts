import { View } from './View';
import { caseAndSpaceInsensitiveEquals } from '../utils/Utils';

export class MDXView extends View {
    /** Abstraction on TM1 MDX view
     *
     *     IMPORTANT. MDXViews can't be seen through the old TM1 clients (Archict, Perspectives). They do exist though!
     */

    private static readonly _DYNAMIC_PROPERTIES_EXCLUDED_KEYS: ReadonlySet<string> = new Set([
        '@odata.type',
        '@odata.context',
        '@odata.etag',
        'Name',
        'MDX',
        'Cube',
        'Attributes',
        'LocalizedAttributes',
    ]);

    private static _filterDynamicProperties(properties: Record<string, any>): Record<string, any> {
        const out: Record<string, any> = {};
        for (const key of Object.keys(properties)) {
            if (!MDXView._DYNAMIC_PROPERTIES_EXCLUDED_KEYS.has(key)) {
                out[key] = properties[key];
            }
        }
        return out;
    }

    private _mdx: string;
    private _dynamicProperties: Record<string, any>;

    constructor(cubeName: string, viewName: string, MDX: string, dynamicProperties?: Record<string, any>) {
        super(cubeName, viewName);
        this._mdx = MDX;
        this._dynamicProperties = dynamicProperties || {};
    }

    public get mdx(): string {
        return this._mdx;
    }

    public set mdx(value: string) {
        this._mdx = value;
    }

    public get MDX(): string {
        return this._mdx;
    }

    public set MDX(value: string) {
        this._mdx = value;
    }

    public get dynamicProperties(): Record<string, any> {
        return this._dynamicProperties;
    }

    public set dynamicProperties(value: Record<string, any>) {
        this._dynamicProperties = value;
    }

    public get body(): string {
        return this.constructBody();
    }

    public substituteTitle(dimension: string, hierarchy: string, element: string): void {
        /** dimension and hierarchy name are space sensitive!
         *
         * :param dimension:
         * :param hierarchy:
         * :param element:
         * :return:
         */
        let pattern = new RegExp(`\\[${dimension}\\]\\.\\[${hierarchy}\\]\\.\\[(.*?)\\]`, 'gi');
        let findings = this._mdx.match(pattern);

        if (findings) {
            this._mdx = this._mdx.replace(
                pattern,
                `[${dimension}].[${hierarchy}].[${element}]`
            );
            return;
        }

        if (!hierarchy || caseAndSpaceInsensitiveEquals(dimension, hierarchy)) {
            pattern = new RegExp(`\\[${dimension}\\]\\.\\[(.*?)\\]`, 'gi');
            findings = this._mdx.match(pattern);
            if (findings) {
                this._mdx = this._mdx.replace(
                    pattern,
                    `[${dimension}].[${element}]`
                );
                return;
            }
        }

        throw new Error(`No selection in title with dimension: '${dimension}' and hierarchy: '${hierarchy}'`);
    }

    public static fromJSON(viewAsJson: string, cubeName?: string): MDXView {
        const viewAsDict = JSON.parse(viewAsJson);
        return MDXView.fromDict(viewAsDict, cubeName);
    }

    public static fromDict(viewAsDict: any, cubeName?: string): MDXView {
        return new MDXView(
            cubeName ? cubeName : viewAsDict.Cube.Name,
            viewAsDict.Name,
            viewAsDict.MDX,
            MDXView._filterDynamicProperties(viewAsDict),
        );
    }

    private constructBody(): string {
        const mdxViewAsDict: Record<string, any> = {
            '@odata.type': 'ibm.tm1.api.v1.MDXView',
            Name: this._name,
            MDX: this._mdx,
            ...MDXView._filterDynamicProperties(this._dynamicProperties),
        };
        return JSON.stringify(mdxViewAsDict);
    }
}
