import { AxiosResponse } from 'axios';
import { RestService } from './RestService';
import { ObjectService } from './ObjectService';
import { Subset } from '../objects/Subset';
import { ElementService } from './ElementService';
import { TM1RestException } from '../exceptions/TM1Exception';

export class SubsetService extends ObjectService {
    private elementService?: ElementService;

    constructor(rest: RestService) {
        super(rest);
    }

    public async create(
        subset: Subset,
        isPrivate?: boolean
    ): Promise<AxiosResponse>;

    public async create(
        dimensionName: string,
        hierarchyName: string,
        subset: any,
        isPrivate?: boolean
    ): Promise<AxiosResponse>;

    public async create(
        arg1: Subset | string,
        arg2?: string | boolean,
        arg3?: any,
        arg4: boolean = false
    ): Promise<AxiosResponse> {
        if (arg1 instanceof Subset) {
            const subset = arg1;
            const isPrivate = typeof arg2 === 'boolean' ? arg2 : arg4;
            const subsetsCollection = this.getSubsetCollection(isPrivate);
            const url = this.formatUrl(
                "/Dimensions('{}')/Hierarchies('{}')/{}",
                subset.dimensionName,
                subset.hierarchyName,
                subsetsCollection
            );
            return await this.rest.post(url, subset.body);
        }

        const dimensionName = arg1;
        const hierarchyName = arg2 as string;
        const subset = arg3;
        const isPrivate = arg4;
        const subsetsCollection = this.getSubsetCollection(isPrivate);
        const url = this.formatUrl(
            "/Dimensions('{}')/Hierarchies('{}')/{}",
            dimensionName,
            hierarchyName,
            subsetsCollection
        );
        return await this.rest.post(url, JSON.stringify(subset));
    }

    public async get(
        dimensionName: string,
        hierarchyName: string,
        subsetName: string,
        isPrivate: boolean = true
    ): Promise<any> {
        const visibility = this.getSubsetCollection(isPrivate);
        const url = this.formatUrl(
            "/Dimensions('{}')/Hierarchies('{}')/{}('{}')",
            dimensionName,
            hierarchyName,
            visibility,
            subsetName
        );
        const response = await this.rest.get(url);
        return response.data;
    }

    public async update(
        subset: Subset,
        isPrivate?: boolean
    ): Promise<AxiosResponse>;

    public async update(
        dimensionName: string,
        hierarchyName: string,
        subset: any,
        isPrivate?: boolean
    ): Promise<AxiosResponse>;

    public async update(
        arg1: Subset | string,
        arg2?: string | boolean,
        arg3?: any,
        arg4: boolean = false
    ): Promise<AxiosResponse> {
        if (arg1 instanceof Subset) {
            const subset = arg1;
            const isPrivate = typeof arg2 === 'boolean' ? arg2 : arg4;
            return await this.updateSubsetInstance(subset, isPrivate);
        }

        const dimensionName = arg1;
        const hierarchyName = arg2 as string;
        const subset = arg3;
        const isPrivate = arg4;
        const visibility = subset?.IsPrivate ?? isPrivate ? 'PrivateSubsets' : 'Subsets';
        const url = this.formatUrl(
            "/Dimensions('{}')/Hierarchies('{}')/{}('{}')",
            dimensionName,
            hierarchyName,
            visibility,
            subset.Name
        );
        return await this.rest.patch(url, JSON.stringify(subset));
    }

    public async delete(
        dimensionName: string,
        hierarchyName: string,
        subsetName: string,
        isPrivate: boolean = true
    ): Promise<AxiosResponse> {
        const visibility = this.getSubsetCollection(isPrivate);
        const url = this.formatUrl(
            "/Dimensions('{}')/Hierarchies('{}')/{}('{}')",
            dimensionName,
            hierarchyName,
            visibility,
            subsetName
        );
        return await this.rest.delete(url);
    }

    public async exists(
        dimensionName: string,
        hierarchyName: string,
        subsetName: string,
        isPrivate: boolean = true
    ): Promise<boolean> {
        const visibility = this.getSubsetCollection(isPrivate);
        const url = this.formatUrl(
            "/Dimensions('{}')/Hierarchies('{}')/{}('{}')",
            dimensionName,
            hierarchyName,
            visibility,
            subsetName
        );

        try {
            await this.rest.get(url);
            return true;
        } catch (error) {
            if (error instanceof TM1RestException && error.statusCode === 404) {
                return false;
            }
            throw error;
        }
    }

    public async getAllNames(
        dimensionName: string,
        hierarchyName: string,
        isPrivate: boolean = true
    ): Promise<string[]> {
        const visibility = this.getSubsetCollection(isPrivate);
        const url = this.formatUrl(
            "/Dimensions('{}')/Hierarchies('{}')/{}?$select=Name",
            dimensionName,
            hierarchyName,
            visibility
        );
        const response = await this.rest.get(url);
        return response.data.value.map((subset: any) => subset.Name);
    }

    public async makeStatic(
        subsetName: string,
        dimensionName: string,
        hierarchyName?: string,
        isPrivate: boolean = false
    ): Promise<AxiosResponse> {
        const hierarchy = hierarchyName ?? dimensionName;
        const payload = {
            Name: subsetName,
            MakePrivate: isPrivate,
            MakeStatic: true
        };
        const subsetsCollection = this.getSubsetCollection(isPrivate);
        const url = this.formatUrl(
            "/Dimensions('{}')/Hierarchies('{}')/{}('{}')/tm1.SaveAs",
            dimensionName,
            hierarchy,
            subsetsCollection,
            subsetName
        );
        return await this.rest.post(url, JSON.stringify(payload));
    }

    public async updateOrCreate(subset: Subset, isPrivate: boolean = false): Promise<AxiosResponse> {
        if (await this.exists(subset.dimensionName, subset.hierarchyName, subset.name, isPrivate)) {
            return await this.updateSubsetInstance(subset, isPrivate);
        }
        return await this.create(subset, isPrivate);
    }

    public async deleteElementsFromStaticSubset(
        dimensionName: string,
        hierarchyName: string,
        subsetName: string,
        isPrivate: boolean = false
    ): Promise<AxiosResponse> {
        const subsetsCollection = this.getSubsetCollection(isPrivate);
        const url = this.formatUrl(
            "/Dimensions('{}')/Hierarchies('{}')/{}('{}')/Elements/$ref",
            dimensionName,
            hierarchyName,
            subsetsCollection,
            subsetName
        );
        return await this.rest.delete(url);
    }

    public async getElementNames(
        dimensionName: string,
        hierarchyName: string,
        subsetName: string,
        isPrivate: boolean = false
    ): Promise<string[]> {
        const hierarchy = hierarchyName || dimensionName;
        const subsetsCollection = this.getSubsetCollection(isPrivate);
        const url = this.formatUrl(
            "/Dimensions('{}')/Hierarchies('{}')/{}('{}')?$expand=Hierarchy($select=Dimension,Name)," +
            "Elements($select=Name)&$select=*,Alias",
            dimensionName,
            hierarchy,
            subsetsCollection,
            subsetName
        );

        const response = await this.rest.get(url);
        const subset = Subset.fromDict(response.data);

        if (subset.isStatic) {
            return subset.elements;
        }

        if (!subset.expression) {
            return [];
        }

        if (!this.elementService) {
            this.elementService = new ElementService(this.rest);
        }

        return await this.elementService.executeSetMdxElementNames(
            subset.expression
        );
    }

    private async updateSubsetInstance(subset: Subset, isPrivate: boolean): Promise<AxiosResponse> {
        if (subset.isStatic) {
            await this.deleteElementsFromStaticSubset(
                subset.dimensionName,
                subset.hierarchyName,
                subset.name,
                isPrivate
            );
        }

        const subsetsCollection = this.getSubsetCollection(isPrivate);
        const url = this.formatUrl(
            "/Dimensions('{}')/Hierarchies('{}')/{}('{}')",
            subset.dimensionName,
            subset.hierarchyName,
            subsetsCollection,
            subset.name
        );
        return await this.rest.patch(url, subset.body);
    }

    private getSubsetCollection(isPrivate: boolean = false): string {
        return isPrivate ? 'PrivateSubsets' : 'Subsets';
    }
}
