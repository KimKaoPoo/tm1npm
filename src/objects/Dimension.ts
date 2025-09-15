import { TM1Object } from './TM1Object';
import { Hierarchy } from './Hierarchy';

export class Dimension extends TM1Object {
    private _name: string;
    private _hierarchies: Hierarchy[] = [];
    private _attributes: Record<string, any> = {};

    constructor(name: string, hierarchies?: Hierarchy[]) {
        super();
        this._name = name;
        this._hierarchies = hierarchies ? [...hierarchies] : [];
        this._attributes = { Caption: name };
    }

    public static fromJSON(dimensionAsJson: string): Dimension {
        const dimensionAsDict = JSON.parse(dimensionAsJson);
        return Dimension.fromDict(dimensionAsDict);
    }

    public static fromDict(dimensionAsDict: any): Dimension {
        const hierarchies = dimensionAsDict.Hierarchies ? 
            dimensionAsDict.Hierarchies.map((h: any) => 
                Hierarchy.fromDict(h, dimensionAsDict.Name)) : [];
        
        return new Dimension(dimensionAsDict.Name, hierarchies);
    }

    public get name(): string {
        return this._name;
    }

    public set name(value: string) {
        for (const hierarchy of this._hierarchies) {
            hierarchy.dimensionName = value;
            if (hierarchy.name === this._name) {
                hierarchy.name = value;
            }
        }
        this._name = value;
    }

    public get uniqueName(): string {
        return '[' + this._name + ']';
    }

    public get hierarchies(): Hierarchy[] {
        return this._hierarchies;
    }

    public get hierarchyNames(): string[] {
        return this._hierarchies.map(h => h.name);
    }

    public get defaultHierarchy(): Hierarchy | undefined {
        return this._hierarchies[0];
    }

    public get body(): string {
        return JSON.stringify(this.constructBody());
    }

    public get bodyAsDict(): any {
        return this.constructBody();
    }

    private constructBody(): any {
        return {
            Name: this._name,
            Hierarchies: this._hierarchies.map(h => h.bodyAsDict)
        };
    }

    public addHierarchy(hierarchy: Hierarchy): void {
        hierarchy.dimensionName = this._name;
        this._hierarchies.push(hierarchy);
    }

    public removeHierarchy(hierarchyName: string): boolean {
        const index = this._hierarchies.findIndex(h => 
            h.name.toLowerCase() === hierarchyName.toLowerCase());
        
        if (index !== -1) {
            this._hierarchies.splice(index, 1);
            return true;
        }
        return false;
    }

    public getHierarchy(hierarchyName: string): Hierarchy | undefined {
        return this._hierarchies.find(h => 
            h.name.toLowerCase() === hierarchyName.toLowerCase());
    }

    public hasHierarchy(hierarchyName: string): boolean {
        return this._hierarchies.some(h => 
            h.name.toLowerCase() === hierarchyName.toLowerCase());
    }

    public *[Symbol.iterator](): Iterator<Hierarchy> {
        yield* this._hierarchies;
    }

    public get length(): number {
        return this._hierarchies.length;
    }
}