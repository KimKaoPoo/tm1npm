import { TM1Object } from './TM1Object';
import { Element } from './Element';
import { ElementAttribute } from './ElementAttribute';

export class Hierarchy extends TM1Object {
    private _name: string;
    private _dimensionName: string;
    private _elements: Map<string, Element> = new Map();
    private _elementAttributes: ElementAttribute[] = [];
    private _edges: Map<string, number> = new Map();
    private _subsets: string[] = [];
    private _balanced: boolean = false;
    private _defaultMember?: string;

    constructor(
        name: string,
        dimensionName: string,
        elements?: Element[],
        elementAttributes?: ElementAttribute[],
        edges?: Map<string, number>,
        subsets?: string[],
        structure?: number,
        defaultMember?: string
    ) {
        super();
        this._name = name;
        this._dimensionName = dimensionName;
        
        if (elements) {
            for (const elem of elements) {
                this._elements.set(elem.name.toLowerCase(), elem);
            }
        }
        
        this._elementAttributes = elementAttributes ? [...elementAttributes] : [];
        this._edges = edges ? new Map(edges) : new Map();
        this._subsets = subsets ? [...subsets] : [];
        this._balanced = structure !== undefined ? structure === 0 : false;
        this._defaultMember = defaultMember;
    }

    public static fromDict(hierarchyAsDict: any, dimensionName: string): Hierarchy {
        const elements = hierarchyAsDict.Elements ? 
            hierarchyAsDict.Elements.map((e: any) => Element.fromDict(e)) : [];
        
        const elementAttributes = hierarchyAsDict.ElementAttributes ? 
            hierarchyAsDict.ElementAttributes.map((ea: any) => ElementAttribute.fromDict(ea)) : [];
        
        const edges = new Map<string, number>();
        if (hierarchyAsDict.Edges) {
            for (const edge of hierarchyAsDict.Edges) {
                const key = `${edge.ParentName}:${edge.ComponentName}`;
                edges.set(key, edge.Weight || 1);
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
        return Array.from(this._elements.keys());
    }

    public get elementAttributes(): ElementAttribute[] {
        return this._elementAttributes;
    }

    public get edges(): Map<string, number> {
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
        
        for (const [key, weight] of this._edges) {
            const [parentName, componentName] = key.split(':');
            edges.push({
                ParentName: parentName,
                ComponentName: componentName,
                Weight: weight
            });
        }
        
        return edges;
    }

    public addElement(element: Element): void {
        this._elements.set(element.name.toLowerCase(), element);
    }

    public removeElement(elementName: string): boolean {
        return this._elements.delete(elementName.toLowerCase());
    }

    public getElement(elementName: string): Element | undefined {
        return this._elements.get(elementName.toLowerCase());
    }

    public hasElement(elementName: string): boolean {
        return this._elements.has(elementName.toLowerCase());
    }

    public addEdge(parentName: string, componentName: string, weight: number = 1): void {
        const key = `${parentName}:${componentName}`;
        this._edges.set(key, weight);
    }

    public removeEdge(parentName: string, componentName: string): boolean {
        const key = `${parentName}:${componentName}`;
        return this._edges.delete(key);
    }

    public getEdgeWeight(parentName: string, componentName: string): number | undefined {
        const key = `${parentName}:${componentName}`;
        return this._edges.get(key);
    }

    public addElementAttribute(elementAttribute: ElementAttribute): void {
        this._elementAttributes.push(elementAttribute);
    }

    public removeElementAttribute(attributeName: string): boolean {
        const index = this._elementAttributes.findIndex(ea => 
            ea.name.toLowerCase() === attributeName.toLowerCase());
        
        if (index !== -1) {
            this._elementAttributes.splice(index, 1);
            return true;
        }
        return false;
    }

    public getElementAttribute(attributeName: string): ElementAttribute | undefined {
        return this._elementAttributes.find(ea => 
            ea.name.toLowerCase() === attributeName.toLowerCase());
    }

    public hasElementAttribute(attributeName: string): boolean {
        return this._elementAttributes.some(ea => 
            ea.name.toLowerCase() === attributeName.toLowerCase());
    }

    public *[Symbol.iterator](): Iterator<Element> {
        yield* this._elements.values();
    }

    public get length(): number {
        return this._elements.size;
    }
}