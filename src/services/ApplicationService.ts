import { AxiosResponse } from 'axios';
import { RestService } from './RestService';
import { ObjectService } from './ObjectService';
import { 
    DocumentApplication,
    ApplicationTypes,
    CubeApplication,
    ChoreApplication,
    FolderApplication,
    LinkApplication,
    ProcessApplication,
    DimensionApplication,
    SubsetApplication,
    ViewApplication,
    Application
} from '../objects/Application';
import { formatUrl, verifyVersion } from '../utils/Utils';

export class ApplicationService extends ObjectService {
    /** Service to Read and Write TM1 Applications
     */

    constructor(tm1Rest: RestService) {
        /**
         *
         * :param tm1_rest:
         */
        super(tm1Rest);
    }

    public async getAllPublicRootNames(): Promise<string[]> {
        const url = "/Contents('Applications')/Contents";
        const response = await this.rest.get(url);
        const applications = response.data.value.map((application: any) => application.Name);
        return applications;
    }

    public async getAllPrivateRootNames(): Promise<string[]> {
        const url = "/Contents('Applications')/PrivateContents";
        const response = await this.rest.get(url);
        const applications = response.data.value.map((application: any) => application.Name);
        return applications;
    }

    public async getNames(path: string, isPrivate: boolean = false): Promise<string[]> {
        /** Retrieve Planning Analytics Application names in given path
         *
         * :param path: path with forward slashes
         * :param private: boolean
         * :return: list of application names
         */
        const contents = isPrivate ? 'PrivateContents' : 'Contents';
        let mid = "";
        if (path.trim() !== '') {
            mid = path.split('/').map(element => 
                formatUrl("/Contents('{}')", element)).join('');
        }
        const baseUrl = "/api/v1/Contents('Applications')" + mid + "/" + contents;

        const response = await this.rest.get(baseUrl);
        const applications = response.data.value.map((application: any) => application.Name);
        
        return applications;
    }

    public async get(
        path: string,
        applicationType: string | ApplicationTypes,
        name: string,
        isPrivate: boolean = false
    ): Promise<Application> {
        /** Retrieve Planning Analytics Application
         *
         * :param path: path with forward slashes
         * :param application_type: str or ApplicationType from Enum
         * :param name:
         * :param private:
         * :return:
         */
        // Parse application type if string
        let appType: ApplicationTypes;
        if (typeof applicationType === 'string') {
            appType = ApplicationTypes[applicationType as keyof typeof ApplicationTypes];
            if (appType === undefined) {
                throw new Error(`Invalid application type: ${applicationType}`);
            }
        } else {
            appType = applicationType;
        }

        // documents require special treatment
        if (appType === ApplicationTypes.DOCUMENT) {
            return await this.getDocument(path, name, isPrivate);
        }

        if (appType !== ApplicationTypes.FOLDER && !verifyVersion('12', this.version)) {
            name += this.getApplicationTypeSuffix(appType);
        }

        const contents = isPrivate ? 'PrivateContents' : 'Contents';
        let mid = "";
        if (path.trim() !== '') {
            mid = path.split('/').map(element => 
                formatUrl("/Contents('{}')", element)).join('');
        }

        const baseUrl = formatUrl(
            "/Contents('Applications')" + mid + "/" + contents + "('{}')",
            name);

        if (appType === ApplicationTypes.CUBE) {
            const response = await this.rest.get(baseUrl + "?$expand=Cube($select=Name)");
            return new CubeApplication(name, path);

        } else if (appType === ApplicationTypes.CHORE) {
            const response = await this.rest.get(baseUrl + "?$expand=Chore($select=Name)");
            return new ChoreApplication(name, path);

        } else if (appType === ApplicationTypes.DIMENSION) {
            const response = await this.rest.get(baseUrl + "?$expand=Dimension($select=Name)");
            return new DimensionApplication(name, path);

        } else if (appType === ApplicationTypes.FOLDER) {
            const response = await this.rest.get(baseUrl);
            return new FolderApplication(name, path);

        } else if (appType === ApplicationTypes.LINK) {
            const response = await this.rest.get(baseUrl);
            return new LinkApplication(name, path);

        } else if (appType === ApplicationTypes.PROCESS) {
            const response = await this.rest.get(baseUrl + "?$expand=Process($select=Name)");
            return new ProcessApplication(name, path);

        } else if (appType === ApplicationTypes.SUBSET) {
            const response = await this.rest.get(baseUrl + "?$expand=Subset($select=Name;$expand=Hierarchy($select=Name;$expand=Dimension($select=Name)))");
            const subset = response.data.Subset;
            return new SubsetApplication(name, path);

        } else if (appType === ApplicationTypes.VIEW) {
            const response = await this.rest.get(baseUrl + "?$expand=View($select=Name;$expand=Cube($select=Name))");
            const view = response.data.View;
            return new ViewApplication(name, path);

        } else {
            throw new Error(`Unsupported application type: ${appType}`);
        }
    }

    public async getDocument(path: string, name: string, isPrivate: boolean = false): Promise<DocumentApplication> {
        /** Get Document Application
         *
         * :param path: path with forward slashes
         * :param name: name of the document
         * :param private: boolean
         * :return: DocumentApplication instance
         */
        const contents = isPrivate ? 'PrivateContents' : 'Contents';
        let mid = "";
        if (path.trim() !== '') {
            mid = path.split('/').map(element => 
                formatUrl("/Contents('{}')", element)).join('');
        }

        const baseUrl = formatUrl(
            "/Contents('Applications')" + mid + "/" + contents + "('{}')",
            name);

        const response = await this.rest.get(baseUrl);
        return new DocumentApplication(name, path);
    }

    public async create(application: Application, isPrivate: boolean = false): Promise<AxiosResponse> {
        /** Create Planning Analytics Application
         *
         * :param application: instance of Application
         * :param private: boolean
         * :return: response
         */
        const contents = isPrivate ? 'PrivateContents' : 'Contents';
        let mid = "";
        if (application.path.trim() !== '') {
            mid = application.path.split('/').map(element => 
                formatUrl("/Contents('{}')", element)).join('');
        }

        const url = "/Contents('Applications')" + mid + "/" + contents;
        return await this.rest.post(url, application.body);
    }

    public async update(application: Application, isPrivate: boolean = false): Promise<AxiosResponse> {
        /** Update Planning Analytics Application
         *
         * :param application: instance of Application
         * :param private: boolean
         * :return: response
         */
        const contents = isPrivate ? 'PrivateContents' : 'Contents';
        let mid = "";
        if (application.path.trim() !== '') {
            mid = application.path.split('/').map(element => 
                formatUrl("/Contents('{}')", element)).join('');
        }

        const url = formatUrl(
            "/Contents('Applications')" + mid + "/" + contents + "('{}')",
            application.name);
        return await this.rest.patch(url, application.body);
    }

    public async delete(path: string, applicationType: ApplicationTypes, name: string, isPrivate: boolean = false): Promise<AxiosResponse> {
        /** Delete Planning Analytics Application
         *
         * :param path: path with forward slashes
         * :param application_type: ApplicationType from Enum
         * :param name: name of the application
         * :param private: boolean
         * :return: response
         */
        if (applicationType !== ApplicationTypes.FOLDER && !verifyVersion('12', this.version)) {
            name += this.getApplicationTypeSuffix(applicationType);
        }

        const contents = isPrivate ? 'PrivateContents' : 'Contents';
        let mid = "";
        if (path.trim() !== '') {
            mid = path.split('/').map(element => 
                formatUrl("/Contents('{}')", element)).join('');
        }

        const url = formatUrl(
            "/Contents('Applications')" + mid + "/" + contents + "('{}')",
            name);
        return await this.rest.delete(url);
    }

    public async exists(path: string, applicationType: ApplicationTypes, name: string, isPrivate: boolean = false): Promise<boolean> {
        /** Check if Planning Analytics Application exists
         *
         * :param path: path with forward slashes
         * :param application_type: ApplicationType from Enum
         * :param name: name of the application
         * :param private: boolean
         * :return: boolean
         */
        try {
            await this.get(path, applicationType, name, isPrivate);
            return true;
        } catch {
            return false;
        }
    }

    private getApplicationTypeSuffix(applicationType: ApplicationTypes): string {
        switch (applicationType) {
            case ApplicationTypes.CUBE:
                return '.cube';
            case ApplicationTypes.CHORE:
                return '.chore';
            case ApplicationTypes.DIMENSION:
                return '.dimension';
            case ApplicationTypes.PROCESS:
                return '.process';
            case ApplicationTypes.SUBSET:
                return '.subset';
            case ApplicationTypes.VIEW:
                return '.view';
            case ApplicationTypes.LINK:
                return '.url';
            default:
                return '';
        }
    }

    private get version(): string {
        // This would need to be implemented to get TM1 server version
        return '12.0.0'; // Default to v12 for now
    }
}