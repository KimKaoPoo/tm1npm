import { TM1Object } from './TM1Object';

export enum ElementType {
    NUMERIC = 1,
    STRING = 2,
    CONSOLIDATED = 3
}

export class Element extends TM1Object {
    public static readonly ELEMENT_ATTRIBUTES_PREFIX = "}ElementAttributes_";

    private _name: string;
    private _uniqueName?: string;
    private _index?: number;
    private _elementType: ElementType;
    private _attributes?: string[];

    constructor(
        name: string,
        elementType: ElementType | string,
        attributes?: string[],
        uniqueName?: string,
        index?: number
    ) {
        super();
        this._name = name;
        this._uniqueName = uniqueName;
        this._index = index;
        this._elementType = this.parseElementType(elementType);
        this._attributes = attributes;
    }

    private parseElementType(elementType: ElementType | string): ElementType {
        if (typeof elementType === 'string') {
            const lowerType = elementType.toLowerCase().replace(/\s+/g, '');
            switch (lowerType) {
                case 'numeric':
                    return ElementType.NUMERIC;
                case 'string':
                    return ElementType.STRING;
                case 'consolidated':
                    return ElementType.CONSOLIDATED;
                default:
                    throw new Error(`Invalid element type: '${elementType}'`);
            }
        }
        return elementType;
    }

    public static fromDict(elementAsDict: any): Element {
        return new Element(
            elementAsDict.Name,
            elementAsDict.Type,
            elementAsDict.Attributes,
            elementAsDict.UniqueName,
            elementAsDict.Index
        );
    }

    public get name(): string {
        return this._name;
    }

    public set name(value: string) {
        this._name = value;
    }

    public get uniqueName(): string | undefined {
        return this._uniqueName;
    }

    public set uniqueName(value: string | undefined) {
        this._uniqueName = value;
    }

    public get index(): number | undefined {
        return this._index;
    }

    public set index(value: number | undefined) {
        this._index = value;
    }

    public get elementType(): ElementType {
        return this._elementType;
    }

    public set elementType(value: ElementType | string) {
        this._elementType = this.parseElementType(value);
    }

    public get attributes(): string[] | undefined {
        return this._attributes;
    }

    public set attributes(value: string[] | undefined) {
        this._attributes = value;
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
            Type: this.elementTypeToString(this._elementType)
        };

        if (this._uniqueName !== undefined) {
            body.UniqueName = this._uniqueName;
        }

        if (this._index !== undefined) {
            body.Index = this._index;
        }

        if (this._attributes !== undefined) {
            body.Attributes = this._attributes;
        }

        return body;
    }

    private elementTypeToString(elementType: ElementType): string {
        switch (elementType) {
            case ElementType.NUMERIC:
                return 'Numeric';
            case ElementType.STRING:
                return 'String';
            case ElementType.CONSOLIDATED:
                return 'Consolidated';
            default:
                return 'String';
        }
    }

    public isNumeric(): boolean {
        return this._elementType === ElementType.NUMERIC;
    }

    public isString(): boolean {
        return this._elementType === ElementType.STRING;
    }

    public isConsolidated(): boolean {
        return this._elementType === ElementType.CONSOLIDATED;
    }
}