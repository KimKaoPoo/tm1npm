export class GitRemote {
    /** Abstraction of GitRemote
     */

    private _connected: boolean;
    private _branches: string[];
    private _tags: string[];

    constructor(connected: boolean, branches: string[], tags: string[]) {
        /** Initialize GitRemote object
         * :param connected: is Git connected to remote
         * :param branches: list of remote branches
         * :param tags: list of remote tags
         */
        this._connected = connected;
        this._branches = branches;
        this._tags = tags;
    }

    public get connected(): boolean {
        return this._connected;
    }

    public get branches(): string[] {
        return this._branches;
    }

    public get tags(): string[] {
        return this._tags;
    }
}