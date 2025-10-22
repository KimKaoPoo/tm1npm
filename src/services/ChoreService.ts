import { AxiosResponse } from 'axios';
import { RestService } from './RestService';
import { ObjectService } from './ObjectService';
import { Chore } from '../objects/Chore';
import { ChoreTask } from '../objects/ChoreTask';
import { formatUrl } from '../utils/Utils';

/**
 * Higher Order function to handle activation and deactivation of chores before updating them
 *
 * :param func:
 * :return:
 */
function deactivateActivate(target: any, propertyKey: string, descriptor: PropertyDescriptor): void {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (this: ChoreService, ...args: any[]) {
        const choreArg = args[0];
        const { choreName, reactivate, wasActive } = await this.resolveChoreActivationState(choreArg);

        if (wasActive) {
            await this.deactivate(choreName);
        }

        try {
            return await originalMethod.apply(this, args);
        } finally {
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
        const response = await this.rest.post(url, chore.body);

        if (chore.dstSensitivity && chore.startTime) {
            await this.setLocalStartTime(chore.name, chore.startTime.datetime);
        }

        if (chore.active) {
            await this.activate(chore.name);
        }

        return response;
    }

    @deactivateActivate
    public async update(chore: Chore): Promise<AxiosResponse> {
        /** Update existing chore
         *
         * :param chore: instance of .Chore
         * :return: response
         */
        const url = formatUrl("/Chores('{}')", chore.name);
        const bodyDict = chore.bodyAsDict;
        delete bodyDict.Tasks;

        const patchResponse = await this.rest.patch(url, JSON.stringify(bodyDict));

        const existingTasks = await this.getTasksCount(chore.name);
        const newTasks = chore.tasks;

        for (let index = 0; index < newTasks.length; index++) {
            const task = newTasks[index];
            if (index >= existingTasks) {
                await this.addTask(chore.name, task);
            } else {
                const currentTask = await this.getTask(chore.name, index);
                if (!currentTask.equals(task)) {
                    await this.updateTask(chore.name, task);
                }
            }
        }

        if (existingTasks > newTasks.length) {
            for (let step = newTasks.length; step < existingTasks; step++) {
                await this.deleteTask(chore.name, step);
            }
        }

        if (chore.dstSensitivity && chore.startTime) {
            await this.setLocalStartTime(chore.name, chore.startTime.datetime);
        }

        return patchResponse;
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
        const url = formatUrl("/Chores('{}')", choreName);
        return await this._exists(url);
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

    @deactivateActivate
    public async setLocalStartTime(choreName: string, dateTime: Date): Promise<AxiosResponse> {
        const url = formatUrl("/Chores('{}')/tm1.SetServerLocalStartTime", choreName);
        const payload = {
            StartDate: `${dateTime.getUTCFullYear()}-${this.zfillTwo(dateTime.getUTCMonth() + 1)}-${this.zfillTwo(dateTime.getUTCDate())}`,
            StartTime: `${this.zfillTwo(dateTime.getUTCHours())}:${this.zfillTwo(dateTime.getUTCMinutes())}:${this.zfillTwo(dateTime.getUTCSeconds())}`
        };
        return await this.rest.post(url, JSON.stringify(payload));
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

    public async searchForProcessName(processName: string): Promise<Chore[]> {
        const url = formatUrl(
            "/Chores?$filter=Tasks/any(t: replace(tolower(t/Process/Name), ' ', '') eq '{}')" +
            "&$expand=Tasks($expand=*,Process($select=Name),Chore($select=Name))",
            processName.toLowerCase().replace(/\s+/g, '')
        );
        const response = await this.rest.get(url);
        return response.data.value.map((entry: any) => Chore.fromDict(entry));
    }

    public async searchForParameterValue(parameterValue: string): Promise<Chore[]> {
        const url = formatUrl(
            "/Chores?$filter=Tasks/any(t: t/Parameters/any(p: isof(p/Value, Edm.String) and contains(tolower(p/Value), '{}')))" +
            "&$expand=Tasks($expand=*,Process($select=Name),Chore($select=Name))",
            parameterValue.toLowerCase()
        );
        const response = await this.rest.get(url);
        return response.data.value.map((entry: any) => Chore.fromDict(entry));
    }

    public async updateOrCreate(chore: Chore): Promise<AxiosResponse> {
        const exists = await this.exists(chore.name);
        if (exists) {
            return await this.update(chore);
        }
        return await this.create(chore);
    }

    public async executeChore(choreName: string): Promise<AxiosResponse> {
        return await this.execute(choreName);
    }

    public async insertTask(choreName: string, newTask: ChoreTask, step: number): Promise<AxiosResponse> {
        /** Insert a task at a specific position and reorder subsequent tasks
         * :param chore_name: Name of the chore
         * :param new_task: ChoreTask instance to insert
         * :param step: Position to insert at (0-based index)
         * :return: response
         */
        const chore = await this.get(choreName);
        const tasks = chore.tasks;

        // Insert the new task and update step numbers
        tasks.splice(step, 0, newTask);
        for (let i = step; i < tasks.length; i++) {
            tasks[i].step = i;
        }

        chore.tasks = tasks;
        return await this.update(chore);
    }

    public async getAllTasks(choreName: string): Promise<ChoreTask[]> {
        /** Get all tasks from a chore
         * :param chore_name: Name of the chore
         * :return: Array of ChoreTask instances
         */
        const chore = await this.get(choreName);
        return chore.tasks;
    }

    public getExecutionPath(chore: Chore): Record<string, string[]> {
        /** Get execution path mapping chore name to list of process names
         * :param chore: Chore instance
         * :return: Dictionary mapping chore name to process names
         */
        const processNames = chore.tasks
            .filter(task => task.processName)
            .map(task => task.processName);

        return { [chore.name]: processNames };
    }

    protected async resolveChoreActivationState(choreArg: Chore | string): Promise<{ choreName: string; reactivate: boolean; wasActive: boolean; }> {
        let choreName: string;
        let reactivate: boolean | undefined;

        if (choreArg instanceof Chore) {
            choreName = choreArg.name;
            reactivate = choreArg.active;
        } else if (typeof choreArg === 'string') {
            choreName = choreArg;
        } else {
            throw new Error("Argument must be of type 'Chore' or 'string'");
        }

        const existing = await this.get(choreName);
        return {
            choreName,
            reactivate: reactivate !== undefined ? reactivate : existing.active,
            wasActive: existing.active
        };
    }

    public async getTasksCount(choreName: string): Promise<number> {
        /** Get the number of tasks in a chore
         * :param chore_name: Name of the chore
         * :return: Number of tasks
         */
        const url = formatUrl("/Chores('{}')/Tasks/$count", choreName);
        const response = await this.rest.get(url);
        const count = typeof response.data === 'string' ? parseInt(response.data, 10) : parseInt(response.data?.value, 10);
        return Number.isNaN(count) ? 0 : count;
    }

    public async getTask(choreName: string, step: number): Promise<ChoreTask> {
        /** Get a specific task from a chore
         * :param chore_name: Name of the chore
         * :param step: Step number (0-based index)
         * :return: ChoreTask instance
         */
        const url = formatUrl(
            "/Chores('{}')/Tasks({})?$expand=*,Process($select=Name),Chore($select=Name)",
            choreName,
            step.toString()
        );
        const response = await this.rest.get(url);
        return ChoreTask.fromDict(response.data, step);
    }

    public async deleteTask(choreName: string, step: number): Promise<AxiosResponse> {
        /** Delete a specific task from a chore
         * :param chore_name: Name of the chore
         * :param step: Step number (0-based index)
         * :return: response
         */
        const url = formatUrl("/Chores('{}')/Tasks({})", choreName, step.toString());
        return await this.rest.delete(url);
    }

    public async addTask(choreName: string, choreTask: ChoreTask): Promise<AxiosResponse> {
        /** Add a task to a chore
         * :param chore_name: Name of the chore
         * :param chore_task: ChoreTask instance to add
         * :return: response
         */
        const url = formatUrl("/Chores('{}')/Tasks", choreName);
        return await this.rest.post(url, choreTask.body);
    }

    public async updateTask(choreName: string, choreTask: ChoreTask): Promise<AxiosResponse> {
        /** Update a specific task in a chore
         * :param chore_name: Name of the chore
         * :param chore_task: ChoreTask instance with updates
         * :return: response
         */
        const url = formatUrl("/Chores('{}')/Tasks({})", choreName, choreTask.step.toString());
        return await this.rest.patch(url, choreTask.body);
    }

    private zfillTwo(value: number): string {
        return value.toString().padStart(2, '0');
    }
}
