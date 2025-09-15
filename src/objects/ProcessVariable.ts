import { TM1Object } from './TM1Object';

export enum ProcessVariableType {
    String = 'String',
    Numeric = 'Numeric'
}

export class ProcessVariable extends TM1Object {
    private _name: string;
    private _type: ProcessVariableType;
    private _position: number;
    private _startByte: number;
    private _endByte: number;

    constructor(
        name: string,
        type: ProcessVariableType = ProcessVariableType.String,
        position: number = 1,
        startByte: number = 1,
        endByte: number = 8
    ) {
        super();
        this._name = name;
        this._type = type;
        this._position = position;
        this._startByte = startByte;
        this._endByte = endByte;
    }

    public get name(): string {
        return this._name;
    }

    public set name(name: string) {
        this._name = name;
    }

    public get type(): ProcessVariableType {
        return this._type;
    }

    public set type(type: ProcessVariableType) {
        this._type = type;
    }

    public get position(): number {
        return this._position;
    }

    public set position(position: number) {
        this._position = position;
    }

    public get startByte(): number {
        return this._startByte;
    }

    public set startByte(startByte: number) {
        this._startByte = startByte;
    }

    public get endByte(): number {
        return this._endByte;
    }

    public set endByte(endByte: number) {
        this._endByte = endByte;
    }

    public get body(): string {
        return JSON.stringify({
            Name: this._name,
            Type: this._type,
            Position: this._position,
            StartByte: this._startByte,
            EndByte: this._endByte
        });
    }

    public static fromDict(variableAsDict: any): ProcessVariable {
        return new ProcessVariable(
            variableAsDict.Name,
            variableAsDict.Type || ProcessVariableType.String,
            variableAsDict.Position || 1,
            variableAsDict.StartByte || 1,
            variableAsDict.EndByte || 8
        );
    }
}