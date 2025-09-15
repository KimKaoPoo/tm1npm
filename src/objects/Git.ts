import { GitCommit } from './GitCommit';
import { GitRemote } from './GitRemote';

export class Git {
    /** Abstraction of Git object
     */

    private _url: string;
    private _deployment: string;
    private _force: boolean;
    private _deployedCommit: GitCommit;
    private _remote: GitRemote;
    private _config?: Record<string, any>;

    constructor(
        url: string,
        deployment: string,
        force: boolean,
        deployedCommit: GitCommit,
        remote: GitRemote,
        config?: Record<string, any>
    ) {
        /** Initialize GIT object
         * :param url: file or http(s) path to GIT repository
         * :param deployment: name of selected deployment group
         * :param force: whether or not Git context was forced
         * :param deployed_commit: GitCommit object of the currently deployed commit
         * :param remote: GitRemote object of the current remote
         * :param config: Dictionary containing git configuration parameters
         */
        this._url = url;
        this._deployment = deployment;
        this._force = force;
        this._deployedCommit = deployedCommit;
        this._remote = remote;
        this._config = config;
    }

    public get url(): string {
        return this._url;
    }

    public get force(): boolean {
        return this._force;
    }

    public get config(): Record<string, any> | undefined {
        return this._config;
    }

    public get deployment(): string {
        return this._deployment;
    }

    public get deployedCommit(): GitCommit {
        return this._deployedCommit;
    }

    public get remote(): GitRemote {
        return this._remote;
    }

    public static fromDict(jsonResponse: any): Git {
        const deployedCommit = new GitCommit(
            jsonResponse["DeployedCommit"].ID,
            jsonResponse["DeployedCommit"].Summary,
            jsonResponse["DeployedCommit"].Author
        );

        const remote = new GitRemote(
            jsonResponse["Remote"].Connected,
            jsonResponse["Remote"].Branches,
            jsonResponse["Remote"].Tags
        );

        const git = new Git(
            jsonResponse["URL"],
            jsonResponse["Deployment"],
            jsonResponse["Deployment"],
            deployedCommit,
            remote
        );

        return git;
    }
}