import { TM1Object } from './TM1Object';
import { formatUrl } from '../utils/Utils';

export enum ApplicationTypes {
    CHORE = 'CHORE',
    CUBE = 'CUBE',
    DIMENSION = 'DIMENSION',
    DOCUMENT = 'DOCUMENT',
    FOLDER = 'FOLDER',
    LINK = 'LINK',
    PROCESS = 'PROCESS',
    SUBSET = 'SUBSET',
    VIEW = 'VIEW'
}

interface ApplicationTypeMetadata {
    suffix: string;
    odataType: string;
}

const APPLICATION_METADATA: Record<ApplicationTypes, ApplicationTypeMetadata> = {
    [ApplicationTypes.CHORE]: { suffix: '.chore', odataType: 'tm1.ChoreReference' },
    [ApplicationTypes.CUBE]: { suffix: '.cube', odataType: 'tm1.CubeReference' },
    [ApplicationTypes.DIMENSION]: { suffix: '.dimension', odataType: 'tm1.DimensionReference' },
    [ApplicationTypes.DOCUMENT]: { suffix: '.blob', odataType: '#ibm.tm1.api.v1.Document' },
    [ApplicationTypes.FOLDER]: { suffix: '', odataType: '#ibm.tm1.api.v1.Folder' },
    [ApplicationTypes.LINK]: { suffix: '.extr', odataType: '#ibm.tm1.api.v1.Link' },
    [ApplicationTypes.PROCESS]: { suffix: '.process', odataType: 'tm1.ProcessReference' },
    [ApplicationTypes.SUBSET]: { suffix: '.subset', odataType: 'tm1.SubsetReference' },
    [ApplicationTypes.VIEW]: { suffix: '.view', odataType: 'tm1.ViewReference' }
};

export abstract class Application extends TM1Object {
    protected _name: string;
    protected _path: string;
    protected _documented: boolean;
    protected readonly _applicationType: ApplicationTypes;

    constructor(path: string, name: string, applicationType: ApplicationTypes, documented: boolean = false) {
        super();
        const metadata = APPLICATION_METADATA[applicationType];
        this._path = path;
        if (metadata.suffix && name.endsWith(metadata.suffix)) {
            this._name = name.slice(0, -metadata.suffix.length);
        } else {
            this._name = name;
        }
        this._applicationType = applicationType;
        this._documented = documented;
    }

    public get name(): string {
        return this._name;
    }

    public set name(name: string) {
        this._name = name;
    }

    public get path(): string {
        return this._path;
    }

    public set path(path: string) {
        this._path = path;
    }

    public get documented(): boolean {
        return this._documented;
    }

    public set documented(documented: boolean) {
        this._documented = documented;
    }

    public get applicationType(): ApplicationTypes {
        return this._applicationType;
    }

    public get applicationId(): string {
        const metadata = APPLICATION_METADATA[this._applicationType];
        const suffix = metadata.suffix || '';
        return `${this._path}${this._path ? '/' : ''}${this._name}${suffix}`.replace('//', '/');
    }

    public get bodyAsDict(): Record<string, any> {
        const metadata = APPLICATION_METADATA[this._applicationType];
        const body: Record<string, any> = {
            '@odata.type': metadata.odataType,
            Name: this._name
        };
        if (this._documented) {
            body.Documented = true;
        }
        return body;
    }

    public get body(): string {
        return JSON.stringify(this.bodyAsDict);
    }
}

export class ChoreApplication extends Application {
    private readonly _choreName: string;

    constructor(path: string, name: string, choreName: string) {
        super(path, name, ApplicationTypes.CHORE);
        this._choreName = choreName;
    }

    public get choreName(): string {
        return this._choreName;
    }

    public override get bodyAsDict(): Record<string, any> {
        const body = super.bodyAsDict;
        body['Chore@odata.bind'] = formatUrl("Chores('{}')", this._choreName);
        return body;
    }
}

export class CubeApplication extends Application {
    private readonly _cubeName: string;

    constructor(path: string, name: string, cubeName: string) {
        super(path, name, ApplicationTypes.CUBE);
        this._cubeName = cubeName;
    }

    public get cubeName(): string {
        return this._cubeName;
    }

    public override get bodyAsDict(): Record<string, any> {
        const body = super.bodyAsDict;
        body['Cube@odata.bind'] = formatUrl("Cubes('{}')", this._cubeName);
        return body;
    }
}

export class DimensionApplication extends Application {
    private readonly _dimensionName: string;

    constructor(path: string, name: string, dimensionName: string) {
        super(path, name, ApplicationTypes.DIMENSION);
        this._dimensionName = dimensionName;
    }

    public get dimensionName(): string {
        return this._dimensionName;
    }

    public override get bodyAsDict(): Record<string, any> {
        const body = super.bodyAsDict;
        body['Dimension@odata.bind'] = formatUrl("Dimensions('{}')", this._dimensionName);
        return body;
    }
}

export class ProcessApplication extends Application {
    private readonly _processName: string;

    constructor(path: string, name: string, processName: string) {
        super(path, name, ApplicationTypes.PROCESS);
        this._processName = processName;
    }

    public get processName(): string {
        return this._processName;
    }

    public override get bodyAsDict(): Record<string, any> {
        const body = super.bodyAsDict;
        body['Process@odata.bind'] = formatUrl("Processes('{}')", this._processName);
        return body;
    }
}

export class SubsetApplication extends Application {
    private readonly _dimensionName: string;
    private readonly _hierarchyName: string;
    private readonly _subsetName: string;

    constructor(path: string, name: string, dimensionName: string, hierarchyName: string, subsetName: string) {
        super(path, name, ApplicationTypes.SUBSET);
        this._dimensionName = dimensionName;
        this._hierarchyName = hierarchyName;
        this._subsetName = subsetName;
    }

    public get dimensionName(): string {
        return this._dimensionName;
    }

    public get hierarchyName(): string {
        return this._hierarchyName;
    }

    public get subsetName(): string {
        return this._subsetName;
    }

    public override get bodyAsDict(): Record<string, any> {
        const body = super.bodyAsDict;
        body['Subset@odata.bind'] = formatUrl(
            "Dimensions('{}')/Hierarchies('{}')/Subsets('{}')",
            this._dimensionName,
            this._hierarchyName,
            this._subsetName
        );
        return body;
    }
}

export class ViewApplication extends Application {
    private readonly _cubeName: string;
    private readonly _viewName: string;

    constructor(path: string, name: string, cubeName: string, viewName: string) {
        super(path, name, ApplicationTypes.VIEW);
        this._cubeName = cubeName;
        this._viewName = viewName;
    }

    public get cubeName(): string {
        return this._cubeName;
    }

    public get viewName(): string {
        return this._viewName;
    }

    public override get bodyAsDict(): Record<string, any> {
        const body = super.bodyAsDict;
        body['View@odata.bind'] = formatUrl("Cubes('{}')/Views('{}')", this._cubeName, this._viewName);
        return body;
    }
}

export class DocumentApplication extends Application {
    private _content?: Buffer;
    private _fileId?: string;
    private _fileName?: string;
    private _lastUpdated?: string;

    constructor(path: string, name: string, content?: Buffer, fileId?: string, fileName?: string, lastUpdated?: string) {
        super(path, name, ApplicationTypes.DOCUMENT, true);
        this._content = content;
        this._fileId = fileId;
        this._fileName = fileName;
        this._lastUpdated = lastUpdated;
    }

    public get content(): Buffer | undefined {
        return this._content;
    }

    public set content(value: Buffer | undefined) {
        this._content = value;
    }

    public get fileId(): string | undefined {
        return this._fileId;
    }

    public get fileName(): string | undefined {
        return this._fileName;
    }

    public get lastUpdated(): string | undefined {
        return this._lastUpdated;
    }

    public async toFile(pathToFile: string): Promise<void> {
        if (!this._content) {
            throw new Error('Document content is empty');
        }
        const fs = await import('fs/promises');
        await fs.writeFile(pathToFile, this._content);
    }

    public async toXlsx(pathToFile: string): Promise<void> {
        await this.toFile(pathToFile);
    }
}

export class FolderApplication extends Application {
    constructor(path: string, name: string) {
        super(path, name, ApplicationTypes.FOLDER);
    }
}

export class LinkApplication extends Application {
    private readonly _url: string;

    constructor(path: string, name: string, url: string) {
        super(path, name, ApplicationTypes.LINK);
        this._url = url;
    }

    public get url(): string {
        return this._url;
    }

    public override get bodyAsDict(): Record<string, any> {
        const body = super.bodyAsDict;
        body['URL'] = this._url;
        return body;
    }
}

export function getApplicationMetadata(applicationType: ApplicationTypes): ApplicationTypeMetadata {
    return APPLICATION_METADATA[applicationType];
}
