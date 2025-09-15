import { TM1Object } from './TM1Object';

export enum ProcessParameterType {
    String = 'String',
    Numeric = 'Numeric'
}

export class ProcessParameter extends TM1Object {
    private _name: string;
    private _prompt: string;
    private _value: string | number;
    private _type: ProcessParameterType;

    constructor(
        name: string,
        prompt: string = '',
        value: string | number = '',
        type: ProcessParameterType = ProcessParameterType.String
    ) {
        super();
        this._name = name;
        this._prompt = prompt;
        this._value = value;
        this._type = type;
    }

    public get name(): string {
        return this._name;
    }

    public set name(name: string) {
        this._name = name;
    }

    public get prompt(): string {
        return this._prompt;
    }

    public set prompt(prompt: string) {
        this._prompt = prompt;
    }

    public get value(): string | number {
        return this._value;
    }

    public set value(value: string | number) {
        this._value = value;
    }

    public get type(): ProcessParameterType {
        return this._type;
    }

    public set type(type: ProcessParameterType) {
        this._type = type;
    }

    public get body(): string {
        return JSON.stringify({
            Name: this._name,
            Prompt: this._prompt,
            Value: this._value,
            Type: this._type
        });
    }

    public static fromDict(parameterAsDict: any): ProcessParameter {
        return new ProcessParameter(
            parameterAsDict.Name,
            parameterAsDict.Prompt || '',
            parameterAsDict.Value || '',
            parameterAsDict.Type || ProcessParameterType.String
        );
    }
}