import { TM1Object } from './TM1Object';

export enum HitMode {
    BREAK_ALWAYS = 'BreakAlways',
    BREAK_EQUAL = 'BreakEqual',
    BREAK_GREATER_OR_EQUAL = 'BreakGreaterOrEqual'
}

export enum BreakPointType {
    // A breakpoint that pauses execution when the named variable is written to
    PROCESS_DEBUG_CONTEXT_DATA_BREAK_POINT = "ProcessDebugContextDataBreakpoint",
    // A breakpoint that pauses execution at a specific script line
    PROCESS_DEBUG_CONTEXT_LINE_BREAK_POINT = "ProcessDebugContextLineBreakpoint",
    // A breakpoint that pauses execution when an object lock is acquired.
    PROCESS_DEBUG_CONTEXT_LOCK_BREAK_POINT = "ProcessDebugContextLockBreakpoint"
}

export class ProcessDebugBreakpoint extends TM1Object {
    /** Abstraction of a TM1 Process Debug Breakpoint.
     *
     */

    private _type: BreakPointType;
    private _id: number;
    private _enabled: boolean;
    private _hitMode: HitMode;
    private _hitCount: number;
    private _expression: string;
    private _variableName: string;
    private _processName: string;
    private _procedure: string;
    private _lineNumber: number;
    private _objectName: string;
    private _objectType: string;
    private _lockMode: string;

    constructor(
        breakpointId: number,
        breakpointType: BreakPointType | string = BreakPointType.PROCESS_DEBUG_CONTEXT_LINE_BREAK_POINT,
        enabled: boolean = true,
        hitMode: HitMode | string = HitMode.BREAK_ALWAYS,
        hitCount: number = 0,
        expression: string = '',
        variableName: string = '',
        processName: string = '',
        procedure: string = '',
        lineNumber: number = 0,
        objectName: string = '',
        objectType: string = '',
        lockMode: string = ''
    ) {
        super();
        this._type = this.parseBreakPointType(breakpointType);
        this._id = breakpointId;
        this._enabled = enabled;
        this._hitMode = this.parseHitMode(hitMode);
        this._hitCount = hitCount;
        this._expression = expression;
        this._variableName = variableName;
        this._processName = processName;
        this._procedure = procedure;
        this._lineNumber = lineNumber;
        this._objectName = objectName;
        this._objectType = objectType;
        this._lockMode = lockMode;
    }

    private parseBreakPointType(breakpointType: BreakPointType | string): BreakPointType {
        if (typeof breakpointType === 'string') {
            for (const member of Object.values(BreakPointType)) {
                if (member.toLowerCase() === breakpointType.replace(/\s+/g, '').toLowerCase()) {
                    return member;
                }
            }
            throw new Error(`Invalid BreakPointType: '${breakpointType}'`);
        }
        return breakpointType;
    }

    private parseHitMode(hitMode: HitMode | string): HitMode {
        if (typeof hitMode === 'string') {
            for (const member of Object.values(HitMode)) {
                if (member.toLowerCase() === hitMode.replace(/\s+/g, '').toLowerCase()) {
                    return member;
                }
            }
            throw new Error(`Invalid HitMode: '${hitMode}'`);
        }
        return hitMode;
    }

    public static fromDict(breakpointAsDict: any): ProcessDebugBreakpoint {
        /**
         *
         * :param breakpoint_as_dict
         * :return: an instance of this class
         */
        const breakpointType = breakpointAsDict['@odata.type'].substring(16);
        return new ProcessDebugBreakpoint(
            breakpointAsDict['ID'],
            breakpointType,
            breakpointAsDict['Enabled'],
            breakpointAsDict['HitMode'],
            breakpointAsDict['HitCount'],
            breakpointAsDict['Expression'],
            breakpointType === "ProcessDebugContextDataBreakpoint" ? breakpointAsDict['VariableName'] : "",
            breakpointType === "ProcessDebugContextLineBreakpoint" ? breakpointAsDict['ProcessName'] : "",
            breakpointType === "ProcessDebugContextLineBreakpoint" ? breakpointAsDict['Procedure'] : "",
            breakpointType === "ProcessDebugContextLineBreakpoint" ? breakpointAsDict['LineNumber'] : 0,
            breakpointType === "ProcessDebugContextLockBreakpoint" ? breakpointAsDict['ObjectName'] : "",
            breakpointType === "ProcessDebugContextLockBreakpoint" ? breakpointAsDict['ObjectType'] : "",
            breakpointType === "ProcessDebugContextLockBreakpoint" ? breakpointAsDict['LockMode'] : ""
        );
    }

    public get breakpointType(): string {
        return this._type.toString();
    }

    public get breakpointId(): number {
        return this._id;
    }

    public get enabled(): boolean {
        return this._enabled;
    }

    public set enabled(value: boolean) {
        this._enabled = value;
    }

    public get hitMode(): string {
        return this._hitMode.toString();
    }

    public set hitMode(value: HitMode | string) {
        this._hitMode = this.parseHitMode(value);
    }

    public get hitCount(): number {
        return this._hitCount;
    }

    public get expression(): string {
        return this._expression;
    }

    public set expression(value: string) {
        this._expression = value;
    }

    public get variableName(): string {
        return this._variableName;
    }

    public set variableName(value: string) {
        this._variableName = value;
    }

    public get processName(): string {
        return this._processName;
    }

    public set processName(value: string) {
        this._processName = value;
    }

    public get procedure(): string {
        return this._procedure;
    }

    public set procedure(value: string) {
        this._procedure = value;
    }

    public get lineNumber(): number {
        return this._lineNumber;
    }

    public set lineNumber(value: number) {
        this._lineNumber = value;
    }

    public get objectName(): string {
        return this._objectName;
    }

    public set objectName(value: string) {
        this._objectName = value;
    }

    public get objectType(): string {
        return this._objectType;
    }

    public set objectType(value: string) {
        this._objectType = value;
    }

    public get lockMode(): string {
        return this._lockMode;
    }

    public set lockMode(value: string) {
        this._lockMode = value;
    }

    public get body(): string {
        return JSON.stringify(this.constructBody());
    }

    public get bodyAsDict(): any {
        return this.constructBody();
    }

    private constructBody(): any {
        const bodyAsDict: any = {
            '@odata.type': "#ibm.tm1.api.v1." + this._type,
            'ID': this._id,
            'Enabled': this._enabled,
            'HitMode': this._hitMode.toString(),
            'Expression': this._expression
        };

        if (this._type === BreakPointType.PROCESS_DEBUG_CONTEXT_DATA_BREAK_POINT) {
            bodyAsDict['VariableName'] = this._variableName;
        } else if (this._type === BreakPointType.PROCESS_DEBUG_CONTEXT_LINE_BREAK_POINT) {
            bodyAsDict['ProcessName'] = this._processName;
            bodyAsDict['Procedure'] = this._procedure;
            bodyAsDict['LineNumber'] = this._lineNumber;
        } else if (this._type === BreakPointType.PROCESS_DEBUG_CONTEXT_LOCK_BREAK_POINT) {
            bodyAsDict['ObjectName'] = this._objectName;
            bodyAsDict['ObjectType'] = this._objectType;
            bodyAsDict['LockMode'] = this._lockMode;
        }

        return bodyAsDict;
    }
}