import { TM1Object } from './TM1Object';

export enum ApplicationTypes {
    CUBE = 'tm1.cube',
    DIMENSION = 'tm1.dimension',
    PROCESS = 'tm1.process',
    CHORE = 'tm1.chore',
    VIEW = 'tm1.view',
    SUBSET = 'tm1.subset',
    DOCUMENT = 'tm1.document',
    FOLDER = 'tm1.folder',
    LINK = 'tm1.link'
}

// Compatibility aliases
export const ApplicationTypeAliases = {
    Cube: ApplicationTypes.CUBE,
    Dimension: ApplicationTypes.DIMENSION,
    Process: ApplicationTypes.PROCESS,
    Chore: ApplicationTypes.CHORE,
    View: ApplicationTypes.VIEW,
    Subset: ApplicationTypes.SUBSET,
    Document: ApplicationTypes.DOCUMENT,
    Folder: ApplicationTypes.FOLDER,
    Link: ApplicationTypes.LINK
};

export class Application extends TM1Object {
    private _name: string;
    private _path: string;
    private _documented: boolean;
    private _type: string;

    constructor(
        name: string,
        path: string = '',
        documented: boolean = false,
        type: string = 'Application'
    ) {
        super();
        this._name = name;
        this._path = path;
        this._documented = documented;
        this._type = type;
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

    public get type(): string {
        return this._type;
    }

    public get body(): string {
        return JSON.stringify({
            Name: this._name,
            Path: this._path,
            Documented: this._documented,
            Type: this._type
        });
    }

    public static fromDict(applicationAsDict: any): Application {
        return new Application(
            applicationAsDict.Name,
            applicationAsDict.Path || '',
            applicationAsDict.Documented || false,
            applicationAsDict.Type || 'Application'
        );
    }
}

export class CubeApplication extends Application {
    constructor(name: string, path: string = '') {
        super(name, path, false, ApplicationTypes.CUBE);
    }
}

export class DimensionApplication extends Application {
    constructor(name: string, path: string = '') {
        super(name, path, false, ApplicationTypes.DIMENSION);
    }
}

export class ProcessApplication extends Application {
    constructor(name: string, path: string = '') {
        super(name, path, false, ApplicationTypes.PROCESS);
    }
}

export class ChoreApplication extends Application {
    constructor(name: string, path: string = '') {
        super(name, path, false, ApplicationTypes.CHORE);
    }
}

export class ViewApplication extends Application {
    constructor(name: string, path: string = '') {
        super(name, path, false, ApplicationTypes.VIEW);
    }
}

export class SubsetApplication extends Application {
    constructor(name: string, path: string = '') {
        super(name, path, false, ApplicationTypes.SUBSET);
    }
}

export class DocumentApplication extends Application {
    constructor(name: string, path: string = '') {
        super(name, path, true, ApplicationTypes.DOCUMENT);
    }
}

export class FolderApplication extends Application {
    constructor(name: string, path: string = '') {
        super(name, path, false, ApplicationTypes.FOLDER);
    }
}

export class LinkApplication extends Application {
    constructor(name: string, path: string = '') {
        super(name, path, false, ApplicationTypes.LINK);
    }
}