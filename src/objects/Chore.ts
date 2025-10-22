import { TM1Object } from './TM1Object';
import { ChoreFrequency } from './ChoreFrequency';
import { ChoreStartTime } from './ChoreStartTime';
import { ChoreTask } from './ChoreTask';

export class Chore extends TM1Object {
    /** Abstraction of TM1 Chore
     *
     */
    public static readonly SINGLE_COMMIT = 'SingleCommit';
    public static readonly MULTIPLE_COMMIT = 'MultipleCommit';

    private _name: string;
    private _startTime: ChoreStartTime;
    private _dstSensitivity: boolean;
    private _active: boolean;
    private _executionMode: string;
    private _frequency: ChoreFrequency;
    private _tasks: ChoreTask[];

    constructor(
        name: string,
        startTime: ChoreStartTime,
        dstSensitivity: boolean,
        active: boolean,
        executionMode: string,
        frequency: ChoreFrequency,
        tasks: Iterable<ChoreTask>
    ) {
        super();
        this._name = name;
        this._startTime = startTime;
        this._dstSensitivity = dstSensitivity;
        this._active = active;
        this._executionMode = executionMode;
        this._frequency = frequency;
        this._tasks = Array.from(tasks);
    }

    public static fromJSON(choreAsJson: string): Chore {
        /** Alternative constructor
         *
         * :param chore_as_json: string, JSON. Response of /Chores('x')/Tasks?$expand=*
         * :return: Chore, an instance of this class
         */
        const choreAsDict = JSON.parse(choreAsJson);
        return Chore.fromDict(choreAsDict);
    }

    public static fromDict(choreAsDict: any): Chore {
        /** Alternative constructor
         *
         * :param chore_as_dict: Chore as dict
         * :return: Chore, an instance of this class
         */
        return new Chore(
            choreAsDict.Name,
            ChoreStartTime.fromString(choreAsDict.StartTime),
            choreAsDict.DSTSensitive,
            choreAsDict.Active,
            choreAsDict.ExecutionMode,
            ChoreFrequency.fromString(choreAsDict.Frequency),
            choreAsDict.Tasks.map((task: any, step: number) => 
                ChoreTask.fromDict(task, step))
        );
    }

    public get name(): string {
        return this._name;
    }

    public set name(name: string) {
        this._name = name;
    }

    public get startTime(): ChoreStartTime {
        return this._startTime;
    }

    public set startTime(startTime: ChoreStartTime) {
        this._startTime = startTime;
    }

    public get dstSensitivity(): boolean {
        return this._dstSensitivity;
    }

    public set dstSensitivity(dstSensitivity: boolean) {
        this._dstSensitivity = dstSensitivity;
    }

    public get active(): boolean {
        return this._active;
    }

    public get executionMode(): string {
        return this._executionMode;
    }

    public set executionMode(executionMode: string) {
        this._executionMode = executionMode;
    }

    public get frequency(): ChoreFrequency {
        return this._frequency;
    }

    public set frequency(frequency: ChoreFrequency) {
        this._frequency = frequency;
    }

    public get tasks(): ChoreTask[] {
        return this._tasks;
    }

    public set tasks(tasks: ChoreTask[]) {
        this._tasks = tasks;
    }

    public addTask(task: ChoreTask): void {
        this._tasks.push(task);
    }

    public removeTask(step: number): ChoreTask | undefined {
        if (step >= 0 && step < this._tasks.length) {
            return this._tasks.splice(step, 1)[0];
        }
        return undefined;
    }

    public get body(): string {
        return JSON.stringify(this.constructBody());
    }

    public get bodyAsDict(): any {
        return this.constructBody();
    }

    private constructBody(): any {
        const body: any = {};
        body.Name = this._name;
        body.StartTime = this._startTime.toString();
        body.DSTSensitive = this._dstSensitivity;
        body.Active = this._active;
        body.ExecutionMode = this._executionMode;
        body.Frequency = this._frequency.toString();
        body.Tasks = this._tasks.map(task => task.bodyAsDict);
        return body;
    }

    public reschedule(frequency: ChoreFrequency, startTime?: ChoreStartTime): void {
        /** Reschedule the chore
         *
         * :param frequency: new ChoreFrequency
         * :param start_time: new ChoreStartTime (optional)
         */
        this._frequency = frequency;
        if (startTime) {
            this._startTime = startTime;
        }
    }

    public activate(): void {
        /** Activate the chore
         */
        this._active = true;
    }

    public deactivate(): void {
        /** Deactivate the chore
         */
        this._active = false;
    }

    public insertTask(newTask: ChoreTask, step?: number): void {
        /** Insert a task at a specific position and reorder subsequent tasks
         * :param new_task: ChoreTask instance to insert
         * :param step: Position to insert at (0-based index). If not provided, adds at the end.
         */
        const insertIndex = step !== undefined ? step : this._tasks.length;
        this._tasks.splice(insertIndex, 0, newTask);

        // Update step numbers for all tasks
        this._tasks.forEach((task, index) => {
            task.step = index;
        });
    }

    public get executionPath(): Record<string, string[]> {
        /** Get execution path mapping chore name to list of process names
         * :return: Dictionary mapping chore name to process names
         */
        const processNames = this._tasks
            .filter(task => task.processName)
            .map(task => task.processName);

        return { [this._name]: processNames };
    }

    public rescheduleByTime(days: number = 0, hours: number = 0, minutes: number = 0, seconds: number = 0): void {
        /** Programmatically reschedule a chore by adding time to current start time
         * :param days: Days to add
         * :param hours: Hours to add
         * :param minutes: Minutes to add
         * :param seconds: Seconds to add
         */
        if (this._startTime.datetime) {
            const newDateTime = new Date(this._startTime.datetime);
            newDateTime.setDate(newDateTime.getDate() + days);
            newDateTime.setHours(newDateTime.getHours() + hours);
            newDateTime.setMinutes(newDateTime.getMinutes() + minutes);
            newDateTime.setSeconds(newDateTime.getSeconds() + seconds);

            this._startTime = new ChoreStartTime(newDateTime, this._startTime.tz);
        }
    }

    public static fromJson(choreAsJson: string): Chore {
        /** Alternative constructor from JSON string
         * :param chore_as_json: JSON string representation of chore
         * :return: Chore instance
         */
        return Chore.fromJSON(choreAsJson);
    }
}