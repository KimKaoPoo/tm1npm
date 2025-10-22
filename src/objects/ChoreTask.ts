import { TM1Object } from './TM1Object';
import { formatUrl } from '../utils/Utils';

export interface ChoreTaskParameter {
    Name: string;
    Value: string;
}

export class ChoreTask extends TM1Object {
    /** Abstraction of a Chore Task
     * 
     *    A Chore task always conistst of
     *    - The step integer ID: it's order in the execution plan.
     *      1 to n, where n is the last Process in the Chore
     *    - The name of the process to execute
     *    - The parameters for the process
     */

    private _step: number;
    private _processName: string;
    private _parameters: ChoreTaskParameter[];

    constructor(step: number, processName: string, parameters: ChoreTaskParameter[]) {
        /**
         * :param step: step in the execution order of the Chores' processes. 1 to n, where n the number of processes
         * :param process_name: name of the process
         * :param parameters: list of dictionaries with 'Name' and 'Value' property:
         *                     [{
         *                         'Name': '..',
         *                         'Value': '..'
         *                     },
         *                     ...
         *                     ]            
         */
        super();
        this._step = step;
        this._processName = processName;
        this._parameters = parameters;
    }

    public static fromDict(choreTaskAsDict: Record<string, any>, step?: number): ChoreTask {
        let processName: string;
        if ('Process' in choreTaskAsDict) {
            processName = choreTaskAsDict['Process']['Name'];
        } else {
            // Extract "ProcessName" from "Processes('ProcessName')"
            processName = choreTaskAsDict['Process@odata.bind'].slice(11, -2);
        }

        return new ChoreTask(
            step !== undefined ? step : parseInt(choreTaskAsDict['Step']),
            processName,
            (choreTaskAsDict['Parameters'] || []).map((p: any) => ({
                Name: p['Name'],
                Value: p['Value']
            }))
        );
    }

    public get bodyAsDict(): Record<string, any> {
        const bodyAsDict: Record<string, any> = {};
        bodyAsDict['Process@odata.bind'] = formatUrl("Processes('{}')", this._processName);
        bodyAsDict['Parameters'] = this._parameters;
        return bodyAsDict;
    }

    public get step(): number {
        return this._step;
    }

    public set step(value: number) {
        this._step = value;
    }

    public get processName(): string {
        return this._processName;
    }

    public get parameters(): ChoreTaskParameter[] {
        return this._parameters;
    }

    public get body(): string {
        return JSON.stringify(this.bodyAsDict);
    }

    public equals(other: ChoreTask): boolean {
        return this.processName === other.processName && 
               JSON.stringify(this.parameters) === JSON.stringify(other.parameters);
    }

    public notEquals(other: ChoreTask): boolean {
        return this.processName !== other.processName || 
               JSON.stringify(this._parameters) !== JSON.stringify(other.parameters);
    }
}