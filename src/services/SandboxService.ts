import { AxiosResponse } from 'axios';
import { RestService } from './RestService';
import { ObjectService } from './ObjectService';
import { Sandbox } from '../objects/Sandbox';
import { TM1RestException } from '../exceptions/TM1Exception';
import { formatUrl } from '../utils/Utils';

export class SandboxService extends ObjectService {
    /** Service to handle sandboxes in TM1
     * 
     */

    constructor(rest: RestService) {
        super(rest);
    }

    public async get(sandboxName: string): Promise<Sandbox> {
        /** get a sandbox from TM1 Server
         *
         * :param sandbox_name: str
         * :return: instance of .Sandbox
         */
        const url = formatUrl("/Sandboxes('{}')", sandboxName);
        const response = await this.rest.get(url);
        const sandbox = Sandbox.fromJSON(JSON.stringify(response.data));
        return sandbox;
    }

    public async getAll(): Promise<Sandbox[]> {
        /** get all sandboxes from TM1 Server
         *
         * :return: List of .Sandbox instances
         */
        const url = "/Sandboxes?$select=Name,IncludeInSandboxDimension,IsLoaded,IsActive,IsQueued";
        const response = await this.rest.get(url);
        const sandboxes = response.data.value.map((sandboxAsDict: any) =>
            Sandbox.fromDict(sandboxAsDict)
        );
        return sandboxes;
    }

    public async getAllNames(): Promise<string[]> {
        /** get all sandbox names
         *
         * :param kwargs:
         * :return:
         */
        const url = "/Sandboxes?$select=Name";
        const response = await this.rest.get(url);
        return response.data.value.map((entry: any) => entry.Name);
    }

    public async create(sandbox: Sandbox): Promise<AxiosResponse> {
        /** create a new sandbox in TM1 Server
         *
         * :param sandbox: Sandbox
         * :return: response
         */
        const url = "/Sandboxes";
        return await this.rest.post(url, sandbox.body);
    }

    public async update(sandbox: Sandbox): Promise<AxiosResponse> {
        /** update a sandbox in TM1
         *
         * :param sandbox:
         * :return: response
         */
        const url = formatUrl("/Sandboxes('{}')", sandbox.name);
        return await this.rest.patch(url, sandbox.body);
    }

    public async delete(sandboxName: string): Promise<AxiosResponse> {
        /** delete a sandbox in TM1
         *
         * :param sandbox_name:
         * :return: response
         */
        const url = formatUrl("/Sandboxes('{}')", sandboxName);
        return await this.rest.delete(url);
    }

    public async publish(sandboxName: string): Promise<AxiosResponse> {
        /** publish existing sandbox to base
         *
         * :param sandbox_name: str
         * :return: response
         */
        const url = formatUrl("/Sandboxes('{}')/tm1.Publish", sandboxName);
        return await this.rest.post(url, "{}");
    }

    public async reset(sandboxName: string): Promise<AxiosResponse> {
        /** reset all changes in specified sandbox
         *
         * :param sandbox_name: str
         * :return: response
         */
        const url = formatUrl("/Sandboxes('{}')/tm1.DiscardChanges", sandboxName);
        return await this.rest.post(url, "{}");
    }

    public async merge(sourceSandboxName: string, targetSandboxName: string): Promise<AxiosResponse> {
        /** merge changes from source sandbox into target sandbox
         *
         * :param source_sandbox_name: str
         * :param target_sandbox_name: str
         * :return: response
         */
        const url = formatUrl("/Sandboxes('{}')/tm1.Merge", targetSandboxName);
        const body = {
            "Source@odata.bind": `Sandboxes('${sourceSandboxName}')`
        };
        return await this.rest.post(url, JSON.stringify(body));
    }

    public async exists(sandboxName: string): Promise<boolean> {
        /** check if sandbox exists
         *
         * :param sandbox_name: str
         * :return: boolean
         */
        try {
            await this.get(sandboxName);
            return true;
        } catch (error) {
            if (error instanceof TM1RestException && error.statusCode === 404) {
                return false;
            }
            throw error;
        }
    }

    public async getChanges(sandboxName: string): Promise<any> {
        /** get all changes in a sandbox
         *
         * :param sandbox_name: str
         * :return: dict of changes
         */
        const url = formatUrl("/Sandboxes('{}')/Changes", sandboxName);
        const response = await this.rest.get(url);
        return response.data;
    }

    public async isEmpty(sandboxName: string): Promise<boolean> {
        /** check if sandbox is empty (has no changes)
         *
         * :param sandbox_name: str
         * :return: boolean
         */
        try {
            const changes = await this.getChanges(sandboxName);
            return !changes || !changes.value || changes.value.length === 0;
        } catch {
            return true;
        }
    }

    public async load(sandboxName: string): Promise<AxiosResponse> {
        /** load sandbox into memory
         *
         * :param sandbox_name: str
         * :return: response
         */
        const url = formatUrl("/Sandboxes('{}')/tm1.Load", sandboxName);
        return await this.rest.post(url, "{}");
    }

    public async unload(sandboxName: string): Promise<AxiosResponse> {
        /** unload sandbox from memory
         *
         * :param sandbox_name: str
         * :return: response
         */
        const url = formatUrl("/Sandboxes('{}')/tm1.Unload", sandboxName);
        return await this.rest.post(url, "{}");
    }

    public async getSandboxDimensionMembers(): Promise<string[]> {
        /** get all members of the }Sandboxes dimension
         *
         * :return: list of sandbox names
         */
        const url = "/Dimensions('}Sandboxes')/Hierarchies('}Sandboxes')/Elements?$select=Name";
        const response = await this.rest.get(url);
        return response.data.value.map((element: any) => element.Name);
    }

    public async createIfNotExists(sandbox: Sandbox): Promise<AxiosResponse | null> {
        /** create sandbox if it doesn't exist
         *
         * :param sandbox: Sandbox instance
         * :return: response or null if already exists
         */
        if (await this.exists(sandbox.name)) {
            return null;
        }
        return await this.create(sandbox);
    }

    public async cloneSandbox(sourceSandboxName: string, targetSandboxName: string): Promise<AxiosResponse> {
        /** clone a sandbox
         *
         * :param source_sandbox_name: str
         * :param target_sandbox_name: str
         * :return: response
         */
        const sourceSandbox = await this.get(sourceSandboxName);
        const targetSandbox = new Sandbox(
            targetSandboxName,
            sourceSandbox.includeInSandboxDimension
        );
        
        await this.create(targetSandbox);
        return await this.merge(sourceSandboxName, targetSandboxName);
    }
}