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
import { CaseAndSpaceInsensitiveDict, caseAndSpaceInsensitiveEquals, formatUrl, verifyVersion } from '../utils/Utils';

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

        // Get all descendants (recursive) + the consolidation element itself
        const descendants = hierarchy.getDescendants(consolidationElement, true);
        const membersUnderConsolidation = new Set<string>(descendants.map(d => d.toLowerCase()));
        membersUnderConsolidation.add(consolidationElement.toLowerCase());

        // Collect edges to remove: where parent is under the consolidation
        const edgesToRemove: Array<[string, string]> = [];
        for (const [parent, children] of hierarchy.edges) {
            if (membersUnderConsolidation.has(parent.toLowerCase())) {
                for (const child of children.keys()) {
                    edgesToRemove.push([parent, child]);
                }
            }
        }

        // Remove edges from hierarchy object
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
            verifyEdges?: boolean;
            elementTypeColumn?: string;
            unwindAll?: boolean;
            unwindConsolidations?: string[];
            updateAttributeTypes?: boolean;
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

        // Step 1: Determine element column (default to first column)
        const elementColumn = elemCol || df.columns[0];

        // Step 2: Get all rows as objects for easier processing
        const rows = df.toJson();

        // Step 3: Identify level columns (e.g., "Level001", "Level002") and weight columns
        const levelColumns = df.columns
            .filter(c => /^Level\d+$/i.test(c))
            .sort();
        const weightColumns = df.columns
            .filter(c => /^Weight\d+$/i.test(c))
            .sort();

        // Step 4: Identify attribute columns (everything that's not element, type, level, weight)
        const reservedColumns = new Set([
            elementColumn.toLowerCase(),
            elementTypeColumn.toLowerCase(),
            ...levelColumns.map(c => c.toLowerCase()),
            ...weightColumns.map(c => c.toLowerCase())
        ]);
        const attributeColumns = df.columns.filter(c => !reservedColumns.has(c.toLowerCase()));

        // Step 5: Validate uniqueness if requested
        if (verifyUniqueElements) {
            const seen = new Set<string>();
            for (const row of rows) {
                const lower = String(row[elementColumn]).toLowerCase().replace(/\s+/g, '');
                if (seen.has(lower)) {
                    throw new Error(`Duplicate element found: '${row[elementColumn]}'`);
                }
                seen.add(lower);
            }
        }

        // Step 6: Build elements, edges, and attributes from DataFrame
        const elementsToAdd: Element[] = [];
        const edgesToAdd: { [parent: string]: { [child: string]: number } } = {};
        const attributeValues = new Map<string, Map<string, any>>();

        for (const row of rows) {
            const elementName = String(row[elementColumn]);
            const elementTypeStr = df.columns.includes(elementTypeColumn)
                ? String(row[elementTypeColumn] || 'Numeric')
                : 'Numeric';

            let type: ElementType;
            switch (elementTypeStr.toLowerCase()) {
                case 'consolidated': case '3': type = ElementType.CONSOLIDATED; break;
                case 'string': case '2': type = ElementType.STRING; break;
                default: type = ElementType.NUMERIC;
            }
            elementsToAdd.push(new Element(elementName, type));

            // Process level/weight columns for edges
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

            // Collect attribute values
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

        // Step 7: Check if dimension/hierarchy exists
        const dimensionService = new DimensionService(this.rest);
        let hierarchyExists = false;
        try {
            hierarchyExists = await this.exists(dimensionName, hierarchyName);
        } catch {
            hierarchyExists = false;
        }

        // Step 8: Get or create hierarchy
        let hierarchy: Hierarchy;
        if (hierarchyExists) {
            hierarchy = await this.get(dimensionName, hierarchyName);
        } else {
            const newHierarchy = new Hierarchy(hierarchyName, dimensionName);
            try {
                const dim = new Dimension(dimensionName, [newHierarchy]);
                await dimensionService.create(dim);
            } catch (e: any) {
                // Dimension may already exist, just hierarchy is missing
                if (e.statusCode !== 409 && !(e.message && e.message.includes('already exists'))) {
                    try {
                        await this.create(newHierarchy);
                    } catch {
                        // ignore if creation fails (dimension create may have done it)
                    }
                }
            }
            hierarchy = await this.get(dimensionName, hierarchyName);
        }

        // Step 9: Unwind edges if requested
        if (unwindAll) {
            await this.removeAllEdges(dimensionName, hierarchyName);
            hierarchy = await this.get(dimensionName, hierarchyName);
        } else if (unwindConsolidations && unwindConsolidations.length > 0) {
            for (const consolidation of unwindConsolidations) {
                try {
                    await this.removeEdgesUnderConsolidation(dimensionName, hierarchyName, consolidation);
                } catch {
                    // Element may not exist yet
                }
            }
            hierarchy = await this.get(dimensionName, hierarchyName);
        }

        // Step 10: Add new elements that don't exist yet
        const existingElementNames = new Set(
            hierarchy.elements.map(e => e.name.toLowerCase())
        );
        const newElements = elementsToAdd.filter(
            e => !existingElementNames.has(e.name.toLowerCase())
        );

        // Also add parent elements from edges that aren't in the elements list
        const parentElementsToAdd: Element[] = [];
        for (const parentName of Object.keys(edgesToAdd)) {
            const lowerParent = parentName.toLowerCase();
            if (!existingElementNames.has(lowerParent) &&
                !newElements.some(e => e.name.toLowerCase() === lowerParent)) {
                parentElementsToAdd.push(new Element(parentName, ElementType.CONSOLIDATED));
            }
        }

        const allNewElements = [...newElements, ...parentElementsToAdd];
        if (allNewElements.length > 0) {
            await this.addElements(dimensionName, hierarchyName, allNewElements);
        }

        // Step 11: Handle element attributes
        if (attributeColumns.length > 0) {
            const existingAttrs = await this.getElementAttributes(dimensionName, hierarchyName);
            const existingAttrNames = new Set(existingAttrs.map(a => a.name.toLowerCase().replace(/\s+/g, '')));

            const newAttrs: ElementAttribute[] = [];
            for (const col of attributeColumns) {
                if (!existingAttrNames.has(col.toLowerCase().replace(/\s+/g, ''))) {
                    const values = rows.map(r => r[col]).filter(v => v !== undefined && v !== null && v !== '');
                    const isNumeric = values.length > 0 && values.every(v => !isNaN(Number(v)));
                    const attrType = isNumeric ? 'Numeric' : 'String';
                    newAttrs.push(new ElementAttribute(col, attrType));
                }
            }

            if (newAttrs.length > 0) {
                await this.addElementAttributes(dimensionName, hierarchyName, newAttrs);
            }

            // Write attribute values via CellService
            if (attributeValues.size > 0) {
                const cellService = new CellService(this.rest);
                const cubeName = `}ElementAttributes_${dimensionName}`;

                for (const [elementName, attrs] of attributeValues) {
                    for (const [attrName, value] of attrs) {
                        try {
                            await cellService.writeValue(
                                cubeName,
                                [elementName, attrName],
                                value
                            );
                        } catch {
                            // Skip failed writes (element may not exist in control dimension)
                        }
                    }
                }
            }
        }

        // Step 12: Add edges
        if (Object.keys(edgesToAdd).length > 0) {
            try {
                await this.addEdges(dimensionName, hierarchyName, edgesToAdd);
            } catch {
                // Some edges may already exist; add one by one as fallback
                for (const [parent, children] of Object.entries(edgesToAdd)) {
                    for (const [child, weight] of Object.entries(children)) {
                        try {
                            await this.addEdges(dimensionName, hierarchyName, { [parent]: { [child]: weight } });
                        } catch {
                            // Edge may already exist
                        }
                    }
                }
            }
        }

        // Step 13: Delete orphaned consolidations if requested
        if (deleteOrphanedConsolidations) {
            const updatedHierarchy = await this.get(dimensionName, hierarchyName);
            const hasChildren = new Set<string>();
            for (const [parent] of updatedHierarchy.edges) {
                hasChildren.add(parent.toLowerCase());
            }

            const elemService = this.getElementService();
            for (const element of updatedHierarchy.elements) {
                if (element.elementType === ElementType.CONSOLIDATED &&
                    !hasChildren.has(element.name.toLowerCase())) {
                    try {
                        await elemService.delete(dimensionName, hierarchyName, element.name);
                    } catch {
                        // Ignore deletion errors
                    }
                }
            }
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
