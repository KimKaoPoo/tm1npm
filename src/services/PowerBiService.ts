import { RestService } from './RestService';
import { CellService } from './CellService';
import { ElementService } from './ElementService';

export class PowerBiService {
    private _tm1Rest: RestService;
    public cells: CellService;
    public elements: ElementService;

    constructor(tm1Rest: RestService) {
        /**
         * :param tm1_rest: instance of RestService
         */
        this._tm1Rest = tm1Rest;
        this.cells = new CellService(tm1Rest);
        this.elements = new ElementService(tm1Rest);
    }

    public async executeMdx(mdx: string): Promise<any[]> {
        /** Execute MDX and return data as array (equivalent to DataFrame)
         * Note: In JavaScript/TypeScript, we return array of objects instead of pandas DataFrame
         */
        return await this.cells.executeMdxDataFrameShaped(mdx);
    }

    public async executeView(
        cubeName: string,
        viewName: string,
        isPrivate: boolean,
        useIterativeJson: boolean = false,
        useBlob: boolean = false
    ): Promise<any[]> {
        /** Execute view and return data as array (equivalent to DataFrame)
         * Note: In JavaScript/TypeScript, we return array of objects instead of pandas DataFrame
         */
        return await this.cells.executeViewDataFrameShaped(
            cubeName,
            viewName,
            isPrivate,
            useIterativeJson,
            useBlob
        );
    }

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
        /**
         * :param dimension_name: Name of the dimension
         * :param hierarchy_name: Name of the hierarchy in the dimension
         * :param member_selection: Selection of members. Array or valid MDX string
         * :param skip_consolidations: Boolean flag to skip consolidations
         * :param attributes: Selection of attributes. Array. If None retrieve all.
         * :param level_names: List of labels for parent columns. If None use level names from TM1.
         * :param skip_parents: Boolean Flag to skip parent columns.
         * :param parent_attribute: Attribute to be displayed in parent columns. If None, parent name is used.
         * :param skip_weights: include weight columns
         * :param use_blob: Better performance on large sets and lower memory footprint in any case. Requires admin permissions
         *
         * :return: Array of objects (equivalent to pandas DataFrame)
         */
        if (!skipWeights && skipParents) {
            throw new Error("skip_weights must not be false if skip_parents is true");
        }

        if (!dimensionName) {
            throw new Error("dimensionName is required");
        }

        return await this.elements.getElementsDataframe(
            dimensionName,
            hierarchyName || dimensionName,
            attributes
        );
    }
}