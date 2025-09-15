import { AxiosResponse } from 'axios';
import { RestService } from './RestService';
import { Dimension } from '../objects/Dimension';
import { TM1RestException } from '../exceptions/TM1Exception';
import { HierarchyService } from './HierarchyService';
import { SubsetService } from './SubsetService';
import { ObjectService } from './ObjectService';

export class DimensionService extends ObjectService {
    private hierarchies: HierarchyService;
    private subsets: SubsetService;

    constructor(rest: RestService) {
        super(rest);
        this.hierarchies = new HierarchyService(rest);
        this.subsets = new SubsetService(rest);
    }

    public async create(dimension: Dimension): Promise<AxiosResponse> {
        // If Dimension exists, throw Exception
        if (await this.exists(dimension.name)) {
            throw new Error(`Dimension '${dimension.name}' already exists`);
        }

        try {
            // Create Dimension, Hierarchies, Elements, Edges
            const url = "/Dimensions";
            const response = await this.rest.post(url, dimension.body);

            // Create ElementAttributes
            for (const hierarchy of dimension) {
                if (!this.caseAndSpaceInsensitiveEquals(hierarchy.name, "Leaves")) {
                    await this.hierarchies.updateElementAttributes(hierarchy);
                }
            }

            return response;
        } catch (error) {
            // Undo everything if problem occurred
            if (await this.exists(dimension.name)) {
                await this.delete(dimension.name);
            }
            throw error;
        }
    }

    public async get(dimensionName: string): Promise<Dimension> {
        const url = this.formatUrl("/Dimensions('{}')?$expand=Hierarchies($expand=*)", dimensionName);
        const response = await this.rest.get(url);
        return Dimension.fromJSON(JSON.stringify(response.data));
    }

    public async update(dimension: Dimension, keepExistingAttributes: boolean = false): Promise<void> {
        // Get existing hierarchy names to identify which ones to remove
        const existingHierarchyNames = await this.hierarchies.getAllNames(dimension.name);
        const hierarchiesToBeRemoved = new Set(existingHierarchyNames);

        for (const hierarchyName of dimension.hierarchyNames) {
            hierarchiesToBeRemoved.delete(hierarchyName);
        }

        // Update all Hierarchies except for the implicitly maintained 'Leaves' Hierarchy
        for (const hierarchy of dimension) {
            if (!this.caseAndSpaceInsensitiveEquals(hierarchy.name, "Leaves")) {
                if (await this.hierarchies.exists(hierarchy.dimensionName, hierarchy.name)) {
                    await this.hierarchies.update(hierarchy, keepExistingAttributes);
                } else {
                    await this.hierarchies.create(hierarchy);
                }
            }
        }

        // Remove hierarchies that are no longer in the dimension
        for (const hierarchyName of hierarchiesToBeRemoved) {
            if (!this.caseAndSpaceInsensitiveEquals(hierarchyName, "Leaves")) {
                await this.hierarchies.delete(dimension.name, hierarchyName);
            }
        }
    }

    public async delete(dimensionName: string): Promise<AxiosResponse> {
        const url = this.formatUrl("/Dimensions('{}')", dimensionName);
        return await this.rest.delete(url);
    }

    public async exists(dimensionName: string): Promise<boolean> {
        try {
            const url = this.formatUrl("/Dimensions('{}')", dimensionName);
            await this.rest.get(url);
            return true;
        } catch (error) {
            if (error instanceof TM1RestException && error.statusCode === 404) {
                return false;
            }
            throw error;
        }
    }

    public async getAllNames(skipControlDimensions: boolean = false): Promise<string[]> {
        let url = "/Dimensions?$select=Name";
        
        if (skipControlDimensions) {
            url += "&$filter=not startswith(Name,'}')";
        }

        const response = await this.rest.get(url);
        return response.data.value.map((dim: any) => dim.Name);
    }

    public async getAll(skipControlDimensions: boolean = false): Promise<Dimension[]> {
        let url = "/Dimensions?$expand=Hierarchies($expand=*)";
        
        if (skipControlDimensions) {
            url += "&$filter=not startswith(Name,'}')";
        }

        const response = await this.rest.get(url);
        return response.data.value.map((dim: any) => Dimension.fromDict(dim));
    }

    public async getDimensionNames(cubeName: string): Promise<string[]> {
        const url = this.formatUrl("/Cubes('{}')?$select=Dimensions", cubeName);
        const response = await this.rest.get(url);
        return response.data.Dimensions.map((dim: any) => dim.Name);
    }

    public async clone(sourceDimensionName: string, targetDimensionName: string, cloneHierarchies: boolean = true): Promise<AxiosResponse> {
        if (await this.exists(targetDimensionName)) {
            throw new Error(`Dimension '${targetDimensionName}' already exists`);
        }

        const sourceDimension = await this.get(sourceDimensionName);
        sourceDimension.name = targetDimensionName;

        if (!cloneHierarchies) {
            // Keep only the default hierarchy
            const defaultHierarchy = sourceDimension.defaultHierarchy;
            if (defaultHierarchy) {
                defaultHierarchy.name = targetDimensionName;
                sourceDimension.hierarchies.length = 0;
                sourceDimension.addHierarchy(defaultHierarchy);
            }
        } else {
            // Rename hierarchies to match new dimension name where appropriate
            for (const hierarchy of sourceDimension.hierarchies) {
                if (hierarchy.name === sourceDimensionName) {
                    hierarchy.name = targetDimensionName;
                }
            }
        }

        return await this.create(sourceDimension);
    }

    public async getElementsCount(dimensionName: string, hierarchyName?: string): Promise<number> {
        const hierarchy = hierarchyName || dimensionName;
        const url = this.formatUrl("/Dimensions('{}')/Hierarchies('{}')/Elements/$count", dimensionName, hierarchy);
        const response = await this.rest.get(url);
        return parseInt(response.data);
    }

    public async getHierarchiesCount(dimensionName: string): Promise<number> {
        const url = this.formatUrl("/Dimensions('{}')/Hierarchies/$count", dimensionName);
        const response = await this.rest.get(url);
        return parseInt(response.data);
    }

}