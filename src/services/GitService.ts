import { AxiosResponse } from 'axios';
import { RestService } from './RestService';
import { ObjectService } from './ObjectService';
import { Git } from '../objects/Git';
import { GitCommit } from '../objects/GitCommit';
import { GitPlan, GitPushPlan, GitPullPlan } from '../objects/GitPlan';
import { TM1Project } from '../objects/TM1Project';
import { formatUrl } from '../utils/Utils';

export class GitService extends ObjectService {
    /** Service to interact with GIT
     */
    
    private static readonly COMMON_PARAMETERS = {
        'username': 'Username', 
        'password': 'Password', 
        'message': 'Message', 
        'author': 'Author',
        'email': 'Email', 
        'branch': 'Branch', 
        'new_branch': 'NewBranch', 
        'force': 'Force',
        'public_key': 'PublicKey', 
        'private_key': 'PrivateKey', 
        'passphrase': 'Passphrase',
        'config': 'Config'
    };

    constructor(rest: RestService) {
        super(rest);
    }
        
    public async tm1projectGet(): Promise<TM1Project | null> {
        const url = '/!tm1project';
        const response = await this.rest.get(url);
        const data = this.toJson(response.data);
        if (!data || Object.keys(data).length === 0) {
            return null;
        }
        return TM1Project.fromDict(data);
    }

    public async tm1projectDelete(): Promise<TM1Project> {
        const url = '/!tm1project';
        const emptyDict = {};
        const response = await this.rest.put(url, JSON.stringify(emptyDict));
        return TM1Project.fromDict(this.toJson(response.data));
    }
        
    public async tm1projectPut(tm1Project: TM1Project): Promise<TM1Project> {
        const url = '/!tm1project';
        const bodyJson = tm1Project.body;

        // we need to ensure that async_requests_mode=False for this specific request as the response will not include
        // the Location field with the async_id.
        const response = await this.rest.put(url, bodyJson, {
            // Disable async mode for this specific request
            headers: { 'TM1-Async': 'false' }
        });
        return TM1Project.fromDict(this.toJson(response.data));
    }

    public async gitInit(
        gitUrl: string, 
        deployment: string, 
        username?: string, 
        password?: string,
        publicKey?: string, 
        privateKey?: string, 
        passphrase?: string, 
        force?: boolean,
        config?: Record<string, any>
    ): Promise<Git> {
        /** Initialize GIT service, returns Git object
         * :param git_url: file or http(s) path to GIT repository
         * :param deployment: name of selected deployment group
         * :param username: GIT username
         * :param password: GIT password
         * :param public_key: SSH public key, available from PAA V2.0.9.4
         * :param private_key: SSH private key, available from PAA V2.0.9.4
         * :param passphrase: Passphrase for decrypting private key, if set
         * :param force: reset git context on True
         * :param config: Dictionary containing git configuration parameters
         */
        const url = "/GitInit";
        const body: Record<string, any> = { 'URL': gitUrl, 'Deployment': deployment };

        const locals: Record<string, any> = {
            username, password, public_key: publicKey, private_key: privateKey, 
            passphrase, force, config
        };

        for (const [key, value] of Object.entries(locals)) {
            if (value !== undefined && key in GitService.COMMON_PARAMETERS) {
                body[GitService.COMMON_PARAMETERS[key as keyof typeof GitService.COMMON_PARAMETERS]] = value;
            }
        }

        const bodyJson = JSON.stringify(body);
        const response = await this.rest.post(url, bodyJson);

        return Git.fromDict(this.toJson(response.data));
    }

    public async gitUninit(force: boolean = false): Promise<AxiosResponse> {
        /** Unitialize GIT service
         *
         * :param force: clean up git context when True
         */
        const url = "/GitUninit";
        const body = JSON.stringify(force);
        return await this.rest.post(url, body);
    }

    public async gitStatus(
        username?: string, 
        password?: string, 
        publicKey?: string, 
        privateKey?: string,
        passphrase?: string
    ): Promise<Git> {
        /** Get GIT status, returns Git object
         * :param username: GIT username
         * :param password: GIT password
         * :param public_key: SSH public key, available from PAA V2.0.9.4
         * :param private_key: SSH private key, available from PAA V2.0.9.4
         * :param passphrase: Passphrase for decrypting private key, if set
         */
        const url = "/GitStatus";
        const body: Record<string, any> = {};

        const locals: Record<string, any> = {
            username, password, public_key: publicKey, private_key: privateKey, passphrase
        };

        for (const [key, value] of Object.entries(locals)) {
            if (value !== undefined && key in GitService.COMMON_PARAMETERS) {
                body[GitService.COMMON_PARAMETERS[key as keyof typeof GitService.COMMON_PARAMETERS]] = value;
            }
        }

        const response = await this.rest.post(url, JSON.stringify(body));

        return Git.fromDict(this.toJson(response.data));
    }

    public async gitPush(
        message: string, 
        author: string, 
        email: string, 
        branch?: string, 
        newBranch?: string,
        force: boolean = false, 
        username?: string, 
        password?: string, 
        publicKey?: string,
        privateKey?: string, 
        passphrase?: string, 
        execute?: boolean
    ): Promise<AxiosResponse> {
        /** Creates a gitpush plan, returns response
         * :param message: Commit message
         * :param author: Name of commit author
         * :param email: Email of commit author
         * :param branch: The branch which last commit will be used as parent commit for new branch.
         * Must be empty if GIT repo is empty
         * :param new_branch: If specified, creates a new branch and pushes the commit onto it. If not specified,
         * pushes to the branch specified in "Branch"
         * :param force: A flag passed in for evaluating preconditions
         * :param username: GIT username
         * :param password: GIT password
         * :param public_key: SSH public key, available from PAA V2.0.9.4
         * :param private_key: SSH private key, available from PAA V2.0.9.4
         * :param passphrase: Passphrase for decrypting private key, if set
         * :param execute: Executes the plan right away if True
         */
        const url = "/GitPush";
        const body: Record<string, any> = {};

        const locals: Record<string, any> = {
            message, author, email, branch, new_branch: newBranch, force, 
            username, password, public_key: publicKey, private_key: privateKey, passphrase
        };

        for (const [key, value] of Object.entries(locals)) {
            if (value !== undefined && key in GitService.COMMON_PARAMETERS) {
                body[GitService.COMMON_PARAMETERS[key as keyof typeof GitService.COMMON_PARAMETERS]] = value;
            }
        }

        const response = await this.rest.post(url, JSON.stringify(body));

        if (execute) {
            const planId = this.toJson(response.data)?.ID;
            await this.gitExecutePlan(planId);
        }

        return response;
    }

    public async gitPull(
        branch: string, 
        force?: boolean, 
        execute?: boolean, 
        username?: string,
        password?: string, 
        publicKey?: string, 
        privateKey?: string, 
        passphrase?: string
    ): Promise<AxiosResponse> {
        /** Creates a gitpull plan, returns response
         * :param branch: The name of source branch
         * :param force: A flag passed in for evaluating preconditions
         * :param execute: Executes the plan right away if True
         * :param username: GIT username
         * :param password: GIT password
         * :param public_key: SSH public key, available from PAA V2.0.9.4
         * :param private_key: SSH private key, available from PAA V2.0.9.4
         * :param passphrase: Passphrase for decrypting private key, if set
         */
        const url = "/GitPull";
        const body: Record<string, any> = {};

        const locals: Record<string, any> = {
            branch, force, username, password, public_key: publicKey, private_key: privateKey, passphrase
        };

        for (const [key, value] of Object.entries(locals)) {
            if (value !== undefined && key in GitService.COMMON_PARAMETERS) {
                body[GitService.COMMON_PARAMETERS[key as keyof typeof GitService.COMMON_PARAMETERS]] = value;
            }
        }

        const bodyJson = JSON.stringify(body);
        const response = await this.rest.post(url, bodyJson);

        if (execute) {
            const planId = this.toJson(response.data)?.ID;
            await this.gitExecutePlan(planId);
        }

        return response;
    }

    public async gitExecutePlan(planId: string): Promise<AxiosResponse> {
        /** Executes a plan based on the planid
         * :param plan_id: GitPlan id
         */
        const url = formatUrl("/GitPlans('{}')/tm1.Execute", planId);
        return await this.rest.post(url);
    }

    public async gitGetPlans(): Promise<GitPlan[]> {
        /** Gets a list of currently available GIT plans
         */
        const url = "/GitPlans";
        const plans: GitPlan[] = [];

        const response = await this.rest.get(url);
        const payload = this.toJson(response.data);
        const values = Array.isArray(payload?.value) ? payload.value : [];

        // Every individual plan is wrapped in a "value" parent, iterate through those to get the actual plans
        for (const plan of values) {
            const planId = plan.ID;
            // Check if plan has an ID, sometimes there's a null in the mix that we don't want
            if (planId === null || planId === undefined) {
                continue;
            }
            const planBranch = plan.Branch;
            const planForce = plan.Force;

            // A git plan can either be a PushPlan or a PullPlan, these have slightly different variables,
            // so we need to handle those differently
            if (plan['@odata.type'] === '#ibm.tm1.api.v1.GitPushPlan') {
                const planNewBranch = plan.NewBranch;
                const planSourceFiles = plan.SourceFiles;

                const newCommit = new GitCommit(
                    plan.NewCommit?.ID,
                    plan.NewCommit?.Summary,
                    plan.NewCommit?.Author
                );

                const parentCommit = new GitCommit(
                    plan.ParentCommit?.ID,
                    plan.ParentCommit?.Summary,
                    plan.ParentCommit?.Author
                );

                const currentPlan = new GitPushPlan(
                    planId, planBranch, planForce,
                    planNewBranch, newCommit,
                    parentCommit, planSourceFiles
                );

                plans.push(currentPlan);

            } else if (plan['@odata.type'] === '#ibm.tm1.api.v1.GitPullPlan') {

                const planCommit = new GitCommit(
                    plan.Commit?.ID,
                    plan.Commit?.Summary,
                    plan.Commit?.Author
                );

                const planOperations = plan.Operations;
                const currentPlan = new GitPullPlan(
                    planId, planBranch, planForce, planCommit, planOperations
                );

                plans.push(currentPlan);

            } else {
                throw new Error(`Invalid plan detected: ${plan['@odata.type']}`);
            }
        }

        return plans;
    }
    private toJson(data: any): any {
        if (data === undefined || data === null || data === '') {
            return undefined;
        }
        if (typeof data === 'string') {
            try {
                return JSON.parse(data);
            } catch {
                return undefined;
            }
        }
        return data;
    }
}
