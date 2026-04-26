import { TM1Object } from './TM1Object';
import { Element, ElementType } from './Element';
import { ElementAttribute } from './ElementAttribute';
import { lowerAndDropSpaces, caseAndSpaceInsensitiveEquals } from '../utils/Utils';

export class Hierarchy extends TM1Object {
    private _name: string;
    private _dimensionName: string;
    private _elements: Map<string, Element> = new Map();
    private _elementAttributes: ElementAttribute[] = [];
    private _edges: Map<string, Map<string, number>> = new Map();
    private _subsets: string[] = [];
    private _balanced: boolean = false;
    private _defaultMember?: string;

    constructor(
        name: string,
        dimensionName: string,
        elements?: Element[],
        elementAttributes?: ElementAttribute[],
        edges?: Map<string, Map<string, number>>,
        subsets?: string[],
        structure?: number,
        defaultMember?: string
    ) {
        super();
        this._name = name;
        this._dimensionName = dimensionName;

        if (elements) {
            for (const elem of elements) {
                this._elements.set(lowerAndDropSpaces(elem.name), elem);
            }
        }

        this._elementAttributes = elementAttributes ? [...elementAttributes] : [];
        this._edges = edges
            ? new Map(Array.from(edges, ([k, v]) => [k, new Map(v)]))
            : new Map();
        this._subsets = subsets ? [...subsets] : [];
        this._balanced = structure !== undefined ? structure === 0 : false;
        this._defaultMember = defaultMember;
    }

    public static fromDict(hierarchyAsDict: any, dimensionName: string): Hierarchy {
        const elements = hierarchyAsDict.Elements ?
            hierarchyAsDict.Elements.map((e: any) => Element.fromDict(e)) : [];

        const elementAttributes = hierarchyAsDict.ElementAttributes ?
            hierarchyAsDict.ElementAttributes.map((ea: any) => ElementAttribute.fromDict(ea)) : [];

        const edges = new Map<string, Map<string, number>>();
        if (hierarchyAsDict.Edges) {
            for (const edge of hierarchyAsDict.Edges) {
                const parentName: string = edge.ParentName;
                const componentName: string = edge.ComponentName;
                if (!edges.has(parentName)) {
                    edges.set(parentName, new Map());
                }
                edges.get(parentName)!.set(componentName, edge.Weight || 1);
            }
        }

        return new Hierarchy(
            hierarchyAsDict.Name,
            dimensionName,
            elements,
            elementAttributes,
            edges,
            hierarchyAsDict.Subsets,
            hierarchyAsDict.Structure,
            hierarchyAsDict.DefaultMember
        );
    }

    public get name(): string {
        return this._name;
    }

    public set name(value: string) {
        this._name = value;
    }

    public get dimensionName(): string {
        return this._dimensionName;
    }

    public set dimensionName(value: string) {
        this._dimensionName = value;
    }

    public get uniqueName(): string {
        return `[${this._dimensionName}].[${this._name}]`;
    }

    public get elements(): Element[] {
        return Array.from(this._elements.values());
    }

    public get elementNames(): string[] {
        return Array.from(this._elements.values()).map(e => e.name);
    }

    public get elementAttributes(): ElementAttribute[] {
        return this._elementAttributes;
    }

    public get edges(): Map<string, Map<string, number>> {
        return this._edges;
    }

    public get subsets(): string[] {
        return this._subsets;
    }

    public get balanced(): boolean {
        return this._balanced;
    }

    public set balanced(value: boolean) {
        this._balanced = value;
    }

    public get defaultMember(): string | undefined {
        return this._defaultMember;
    }

    public set defaultMember(value: string | undefined) {
        this._defaultMember = value;
    }

    public get body(): string {
        return JSON.stringify(this.constructBody());
    }

    public get bodyAsDict(): any {
        return this.constructBody();
    }

    private constructBody(): any {
        const body: any = {
            Name: this._name,
            Elements: this.elements.map(e => e.bodyAsDict),
            ElementAttributes: this._elementAttributes.map(ea => ea.bodyAsDict),
            Edges: this.constructEdges(),
            Subsets: this._subsets
        };

        if (this._defaultMember !== undefined) {
            body.DefaultMember = this._defaultMember;
        }

        body.Structure = this._balanced ? 0 : 1;

        return body;
    }

    private constructEdges(): any[] {
        const edges: any[] = [];

        for (const [parentName, children] of this._edges) {
            for (const [componentName, weight] of children) {
                edges.push({
                    ParentName: parentName,
                    ComponentName: componentName,
                    Weight: weight
                });
            }
        }

        return edges;
    }

    public addElement(element: Element): void {
        this._elements.set(lowerAndDropSpaces(element.name), element);
    }

    public removeElement(elementName: string): boolean {
        return this._elements.delete(lowerAndDropSpaces(elementName));
    }

    public getElement(elementName: string): Element | undefined {
        return this._elements.get(lowerAndDropSpaces(elementName));
    }

    public hasElement(elementName: string): boolean {
        return this._elements.has(lowerAndDropSpaces(elementName));
    }

    public addEdge(parentName: string, componentName: string, weight: number = 1): void {
        if (!this._edges.has(parentName)) {
            this._edges.set(parentName, new Map());
        }
        this._edges.get(parentName)!.set(componentName, weight);
    }

    public removeEdge(parentName: string, componentName: string): boolean {
        const children = this._edges.get(parentName);
        if (children) {
            const result = children.delete(componentName);
            if (children.size === 0) {
                this._edges.delete(parentName);
            }
            return result;
        }
        return false;
    }

    public getEdgeWeight(parentName: string, componentName: string): number | undefined {
        return this._edges.get(parentName)?.get(componentName);
    }

    public addElementAttribute(elementAttribute: ElementAttribute): void {
        this._elementAttributes.push(elementAttribute);
    }

    public removeElementAttribute(attributeName: string): boolean {
        const index = this._elementAttributes.findIndex(ea =>
            caseAndSpaceInsensitiveEquals(ea.name, attributeName));

        if (index !== -1) {
            this._elementAttributes.splice(index, 1);
            return true;
        }
        return false;
    }

    public getElementAttribute(attributeName: string): ElementAttribute | undefined {
        return this._elementAttributes.find(ea =>
            caseAndSpaceInsensitiveEquals(ea.name, attributeName));
    }

    public hasElementAttribute(attributeName: string): boolean {
        return this._elementAttributes.some(ea =>
            caseAndSpaceInsensitiveEquals(ea.name, attributeName));
    }

    public getAncestors(elementName: string, recursive: boolean = false): string[] {
        const normalizedTarget = lowerAndDropSpaces(elementName);
        const directParents: string[] = [];

        for (const [parent, children] of this._edges) {
            for (const child of children.keys()) {
                if (lowerAndDropSpaces(child) === normalizedTarget) {
                    directParents.push(parent);
                    break;
                }
            }
        }

        if (!recursive) {
            return directParents;
        }

        // BFS; uses non-recursive call to avoid re-scanning for already-visited ancestors
        const result = new Set<string>(directParents);
        const queue = [...directParents];
        while (queue.length > 0) {
            const current = queue.shift()!;
            for (const ancestor of this.getAncestors(current, false)) {
                if (!result.has(ancestor)) {
                    result.add(ancestor);
                    queue.push(ancestor);
                }
            }
        }
        return Array.from(result);
    }

    public getDescendants(elementName: string, recursive: boolean = false, leavesOnly: boolean = false): string[] {
        const normalizedTarget = lowerAndDropSpaces(elementName);
        const directChildren: string[] = [];

        for (const [parent, children] of this._edges) {
            if (lowerAndDropSpaces(parent) === normalizedTarget) {
                directChildren.push(...children.keys());
            }
        }

        let result: string[];
        if (recursive) {
            const seen = new Set<string>(directChildren);
            const queue = [...directChildren];
            while (queue.length > 0) {
                const current = queue.shift()!;
                // current comes directly from stored edge values; use O(1) Map lookup
                const grandChildren = this._edges.get(current);
                if (grandChildren) {
                    for (const child of grandChildren.keys()) {
                        if (!seen.has(child)) {
                            seen.add(child);
                            queue.push(child);
                        }
                    }
                }
            }
            result = Array.from(seen);
        } else {
            result = directChildren;
        }

        if (leavesOnly) {
            const allParents = new Set(Array.from(this._edges.keys()).map(lowerAndDropSpaces));
            return result.filter(d => !allParents.has(lowerAndDropSpaces(d)));
        }
        return result;
    }

    private buildEdgeMap(elements: string[]): Map<string, Map<string, number>> {
        const result = new Map<string, Map<string, number>>();
        for (const element of elements) {
            // elements come from stored edge keys/values; O(1) lookup suffices
            const children = this._edges.get(element);
            if (children) {
                result.set(element, new Map(children));
            }
        }
        return result;
    }

    public getDescendantEdges(elementName: string, recursive: boolean = false): Map<string, Map<string, number>> {
        return this.buildEdgeMap(this.getDescendants(elementName, recursive));
    }

    public getAncestorEdges(elementName: string, recursive: boolean = false): Map<string, Map<string, number>> {
        return this.buildEdgeMap(this.getAncestors(elementName, recursive));
    }

    public replaceElement(oldName: string, newName: string): void {
        const normalizedOld = lowerAndDropSpaces(oldName);

        // Rename in _elements
        const oldKey = Array.from(this._elements.keys()).find(
            k => lowerAndDropSpaces(k) === normalizedOld
        );
        if (oldKey) {
            const element = this._elements.get(oldKey)!;
            element.name = newName;
            this._elements.delete(oldKey);
            this._elements.set(lowerAndDropSpaces(newName), element);
        }

        // Rebuild edges replacing all occurrences of oldName
        const newEdges = new Map<string, Map<string, number>>();
        for (const [parent, children] of this._edges) {
            const newParent = lowerAndDropSpaces(parent) === normalizedOld ? newName : parent;
            const newChildren = new Map<string, number>();
            for (const [child, weight] of children) {
                const newChild = lowerAndDropSpaces(child) === normalizedOld ? newName : child;
                newChildren.set(newChild, weight);
            }
            newEdges.set(newParent, newChildren);
        }
        this._edges = newEdges;
    }

    public addComponent(parent: string, component: string, weight: number = 1): void {
        const parentElement = this.getElement(parent);
        if (!parentElement) {
            throw new Error(`Parent element '${parent}' not found in hierarchy`);
        }
        if (parentElement.elementType === ElementType.STRING) {
            throw new Error(`Parent element '${parent}' is of type String and cannot have components`);
        }
        this.addEdge(parent, component, weight);
    }

    public *[Symbol.iterator](): Iterator<Element> {
        yield* this._elements.values();
    }

    public get length(): number {
        return this._elements.size;
    }
}
