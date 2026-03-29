import { AxiosResponse } from 'axios';
import { RestService } from './RestService';
import { Hierarchy } from '../objects/Hierarchy';
import { ElementAttribute } from '../objects/ElementAttribute';
import { TM1RestException } from '../exceptions/TM1Exception';
import { ObjectService } from './ObjectService';
import { CaseAndSpaceInsensitiveDict, caseAndSpaceInsensitiveEquals } from '../utils/Utils';

export class HierarchyService extends ObjectService {
    constructor(rest: RestService) {
        super(rest);
    }

    public async create(hierarchy: Hierarchy): Promise<AxiosResponse> {
        const url = this.formatUrl("/Dimensions('{}')/Hierarchies", hierarchy.dimensionName);
        const response = await this.rest.post(url, hierarchy.body);

        await this.updateElementAttributes(hierarchy);

        return response;
    }

    public async get(dimensionName: string, hierarchyName?: string): Promise<Hierarchy> {
        const hierarchy = hierarchyName || dimensionName;
        const url = this.formatUrl(
            "/Dimensions('{}')/Hierarchies('{}')?$expand=Edges,Elements,ElementAttributes,Subsets,DefaultMember",
            dimensionName,
            hierarchy
        );
        const response = await this.rest.get(url);
        return Hierarchy.fromDict(response.data, dimensionName);
    }

    public async update(hierarchy: Hierarchy, keepExistingAttributes: boolean = false): Promise<AxiosResponse[]> {
        const responses: AxiosResponse[] = [];

        const url = this.formatUrl("/Dimensions('{}')/Hierarchies('{}')", hierarchy.dimensionName, hierarchy.name);
        const hierarchyBody = hierarchy.bodyAsDict;
        responses.push(await this.rest.patch(url, JSON.stringify(hierarchyBody)));

        await this.updateElementAttributes(hierarchy, keepExistingAttributes);

        return responses;
    }

    public async delete(dimensionName: string, hierarchyName: string): Promise<AxiosResponse> {
        const url = this.formatUrl("/Dimensions('{}')/Hierarchies('{}')", dimensionName, hierarchyName);
        return await this.rest.delete(url);
    }

    public async exists(dimensionName: string, hierarchyName: string): Promise<boolean> {
        const url = this.formatUrl("/Dimensions('{}')/Hierarchies?$select=Name", dimensionName);

        try {
            const response = await this.rest.get(url);
            const existingHierarchies: string[] = response.data.value.map((h: any) => h.Name);
            return existingHierarchies.some(name => caseAndSpaceInsensitiveEquals(name, hierarchyName));
        } catch (error) {
            if (error instanceof TM1RestException && error.statusCode === 404) {
                return false;
            }
            throw error;
        }
    }

    public async getAllNames(dimensionName: string): Promise<string[]> {
        const url = this.formatUrl("/Dimensions('{}')/Hierarchies?$select=Name", dimensionName);
        const response = await this.rest.get(url);
        return response.data.value.map((hierarchy: any) => hierarchy.Name);
    }

    public async getAll(dimensionName: string): Promise<Hierarchy[]> {
        const url = this.formatUrl(
            "/Dimensions('{}')/Hierarchies?$expand=Edges,Elements,ElementAttributes,Subsets,DefaultMember",
            dimensionName
        );
        const response = await this.rest.get(url);
        return response.data.value.map((h: any) => Hierarchy.fromDict(h, dimensionName));
    }

    public async updateElementAttributes(hierarchy: Hierarchy, keepExisting: boolean = false): Promise<void> {
        const existingAttributes = await this.getElementAttributes(hierarchy.dimensionName, hierarchy.name);

        const existingByName = new CaseAndSpaceInsensitiveDict<ElementAttribute>();
        for (const ea of existingAttributes) {
            existingByName.set(ea.name, ea);
        }

        const attributesToCreate: ElementAttribute[] = [];
        const attributesToDelete: string[] = [];
        const attributesToUpdate: ElementAttribute[] = [];

        for (const attr of hierarchy.elementAttributes) {
            const existing = existingByName.get(attr.name);

            if (!existing) {
                attributesToCreate.push(attr);
            } else if (existing.attributeType !== attr.attributeType) {
                attributesToUpdate.push(attr);
            }
        }

        if (!keepExisting) {
            for (const existing of existingAttributes) {
                const stillPresent = hierarchy.elementAttributes.some(
                    ea => caseAndSpaceInsensitiveEquals(ea.name, existing.name)
                );
                if (!stillPresent) {
                    attributesToDelete.push(existing.name);
                }
            }
        }

        const attrUrl = this.formatUrl("/Dimensions('{}')/Hierarchies('{}')/ElementAttributes",
            hierarchy.dimensionName, hierarchy.name);

        for (const attr of attributesToCreate) {
            await this.rest.post(attrUrl, attr.body);
        }

        for (const attrName of attributesToDelete) {
            await this.deleteElementAttribute(hierarchy.dimensionName, hierarchy.name, attrName);
        }

        for (const attr of attributesToUpdate) {
            await this.deleteElementAttribute(hierarchy.dimensionName, hierarchy.name, attr.name);
            await this.rest.post(attrUrl, attr.body);
        }
    }

    public async getElementAttributes(dimensionName: string, hierarchyName: string): Promise<ElementAttribute[]> {
        const url = this.formatUrl("/Dimensions('{}')/Hierarchies('{}')/ElementAttributes",
            dimensionName, hierarchyName);
        const response = await this.rest.get(url);
        return response.data.value.map((ea: any) => ElementAttribute.fromDict(ea));
    }

    public async elementAttributeExists(dimensionName: string, hierarchyName: string, attributeName: string): Promise<boolean> {
        try {
            const url = this.formatUrl("/Dimensions('{}')/Hierarchies('{}')/ElementAttributes('{}')",
                dimensionName, hierarchyName, attributeName);
            await this.rest.get(url);
            return true;
        } catch (error) {
            if (error instanceof TM1RestException && error.statusCode === 404) {
                return false;
            }
            throw error;
        }
    }

    public async deleteElementAttribute(dimensionName: string, hierarchyName: string, attributeName: string): Promise<AxiosResponse> {
        const url = this.formatUrl("/Dimensions('}ElementAttributes_{}')/Hierarchies('}ElementAttributes_{}')/Elements('{}')",
            dimensionName, hierarchyName, attributeName);
        return await this.rest.delete(url);
    }

    public async removeAllEdges(dimensionName: string, hierarchyName?: string): Promise<AxiosResponse> {
        const hierarchy = hierarchyName || dimensionName;
        const url = this.formatUrl("/Dimensions('{}')/Hierarchies('{}')", dimensionName, hierarchy);
        const body = { Edges: [] };
        return await this.rest.patch(url, JSON.stringify(body));
    }

    public async isBalanced(dimensionName: string, hierarchyName: string): Promise<boolean> {
        const url = this.formatUrl("/Dimensions('{}')/Hierarchies('{}')/Structure/$value",
            dimensionName, hierarchyName);
        const response = await this.rest.get(url);
        const structure = parseInt(String(response.data), 10);

        if (structure === 0) {
            return true;
        } else if (structure === 2) {
            return false;
        }
        throw new Error(`Unexpected return value from TM1 API request: ${structure}`);
    }
}
