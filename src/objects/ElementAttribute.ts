import { TM1Object } from './TM1Object';

export enum ElementAttributeType {
    NUMERIC = 1,
    STRING = 2,
    ALIAS = 3
}

export class ElementAttribute extends TM1Object {
    private _name: string;
    private _attributeType: ElementAttributeType;

    constructor(name: string, attributeType: ElementAttributeType | string) {
        super();
        this._name = name;
        this._attributeType = this.parseAttributeType(attributeType);
    }

    private parseAttributeType(attributeType: ElementAttributeType | string): ElementAttributeType {
        if (typeof attributeType === 'string') {
            const lowerType = attributeType.toLowerCase().replace(/\s+/g, '');
            switch (lowerType) {
                case 'numeric':
                    return ElementAttributeType.NUMERIC;
                case 'string':
                    return ElementAttributeType.STRING;
                case 'alias':
                    return ElementAttributeType.ALIAS;
                default:
                    throw new Error(`Invalid attribute type: '${attributeType}'`);
            }
        }
        return attributeType;
    }

    public static fromJSON(elementAttributeAsJson: string): ElementAttribute {
        return ElementAttribute.fromDict(JSON.parse(elementAttributeAsJson));
    }

    public static fromDict(elementAttributeAsDict: any): ElementAttribute {
        return new ElementAttribute(
            elementAttributeAsDict.Name,
            elementAttributeAsDict.Type
        );
    }

    public get name(): string {
        return this._name;
    }

    public set name(value: string) {
        this._name = value;
    }

    public get attributeType(): string {
        return this.attributeTypeToString(this._attributeType);
    }

    public set attributeType(value: ElementAttributeType | string) {
        this._attributeType = this.parseAttributeType(value);
    }

    public get attributeTypeEnum(): ElementAttributeType {
        return this._attributeType;
    }

    public get body(): string {
        return JSON.stringify(this.bodyAsDict);
    }

    public get bodyAsDict(): any {
        return {
            Name: this._name,
            Type: this.attributeType
        };
    }

    private attributeTypeToString(attributeType: ElementAttributeType): string {
        switch (attributeType) {
            case ElementAttributeType.NUMERIC:
                return 'Numeric';
            case ElementAttributeType.STRING:
                return 'String';
            case ElementAttributeType.ALIAS:
                return 'Alias';
            default:
                return 'String';
        }
    }

    public isNumeric(): boolean {
        return this._attributeType === ElementAttributeType.NUMERIC;
    }

    public isString(): boolean {
        return this._attributeType === ElementAttributeType.STRING;
    }

    public isAlias(): boolean {
        return this._attributeType === ElementAttributeType.ALIAS;
    }

    public equals(other: TM1Object): boolean {
        if (other instanceof ElementAttribute) {
            return this._name.toLowerCase().replace(/\s+/g, '') === 
                   other._name.toLowerCase().replace(/\s+/g, '');
        }
        return false;
    }

    public equalsString(other: string): boolean {
        return this._name.toLowerCase().replace(/\s+/g, '') === 
               other.toLowerCase().replace(/\s+/g, '');
    }
}