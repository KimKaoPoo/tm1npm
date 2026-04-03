import { AxiosResponse } from 'axios';
import { RestService } from './RestService';
import { Hierarchy } from '../objects/Hierarchy';
import { ElementAttribute } from '../objects/ElementAttribute';
import { Element, ElementType } from '../objects/Element';
import { Dimension } from '../objects/Dimension';
import { TM1RestException } from '../exceptions/TM1Exception';
import { ObjectService } from './ObjectService';
import { ElementService } from './ElementService';
import { CellService } from './CellService';
import { DimensionService } from './DimensionService';
import { DataFrame } from '../utils/DataFrame';
import {
    CaseAndSpaceInsensitiveDict,
    CaseAndSpaceInsensitiveSet,
    caseAndSpaceInsensitiveEquals,
    formatUrl,
    verifyVersion
} from '../utils/Utils';

export class HierarchyService extends ObjectService {
    private elementService?: ElementService;

    constructor(rest: RestService) {
        super(rest);
    }

    private getElementService(): ElementService {
        if (!this.elementService) {
            this.elementService = new ElementService(this.rest);
        }
        return this.elementService;
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

    public async updateOrCreate(hierarchy: Hierarchy): Promise<AxiosResponse | AxiosResponse[]> {
        if (await this.exists(hierarchy.dimensionName, hierarchy.name)) {
            return await this.update(hierarchy);
        }
        return await this.create(hierarchy);
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

    public async getHierarchySummary(
        dimensionName: string,
        hierarchyName?: string
    ): Promise<Record<string, number>> {
        const hierarchy = hierarchyName || dimensionName;
        const url = this.formatUrl(
            "/Dimensions('{}')/Hierarchies('{}')" +
            "?$expand=Edges/$count,Elements/$count,ElementAttributes/$count,Members/$count,Levels/$count" +
            "&$select=Cardinality",
            dimensionName, hierarchy);
        const response = await this.rest.get(url);
        const data = response.data;
        return {
            Elements: data['Elements@odata.count'] ?? 0,
            Edges: data['Edges@odata.count'] ?? 0,
            ElementAttributes: data['ElementAttributes@odata.count'] ?? 0,
            Members: data['Members@odata.count'] ?? 0,
            Levels: data['Levels@odata.count'] ?? 0
        };
    }

    public async getDefaultMember(
        dimensionName: string,
        hierarchyName?: string
    ): Promise<string | null> {
        const hierarchy = hierarchyName || dimensionName;
        const url = this.formatUrl(
            "/Dimensions('{}')/Hierarchies('{}')/DefaultMember",
            dimensionName, hierarchy);
        try {
            const response = await this.rest.get(url);
            return response.data?.Name || null;
        } catch (error) {
            if (error instanceof TM1RestException && error.statusCode === 404) {
                return null;
            }
            throw error;
        }
    }

    public async updateDefaultMember(
        dimensionName: string,
        hierarchyName?: string,
        memberName: string = ''
    ): Promise<AxiosResponse | void> {
        const hierarchy = hierarchyName || dimensionName;
        // Default to API approach (v12+) when version is unknown
        if (!this.version || verifyVersion(this.version, '12.0.0')) {
            return this._updateDefaultMemberViaApi(dimensionName, hierarchy, memberName);
        }
        return this._updateDefaultMemberViaPropsCube(dimensionName, hierarchy, memberName);
    }

    private async _updateDefaultMemberViaApi(
        dimensionName: string,
        hierarchyName: string,
        memberName: string
    ): Promise<AxiosResponse> {
        const url = this.formatUrl(
            "/Dimensions('{}')/Hierarchies('{}')",
            dimensionName, hierarchyName);
        const body: Record<string, any> = {};
        if (memberName) {
            body['DefaultMember@odata.bind'] = formatUrl(
                "Dimensions('{}')/Hierarchies('{}')/Elements('{}')",
                dimensionName, hierarchyName, memberName);
        } else {
            body['DefaultMember@odata.bind'] = null;
        }
        return await this.rest.patch(url, JSON.stringify(body));
    }

    private async _updateDefaultMemberViaPropsCube(
        dimensionName: string,
        hierarchyName: string,
        memberName: string
    ): Promise<void> {
        const cellService = new CellService(this.rest);
        const value = memberName || '';
        await cellService.writeValue(
            '}HierarchyProperties',
            [dimensionName, hierarchyName, 'MEMBER_DEFAULT'],
            value
        );
    }

    public async removeEdgesUnderConsolidation(
        dimensionName: string,
        hierarchyName: string,
        consolidationElement: string
    ): Promise<AxiosResponse[]> {
        const hierarchy = await this.get(dimensionName, hierarchyName);

        const descendants = hierarchy.getDescendants(consolidationElement, true);
        const membersUnderConsolidation = new CaseAndSpaceInsensitiveSet(descendants);
        membersUnderConsolidation.add(consolidationElement);

        const edgesToRemove: Array<[string, string]> = [];
        for (const [parent, children] of hierarchy.edges) {
            if (membersUnderConsolidation.has(parent)) {
                for (const child of children.keys()) {
                    edgesToRemove.push([parent, child]);
                }
            }
        }

        for (const [parent, child] of edgesToRemove) {
            hierarchy.removeEdge(parent, child);
        }

        return await this.update(hierarchy);
    }

    public async addEdges(
        dimensionName: string,
        hierarchyName: string | undefined,
        edges: { [parent: string]: { [child: string]: number } }
    ): Promise<AxiosResponse> {
        return this.getElementService().addEdges(dimensionName, hierarchyName || dimensionName, edges);
    }

    public async addElements(
        dimensionName: string,
        hierarchyName: string,
        elements: Element[]
    ): Promise<AxiosResponse> {
        return this.getElementService().addElements(dimensionName, hierarchyName, elements);
    }

    public async addElementAttributes(
        dimensionName: string,
        hierarchyName: string,
        elementAttributes: ElementAttribute[]
    ): Promise<AxiosResponse> {
        return this.getElementService().addElementAttributes(dimensionName, hierarchyName, elementAttributes);
    }

    public async updateOrCreateHierarchyFromDataframe(
        dimensionName: string,
        hierarchyName: string,
        df: DataFrame,
        options: {
            elementColumn?: string;
            verifyUniqueElements?: boolean;
            elementTypeColumn?: string;
            unwindAll?: boolean;
            unwindConsolidations?: string[];
            deleteOrphanedConsolidations?: boolean;
        } = {}
    ): Promise<void> {
        const {
            elementColumn: elemCol,
            verifyUniqueElements = false,
            elementTypeColumn = 'ElementType',
            unwindAll = false,
            unwindConsolidations,
            deleteOrphanedConsolidations = false
        } = options;

        const elementColumn = elemCol || df.columns[0];
        const rows = df.toJson();

        const numericSuffix = (col: string) => parseInt(col.replace(/\D/g, ''), 10);
        const levelColumns = df.columns
            .filter(c => /^Level\d+$/i.test(c))
            .sort((a, b) => numericSuffix(a) - numericSuffix(b));
        const weightColumns = df.columns
            .filter(c => /^Weight\d+$/i.test(c))
            .sort((a, b) => numericSuffix(a) - numericSuffix(b));

        const reservedColumns = new Set([
            elementColumn.toLowerCase(),
            elementTypeColumn.toLowerCase(),
            ...levelColumns.map(c => c.toLowerCase()),
            ...weightColumns.map(c => c.toLowerCase())
        ]);
        const attributeColumns = df.columns.filter(c => !reservedColumns.has(c.toLowerCase()));

        if (verifyUniqueElements) {
            const seen = new CaseAndSpaceInsensitiveSet();
            for (const row of rows) {
                const name = String(row[elementColumn]);
                if (seen.has(name)) {
                    throw new Error(`Duplicate element found: '${name}'`);
                }
                seen.add(name);
            }
        }

        // Parse DataFrame rows into elements, edges, and attribute values
        const elementsToAdd: Element[] = [];
        const edgesToAdd: { [parent: string]: { [child: string]: number } } = {};
        const attributeValues = new Map<string, Map<string, any>>();

        for (const row of rows) {
            const elementName = String(row[elementColumn]);
            const elementTypeStr = df.columns.includes(elementTypeColumn)
                ? String(row[elementTypeColumn] || 'Numeric')
                : 'Numeric';

            // Element constructor handles string→ElementType conversion
            elementsToAdd.push(new Element(elementName, elementTypeStr));

            for (let i = 0; i < levelColumns.length; i++) {
                const parentName = row[levelColumns[i]];
                if (parentName && String(parentName).trim()) {
                    const weight = weightColumns[i] ? Number(row[weightColumns[i]] || 1) : 1;
                    const parentStr = String(parentName);
                    if (!edgesToAdd[parentStr]) {
                        edgesToAdd[parentStr] = {};
                    }
                    edgesToAdd[parentStr][elementName] = weight;
                }
            }

            if (attributeColumns.length > 0) {
                const attrs = new Map<string, any>();
                for (const col of attributeColumns) {
                    if (row[col] !== undefined && row[col] !== null && row[col] !== '') {
                        attrs.set(col, row[col]);
                    }
                }
                if (attrs.size > 0) {
                    attributeValues.set(elementName, attrs);
                }
            }
        }

        // Get or create the dimension/hierarchy
        const dimensionService = new DimensionService(this.rest);
        const hierarchyExists = await this.exists(dimensionName, hierarchyName).catch(() => false);

        let hierarchy: Hierarchy;
        if (hierarchyExists) {
            hierarchy = await this.get(dimensionName, hierarchyName);
        } else {
            const newHierarchy = new Hierarchy(hierarchyName, dimensionName);
            try {
                const dim = new Dimension(dimensionName, [newHierarchy]);
                await dimensionService.create(dim);
            } catch (e: any) {
                const isAlreadyExists = (e instanceof TM1RestException && e.statusCode === 409)
                    || (e.message && e.message.includes('already exists'));
                if (isAlreadyExists) {
                    // Dimension exists but hierarchy doesn't — create just the hierarchy
                    await this.create(newHierarchy);
                } else {
                    throw e;
                }
            }
            hierarchy = await this.get(dimensionName, hierarchyName);
        }

        // Unwind edges if requested
        if (unwindAll) {
            await this.removeAllEdges(dimensionName, hierarchyName);
        } else if (unwindConsolidations && unwindConsolidations.length > 0) {
            for (const consolidation of unwindConsolidations) {
                try {
                    await this.removeEdgesUnderConsolidation(dimensionName, hierarchyName, consolidation);
                } catch (e: any) {
                    if (!(e instanceof TM1RestException && e.statusCode === 404)) {
                        throw e;
                    }
                }
            }
        }

        // Re-fetch hierarchy only if edges were modified
        if (unwindAll || (unwindConsolidations && unwindConsolidations.length > 0)) {
            hierarchy = await this.get(dimensionName, hierarchyName);
        }

        // Add new elements not already in hierarchy
        const existingElementNames = new CaseAndSpaceInsensitiveSet(
            hierarchy.elements.map(e => e.name)
        );
        const newElements = elementsToAdd.filter(e => !existingElementNames.has(e.name));

        // Ensure parent elements from edges exist as Consolidated type
        const newElementNames = new CaseAndSpaceInsensitiveSet(newElements.map(e => e.name));
        const parentElementsToAdd: Element[] = [];
        for (const parentName of Object.keys(edgesToAdd)) {
            if (!existingElementNames.has(parentName) && !newElementNames.has(parentName)) {
                parentElementsToAdd.push(new Element(parentName, ElementType.CONSOLIDATED));
            }
        }

        const allNewElements = [...newElements, ...parentElementsToAdd];
        if (allNewElements.length > 0) {
            await this.addElements(dimensionName, hierarchyName, allNewElements);
        }

        // Create missing element attributes and write values
        if (attributeColumns.length > 0) {
            const existingAttrs = await this.getElementAttributes(dimensionName, hierarchyName);
            const existingAttrNames = new CaseAndSpaceInsensitiveSet(existingAttrs.map(a => a.name));

            const newAttrs: ElementAttribute[] = [];
            for (const col of attributeColumns) {
                if (!existingAttrNames.has(col)) {
                    const values = rows.map(r => r[col]).filter(v => v !== undefined && v !== null && v !== '');
                    const isNumeric = values.length > 0 && values.every(v => !isNaN(Number(v)));
                    newAttrs.push(new ElementAttribute(col, isNumeric ? 'Numeric' : 'String'));
                }
            }

            if (newAttrs.length > 0) {
                await this.addElementAttributes(dimensionName, hierarchyName, newAttrs);
            }

            // Write attribute values in parallel batches
            if (attributeValues.size > 0) {
                const cellService = new CellService(this.rest);
                const cubeName = `}ElementAttributes_${dimensionName}`;
                const writePromises: Promise<void>[] = [];

                for (const [elementName, attrs] of attributeValues) {
                    for (const [attrName, value] of attrs) {
                        writePromises.push(
                            cellService.writeValue(cubeName, [elementName, attrName], value)
                                .catch((e: any) => {
                                    // Expected: element may not exist in control dimension
                                    if (!(e instanceof TM1RestException && e.statusCode === 404)) {
                                        throw e;
                                    }
                                })
                        );
                    }
                }
                await Promise.all(writePromises);
            }
        }

        // Add edges
        if (Object.keys(edgesToAdd).length > 0) {
            try {
                await this.addEdges(dimensionName, hierarchyName, edgesToAdd);
            } catch (bulkError: any) {
                // Only fall back on client errors (400, 422); re-throw server/network errors
                if (!(bulkError instanceof TM1RestException) ||
                    (bulkError.statusCode !== 400 && bulkError.statusCode !== 422)) {
                    throw bulkError;
                }
                // Bulk failed due to validation; fall back to individual edge adds
                const edgePromises: Promise<AxiosResponse>[] = [];
                for (const [parent, children] of Object.entries(edgesToAdd)) {
                    for (const [child, weight] of Object.entries(children)) {
                        edgePromises.push(
                            this.addEdges(dimensionName, hierarchyName, { [parent]: { [child]: weight } })
                                .catch((e: any) => {
                                    if (e instanceof TM1RestException && e.statusCode === 409) {
                                        return null as any;
                                    }
                                    throw e;
                                })
                        );
                    }
                }
                await Promise.all(edgePromises);
            }
        }

        // Delete orphaned consolidations (consolidated elements with no children)
        if (deleteOrphanedConsolidations) {
            const updatedHierarchy = await this.get(dimensionName, hierarchyName);
            const parentNames = new CaseAndSpaceInsensitiveSet();
            for (const [parent] of updatedHierarchy.edges) {
                parentNames.add(parent);
            }

            const elemService = this.getElementService();
            const deletePromises: Promise<any>[] = [];
            for (const element of updatedHierarchy.elements) {
                if (element.elementType === ElementType.CONSOLIDATED && !parentNames.has(element.name)) {
                    deletePromises.push(
                        elemService.delete(dimensionName, hierarchyName, element.name)
                            .catch((e: any) => {
                                // Expected: element may have been deleted already (404)
                                if (!(e instanceof TM1RestException && e.statusCode === 404)) {
                                    throw e;
                                }
                            })
                    );
                }
            }
            await Promise.all(deletePromises);
        }
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
