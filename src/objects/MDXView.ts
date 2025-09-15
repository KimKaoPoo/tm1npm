import { View } from './View';
import { caseAndSpaceInsensitiveEquals } from '../utils/Utils';

export class MDXView extends View {
    /** Abstraction on TM1 MDX view
     *
     *     IMPORTANT. MDXViews can't be seen through the old TM1 clients (Archict, Perspectives). They do exist though!
     */

    private _mdx: string;

    constructor(cubeName: string, viewName: string, MDX: string) {
        super(cubeName, viewName);
        this._mdx = MDX;
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
            viewAsDict.Cube?.Name || cubeName!,
            viewAsDict.Name,
            viewAsDict.MDX
        );
    }

    private constructBody(): string {
        const mdxViewAsDict: any = {};
        mdxViewAsDict['@odata.type'] = 'ibm.tm1.api.v1.MDXView';
        mdxViewAsDict['Name'] = this._name;
        mdxViewAsDict['MDX'] = this._mdx;
        return JSON.stringify(mdxViewAsDict);
    }
}