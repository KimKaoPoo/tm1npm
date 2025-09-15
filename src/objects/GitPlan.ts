import { GitCommit } from './GitCommit';

export class GitPlan {
    /** Base GitPlan abstraction
     */

    private _planId: string;
    private _branch: string;
    private _force: boolean;

    constructor(planId: string, branch: string, force: boolean) {
        /** Initialize GitPlan object
         * :param plan_id: id of the Plan
         * :param branch: current branch
         * :param force: force git context reset
         */
        this._planId = planId;
        this._branch = branch;
        this._force = force;
    }

    public get planId(): string {
        return this._planId;
    }

    public get branch(): string {
        return this._branch;
    }

    public get force(): boolean {
        return this._force;
    }
}


export class GitPushPlan extends GitPlan {
    /** GitPushPlan abstraction based on GitPlan
     */

    private _newBranch: string;
    private _newCommit: GitCommit;
    private _parentCommit: GitCommit;
    private _sourceFiles: string[];

    constructor(
        planId: string,
        branch: string,
        force: boolean,
        newBranch: string,
        newCommit: GitCommit,
        parentCommit: GitCommit,
        sourceFiles: string[]
    ) {
        /** Initialize GitPushPlan object
         * :param plan_id: id of the PushPlan
         * :param branch: current branch to base the pushplan on
         * :param force: force git context reset
         * :param new_branch: the new branch that will be pushed to
         * :param new_commit: GitCommit of the new commit
         * :param parent_commit: The current commit in the branch
         * :param source_files: list of included files in the push
         */
        super(planId, branch, force);
        this._newBranch = newBranch;
        this._newCommit = newCommit;
        this._parentCommit = parentCommit;
        this._sourceFiles = sourceFiles;
    }

    public get newBranch(): string {
        return this._newBranch;
    }

    public get newCommit(): GitCommit {
        return this._newCommit;
    }

    public get parentCommit(): GitCommit {
        return this._parentCommit;
    }

    public get sourceFiles(): string[] {
        return this._sourceFiles;
    }
}


export class GitPullPlan extends GitPlan {
    /** GitPushPlan abstraction based on GitPlan
     */

    private _commit: GitCommit;
    private _operations: string[];

    constructor(
        planId: string,
        branch: string,
        force: boolean,
        commit: GitCommit,
        operations: string[]
    ) {
        /** Initialize GitPushPlan object
         * :param plan_id: id of the PullPlan
         * :param branch: current branch to base the pullplan on
         * :param force: force git context reset
         * :param commit: GitCommit of the commit to pull
         * :param operations: list of changes made upon pulling
         */
        super(planId, branch, force);
        this._commit = commit;
        this._operations = operations;
    }

    public get commit(): GitCommit {
        return this._commit;
    }

    public get operations(): string[] {
        return this._operations;
    }
}