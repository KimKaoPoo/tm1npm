import { TM1Object } from './TM1Object';

function cleanNullTerms(d: Record<string, any>): Record<string, any> {
    const clean: Record<string, any> = {};
    for (const [k, v] of Object.entries(d)) {
        if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
            const nested = cleanNullTerms(v);
            if (Object.keys(nested).length > 0) {
                clean[k] = nested;
            }
        } else if (Array.isArray(v) && v.length === 0) {
            continue;
        } else if (v !== null && v !== undefined) {
            clean[k] = v;
        }
    }
    return clean;
}

export class TM1ProjectTask {
    public taskName: string;
    public chore?: string;
    public process?: string;
    public parameters?: Array<Record<string, string>>;
    public dependencies?: string[];
    public precondition?: string;

    constructor(
        taskName: string,
        chore?: string,
        process?: string,
        parameters?: Array<Record<string, string>>,
        dependencies?: string[],
        precondition?: string
    ) {
        /**
         * Defines an action that executes a Process or a Chore with certain parameters.
         *
         * A Task MUST either have a Process or a Chore property.
         * The property specifies the reference of the Process or Chore to be executed.
         * The Process or Chore MUST be visible.
         *
         * A Task MAY have a Parameters property.
         * The property specifies the parameters to be passed to the Process.
         * This property MUST NOT be specified if the task is to execute a Chore.
         *
         * A Task MAY have a Dependencies property.
         * The property specifies an array of URIs of tasks or objects,
         * which will be executed or loaded, respectively, before executing the current task.
         * E.g.: ["Cubes('Cube_A')", "Dimensions('Dimension_C')"]
         *
         * A Task MAY have a Precondition property.
         * The server only executes a Task when either the precondition is not specified, or it is evaluated to TRUE.
         *
         * The server only executes a Task one time during a deployment.
         */

        if (!chore && !process) {
            throw new Error("TM1ProjectTask must either have a 'Process' or a 'Chore' property");
        }

        if (chore && process) {
            throw new Error("TM1ProjectTask must not have a 'Chore' and 'Process' property");
        }

        if (chore && parameters) {
            throw new Error("TM1ProjectTask must not have a 'Chore' and 'Parameters' property");
        }

        this.taskName = taskName;
        this.chore = chore;
        this.process = process;
        this.parameters = parameters;
        this.dependencies = dependencies;
        this.precondition = precondition;
    }

    public constructBody(): Record<string, any> {
        const body: Record<string, any> = {};
        
        if (this.chore) {
            if (!this.chore.startsWith("Chores('")) {
                body["Chore"] = `Chores('${this.chore}')`;
            } else {
                body["Chore"] = this.chore;
            }
        } else if (this.process) {
            if (!this.process.startsWith("Processes('")) {
                body["Process"] = `Processes('${this.process}')`;
            } else {
                body["Process"] = this.process;
            }
            body["Parameters"] = this.parameters;
        }
        
        if (this.dependencies) {
            body["Dependencies"] = this.dependencies;
        }

        return body;
    }

    public static fromDict(taskName: string, task: Record<string, any>): TM1ProjectTask {
        return new TM1ProjectTask(
            taskName,
            task.Chore,
            task.Process,
            task.Parameters,
            task.Dependencies,
            task.Precondition
        );
    }
}


export class TM1Project extends TM1Object {
    /** Abstraction of Git tm1project
     */

    private _version: number;
    private _name?: string;
    private _settings?: Record<string, any>;
    private _tasks?: Record<string, TM1ProjectTask>;
    private _objects?: Record<string, any>;
    private _ignore?: string[];
    protected _files?: string[];
    private _deployment?: Record<string, TM1ProjectDeployment>;
    private _prePush?: string[];
    private _postPush?: string[];
    private _prePull?: string[];
    private _postPull?: string[];

    constructor(
        version: number = 1.0,
        name?: string,
        settings?: Record<string, any>,
        tasks?: Record<string, TM1ProjectTask>,
        objects?: Record<string, any>,
        ignore?: string[],
        files?: string[],
        deployment?: Record<string, TM1ProjectDeployment>,
        prePush?: string[],
        postPush?: string[],
        prePull?: string[],
        postPull?: string[]
    ) {
        /**
         *
         * Args:
         *     version (int): _description_
         *     settings (dict, optional): _description_. Defaults to None.
         *     tasks (dict, optional): _description_. Defaults to None.
         *     objects (dict, optional): _description_. Defaults to None.
         *     ignore (list, optional): _description_. Defaults to None.
         *     files (list, optional): _description_. Defaults to None.
         *     deployment (dict, optional): _description_. Defaults to None.
         *     pre_push (list, optional): _description_. Defaults to None.
         *     post_push (list, optional): _description_. Defaults to None.
         *     pre_pull (list, optional): _description_. Defaults to None.
         *     post_pull (list, optional): _description_. Defaults to None.
         */
        super();
        this._version = version;
        this._name = name || '';
        this._settings = settings;
        this._tasks = tasks;
        this._objects = objects;
        this._ignore = ignore;
        this._files = files;
        this._deployment = deployment;
        this._prePush = prePush;
        this._postPush = postPush;
        this._prePull = prePull;
        this._postPull = postPull;
    }

    public addTask(projectTask: TM1ProjectTask): void {
        if (!this._tasks) {
            this._tasks = {};
        }

        if (projectTask.taskName in this._tasks) {
            throw new Error(`Task with name '${projectTask.taskName}' already exists in TM1 project. Task name must be unique`);
        }

        this._tasks[projectTask.taskName] = projectTask;
    }

    public removeTask(taskName: string): void {
        if (this._tasks && taskName in this._tasks) {
            delete this._tasks[taskName];
        }
    }

    public includeAllAttributeDimensions(tm1: any): void {
        /**
         * Add an ignore-exception for each attribute dimension
         */
        const attributeDimensions = tm1.dimensions.getAllNames()
            .filter((dimension: string) => 
                dimension.toLowerCase().startsWith("}elementattributes_"));

        this.addIgnoreExceptions("Dimensions", attributeDimensions);
    }

    public addIgnoreExceptions(objectClass: string, objectNames: string[]): void {
        /**
         * Specify exceptions to ignore policy.
         * Wildcards (`*`) can not be used in the `object_name`
         *
         * Args:
         *     object_class: class of the object e.g., "Dimensions"
         *     object_names: names of the objects e.g., ["Product", "Customer", "Region"]
         *
         * Example of the ignore property in the tm1project:
         *     Exclude all Dimensions that start with 'Dim', except for dimension 'DimB', 'DimA'
         *
         *     "Ignore":
         *     [
         *       "Dimensions('Dim*')",
         *       "!Dimensions('DimA')",
         *       "!Dimensions('DimB')"
         *     ]
         */

        for (const objectName of objectNames) {
            if (objectName.includes("*")) {
                throw new Error("'*' character must not be used in object_name");
            }

            let ignoreEntry = "!" + objectClass;
            if (objectName) {
                ignoreEntry += `('${objectName}')`;
            }

            if (!this.ignore) {
                this.ignore = [];
            }

            if (!this.ignore.includes(ignoreEntry)) {
                this.ignore.push(ignoreEntry);
            }
        }
    }

    public addIgnore(objectClass: string, objectName: string): void {
        /**
         * Ignore is an optional property in the tm1project
         * It specifies the objects to be excluded from the source, if the object is newly created.
         *
         * Args:
         *     object_class: class of the object e.g., "Dimensions"
         *     object_name: name of the object e.g., "Product"
         *
         * For the `object_type` pass value like `Dimensions` or `Cubes/Views`
         *
         * Wildcards (`*`) can be used in the `object_name`, if the object is not a control object.
         *
         * Example of the `ignore` property in the tm1project:
         *     Exclude all the new Cubes and Views in the source, except Cube_A;
         *     include control Process }Drill_Drill_A;
         *     and exclude all the new Dimensions which has a name starting with 'Dim'
         *
         *     "Ignore":
         *     [
         *       "Cubes/Views",
         *       "!Cubes('Cube_A')",
         *       "!Processes('}Drill_Drill_A')",
         *       "Dimensions('Dim*')"
         *     ]
         */

        if (objectName.startsWith("}") && objectName.includes("*")) {
            throw new Error("'*' character must not be used in object_name for control objects");
        }

        if (!this.ignore) {
            this.ignore = [];
        }

        let ignoreEntry = objectClass;
        if (objectName) {
            ignoreEntry += `('${objectName}')`;
        }

        if (!this.ignore.includes(ignoreEntry)) {
            this.ignore.push(ignoreEntry);
        }
    }

    public removeIgnore(ignoreEntry: string): void {
        if (this.ignore && this.ignore.includes(ignoreEntry)) {
            const index = this.ignore.indexOf(ignoreEntry);
            this.ignore.splice(index, 1);
        }
    }

    public addDeployment(deployment: TM1ProjectDeployment): void {
        /**
         * "Deployment is an OPTIONAL property. Each of its property defines a named deployment and its specific properties.
         * All the tm1project properties can be redefined for a deployment, except Version.
         * Those properties override the tm1project properties for the specific deployment.
         *
         * Current deployment is set by action GitInit."
         */
        if (!this._deployment) {
            this._deployment = {};
        }

        if (deployment.deploymentName in this._deployment) {
            throw new Error(`Deployment with name '${deployment.deploymentName}' already exists in TM1 project. Deployment name must be unique`);
        }

        this._deployment[deployment.deploymentName] = deployment;
    }

    public removeDeployment(deploymentName: string): void {
        if (this._deployment && deploymentName in this._deployment) {
            delete this._deployment[deploymentName];
        }
    }

    public static fromJSON(tm1projectAsJson: string): TM1Project {
        /**
         * :param tm1project_as_json: response of /!tm1project
         * :return: an instance of this class
         */
        const tm1projectAsDict = JSON.parse(tm1projectAsJson);
        return TM1Project.fromDict(tm1projectAsDict);
    }

    public static fromDict(tm1projectAsDict: Record<string, any>): TM1Project {
        /**
         * :param tm1project_as_dict: Dictionary, tm1project as dictionary
         * :return: an instance of this class
         */
        return new TM1Project(
            tm1projectAsDict['Version'],
            tm1projectAsDict.Name,
            tm1projectAsDict.Settings,
            tm1projectAsDict.Tasks ? Object.fromEntries(
                Object.entries(tm1projectAsDict.Tasks).map(([taskName, task]) => [
                    taskName,
                    TM1ProjectTask.fromDict(taskName, task as Record<string, any>)
                ])
            ) : undefined,
            tm1projectAsDict.Objects,
            tm1projectAsDict.Ignore,
            tm1projectAsDict.Files,
            tm1projectAsDict.Deployment ? Object.fromEntries(
                Object.entries(tm1projectAsDict.Deployment).map(([deploymentName, deployment]) => [
                    deploymentName,
                    TM1ProjectDeployment.fromDeploymentDict(deploymentName, deployment as Record<string, any>)
                ])
            ) : undefined,
            tm1projectAsDict.PrePush,
            tm1projectAsDict.PostPush,
            tm1projectAsDict.PrePull,
            tm1projectAsDict.PostPull
        );
    }

    // construct self.body (json) from the class-attributes
    protected constructBody(): Record<string, any> {
        const body = {
            'Version': this._version,
            'Name': this._name,
            'Settings': this._settings,
            'Tasks': this._tasks ? Object.fromEntries(
                Object.entries(this._tasks).map(([name, task]) => [name, task.constructBody()])
            ) : undefined,
            'Objects': this._objects,
            'Ignore': this._ignore,
            'Files': this._files,
            'Deployment': this._deployment ? Object.fromEntries(
                Object.entries(this._deployment).map(([name, deployment]) => [
                    name,
                    deployment.constructBody()
                ])
            ) : undefined,
            'PrePush': this._prePush,
            'PostPush': this._postPush,
            'PrePull': this._prePull,
            'PostPull': this._postPull
        };
        return cleanNullTerms(body);
    }

    public get bodyAsDict(): Record<string, any> {
        return this.constructBody();
    }

    public get body(): string {
        return JSON.stringify(this.bodyAsDict);
    }

    public get version(): number {
        return this._version;
    }

    public set version(value: number) {
        this._version = value;
    }

    public get name(): string | undefined {
        return this._name;
    }

    public set name(value: string | undefined) {
        this._name = value;
    }

    public get settings(): Record<string, any> | undefined {
        return this._settings;
    }

    public set settings(value: Record<string, any> | undefined) {
        this._settings = value;
    }

    public get tasks(): Record<string, TM1ProjectTask> | undefined {
        return this._tasks;
    }

    public set tasks(value: Record<string, TM1ProjectTask> | undefined) {
        this._tasks = value;
    }

    public get objects(): Record<string, any> | undefined {
        return this._objects;
    }

    public set objects(value: Record<string, any> | undefined) {
        this._objects = value;
    }

    public get ignore(): string[] | undefined {
        return this._ignore;
    }

    public set ignore(value: string[] | undefined) {
        this._ignore = value;
    }

    public get deployment(): Record<string, TM1ProjectDeployment> | undefined {
        return this._deployment;
    }

    public set deployment(value: Record<string, TM1ProjectDeployment> | undefined) {
        this._deployment = value;
    }

    public get prePush(): string[] | undefined {
        return this._prePush;
    }

    public set prePush(value: string[] | undefined) {
        this._prePush = value;
    }

    public get postPush(): string[] | undefined {
        return this._postPush;
    }

    public set postPush(value: string[] | undefined) {
        this._postPush = value;
    }

    public get prePull(): string[] | undefined {
        return this._prePull;
    }

    public set prePull(value: string[] | undefined) {
        this._prePull = value;
    }

    public get postPull(): string[] | undefined {
        return this._postPull;
    }

    public set postPull(value: string[] | undefined) {
        this._postPull = value;
    }
}


export class TM1ProjectDeployment extends TM1Project {
    public deploymentName: string;

    constructor(
        deploymentName: string,
        settings?: Record<string, any>,
        tasks?: Record<string, TM1ProjectTask>,
        objects?: Record<string, any>,
        ignore?: string[],
        files?: string[],
        prePush?: string[],
        postPush?: string[],
        prePull?: string[],
        postPull?: string[]
    ) {
        super(
            undefined as any, // version is not used in deployment
            deploymentName,
            settings,
            tasks,
            objects,
            ignore,
            files,
            undefined, // no nested deployments
            prePush,
            postPush,
            prePull,
            postPull
        );

        this.deploymentName = deploymentName;
    }

    public static fromDeploymentDict(deploymentName: string, deployment: Record<string, any>): TM1ProjectDeployment {
        /**
         * :param deployment_as_dict: Dictionary, deployment as dictionary
         * :return: an instance of this class
         */
        return new TM1ProjectDeployment(
            deploymentName,
            deployment.Settings,
            deployment.Tasks ? Object.fromEntries(
                Object.entries(deployment.Tasks).map(([taskName, task]) => [
                    taskName,
                    TM1ProjectTask.fromDict(taskName, task as Record<string, any>)
                ])
            ) : undefined,
            deployment.Objects,
            deployment.Ignore,
            deployment.Files,
            deployment.PrePush,
            deployment.PostPush,
            deployment.PrePull,
            deployment.PostPull
        );
    }

    // Override the base class fromDict to maintain signature compatibility
    public static fromDict(tm1projectAsDict: Record<string, any>): TM1ProjectDeployment {
        // Use the base class implementation and then create deployment from it
        const baseProject = super.fromDict(tm1projectAsDict);
        return new TM1ProjectDeployment(
            baseProject.name || 'Deployment',
            baseProject.settings,
            baseProject.tasks,
            baseProject.objects,
            baseProject.ignore,
            tm1projectAsDict.Files, // Use from original dict since base class doesn't have files
            baseProject.prePush,
            baseProject.postPush,
            baseProject.prePull,
            baseProject.postPull
        );
    }

    public get bodyAsDict(): Record<string, any> {
        return this.constructBody();
    }

    public get body(): string {
        return JSON.stringify(this.bodyAsDict);
    }

    // construct self.body (json) from the class-attributes
    public constructBody(): Record<string, any> {
        const bodyAsDict = {
            'Settings': this.settings,
            'Tasks': this.tasks ? Object.fromEntries(
                Object.entries(this.tasks).map(([name, task]) => [name, task.constructBody()])
            ) : undefined,
            'Objects': this.objects,
            'Ignore': this.ignore,
            'Files': this._files,
            'PrePush': this.prePush,
            'PostPush': this.postPush,
            'PrePull': this.prePull,
            'PostPull': this.postPull
        };
        return cleanNullTerms(bodyAsDict);
    }
}