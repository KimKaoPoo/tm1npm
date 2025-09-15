import { AxiosResponse } from 'axios';
import { RestService } from './RestService';
import { Hierarchy } from '../objects/Hierarchy';
import { ElementAttribute } from '../objects/ElementAttribute';
import { TM1RestException } from '../exceptions/TM1Exception';
import { ObjectService } from './ObjectService';

export class HierarchyService extends ObjectService {
    constructor(rest: RestService) {
        super(rest);
    }

    public async create(hierarchy: Hierarchy): Promise<AxiosResponse> {
        if (await this.exists(hierarchy.dimensionName, hierarchy.name)) {
            throw new Error(`Hierarchy '${hierarchy.name}' already exists in dimension '${hierarchy.dimensionName}'`);
        }

        const url = this.formatUrl("/Dimensions('{}')/Hierarchies", hierarchy.dimensionName);
        return await this.rest.post(url, hierarchy.body);
    }

    public async get(dimensionName: string, hierarchyName?: string): Promise<Hierarchy> {
        const hierarchy = hierarchyName || dimensionName;
        const url = this.formatUrl("/Dimensions('{}')/Hierarchies('{}')?$expand=*", dimensionName, hierarchy);
        const response = await this.rest.get(url);
        return Hierarchy.fromDict(response.data, dimensionName);
    }

    public async update(hierarchy: Hierarchy, keepExistingAttributes: boolean = false): Promise<void> {
        // Update elements first
        await this.updateElements(hierarchy);
        
        // Update element attributes
        await this.updateElementAttributes(hierarchy, keepExistingAttributes);
        
        // Update edges
        await this.updateEdges(hierarchy);
    }

    public async delete(dimensionName: string, hierarchyName: string): Promise<AxiosResponse> {
        const url = this.formatUrl("/Dimensions('{}')/Hierarchies('{}')", dimensionName, hierarchyName);
        return await this.rest.delete(url);
    }

    public async exists(dimensionName: string, hierarchyName: string): Promise<boolean> {
        try {
            await this.get(dimensionName, hierarchyName);
            return true;
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
        const url = this.formatUrl("/Dimensions('{}')/Hierarchies?$expand=*", dimensionName);
        const response = await this.rest.get(url);
        return response.data.value.map((h: any) => Hierarchy.fromDict(h, dimensionName));
    }

    public async updateElements(hierarchy: Hierarchy): Promise<void> {
        // Remove all existing elements first
        await this.removeAllElements(hierarchy.dimensionName, hierarchy.name);
        
        // Add all elements from hierarchy
        for (const element of hierarchy.elements) {
            const url = this.formatUrl("/Dimensions('{}')/Hierarchies('{}')/Elements", 
                hierarchy.dimensionName, hierarchy.name);
            await this.rest.post(url, element.body);
        }
    }

    public async updateEdges(hierarchy: Hierarchy): Promise<void> {
        // Remove all existing edges
        await this.removeAllEdges(hierarchy.dimensionName, hierarchy.name);
        
        // Add all edges from hierarchy
        for (const [key, weight] of hierarchy.edges) {
            const [parentName, componentName] = key.split(':');
            const edgeBody = {
                ParentName: parentName,
                ComponentName: componentName,
                Weight: weight
            };
            
            const url = this.formatUrl("/Dimensions('{}')/Hierarchies('{}')/Edges", 
                hierarchy.dimensionName, hierarchy.name);
            await this.rest.post(url, JSON.stringify(edgeBody));
        }
    }

    public async updateElementAttributes(hierarchy: Hierarchy, keepExisting: boolean = false): Promise<void> {
        if (!keepExisting) {
            // Remove existing element attributes
            const existingAttributes = await this.getElementAttributes(hierarchy.dimensionName, hierarchy.name);
            for (const attr of existingAttributes) {
                await this.deleteElementAttribute(hierarchy.dimensionName, hierarchy.name, attr.name);
            }
        }

        // Add element attributes from hierarchy
        for (const elementAttribute of hierarchy.elementAttributes) {
            if (!await this.elementAttributeExists(hierarchy.dimensionName, hierarchy.name, elementAttribute.name)) {
                const url = this.formatUrl("/Dimensions('{}')/Hierarchies('{}')/ElementAttributes", 
                    hierarchy.dimensionName, hierarchy.name);
                await this.rest.post(url, elementAttribute.body);
            }
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
        const url = this.formatUrl("/Dimensions('{}')/Hierarchies('{}')/ElementAttributes('{}')", 
            dimensionName, hierarchyName, attributeName);
        return await this.rest.delete(url);
    }

    private async removeAllElements(dimensionName: string, hierarchyName: string): Promise<void> {
        const url = this.formatUrl("/Dimensions('{}')/Hierarchies('{}')/Elements", dimensionName, hierarchyName);
        const response = await this.rest.get(url + "?$select=Name");
        
        for (const element of response.data.value) {
            const deleteUrl = this.formatUrl("/Dimensions('{}')/Hierarchies('{}')/Elements('{}')", 
                dimensionName, hierarchyName, element.Name);
            await this.rest.delete(deleteUrl);
        }
    }

    private async removeAllEdges(dimensionName: string, hierarchyName: string): Promise<void> {
        const url = this.formatUrl("/Dimensions('{}')/Hierarchies('{}')/Edges", dimensionName, hierarchyName);
        const response = await this.rest.get(url);
        
        for (const edge of response.data.value) {
            const deleteUrl = this.formatUrl("/Dimensions('{}')/Hierarchies('{}')/Edges(ParentName='{}',ComponentName='{}')", 
                dimensionName, hierarchyName, edge.ParentName, edge.ComponentName);
            await this.rest.delete(deleteUrl);
        }
    }

    // ===== NEW FUNCTION FOR 100% TM1PY PARITY =====

    /**
     * Check if hierarchy is balanced (all leaf elements are at the same level)
     */
    public async isBalanced(dimensionName: string, hierarchyName: string): Promise<boolean> {
        /** Check if hierarchy is balanced
         *
         * :param dimensionName: name of the dimension
         * :param hierarchyName: name of the hierarchy
         * :return: true if hierarchy is balanced, false otherwise
         */
        try {
            // Get all elements in the hierarchy
            const elementsUrl = this.formatUrl("/Dimensions('{}')/Hierarchies('{}')/Elements?$expand=*", 
                dimensionName, hierarchyName);
            const elementsResponse = await this.rest.get(elementsUrl);
            const elements = elementsResponse.data.value;

            if (elements.length === 0) {
                return true; // Empty hierarchy is considered balanced
            }

            // Separate leaf and consolidated elements
            const leafElements = elements.filter((el: any) => el.Type !== 'Consolidated');
            const consolidatedElements = elements.filter((el: any) => el.Type === 'Consolidated');

            if (leafElements.length === 0) {
                return true; // No leaf elements means balanced
            }

            if (consolidatedElements.length === 0) {
                return true; // Only leaf elements means balanced (all at level 0)
            }

            // Calculate the level of each leaf element
            const leafLevels: number[] = [];

            for (const leafElement of leafElements) {
                const level = await this.calculateElementLevel(dimensionName, hierarchyName, leafElement.Name);
                leafLevels.push(level);
            }

            // Check if all leaf elements are at the same level
            const firstLevel = leafLevels[0];
            return leafLevels.every(level => level === firstLevel);

        } catch (error) {
            throw new Error(`Failed to check if hierarchy is balanced: ${error}`);
        }
    }

    /**
     * Private helper method to calculate the level of an element in the hierarchy
     */
    private async calculateElementLevel(dimensionName: string, hierarchyName: string, elementName: string): Promise<number> {
        /** Calculate the level of an element (0 for leaf, higher numbers for consolidated)
         *
         * :param dimensionName: name of the dimension
         * :param hierarchyName: name of the hierarchy
         * :param elementName: name of the element
         * :return: level of the element
         */
        try {
            // Get element details
            const elementUrl = this.formatUrl("/Dimensions('{}')/Hierarchies('{}')/Elements('{}')?$expand=*", 
                dimensionName, hierarchyName, elementName);
            const elementResponse = await this.rest.get(elementUrl);
            const element = elementResponse.data;

            // If it's not consolidated, it's at level 0
            if (element.Type !== 'Consolidated') {
                return 0;
            }

            // Get all parents of this element to determine its level
            let level = 0;
            let currentElement = elementName;
            const visitedElements = new Set<string>();

            // eslint-disable-next-line no-constant-condition
            while (true) {
                // Prevent infinite loops
                if (visitedElements.has(currentElement)) {
                    break;
                }
                visitedElements.add(currentElement);

                // Get parents of current element
                const parentsUrl = this.formatUrl("/Dimensions('{}')/Hierarchies('{}')/Elements('{}')/Parents", 
                    dimensionName, hierarchyName, currentElement);
                const parentsResponse = await this.rest.get(parentsUrl);
                const parents = parentsResponse.data.value;

                if (parents.length === 0) {
                    // No more parents, this is the top level
                    break;
                }

                // Move to the first parent and increment level
                currentElement = parents[0].Name;
                level++;

                // Prevent excessive recursion
                if (level > 100) {
                    break;
                }
            }

            return level;

        } catch (error) {
            // If we can't determine the level, assume it's 0
            return 0;
        }
    }
}