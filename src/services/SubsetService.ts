import { AxiosResponse } from 'axios';
import { RestService } from './RestService';
import { ObjectService } from './ObjectService';

export class SubsetService extends ObjectService {
    constructor(rest: RestService) {
        super(rest);
    }

    public async create(dimensionName: string, hierarchyName: string, subset: any): Promise<AxiosResponse> {
        const url = this.formatUrl("/Dimensions('{}')/Hierarchies('{}')/Subsets", dimensionName, hierarchyName);
        return await this.rest.post(url, JSON.stringify(subset));
    }

    public async get(dimensionName: string, hierarchyName: string, subsetName: string, isPrivate: boolean = true): Promise<any> {
        const visibility = isPrivate ? 'PrivateSubsets' : 'Subsets';
        const url = this.formatUrl("/Dimensions('{}')/Hierarchies('{}')/{}/'{}'", 
            dimensionName, hierarchyName, visibility, subsetName);
        const response = await this.rest.get(url);
        return response.data;
    }

    public async update(dimensionName: string, hierarchyName: string, subset: any): Promise<AxiosResponse> {
        const visibility = subset.IsPrivate ? 'PrivateSubsets' : 'Subsets';
        const url = this.formatUrl("/Dimensions('{}')/Hierarchies('{}')/{}/'{}')", 
            dimensionName, hierarchyName, visibility, subset.Name);
        return await this.rest.patch(url, JSON.stringify(subset));
    }

    public async delete(dimensionName: string, hierarchyName: string, subsetName: string, isPrivate: boolean = true): Promise<AxiosResponse> {
        const visibility = isPrivate ? 'PrivateSubsets' : 'Subsets';
        const url = this.formatUrl("/Dimensions('{}')/Hierarchies('{}')/{}/'{}'", 
            dimensionName, hierarchyName, visibility, subsetName);
        return await this.rest.delete(url);
    }

    public async exists(dimensionName: string, hierarchyName: string, subsetName: string, isPrivate: boolean = true): Promise<boolean> {
        try {
            await this.get(dimensionName, hierarchyName, subsetName, isPrivate);
            return true;
        } catch (error) {
            return false;
        }
    }

    public async getAllNames(dimensionName: string, hierarchyName: string, isPrivate: boolean = true): Promise<string[]> {
        const visibility = isPrivate ? 'PrivateSubsets' : 'Subsets';
        const url = this.formatUrl("/Dimensions('{}')/Hierarchies('{}')/{}", dimensionName, hierarchyName, visibility);
        const response = await this.rest.get(url);
        return response.data.value.map((subset: any) => subset.Name);
    }
}