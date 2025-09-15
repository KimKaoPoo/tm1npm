import { TM1Object } from './TM1Object';

export class Sandbox extends TM1Object {
    /** Abstraction of a TM1 Sandbox
     *        
     */

    private _name!: string;
    private _includeInSandboxDimension!: boolean;
    public loaded: boolean;
    public active: boolean;
    public queued: boolean;

    constructor(
        name: string,
        includeInSandboxDimension: boolean = true,
        loaded: boolean = false,
        active: boolean = false,
        queued: boolean = false
    ) {
        /**
         * 
         * :param name: name of the Sandbox
         * :param include_in_sandbox_dimension:
         * :params loaded, active, queued: leave default as false when creating sandbox 
         */
        super();
        this.name = name;
        this.includeInSandboxDimension = includeInSandboxDimension;
        this.loaded = loaded;
        this.active = active;
        this.queued = queued;
    }

    public get name(): string {
        return this._name;
    }

    public set name(value: string) {
        this._name = value;
    }

    public get includeInSandboxDimension(): boolean {
        return this._includeInSandboxDimension;
    }

    public set includeInSandboxDimension(value: boolean) {
        this._includeInSandboxDimension = value;
    }

    public static fromJSON(sandboxAsJson: string): Sandbox {
        /** Alternative constructor
         *
         * :param sandbox_as_json: user as JSON string
         * :return: sandbox, an instance of this class
         */
        const sandboxAsDict = JSON.parse(sandboxAsJson);
        return Sandbox.fromDict(sandboxAsDict);
    }

    public static fromDict(sandboxAsDict: any): Sandbox {
        /** Alternative constructor
         *
         * :param sandbox_as_dict: user as dict
         * :return: an instance of this class
         */
        return new Sandbox(
            sandboxAsDict.Name,
            sandboxAsDict.IncludeInSandboxDimension,
            sandboxAsDict.IsLoaded,
            sandboxAsDict.IsActive,
            sandboxAsDict.IsQueued
        );
    }

    public get body(): string {
        return this.constructBody();
    }

    private constructBody(): string {
        /**
         * construct body (json) from the class attributes
         * :return: String, TM1 JSON representation of a sandbox
         */
        const bodyAsDict: any = {};
        bodyAsDict.Name = this.name;
        bodyAsDict.IncludeInSandboxDimension = this._includeInSandboxDimension;
        return JSON.stringify(bodyAsDict);
    }
}