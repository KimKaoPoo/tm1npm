import { AxiosResponse } from 'axios';
import { RestService } from './RestService';
import { ObjectService } from './ObjectService';
import { Chore } from '../objects/Chore';
import { ChoreTask } from '../objects/ChoreTask';
import { formatUrl, decohints } from '../utils/Utils';

/**
 * Higher Order function to handle activation and deactivation of chores before updating them
 *
 * :param func:
 * :return:
 */
function deactivateActivate(target: any, propertyKey: string, descriptor: PropertyDescriptor): void {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (this: ChoreService, ...args: any[]) {
        // chore (type Chore) or chore_name (type str) is passed as first arg or kwargs
        const kwargs = args[args.length - 1] || {};
        let chore: Chore | string;
        let reactivate: boolean | undefined;
        
        if ('chore' in kwargs) {
            chore = kwargs.chore.name;
        } else if ('chore_name' in kwargs) {
            chore = kwargs.chore_name;
        } else {
            chore = args[0];
        }

        let choreName: string;
        if (chore instanceof Chore) {
            choreName = chore.name;
            reactivate = chore.active;
        } else if (typeof chore === 'string') {
            choreName = chore;
        } else {
            throw new Error("Argument must be of type 'Chore' or 'string'");
        }

        // Get current chore
        const choreOld = await this.get(choreName);
        if (reactivate === undefined) {
            reactivate = choreOld.active;
        }

        // Deactivate
        if (choreOld.active) {
            await this.deactivate(choreName);
        }
        
        // Do stuff
        try {
            const response = await originalMethod.apply(this, args);
            return response;
        } finally {
            // Activate if necessary
            if (reactivate) {
                await this.activate(choreName);
            }
        }
    };
}

export class ChoreService extends ObjectService {
    /** Service to handle Object Updates for TM1 Chores
     *
     */

    constructor(rest: RestService) {
        super(rest);
    }

    public async get(choreName: string): Promise<Chore> {
        /** Get a chore from the TM1 Server
         * :param chore_name:
         * :return: instance of .Chore
         */
        const url = formatUrl(
            "/Chores('{}')?$expand=Tasks($expand=*,Process($select=Name),Chore($select=Name))",
            choreName);
        const response = await this.rest.get(url);
        return Chore.fromDict(response.data);
    }

    public async getAll(): Promise<Chore[]> {
        /** get a List of all Chores
         * :return: List of .Chore
         */
        const url = "/Chores?$expand=Tasks($expand=*,Process($select=Name),Chore($select=Name))";
        const response = await this.rest.get(url);
        return response.data.value.map((choreAsDict: any) => Chore.fromDict(choreAsDict));
    }

    public async getAllNames(): Promise<string[]> {
        /** get a List of all Chores
         * :return: List of .Chore
         */
        const url = "/Chores?$select=Name";
        const response = await this.rest.get(url);
        return response.data.value.map((chore: any) => chore.Name);
    }

    public async create(chore: Chore): Promise<AxiosResponse> {
        /** Create a chore
         * :param chore: instance of .Chore
         * :return: response
         */
        const url = "/Chores";
        return await this.rest.post(url, chore.body);
    }

    @deactivateActivate
    public async update(chore: Chore): Promise<AxiosResponse> {
        /** Update existing chore
         *
         * :param chore: instance of .Chore
         * :return: response
         */
        const url = formatUrl("/Chores('{}')", chore.name);
        return await this.rest.patch(url, chore.body);
    }

    public async delete(choreName: string): Promise<AxiosResponse> {
        /** Delete a chore
         * :param chore_name: Name of the chore to delete
         * :return: response
         */
        const url = formatUrl("/Chores('{}')", choreName);
        return await this.rest.delete(url);
    }

    public async exists(choreName: string): Promise<boolean> {
        /** Check if chore exists
         * :param chore_name: Name of the chore
         * :return: True if chore exists
         */
        try {
            await this.get(choreName);
            return true;
        } catch (error) {
            return false;
        }
    }

    public async activate(choreName: string): Promise<AxiosResponse> {
        /** Activate a chore
         * :param chore_name: Name of the chore
         * :return: response
         */
        const url = formatUrl("/Chores('{}')/tm1.Activate", choreName);
        return await this.rest.post(url, "{}");
    }

    public async deactivate(choreName: string): Promise<AxiosResponse> {
        /** Deactivate a chore
         * :param chore_name: Name of the chore
         * :return: response
         */
        const url = formatUrl("/Chores('{}')/tm1.Deactivate", choreName);
        return await this.rest.post(url, "{}");
    }

    public async execute(choreName: string): Promise<AxiosResponse> {
        /** Execute a chore
         * :param chore_name: Name of the chore
         * :return: response
         */
        const url = formatUrl("/Chores('{}')/tm1.Execute", choreName);
        return await this.rest.post(url, "{}");
    }

    public async getLastExecutionTime(choreName: string): Promise<string | null> {
        /** Get last execution time of a chore
         * :param chore_name: Name of the chore
         * :return: Last execution time as string
         */
        const url = formatUrl("/Chores('{}')/LastExecutionTime", choreName);
        try {
            const response = await this.rest.get(url);
            return response.data.value;
        } catch (error) {
            return null;
        }
    }

    public async getNextExecutionTime(choreName: string): Promise<string | null> {
        /** Get next execution time of a chore
         * :param chore_name: Name of the chore
         * :return: Next execution time as string
         */
        const url = formatUrl("/Chores('{}')/NextExecutionTime", choreName);
        try {
            const response = await this.rest.get(url);
            return response.data.value;
        } catch (error) {
            return null;
        }
    }

    public async getExecutionHistory(choreName: string, top?: number): Promise<any[]> {
        /** Get execution history of a chore
         * :param chore_name: Name of the chore
         * :param top: Number of records to return
         * :return: Array of execution records
         */
        let url = formatUrl("/Chores('{}')/ExecutionHistory", choreName);
        if (top) {
            url += `?$top=${top}`;
        }
        
        try {
            const response = await this.rest.get(url);
            return response.data.value;
        } catch (error) {
            return [];
        }
    }
}