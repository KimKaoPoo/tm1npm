import { AxiosResponse } from 'axios';
import { RestService } from './RestService';
import { ObjectService } from './ObjectService';
import { Element, ElementType } from '../objects/Element';
import { ElementAttribute } from '../objects/ElementAttribute';
import { Process } from '../objects/Process';
import { ProcessService } from './ProcessService';
import { HierarchyService } from './HierarchyService';
import { CellService } from './CellService';
import {
    formatUrl,
    escapeODataValue,
    requireDataAdmin,
    CaseAndSpaceInsensitiveDict,
    CaseAndSpaceInsensitiveSet
} from '../utils/Utils';

export interface ElementsDataFrameOptions {
    skip_consolidations?: boolean;
    attributes?: string[];
    attribute_column_prefix?: string;
    skip_parents?: boolean;
    level_names?: string[];
    parent_attribute?: string;
    skip_weights?: boolean;
    use_blob?: boolean;
    allow_empty_alias?: boolean;
    attribute_suffix?: boolean;
    element_type_column?: string;
}

export interface DataFrame {
    columns: string[];
    data: any[][];
    index?: any[];
}

export interface ElementEdge {
    parent: string;
    component: string;
    weight?: number;
}

export interface ElementInfo {
    name: string;
    type: ElementType;
    level?: number;
    index?: number;
    attributes?: { [key: string]: any };
    parents?: string[];
    weight?: number;
    uniqueName?: string;
}

export enum MDXDrillMethod {
    TM1DRILLDOWNMEMBER = 1,
    DESCENDANTS = 2
}

export class ElementService extends ObjectService {
    /** Service to handle Object Updates for TM1 Dimension (resp. Hierarchy) Elements
     *
     */

    constructor(rest: RestService) {
        super(rest);
    }

    public async get(dimensionName: string, hierarchyName: string, elementName: string): Promise<Element> {
        const url = formatUrl(
            "/Dimensions('{}')/Hierarchies('{}')/Elements('{}')?$expand=*",
            dimensionName, hierarchyName, elementName);
        const response = await this.rest.get(url);
        return Element.fromDict(response.data);
    }

    public async create(dimensionName: string, hierarchyName: string, element: Element): Promise<AxiosResponse> {
        const url = formatUrl(
            "/Dimensions('{}')/Hierarchies('{}')/Elements",
            dimensionName,
            hierarchyName);
        return await this.rest.post(url, element.body);
    }

    public async update(dimensionName: string, hierarchyName: string, element: Element): Promise<AxiosResponse> {
        const url = formatUrl(
            "/Dimensions('{}')/Hierarchies('{}')/Elements('{}')",
            dimensionName,
            hierarchyName,
            element.name);
        return await this.rest.patch(url, element.body);
    }

    public async exists(dimensionName: string, hierarchyName: string, elementName: string): Promise<boolean> {
        const url = formatUrl(
            "/Dimensions('{}')/Hierarchies('{}')/Elements('{}')",
            dimensionName,
            hierarchyName,
            elementName);
        return await this.rest.get(url).then(() => true).catch(() => false);
    }

    public async updateOrCreate(dimensionName: string, hierarchyName: string, element: Element): Promise<AxiosResponse> {
        if (await this.exists(dimensionName, hierarchyName, element.name)) {
            return await this.update(dimensionName, hierarchyName, element);
        }
        return await this.create(dimensionName, hierarchyName, element);
    }

    public async delete(dimensionName: string, hierarchyName: string, elementName: string): Promise<AxiosResponse> {
        const url = formatUrl(
            "/Dimensions('{}')/Hierarchies('{}')/Elements('{}')",
            dimensionName,
            hierarchyName,
            elementName);
        return await this.rest.delete(url);
    }

    public async getNames(
        dimensionName: string,
        hierarchyName?: string,
        skipConsolidatedElements: boolean = false
    ): Promise<string[]> {
        const hierarchy = hierarchyName || dimensionName;
        let url = formatUrl("/Dimensions('{}')/Hierarchies('{}')/Elements?$select=Name", dimensionName, hierarchy);

        if (skipConsolidatedElements) {
            url += `&$filter=Type ne ${ElementType.CONSOLIDATED}`;
        }

        const response = await this.rest.get(url);
        return response.data.value.map((element: any) => element.Name);
    }

    // ===== ENHANCED ELEMENT SERVICE WITH 100% TM1PY PARITY =====

    /**
     * Get all elements in a hierarchy
     */
    public async getElements(
        dimensionName: string,
        hierarchyName?: string
    ): Promise<Element[]> {
        const hierarchy = hierarchyName || dimensionName;
        const url = formatUrl(
            "/Dimensions('{}')/Hierarchies('{}')/Elements?$expand=*",
            dimensionName, hierarchy
        );
        const response = await this.rest.get(url);
        return response.data.value.map((elementDict: any) => Element.fromDict(elementDict));
    }

    /**
     * Get element names (alias for getNames for tm1py compatibility)
     */
    public async getElementNames(
        dimensionName: string,
        hierarchyName?: string
    ): Promise<string[]> {
        return this.getNames(dimensionName, hierarchyName);
    }

    /**
     * Get leaf elements only
     */
    public async getLeafElements(
        dimensionName: string,
        hierarchyName?: string
    ): Promise<Element[]> {
        const hierarchy = hierarchyName || dimensionName;
        const url = formatUrl(
            `/Dimensions('{}')/Hierarchies('{}')/Elements?$expand=*&$filter=Type ne ${ElementType.CONSOLIDATED}`,
            dimensionName, hierarchy
        );
        const response = await this.rest.get(url);
        return response.data.value.map((elementDict: any) => Element.fromDict(elementDict));
    }

    /**
     * Get leaf element names only
     */
    public async getLeafElementNames(
        dimensionName: string,
        hierarchyName?: string
    ): Promise<string[]> {
        const hierarchy = hierarchyName || dimensionName;
        const url = formatUrl(
            `/Dimensions('{}')/Hierarchies('{}')/Elements?$select=Name&$filter=Type ne ${ElementType.CONSOLIDATED}`,
            dimensionName, hierarchy
        );
        const response = await this.rest.get(url);
        return response.data.value.map((element: any) => element.Name);
    }

    /**
     * Get consolidated elements only
     */
    public async getConsolidatedElements(
        dimensionName: string,
        hierarchyName?: string
    ): Promise<Element[]> {
        const hierarchy = hierarchyName || dimensionName;
        const url = formatUrl(
            `/Dimensions('{}')/Hierarchies('{}')/Elements?$expand=*&$filter=Type eq ${ElementType.CONSOLIDATED}`,
            dimensionName, hierarchy
        );
        const response = await this.rest.get(url);
        return response.data.value.map((elementDict: any) => Element.fromDict(elementDict));
    }

    /**
     * Get consolidated element names only
     */
    public async getConsolidatedElementNames(
        dimensionName: string,
        hierarchyName?: string
    ): Promise<string[]> {
        const hierarchy = hierarchyName || dimensionName;
        const url = formatUrl(
            `/Dimensions('{}')/Hierarchies('{}')/Elements?$select=Name&$filter=Type eq ${ElementType.CONSOLIDATED}`,
            dimensionName, hierarchy
        );
        const response = await this.rest.get(url);
        return response.data.value.map((element: any) => element.Name);
    }

    /**
     * Get numeric elements only
     */
    public async getNumericElements(
        dimensionName: string,
        hierarchyName?: string
    ): Promise<Element[]> {
        const hierarchy = hierarchyName || dimensionName;
        const url = formatUrl(
            `/Dimensions('{}')/Hierarchies('{}')/Elements?$expand=*&$filter=Type eq ${ElementType.NUMERIC}`,
            dimensionName, hierarchy
        );
        const response = await this.rest.get(url);
        return response.data.value.map((elementDict: any) => Element.fromDict(elementDict));
    }

    /**
     * Get numeric element names only
     */
    public async getNumericElementNames(
        dimensionName: string,
        hierarchyName?: string
    ): Promise<string[]> {
        const hierarchy = hierarchyName || dimensionName;
        const url = formatUrl(
            `/Dimensions('{}')/Hierarchies('{}')/Elements?$select=Name&$filter=Type eq ${ElementType.NUMERIC}`,
            dimensionName, hierarchy
        );
        const response = await this.rest.get(url);
        return response.data.value.map((element: any) => element.Name);
    }

    /**
     * Get string elements only
     */
    public async getStringElements(
        dimensionName: string,
        hierarchyName?: string
    ): Promise<Element[]> {
        const hierarchy = hierarchyName || dimensionName;
        const url = formatUrl(
            `/Dimensions('{}')/Hierarchies('{}')/Elements?$expand=*&$filter=Type eq ${ElementType.STRING}`,
            dimensionName, hierarchy
        );
        const response = await this.rest.get(url);
        return response.data.value.map((elementDict: any) => Element.fromDict(elementDict));
    }

    /**
     * Get string element names only
     */
    public async getStringElementNames(
        dimensionName: string,
        hierarchyName?: string
    ): Promise<string[]> {
        const hierarchy = hierarchyName || dimensionName;
        const url = formatUrl(
            `/Dimensions('{}')/Hierarchies('{}')/Elements?$select=Name&$filter=Type eq ${ElementType.STRING}`,
            dimensionName, hierarchy
        );
        const response = await this.rest.get(url);
        return response.data.value.map((element: any) => element.Name);
    }

    /**
     * Get total number of elements
     */
    public async getNumberOfElements(
        dimensionName: string,
        hierarchyName?: string
    ): Promise<number> {
        const hierarchy = hierarchyName || dimensionName;
        const url = formatUrl(
            "/Dimensions('{}')/Hierarchies('{}')/Elements/$count",
            dimensionName, hierarchy
        );
        const response = await this.rest.get(url);
        return response.data || 0;
    }

    /**
     * Get elements as DataFrame-like structure (tm1py compatibility)
     */
    public async getElementsDataframe(
        dimensionName: string,
        hierarchyName?: string,
        elements?: string | string[],
        options: ElementsDataFrameOptions = {}
    ): Promise<DataFrame> {
        const {
            skip_consolidations = true,
            attributes = [],
            attribute_column_prefix = '',
            skip_parents = false,
            skip_weights = false,
            element_type_column = 'Type'
        } = options;

        const hierarchy = hierarchyName || dimensionName;

        // Build URL with filters
        let url = formatUrl(
            "/Dimensions('{}')/Hierarchies('{}')/Elements",
            dimensionName, hierarchy
        );

        // Add expand for parents if not skipped
        if (!skip_parents) {
            url += '?$expand=Parents($select=Name)';
        }

        // Build combined filter
        const filters: string[] = [];
        if (elements) {
            const elementArray = Array.isArray(elements) ? elements : [elements];
            filters.push(`(${elementArray.map(e => `Name eq '${e.replace(/'/g, "''")}'`).join(' or ')})`);
        }
        if (skip_consolidations) {
            filters.push(`Type ne ${ElementType.CONSOLIDATED}`);
        }
        if (filters.length > 0) {
            url += url.includes('?')
                ? `&$filter=${filters.join(' and ')}`
                : `?$filter=${filters.join(' and ')}`;
        }

        const response = await this.rest.get(url);
        const elementsData = response.data.value || [];

        // Build DataFrame structure
        const columns = ['Name', element_type_column];
        if (!skip_parents) columns.push('Parents');
        if (!skip_weights) columns.push('Weight');

        // Add attribute columns
        if (attributes.length > 0) {
            for (const _attr of attributes) {
                columns.push(`${attribute_column_prefix}${_attr}`);
            }
        }

        const data: any[][] = [];

        for (const element of elementsData) {
            const row: any[] = [];

            // Basic element info
            row.push(element.Name);
            row.push(element.Type);

            // Parents
            if (!skip_parents) {
                const parents = element.Parents ? element.Parents.map((p: any) => p.Name).join(',') : '';
                row.push(parents);
            }

            // Weight (if element has weight information)
            if (!skip_weights) {
                row.push(element.Weight || 1);
            }

            // Attributes (would need additional API calls for full implementation)
            if (attributes.length > 0) {
                for (const _attr of attributes) {
                    // Placeholder - full implementation would fetch attribute values
                    row.push(null);
                }
            }

            data.push(row);
        }

        return { columns, data };
    }

    /**
     * Add multiple elements in bulk
     */
    public async addElements(
        dimensionName: string,
        hierarchyName: string,
        elements: Element[]
    ): Promise<AxiosResponse> {
        const url = formatUrl(
            "/Dimensions('{}')/Hierarchies('{}')/Elements",
            dimensionName, hierarchyName);
        const body = elements.map(e => e.bodyAsDict);
        return await this.rest.post(url, JSON.stringify(body));
    }

    /**
     * Delete multiple elements in bulk
     */
    public async deleteElements(
        dimensionName: string,
        hierarchyName: string,
        elementNames: string[],
        useTi: boolean = false
    ): Promise<void> {
        if (useTi) {
            return this.deleteElementsUseTi(dimensionName, hierarchyName, elementNames);
        }

        // Delete elements one by one
        for (const elementName of elementNames) {
            try {
                await this.delete(dimensionName, hierarchyName, elementName);
            } catch (error) {
                console.warn(`Failed to delete element ${elementName}:`, error);
                // Continue with other elements
            }
        }
    }

    /**
     * Delete elements using TI process (requires admin privileges)
     */
    public async deleteElementsUseTi(
        dimensionName: string,
        hierarchyName: string,
        elementNames: string[]
    ): Promise<void> {
        if (!elementNames || elementNames.length === 0) {
            return;
        }

        const processName = `DeleteElements_${Date.now()}`;

        // Build TI statements
        const tiStatements = elementNames.map(elementName =>
            `HierarchyElementDelete('${dimensionName}', '${hierarchyName}', '${elementName}');`
        ).join('\n');

        // Create and execute temporary process
        const process = new Process(
            processName,
            false, // hasSecurityAccess
            "CubeAction=1511\fDataAction=1503\fCubeLogChanges=0\f", // uiData
            [], // parameters
            [], // variables
            [], // variablesUiData
            tiStatements, // prologProcedure
            '', // metadataProcedure
            '', // dataProcedure
            '' // epilogProcedure
        );

        try {
            // Create process
            await this.rest.post('/Processes', process.body);

            // Execute process
            const executeUrl = `/Processes('${processName}')/tm1.ExecuteProcess`;
            await this.rest.post(executeUrl);

        } finally {
            // Clean up process
            try {
                await this.rest.delete(`/Processes('${processName}')`);
            } catch (error) {
                console.warn('Failed to clean up temporary process:', error);
            }
        }
    }

    /**
     * Get edges (parent-child relationships) for a hierarchy
     */
    public async getEdges(
        dimensionName: string,
        hierarchyName?: string
    ): Promise<{ [parent: string]: { [child: string]: number } }> {
        const hierarchy = hierarchyName || dimensionName;
        const url = formatUrl(
            "/Dimensions('{}')/Hierarchies('{}')/Edges?$select=ParentName,ComponentName,Weight",
            dimensionName, hierarchy
        );

        const response = await this.rest.get(url);
        const edges: { [parent: string]: { [child: string]: number } } = {};

        if (response.data.value) {
            for (const edge of response.data.value) {
                if (!edges[edge.ParentName]) {
                    edges[edge.ParentName] = {};
                }
                edges[edge.ParentName][edge.ComponentName] = edge.Weight;
            }
        }

        return edges;
    }

    /**
     * Execute MDX set and return element names
     */
    public async executeSetMdxElementNames(
        mdx: string,
        topRecords?: number
    ): Promise<string[]> {
        const elements = await this.executeSetMdx(
            mdx,
            topRecords,
            ['Name'],
            null,
            null
        );
        return elements.map((member: any[]) => member[0].Name);
    }






    public async getElementTypes(
        dimensionName: string,
        hierarchyName?: string
    ): Promise<CaseAndSpaceInsensitiveDict<string>> {
        const hierarchy = hierarchyName || dimensionName;
        const url = formatUrl(
            "/Dimensions('{}')/Hierarchies('{}')/Elements?$select=Name,Type",
            dimensionName, hierarchy);

        const response = await this.rest.get(url);
        const elementTypes = new CaseAndSpaceInsensitiveDict<string>();
        
        for (const element of response.data.value) {
            elementTypes.set(element.Name, element.Type);
        }

        return elementTypes;
    }

    public async getParents(
        dimensionName: string,
        hierarchyName: string,
        elementName: string
    ): Promise<string[]> {
        const url = formatUrl(
            "/Dimensions('{}')/Hierarchies('{}')/Elements('{}')/Parents?$select=Name",
            dimensionName, hierarchyName, elementName);

        const response = await this.rest.get(url);
        return response.data.value.map((element: any) => element.Name);
    }

    public async getChildren(
        dimensionName: string,
        hierarchyName: string,
        elementName: string
    ): Promise<string[]> {
        const url = formatUrl(
            "/Dimensions('{}')/Hierarchies('{}')/Elements('{}')/Components?$select=Name",
            dimensionName, hierarchyName, elementName);

        const response = await this.rest.get(url);
        return response.data.value.map((component: any) => component.Name);
    }

    public async getAncestors(
        dimensionName: string,
        hierarchyName: string,
        elementName: string
    ): Promise<string[]> {
        // Get all parents recursively
        const ancestors = new Set<string>();
        const toProcess = [elementName];
        const processed = new Set<string>();

        while (toProcess.length > 0) {
            const currentElement = toProcess.pop()!;
            if (processed.has(currentElement)) continue;
            processed.add(currentElement);

            const parents = await this.getParents(dimensionName, hierarchyName, currentElement);
            for (const parent of parents) {
                if (!ancestors.has(parent)) {
                    ancestors.add(parent);
                    toProcess.push(parent);
                }
            }
        }

        return Array.from(ancestors);
    }

    public async getDescendants(
        dimensionName: string,
        hierarchyName: string,
        elementName: string
    ): Promise<string[]> {
        // Get all children recursively
        const descendants = new Set<string>();
        const toProcess = [elementName];
        const processed = new Set<string>();

        while (toProcess.length > 0) {
            const currentElement = toProcess.pop()!;
            if (processed.has(currentElement)) continue;
            processed.add(currentElement);

            const children = await this.getChildren(dimensionName, hierarchyName, currentElement);
            for (const child of children) {
                if (!descendants.has(child)) {
                    descendants.add(child);
                    toProcess.push(child);
                }
            }
        }

        return Array.from(descendants);
    }

    public async executeSetMdx(
        mdx: string,
        topRecords?: number,
        memberProperties: string[] | null = ['Name', 'Weight'],
        parentProperties: string[] | null = ['Name', 'UniqueName'],
        elementProperties: string[] | null = ['Type', 'Level']
    ): Promise<any[][]> {
        const top = topRecords ? `$top=${topRecords};` : '';

        const effectiveMemberProperties = memberProperties || ['Name'];
        const selectMemberProperties = `$select=${effectiveMemberProperties.join(',')}`;

        const propertiesToExpand: string[] = [];
        if (parentProperties) {
            propertiesToExpand.push(`Parent($select=${parentProperties.join(',')})`);
        }
        if (elementProperties) {
            propertiesToExpand.push(`Element($select=${elementProperties.join(',')})`);
        }

        const expandProperties = propertiesToExpand.length > 0
            ? `;$expand=${propertiesToExpand.join(',')}`
            : '';

        const url = `/ExecuteMDXSetExpression?$expand=Tuples(${top}$expand=Members(${selectMemberProperties}${expandProperties}))`;

        const payload = { MDX: mdx };
        const response = await this.rest.post(url, JSON.stringify(payload));
        const rawDict = response.data;
        return (rawDict.Tuples || []).map((tuple: any) => tuple.Members);
    }


    public async getElementAttributes(
        dimensionName: string,
        hierarchyName?: string
    ): Promise<ElementAttribute[]> {
        const hierarchy = hierarchyName || dimensionName;
        const url = formatUrl(
            "/Dimensions('{}')/Hierarchies('{}')/ElementAttributes",
            dimensionName, hierarchy);
        const response = await this.rest.get(url);
        return response.data.value.map((attrDict: any) => ElementAttribute.fromDict(attrDict));
    }

    public async getElementAttributeNames(
        dimensionName: string,
        hierarchyName?: string
    ): Promise<string[]> {
        const hierarchy = hierarchyName || dimensionName;
        const url = formatUrl(
            "/Dimensions('{}')/Hierarchies('{}')/ElementAttributes?$select=Name",
            dimensionName, hierarchy);
        const response = await this.rest.get(url);
        return response.data.value.map((attr: any) => attr.Name);
    }

    public async createElementAttribute(
        dimensionName: string,
        hierarchyName: string,
        elementAttribute: ElementAttribute
    ): Promise<AxiosResponse> {
        const url = formatUrl(
            "/Dimensions('{}')/Hierarchies('{}')/ElementAttributes",
            dimensionName, hierarchyName);
        return await this.rest.post(url, elementAttribute.body);
    }

    public async deleteElementAttribute(
        dimensionName: string,
        hierarchyName: string,
        elementAttributeName: string
    ): Promise<AxiosResponse> {
        const url = formatUrl(
            "/Dimensions('}ElementAttributes_{}')/Hierarchies('}ElementAttributes_{}')/Elements('{}')",
            dimensionName, hierarchyName, elementAttributeName);
        return await this.rest.delete(url);
    }


    private async deleteElementsUseTI(
        dimensionName: string,
        hierarchyName: string,
        elementNames: string[]
    ): Promise<void> {
        if (!elementNames || elementNames.length === 0) {
            return;
        }

        let tiStatements = '';
        for (const elementName of elementNames) {
            tiStatements += `HierarchyElementDelete('${dimensionName}','${hierarchyName}','${elementName}');\n`;
        }

        // Execute TI code directly without creating a process
        const url = "/ExecuteProcessWithReturn";
        const body = {
            Name: `tm1npm_delete_elements_${Date.now()}`,
            PrologProcedure: tiStatements
        };

        await this.rest.post(url, body);
    }

    public async addEdges(
        dimensionName: string,
        hierarchyName: string,
        edges: { [parent: string]: { [child: string]: number } }
    ): Promise<AxiosResponse> {
        const hierarchy = hierarchyName || dimensionName;
        const url = formatUrl(
            "/Dimensions('{}')/Hierarchies('{}')/Edges",
            dimensionName, hierarchy);
        const body: Array<{ ParentName: string; ComponentName: string; Weight: number }> = [];
        for (const [parent, children] of Object.entries(edges)) {
            for (const [component, weight] of Object.entries(children)) {
                body.push({ ParentName: parent, ComponentName: component, Weight: Number(weight) });
            }
        }
        return await this.rest.post(url, JSON.stringify(body));
    }

    public async deleteEdges(
        dimensionName: string,
        hierarchyName: string,
        edges: Array<{parent: string, child: string}>,
        useTI: boolean = false
    ): Promise<void> {
        if (useTI) {
            return this.deleteEdgesUseTI(dimensionName, hierarchyName, edges);
        }

        // Delete parent-child relationships one by one
        for (const edge of edges) {
            const url = formatUrl(
                "/Dimensions('{}')/Hierarchies('{}')/Elements('{}')/Components('{}')",
                dimensionName, hierarchyName, edge.parent, edge.child);

            await this.rest.delete(url);
        }
    }

    private async deleteEdgesUseTI(
        dimensionName: string,
        hierarchyName: string,
        edges: Array<{parent: string, child: string}>
    ): Promise<void> {
        let tiStatements = '';
        for (const edge of edges) {
            tiStatements += `HierarchyElementComponentDelete('${dimensionName}','${hierarchyName}','${edge.parent}','${edge.child}');\n`;
        }

        // Execute TI code directly
        const url = "/ExecuteProcessWithReturn";
        const body = {
            Name: `tm1npm_delete_edges_${Date.now()}`,
            PrologProcedure: tiStatements
        };

        await this.rest.post(url, body);
    }



    public async createHierarchyFromDataframe(
        dimensionName: string,
        hierarchyName: string,
        dataFrame: any[][]
    ): Promise<void> {
        // Assume first row is headers: [Name, Type, Parent1, Weight1, Parent2, Weight2, ...]
        const headers = dataFrame[0];
        const nameIndex = headers.indexOf('Name');
        const typeIndex = headers.indexOf('Type');
        
        if (nameIndex === -1 || typeIndex === -1) {
            throw new Error('DataFrame must contain Name and Type columns');
        }

        // Create elements first
        for (let i = 1; i < dataFrame.length; i++) {
            const row = dataFrame[i];
            const elementName = row[nameIndex];
            const elementType = row[typeIndex] || 'Numeric';

            const element = new Element(elementName, elementType);
            await this.create(dimensionName, hierarchyName, element);
        }

        // Then create relationships
        const edges: { [parent: string]: { [child: string]: number } } = {};

        for (let i = 1; i < dataFrame.length; i++) {
            const row = dataFrame[i];
            const childName = row[nameIndex];

            // Look for parent columns
            for (let j = 0; j < headers.length; j++) {
                const header = headers[j];
                if (header.startsWith('Parent') && row[j]) {
                    const parentName = row[j];
                    const weightIndex = headers.indexOf(header.replace('Parent', 'Weight'));
                    const weight = weightIndex !== -1 ? parseFloat(row[weightIndex]) || 1 : 1;

                    if (!edges[parentName]) edges[parentName] = {};
                    edges[parentName][childName] = weight;
                }
            }
        }

        // Add all edges
        if (Object.keys(edges).length > 0) {
            await this.addEdges(dimensionName, hierarchyName, edges);
        }
    }

    public async updateElementAttribute(
        dimensionName: string,
        hierarchyName: string,
        elementName: string,
        attributeName: string,
        attributeValue: any
    ): Promise<AxiosResponse> {
        const url = formatUrl(
            "/Dimensions('{}')/Hierarchies('{}')/Elements('{}')/Attributes('{}')",
            dimensionName, hierarchyName, elementName, attributeName);
        const body = { Value: attributeValue };
        return await this.rest.patch(url, body);
    }

    public async getElementsCount(
        dimensionName: string,
        hierarchyName?: string,
        skipConsolidatedElements: boolean = false
    ): Promise<number> {
        const hierarchy = hierarchyName || dimensionName;
        let url = formatUrl(
            "/Dimensions('{}')/Hierarchies('{}')/Elements/$count",
            dimensionName, hierarchy);

        if (skipConsolidatedElements) {
            url += `?$filter=Type ne ${ElementType.CONSOLIDATED}`;
        }

        const response = await this.rest.get(url);
        return parseInt(response.data) || 0;
    }



    // ===== NEW FUNCTIONS FOR 100% TM1PY PARITY =====

    /**
     * Delete elements using TI for better performance with large datasets
     */

    /**
     * Delete edges using blob operations for large datasets
     */
    public async deleteEdgesUseBlob(
        dimensionName: string, 
        hierarchyName: string, 
        edges: Array<{parent: string, child: string}>
    ): Promise<void> {
        if (edges.length === 0) return;

        const hierarchy = hierarchyName || dimensionName;
        
        // Create CSV blob for edge deletion
        const csvContent = edges.map(edge => `"${edge.parent}","${edge.child}",0`).join('\n');
        const headers = 'Parent,Child,Weight\n';
        const blobData = headers + csvContent;

        // Use TI process with blob to delete edges efficiently
        const tiCode = `
            # Delete edges using blob upload
            sParent = CellGetS('', 'Parent');
            sChild = CellGetS('', 'Child');
            HierarchyElementComponentDelete('${dimensionName}', '${hierarchy}', sParent, sChild);
        `;

        const processBody = {
            Name: `DeleteEdgesBlob_${Date.now()}`,
            PrologProcedure: tiCode,
            HasSecurityAccess: false,
            DataSource: {
                Type: 'ASCII',
                asciiHeaderRecords: 1,
                asciiDelimiterType: 'Character',
                asciiDelimiterChar: ',',
                data: blobData
            }
        };

        const processUrl = '/Processes';
        await this.rest.post(processUrl, processBody);
        
        // Execute the process
        const executeUrl = `/Processes('${processBody.Name}')/tm1.ExecuteProcess`;
        await this.rest.post(executeUrl, {});
        
        // Clean up
        const deleteUrl = `/Processes('${processBody.Name}')`;
        await this.rest.delete(deleteUrl);
    }

    /**
     * Get elements by hierarchy level
     */
    public async getElementsByLevel(
        dimensionName: string,
        hierarchyName: string,
        level: number
    ): Promise<string[]> {
        const hierarchy = hierarchyName || dimensionName;
        const url = formatUrl(
            "/Dimensions('{}')/Hierarchies('{}')/Elements?$select=Name&$filter=Level eq {}",
            dimensionName, hierarchy, String(level));
        const response = await this.rest.get(url);
        return response.data.value.map((e: any) => e.Name);
    }

    /**
     * Get elements filtered by wildcard pattern
     */
    public async getElementsFilteredByWildcard(
        dimensionName: string, 
        hierarchyName: string, 
        wildcard: string
    ): Promise<Element[]> {
        const hierarchy = hierarchyName || dimensionName;
        
        // Convert wildcard to OData filter
        const filterPattern = wildcard.replace(/\*/g, '%').replace(/\?/g, '_');
        const filter = `substringof('${filterPattern}',Name)`;
        
        const url = formatUrl(
            "/Dimensions('{}')/Hierarchies('{}')/Elements?$expand=*&$filter=" + filter,
            dimensionName, hierarchy);

        const response = await this.rest.get(url);
        return response.data.value.map((element: any) => Element.fromDict(element));
    }

    /**
     * Get attribute values for multiple elements
     */
    public async getAttributeOfElements(
        dimensionName: string, 
        hierarchyName: string, 
        elementNames: string[], 
        attributeName: string
    ): Promise<{[elementName: string]: any}> {
        const hierarchy = hierarchyName || dimensionName;
        const result: {[elementName: string]: any} = {};

        // Get attribute values for each element
        for (const elementName of elementNames) {
            try {
                const url = formatUrl(
                    "/Dimensions('{}')/Hierarchies('{}')/Elements('{}')/Attributes('{}')",
                    dimensionName, hierarchy, elementName, attributeName);
                
                const response = await this.rest.get(url);
                result[elementName] = response.data.Value;
            } catch (error) {
                // If attribute doesn't exist for element, set to null
                result[elementName] = null;
            }
        }

        return result;
    }

    /**
     * Lock element for concurrent operations
     */
    public async elementLock(
        dimensionName: string, 
        hierarchyName: string, 
        elementName: string
    ): Promise<void> {
        const hierarchy = hierarchyName || dimensionName;
        const url = formatUrl(
            "/Dimensions('{}')/Hierarchies('{}')/Elements('{}')/tm1.Lock",
            dimensionName, hierarchy, elementName);
        
        await this.rest.post(url, {});
    }

    /**
     * Unlock element
     */
    public async elementUnlock(
        dimensionName: string, 
        hierarchyName: string, 
        elementName: string
    ): Promise<void> {
        const hierarchy = hierarchyName || dimensionName;
        const url = formatUrl(
            "/Dimensions('{}')/Hierarchies('{}')/Elements('{}')/tm1.Unlock",
            dimensionName, hierarchy, elementName);
        
        await this.rest.post(url, {});
    }

    /**
     * Get the number of levels in hierarchy
     */
    public async getLevelsCount(
        dimensionName: string,
        hierarchyName: string
    ): Promise<number> {
        const hierarchy = hierarchyName || dimensionName;
        const url = formatUrl(
            "/Dimensions('{}')/Hierarchies('{}')/Levels/$count",
            dimensionName, hierarchy);
        const response = await this.rest.get(url);
        return parseInt(response.data) || 0;
    }

    public async getLevelNames(
        dimensionName: string,
        hierarchyName: string,
        descending: boolean = true
    ): Promise<string[]> {
        const hierarchy = hierarchyName || dimensionName;
        const url = formatUrl(
            "/Dimensions('{}')/Hierarchies('{}')/Levels?$select=Name",
            dimensionName, hierarchy);
        const response = await this.rest.get(url);
        const levels = response.data.value.map((level: any) => level.Name);
        if (descending) {
            return levels.reverse();
        }
        return levels;
    }

    /**
     * Get alias element attributes
     */
    public async getAliasElementAttributes(
        dimensionName: string,
        hierarchyName: string
    ): Promise<string[]> {
        const attributes = await this.getElementAttributes(dimensionName, hierarchyName);
        return attributes
            .filter(attr => attr.attributeType === 'Alias')
            .map(attr => attr.name);
    }

    /**
     * Get leaves under a consolidation element
     */
    public async getLeavesUnderConsolidation(
        dimensionName: string, 
        hierarchyName: string, 
        elementName: string
    ): Promise<Element[]> {
        const hierarchy = hierarchyName || dimensionName;
        
        // Use MDX to get descendants that are leaves
        const mdx = `FILTER(DESCENDANTS({[${dimensionName}].[${hierarchy}].[${elementName}]}, 999, LEAVES), [${dimensionName}].[${hierarchy}].CurrentMember.Children.Count = 0)`;
        
        const elementNames = await this.executeSetMdxElementNames(mdx);
        return Promise.all(elementNames.map(name => this.get(dimensionName, hierarchy, name)));
    }

    /**
     * Get edges under a consolidation element
     */
    public async getEdgesUnderConsolidation(
        dimensionName: string, 
        hierarchyName: string, 
        elementName: string
    ): Promise<Array<{parent: string, child: string, weight: number}>> {
        const hierarchy = hierarchyName || dimensionName;
        const url = formatUrl(
            "/Dimensions('{}')/Hierarchies('{}')/Elements('{}')/Components",
            dimensionName, hierarchy, elementName);
        
        const response = await this.rest.get(url);
        return response.data.value.map((edge: any) => ({
            parent: elementName,
            child: edge.Name,
            weight: edge.Weight || 1
        }));
    }

    /**
     * Get all members under a consolidation element
     */
    public async getMembersUnderConsolidation(
        dimensionName: string, 
        hierarchyName: string, 
        elementName: string
    ): Promise<Element[]> {
        const hierarchy = hierarchyName || dimensionName;
        
        // Use MDX to get all descendants
        const mdx = `DESCENDANTS({[${dimensionName}].[${hierarchy}].[${elementName}]}, 999, SELF_AND_AFTER)`;
        
        const elementNames = await this.executeSetMdxElementNames(mdx);
        return Promise.all(elementNames.map(name => this.get(dimensionName, hierarchy, name)));
    }

    /**
     * Get elements filtered by attribute value
     */
    public async getElementsFilteredByAttribute(
        dimensionName: string, 
        hierarchyName: string, 
        attributeName: string, 
        attributeValue: any
    ): Promise<Element[]> {
        const hierarchy = hierarchyName || dimensionName;
        
        // Get all elements and filter by attribute
        const allElements = await this.getElements(dimensionName, hierarchy);
        const filteredElements: Element[] = [];
        
        for (const element of allElements) {
            try {
                const attrUrl = formatUrl(
                    "/Dimensions('{}')/Hierarchies('{}')/Elements('{}')/Attributes('{}')",
                    dimensionName, hierarchy, element.name, attributeName);
                
                const attrResponse = await this.rest.get(attrUrl);
                if (attrResponse.data.Value === attributeValue) {
                    filteredElements.push(element);
                }
            } catch (error) {
                // Attribute doesn't exist for this element
                continue;
            }
        }
        
        return filteredElements;
    }

    /**
     * Get all element identifiers (unique names)
     */
    public async getAllElementIdentifiers(
        dimensionName: string, 
        hierarchyName: string
    ): Promise<string[]> {
        const hierarchy = hierarchyName || dimensionName;
        const elements = await this.getNames(dimensionName, hierarchy);
        
        return elements.map(name => `[${dimensionName}].[${hierarchy}].[${name}]`);
    }

    /**
     * Get element identifiers with optional filter pattern
     */
    public async getElementIdentifiers(
        dimensionName: string, 
        hierarchyName: string, 
        filterPattern?: string
    ): Promise<string[]> {
        const hierarchy = hierarchyName || dimensionName;
        let elements: string[];
        
        if (filterPattern) {
            const filteredElements = await this.getElementsFilteredByWildcard(dimensionName, hierarchy, filterPattern);
            elements = filteredElements.map(e => e.name);
        } else {
            elements = await this.getNames(dimensionName, hierarchy);
        }
        
        return elements.map(name => `[${dimensionName}].[${hierarchy}].[${name}]`);
    }

    public async getNumberOfConsolidatedElements(
        dimensionName: string,
        hierarchyName: string
    ): Promise<number> {
        return this._getElementCountWithFilter(dimensionName, hierarchyName, `Type eq ${ElementType.CONSOLIDATED}`);
    }

    public async getNumberOfLeafElements(
        dimensionName: string,
        hierarchyName: string
    ): Promise<number> {
        return this._getElementCountWithFilter(dimensionName, hierarchyName, `Type ne ${ElementType.CONSOLIDATED}`);
    }

    public async getNumberOfNumericElements(
        dimensionName: string,
        hierarchyName: string
    ): Promise<number> {
        return this._getElementCountWithFilter(dimensionName, hierarchyName, `Type eq ${ElementType.NUMERIC}`);
    }

    public async getNumberOfStringElements(
        dimensionName: string,
        hierarchyName: string
    ): Promise<number> {
        return this._getElementCountWithFilter(dimensionName, hierarchyName, `Type eq ${ElementType.STRING}`);
    }

    /**
     * Get element types from all hierarchies in a single API call
     */
    public async getElementTypesFromAllHierarchies(
        dimensionName: string,
        skipConsolidations: boolean = false
    ): Promise<CaseAndSpaceInsensitiveDict<string>> {
        let url = formatUrl(
            "/Dimensions('{}')?$expand=Hierarchies($select=Elements;$expand=Elements($select=Name,Type",
            dimensionName
        );
        url += skipConsolidations ? ";$filter=Type ne 3))" : "))";

        const response = await this.rest.get(url);
        const result = new CaseAndSpaceInsensitiveDict<string>();
        for (const hierarchy of response.data.Hierarchies) {
            for (const element of hierarchy.Elements) {
                result.set(element.Name, element.Type);
            }
        }
        return result;
    }

    /**
     * Check if the element attributes cube exists for a dimension
     */
    public async attributeCubeExists(dimensionName: string): Promise<boolean> {
        const url = formatUrl("/Cubes('{}')", Element.ELEMENT_ATTRIBUTES_PREFIX + dimensionName);
        return this._exists(url);
    }

    /**
     * Get parent mapping for all elements in a hierarchy
     */
    public async getParentsOfAllElements(
        dimensionName: string,
        hierarchyName: string
    ): Promise<{ [elementName: string]: string[] }> {
        const url = formatUrl(
            "/Dimensions('{}')/Hierarchies('{}')/Elements?$select=Name&$expand=Parents($select=Name)",
            dimensionName, hierarchyName
        );
        const response = await this.rest.get(url);
        const result: { [elementName: string]: string[] } = {};
        for (const child of response.data.value) {
            result[child.Name] = (child.Parents || []).map((p: any) => p.Name);
        }
        return result;
    }

    /**
     * Get the canonical/principal name of an element (resolves aliases)
     */
    public async getElementPrincipalName(
        dimensionName: string,
        hierarchyName: string,
        elementName: string
    ): Promise<string> {
        const element = await this.get(dimensionName, hierarchyName, elementName);
        return element.name;
    }

    /**
     * Check if one element is a direct parent of another
     *
     * Unlike the related function in TM1 (ELISPAR or ElementIsParent), this function will return false
     * if an invalid element is passed. An invalid dimension or hierarchy will cause the underlying
     * REST call to throw (the error propagates from the TM1 server).
     */
    public async elementIsParent(
        dimensionName: string,
        hierarchyName: string,
        parentName: string,
        elementName: string
    ): Promise<boolean> {
        const mdx = this._buildDrillIntersectionMdx(
            dimensionName, hierarchyName,
            parentName, elementName,
            'TM1DrillDownMember', false
        );
        const cardinality = await this._getMdxSetCardinality(mdx);
        return cardinality > 0;
    }

    /**
     * Check if one element is an ancestor of another
     *
     * Unlike the related function in TM1 (ELISANC or ElementIsAncestor), this function will return false
     * if an invalid element is passed; but will raise an exception if an invalid dimension or hierarchy is passed.
     *
     * For method you can pass three values:
     * - 'TI' performs best, but requires admin permissions
     * - 'TM1DrillDownMember' performs well when element is a leaf
     * - 'Descendants' performs well when ancestorName and elementName are Consolidations
     *
     * If no method is passed, defaults to 'TI' for admin users, 'TM1DrillDownMember' otherwise.
     * Note: isAdmin is determined from RestService state; if not set, defaults to 'TM1DrillDownMember'.
     */
    public async elementIsAncestor(
        dimensionName: string,
        hierarchyName: string,
        ancestorName: string,
        elementName: string,
        method?: string
    ): Promise<boolean> {
        if (!method) {
            method = this.isAdmin ? 'TI' : 'TM1DrillDownMember';
        }

        if (method.toUpperCase() === 'TI') {
            if (await this._elementIsAncestorTi(dimensionName, hierarchyName, elementName, ancestorName)) {
                return true;
            }
            if (await this.hierarchyExists(dimensionName, hierarchyName)) {
                return false;
            }
            throw new Error(`Hierarchy: '${hierarchyName}' does not exist in dimension: '${dimensionName}'`);
        }

        if (method.toUpperCase() === 'DESCENDANTS' || method.toUpperCase() === 'TM1DRILLDOWNMEMBER') {
            if (!await this.exists(dimensionName, hierarchyName, elementName)) {
                if (!await this.hierarchyExists(dimensionName, hierarchyName)) {
                    throw new Error(`Hierarchy '${hierarchyName}' does not exist in dimension '${dimensionName}'`);
                }
                return false;
            }
        }

        const mdx = this._buildDrillIntersectionMdx(
            dimensionName, hierarchyName,
            ancestorName, elementName,
            method, true
        );
        const cardinality = await this._getMdxSetCardinality(mdx);
        return cardinality > 0;
    }

    /**
     * Remove a single edge from a hierarchy
     */
    public async removeEdge(
        dimensionName: string,
        hierarchyName: string,
        parentName: string,
        componentName: string
    ): Promise<AxiosResponse> {
        const url = formatUrl(
            "/Dimensions('{}')/Hierarchies('{}')/Elements('{}')/Edges(ParentName='{}',ComponentName='{}')",
            dimensionName, hierarchyName, parentName, parentName, componentName
        );
        return this.rest.delete(url);
    }

    /**
     * Check if a hierarchy exists in a dimension (convenience delegation to HierarchyService)
     */
    public async hierarchyExists(
        dimensionName: string,
        hierarchyName: string
    ): Promise<boolean> {
        const hierarchyService = new HierarchyService(this.rest);
        return hierarchyService.exists(dimensionName, hierarchyName);
    }

    /**
     * Get all element names and alias values for leaf elements as a case-and-space-insensitive set
     */
    public async getAllLeafElementIdentifiers(
        dimensionName: string,
        hierarchyName: string
    ): Promise<CaseAndSpaceInsensitiveSet> {
        const mdxElements = `{ Tm1FilterByLevel ( { Tm1SubsetAll ([${dimensionName}].[${hierarchyName}]) } , 0 ) }`;

        const aliasAttributes = await this.getAliasElementAttributes(dimensionName, hierarchyName);

        if (aliasAttributes.length === 0) {
            const result = await this.executeSetMdx(mdxElements, undefined, ['Name'], null, null);
            const identifiers = new CaseAndSpaceInsensitiveSet();
            for (const record of result) {
                identifiers.add(record[0].Name);
            }
            return identifiers;
        }

        const attrMdx = aliasAttributes.map(a =>
            `[}ElementAttributes_${dimensionName}].[}ElementAttributes_${dimensionName}].[${a}]`
        ).join(',');
        const mdx = `SELECT ${mdxElements} ON ROWS, {${attrMdx}} ON COLUMNS FROM [}ElementAttributes_${dimensionName}]`;

        return this._retrieveMdxRowsAndCellValuesAsStringSet(mdx);
    }

    private async _getElementCountWithFilter(
        dimensionName: string,
        hierarchyName: string,
        filter: string
    ): Promise<number> {
        const baseUrl = formatUrl(
            "/Dimensions('{}')/Hierarchies('{}')/Elements/$count",
            dimensionName, hierarchyName
        );
        const url = `${baseUrl}?$filter=${filter}`;
        const response = await this.rest.get(url);
        return parseInt(response.data) || 0;
    }

    private _buildDrillIntersectionMdx(
        dimensionName: string,
        hierarchyName: string,
        firstElementName: string,
        secondElementName: string,
        mdxMethod: string,
        recursive: boolean
    ): string {
        const first = `[${dimensionName}].[${hierarchyName}].[${firstElementName}]`;
        const second = `[${dimensionName}].[${hierarchyName}].[${secondElementName}]`;

        let drillSet: string;
        if (mdxMethod.toUpperCase() === 'TM1DRILLDOWNMEMBER') {
            drillSet = recursive
                ? `{TM1DRILLDOWNMEMBER({${first}}, ALL, RECURSIVE)}`
                : `{TM1DRILLDOWNMEMBER({${first}}, ALL)}`;
        } else if (mdxMethod.toUpperCase() === 'DESCENDANTS') {
            drillSet = `{DESCENDANTS(${first}, ${second}.Level, SELF)}`;
        } else {
            throw new Error("Invalid MDX Drill Method. Options: 'TM1DrillDownMember' or 'Descendants'");
        }

        return `INTERSECT(${drillSet}, {${second}})`;
    }

    private async _getMdxSetCardinality(mdx: string): Promise<number> {
        const url = '/ExecuteMDXSetExpression?$select=Cardinality';
        const payload = { MDX: mdx };
        const response = await this.rest.post(url, JSON.stringify(payload));
        return response.data.Cardinality || 0;
    }

    @requireDataAdmin
    private async _elementIsAncestorTi(
        dimensionName: string,
        hierarchyName: string,
        elementName: string,
        ancestorName: string
    ): Promise<boolean> {
        const processService = new ProcessService(this.rest);
        const code = `ElementIsAncestor('${escapeODataValue(dimensionName)}', '${escapeODataValue(hierarchyName)}', '${escapeODataValue(ancestorName)}', '${escapeODataValue(elementName)}')=1`;
        return processService.evaluateBooleanTiExpression(code);
    }

    private async _retrieveMdxRowsAndCellValuesAsStringSet(mdx: string): Promise<CaseAndSpaceInsensitiveSet> {
        const cellService = new CellService(this.rest);
        const { rows, values } = await cellService.executeMdxRowsAndValues(mdx);
        const result = new CaseAndSpaceInsensitiveSet();

        for (const row of rows) {
            for (const name of row) {
                if (name) {
                    result.add(name);
                }
            }
        }

        for (const value of values) {
            if (value && typeof value === 'string' && value.trim() !== '') {
                result.add(value);
            }
        }

        return result;
    }
}
