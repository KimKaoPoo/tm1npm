import { AxiosRequestConfig, AxiosResponse } from 'axios';
import { promises as fs } from 'fs';
import { RestService } from './RestService';
import { ObjectService } from './ObjectService';
import {
    Application,
    ApplicationTypes,
    CubeApplication,
    ChoreApplication,
    DimensionApplication,
    DocumentApplication,
    FolderApplication,
    LinkApplication,
    ProcessApplication,
    SubsetApplication,
    ViewApplication,
    getApplicationMetadata
} from '../objects/Application';
import { formatUrl, verifyVersion } from '../utils/Utils';

export class ApplicationService extends ObjectService {
    constructor(rest: RestService) {
        super(rest);
    }

    public async getAllPublicRootNames(): Promise<string[]> {
        const url = "/Contents('Applications')/Contents";
        const response = await this.rest.get(url);
        return response.data.value.map((application: any) => application.Name);
    }

    public async getAllPrivateRootNames(): Promise<string[]> {
        const url = "/Contents('Applications')/PrivateContents";
        const response = await this.rest.get(url);
        return response.data.value.map((application: any) => application.Name);
    }

    public async getNames(path: string, isPrivate: boolean = false): Promise<string[]> {
        const contents = this.getContentsCollection(isPrivate);
        const mid = this.buildPathSegments(path);
        const baseUrl = "/api/v1/Contents('Applications')" + mid + "/" + contents;
        const response = await this.rest.get(baseUrl);
        return response.data.value.map((application: any) => application.Name);
    }

    public async get(
        path: string,
        applicationType: string | ApplicationTypes,
        name: string,
        isPrivate: boolean = false
    ): Promise<Application> {
        const appType = this.parseApplicationType(applicationType);

        if (appType === ApplicationTypes.DOCUMENT) {
            return await this.getDocument(path, name, isPrivate);
        }

        const requestName = this.withLegacySuffix(name, appType);
        const baseUrl = this.buildApplicationUrl(path, isPrivate, requestName);

        switch (appType) {
            case ApplicationTypes.CUBE: {
                const response = await this.rest.get(baseUrl + "?$expand=Cube($select=Name)");
                const cubeName = response.data?.Cube?.Name || response.data?.Name || name;
                return new CubeApplication(path, response.data?.Name || name, cubeName);
            }
            case ApplicationTypes.CHORE: {
                const response = await this.rest.get(baseUrl + "?$expand=Chore($select=Name)");
                const choreName = response.data?.Chore?.Name || response.data?.Name || name;
                return new ChoreApplication(path, response.data?.Name || name, choreName);
            }
            case ApplicationTypes.DIMENSION: {
                const response = await this.rest.get(baseUrl + "?$expand=Dimension($select=Name)");
                const dimensionName = response.data?.Dimension?.Name || response.data?.Name || name;
                return new DimensionApplication(path, response.data?.Name || name, dimensionName);
            }
            case ApplicationTypes.FOLDER: {
                await this.rest.get(baseUrl);
                return new FolderApplication(path, name);
            }
            case ApplicationTypes.LINK: {
                await this.rest.get(baseUrl);
                const response = await this.rest.get(baseUrl + "?$expand=*");
                return new LinkApplication(path, response.data?.Name || name, response.data?.URL || '');
            }
            case ApplicationTypes.PROCESS: {
                const response = await this.rest.get(baseUrl + "?$expand=Process($select=Name)");
                const processName = response.data?.Process?.Name || response.data?.Name || name;
                return new ProcessApplication(path, response.data?.Name || name, processName);
            }
            case ApplicationTypes.SUBSET: {
                const response = await this.rest.get(
                    baseUrl + "?$expand=Subset($select=Name;$expand=Hierarchy($select=Name;$expand=Dimension($select=Name)))"
                );
                const subset = response.data?.Subset;
                return new SubsetApplication(
                    path,
                    response.data?.Name || name,
                    subset?.Hierarchy?.Dimension?.Name || '',
                    subset?.Hierarchy?.Name || '',
                    subset?.Name || ''
                );
            }
            case ApplicationTypes.VIEW: {
                const response = await this.rest.get(
                    baseUrl + "?$expand=View($select=Name;$expand=Cube($select=Name))"
                );
                const view = response.data?.View;
                return new ViewApplication(
                    path,
                    response.data?.Name || name,
                    view?.Cube?.Name || '',
                    view?.Name || ''
                );
            }
            default:
                throw new Error(`Unsupported application type: ${appType}`);
        }
    }

    public async getDocument(path: string, name: string, isPrivate: boolean = false): Promise<DocumentApplication> {
        const requestName = this.withLegacySuffix(name, ApplicationTypes.DOCUMENT);
        const mid = this.buildPathSegments(path);
        const contents = this.getContentsCollection(isPrivate);

        const contentUrl = formatUrl(
            "/Contents('Applications')" + mid + "/" + contents + "('{}')/Document/Content",
            requestName
        );
        const metadataUrl = formatUrl(
            "/Contents('Applications')" + mid + "/" + contents + "('{}')/Document",
            requestName
        );

        const arrayBufferResponse = await this.rest.get(contentUrl, { responseType: 'arraybuffer' } as AxiosRequestConfig);
        const metadataResponse = await this.rest.get(metadataUrl);

        const buffer = Buffer.from(arrayBufferResponse.data);
        const metadata = metadataResponse.data;

        return new DocumentApplication(
            path,
            metadata?.Name || name,
            buffer,
            metadata?.ID,
            metadata?.Name,
            metadata?.LastUpdated
        );
    }

    public async create(application: Application, isPrivate: boolean = false): Promise<AxiosResponse> {
        const contents = this.getContentsCollection(isPrivate);
        const mid = this.buildPathSegments(application.path);
        const url = "/Contents('Applications')" + mid + "/" + contents;

        const response = await this.rest.post(url, application.body);

        if (application instanceof DocumentApplication && application.content) {
            const requestName = this.withLegacySuffix(application.name, ApplicationTypes.DOCUMENT);
            const contentUrl = formatUrl(
                "/Contents('Applications')" + mid + "/" + contents + "('{}')/Document/Content",
                requestName
            );
            await this.rest.put(contentUrl, application.content, {
                headers: this.binaryHttpHeader
            } as AxiosRequestConfig);
        }

        return response;
    }

    public async update(application: Application, isPrivate: boolean = false): Promise<AxiosResponse> {
        const contents = this.getContentsCollection(isPrivate);
        const mid = this.buildPathSegments(application.path);
        const requestName = this.withLegacySuffix(application.name, application.applicationType);

        if (application instanceof DocumentApplication) {
            if (!application.content) {
                throw new Error('Document application requires content for update');
            }
            const url = formatUrl(
                "/Contents('Applications')" + mid + "/" + contents + "('{}')/Document/Content",
                requestName
            );
            return await this.rest.patch(url, application.content, {
                headers: this.binaryHttpHeader
            } as AxiosRequestConfig);
        }

        const url = formatUrl(
            "/Contents('Applications')" + mid + "/" + contents + "('{}')",
            requestName
        );
        return await this.rest.patch(url, application.body);
    }

    public async delete(
        path: string,
        applicationType: ApplicationTypes,
        name: string,
        isPrivate: boolean = false
    ): Promise<AxiosResponse> {
        const contents = this.getContentsCollection(isPrivate);
        const mid = this.buildPathSegments(path);
        const requestName = this.withLegacySuffix(name, applicationType);
        const url = formatUrl(
            "/Contents('Applications')" + mid + "/" + contents + "('{}')",
            requestName
        );
        return await this.rest.delete(url);
    }

    public async rename(
        path: string,
        applicationType: ApplicationTypes,
        currentName: string,
        newName: string,
        isPrivate: boolean = false
    ): Promise<AxiosResponse> {
        const contents = this.getContentsCollection(isPrivate);
        const mid = this.buildPathSegments(path);
        const requestName = this.withLegacySuffix(currentName, applicationType);
        const url = formatUrl(
            "/Contents('Applications')" + mid + "/" + contents + "('{}')/tm1.Move",
            requestName
        );
        const payload = { Name: newName };
        return await this.rest.post(url, JSON.stringify(payload));
    }

    public async exists(
        path: string,
        applicationType: ApplicationTypes,
        name: string,
        isPrivate: boolean = false
    ): Promise<boolean> {
        const contents = this.getContentsCollection(isPrivate);
        const mid = this.buildPathSegments(path);
        const requestName = this.withLegacySuffix(name, applicationType);
        const url = formatUrl(
            "/Contents('Applications')" + mid + "/" + contents + "('{}')",
            requestName
        );
        return await this._exists(url);
    }

    public async updateOrCreate(application: Application, isPrivate: boolean = false): Promise<AxiosResponse> {
        const exists = await this.exists(application.path, application.applicationType, application.name, isPrivate);
        if (exists) {
            return await this.update(application, isPrivate);
        }
        return await this.create(application, isPrivate);
    }

    public async updateOrCreateDocumentFromFile(
        path: string,
        name: string,
        filePath: string,
        isPrivate: boolean = false
    ): Promise<AxiosResponse> {
        const exists = await this.exists(path, ApplicationTypes.DOCUMENT, name, isPrivate);
        if (exists) {
            return await this.updateDocumentFromFile(filePath, path, name, isPrivate);
        }
        return await this.createDocumentFromFile(filePath, path, name, isPrivate);
    }

    public async createDocumentFromFile(
        filePath: string,
        applicationPath: string,
        applicationName: string,
        isPrivate: boolean = false
    ): Promise<AxiosResponse> {
        const content = await fs.readFile(filePath);
        const document = new DocumentApplication(applicationPath, applicationName, content);
        return await this.create(document, isPrivate);
    }

    public async updateDocumentFromFile(
        filePath: string,
        applicationPath: string,
        applicationName: string,
        isPrivate: boolean = false
    ): Promise<AxiosResponse> {
        const content = await fs.readFile(filePath);
        const document = new DocumentApplication(applicationPath, applicationName, content);
        return await this.update(document, isPrivate);
    }

    private parseApplicationType(applicationType: string | ApplicationTypes): ApplicationTypes {
        if (typeof applicationType === 'string') {
            const upper = applicationType.toUpperCase();
            if ((ApplicationTypes as any)[upper]) {
                return (ApplicationTypes as any)[upper] as ApplicationTypes;
            }
            throw new Error(`Invalid application type: ${applicationType}`);
        }
        return applicationType;
    }

    private buildPathSegments(path: string): string {
        if (!path || !path.trim()) {
            return '';
        }
        return path
            .split('/')
            .filter(segment => segment.trim().length > 0)
            .map(segment => formatUrl("/Contents('{}')", segment))
            .join('');
    }

    private getContentsCollection(isPrivate: boolean): string {
        return isPrivate ? 'PrivateContents' : 'Contents';
    }

    private buildApplicationUrl(path: string, isPrivate: boolean, name: string): string {
        const contents = this.getContentsCollection(isPrivate);
        const mid = this.buildPathSegments(path);
        return formatUrl(
            "/Contents('Applications')" + mid + "/" + contents + "('{}')",
            name
        );
    }

    private withLegacySuffix(name: string, applicationType: ApplicationTypes): string {
        if (applicationType === ApplicationTypes.FOLDER) {
            return name;
        }
        const metadata = getApplicationMetadata(applicationType);
        if (!metadata.suffix) {
            return name;
        }

        if (this.isLegacyVersion() && !name.endsWith(metadata.suffix)) {
            return `${name}${metadata.suffix}`;
        }
        return name;
    }

    private isLegacyVersion(): boolean {
        const version = this.rest.version;
        if (!version) {
            return false;
        }
        return !verifyVersion(version, '12.0.0');
    }
}
