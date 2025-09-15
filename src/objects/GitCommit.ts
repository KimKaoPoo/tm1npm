export class GitCommit {
    /** Abstraction of Git Commit
     */

    private _commitId: string;
    private _summary: string;
    private _author: string;

    constructor(commitId: string, summary: string, author: string) {
        /** Initialize GitCommit object
         * :param commit_id: id of the commit
         * :param summary: commit message
         * :param author: the author of the commit
         */
        this._commitId = commitId;
        this._summary = summary;
        this._author = author;
    }

    public get commitId(): string {
        return this._commitId;
    }

    public get summary(): string {
        return this._summary;
    }

    public get author(): string {
        return this._author;
    }
}