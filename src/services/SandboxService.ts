import { AxiosResponse } from 'axios';
import { RestService } from './RestService';
import { ObjectService } from './ObjectService';
import { Sandbox } from '../objects/Sandbox';
import { formatUrl } from '../utils/Utils';

export class SandboxService extends ObjectService {
    /** Service to handle sandboxes in TM1 */

    constructor(rest: RestService) {
        super(rest);
    }

    public async get(sandboxName: string): Promise<Sandbox> {
        /** Get a sandbox from the TM1 Server */
        const url = formatUrl("/Sandboxes('{}')", sandboxName);
        const response = await this.rest.get(url);
        return Sandbox.fromJSON(JSON.stringify(response.data));
    }

    public async getAll(): Promise<Sandbox[]> {
        /** Fetch all sandboxes */
        const url = "/Sandboxes?$select=Name,IncludeInSandboxDimension,IsLoaded,IsActive,IsQueued";
        const response = await this.rest.get(url);
        return response.data.value.map((sandboxDict: any) => Sandbox.fromDict(sandboxDict));
    }

    public async getAllNames(): Promise<string[]> {
        /** Fetch all sandbox names */
        const url = "/Sandboxes?$select=Name";
        const response = await this.rest.get(url);
        return response.data.value.map((entry: any) => entry.Name);
    }

    public async create(sandbox: Sandbox): Promise<AxiosResponse> {
        /** Create a sandbox on the TM1 Server */
        const url = "/Sandboxes";
        return await this.rest.post(url, sandbox.body);
    }

    public async update(sandbox: Sandbox): Promise<AxiosResponse> {
        /** Update an existing sandbox */
        const url = formatUrl("/Sandboxes('{}')", sandbox.name);
        return await this.rest.patch(url, sandbox.body);
    }

    public async delete(sandboxName: string): Promise<AxiosResponse> {
        /** Delete a sandbox */
        const url = formatUrl("/Sandboxes('{}')", sandboxName);
        return await this.rest.delete(url);
    }

    public async publish(sandboxName: string): Promise<AxiosResponse> {
        /** Publish sandbox changes to the base */
        const url = formatUrl("/Sandboxes('{}')/tm1.Publish", sandboxName);
        return await this.rest.post(url);
    }

    public async reset(sandboxName: string): Promise<AxiosResponse> {
        /** Discard all changes in the sandbox */
        const url = formatUrl("/Sandboxes('{}')/tm1.DiscardChanges", sandboxName);
        return await this.rest.post(url);
    }

    public async merge(
        sourceSandboxName: string,
        targetSandboxName: string,
        cleanAfter: boolean = false
    ): Promise<AxiosResponse> {
        /** Merge one sandbox into another */
        const url = formatUrl("/Sandboxes('{}')/tm1.Merge", sourceSandboxName);
        const body = {
            "Target@odata.bind": formatUrl("Sandboxes('{}')", targetSandboxName),
            CleanAfter: cleanAfter
        };
        return await this.rest.post(url, body);
    }

    public async load(sandboxName: string): Promise<AxiosResponse> {
        /** Load sandbox into memory */
        const url = formatUrl("/Sandboxes('{}')/tm1.Load", sandboxName);
        return await this.rest.post(url);
    }

    public async unload(sandboxName: string): Promise<AxiosResponse> {
        /** Unload sandbox from memory */
        const url = formatUrl("/Sandboxes('{}')/tm1.Unload", sandboxName);
        return await this.rest.post(url);
    }

    public async getQueuedSandboxes(): Promise<Sandbox[]> {
        /** Fetch sandboxes currently queued */
        const url = "/Sandboxes?$filter=IsQueued eq true";
        const response = await this.rest.get(url);
        return response.data.value.map((sandboxDict: any) => Sandbox.fromDict(sandboxDict));
    }

    public async getLoadedSandboxes(): Promise<Sandbox[]> {
        /** Fetch sandboxes currently loaded */
        const url = "/Sandboxes?$filter=IsLoaded eq true";
        const response = await this.rest.get(url);
        return response.data.value.map((sandboxDict: any) => Sandbox.fromDict(sandboxDict));
    }

    public async exists(sandboxName: string): Promise<boolean> {
        /** Check if the sandbox exists */
        const url = formatUrl("/Sandboxes('{}')", sandboxName);
        return await this._exists(url);
    }

    public async getChanges(sandboxName: string): Promise<any> {
        /** Retrieve all changes captured in the sandbox */
        const url = formatUrl("/Sandboxes('{}')/Changes", sandboxName);
        const response = await this.rest.get(url);
        return response.data;
    }

    public async isEmpty(sandboxName: string): Promise<boolean> {
        /** Determine if the sandbox has no pending changes */
        try {
            const changes = await this.getChanges(sandboxName);
            return !changes || !changes.value || changes.value.length === 0;
        } catch {
            return true;
        }
    }

    public async getSandboxDimensionMembers(): Promise<string[]> {
        /** Fetch all members of the }Sandboxes dimension */
        const url = "/Dimensions('}Sandboxes')/Hierarchies('}Sandboxes')/Elements?$select=Name";
        const response = await this.rest.get(url);
        return response.data.value.map((element: any) => element.Name);
    }

    public async createIfNotExists(sandbox: Sandbox): Promise<AxiosResponse | null> {
        /** Create the sandbox if it is not present */
        if (await this.exists(sandbox.name)) {
            return null;
        }
        return await this.create(sandbox);
    }

    public async cloneSandbox(sourceSandboxName: string, targetSandboxName: string): Promise<AxiosResponse> {
        /** Clone a sandbox by creating a new sandbox and merging the source */
        const sourceSandbox = await this.get(sourceSandboxName);
        const targetSandbox = new Sandbox(
            targetSandboxName,
            sourceSandbox.includeInSandboxDimension
        );

        await this.create(targetSandbox);
        return await this.merge(sourceSandboxName, targetSandboxName);
    }
}
