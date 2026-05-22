import { AxiosResponse } from 'axios';
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
import { TM1RestException } from '../exceptions/TM1Exception';

export interface DiscoverItem {
    '@odata.type': string;
    type: string;
    id: string;
    name: string;
    path: string;
    is_private: boolean;
    children?: DiscoverItem[];
}

export class ApplicationService extends ObjectService {
    private privatePathCache: Map<string, number> = new Map();

    constructor(rest: RestService) {
        super(rest);
    }

    public clearPrivatePathCache(): void {
        this.privatePathCache.clear();
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

    public async getNames(
        path: string,
        isPrivate: boolean = false,
        useCache: boolean = false
    ): Promise<string[]> {
        const { baseUrl, inPrivateContext } = await this._resolvePath(path, isPrivate, useCache);
        const contents = (isPrivate || inPrivateContext) ? 'PrivateContents' : 'Contents';
        const url = baseUrl + '/' + contents;
        const response = await this.rest.get(url);
        return response.data.value.map((application: any) => application.Name);
    }

    public async get(
        path: string,
        applicationType: string | ApplicationTypes,
        name: string,
        isPrivate: boolean = false,
        useCache: boolean = false
    ): Promise<Application> {
        const appType = this.parseApplicationType(applicationType);

        if (appType === ApplicationTypes.DOCUMENT) {
            return await this.getDocument(path, name, isPrivate, useCache);
        }

        const requestName = this.withLegacySuffix(name, appType);
        const { baseUrl: resolvedBase, inPrivateContext } = await this._resolvePath(path, isPrivate, useCache);
        const contents = (isPrivate || inPrivateContext) ? 'PrivateContents' : 'Contents';
        const baseUrl = formatUrl(resolvedBase + '/' + contents + "('{}')", requestName);

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

    public async getDocument(
        path: string,
        name: string,
        isPrivate: boolean = false,
        useCache: boolean = false
    ): Promise<DocumentApplication> {
        const requestName = this.withLegacySuffix(name, ApplicationTypes.DOCUMENT);
        const { baseUrl, inPrivateContext } = await this._resolvePath(path, isPrivate, useCache);
        const contents = (isPrivate || inPrivateContext) ? 'PrivateContents' : 'Contents';

        const contentUrl = formatUrl(
            baseUrl + '/' + contents + "('{}')/Document/Content",
            requestName
        );
        const metadataUrl = formatUrl(
            baseUrl + '/' + contents + "('{}')/Document",
            requestName
        );

        const arrayBufferResponse = await this.rest.get(contentUrl, { responseType: 'arraybuffer' });
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

    public async create(
        application: Application,
        isPrivate: boolean = false,
        useCache: boolean = false
    ): Promise<AxiosResponse> {
        const { baseUrl, inPrivateContext } = await this._resolvePath(application.path, isPrivate, useCache);
        const contents = (isPrivate || inPrivateContext) ? 'PrivateContents' : 'Contents';
        const collectionUrl = baseUrl + '/' + contents;

        const response = await this.rest.post(collectionUrl, application.body);

        if (application instanceof DocumentApplication && application.content) {
            const extension = this.isLegacyVersion() ? '.blob' : '';
            const documentUrl = formatUrl(
                baseUrl + '/' + contents + "('{}{}')/Document/Content",
                application.name,
                extension
            );
            await this.rest.put(documentUrl, application.content, {
                headers: this.binaryHttpHeader
            });
        }

        return response;
    }

    public async update(
        application: Application,
        isPrivate: boolean = false,
        useCache: boolean = false
    ): Promise<AxiosResponse> {
        const { baseUrl, inPrivateContext } = await this._resolvePath(application.path, isPrivate, useCache);
        const contents = (isPrivate || inPrivateContext) ? 'PrivateContents' : 'Contents';

        if (application instanceof DocumentApplication) {
            const extension = this.isLegacyVersion() ? '.blob' : '';
            const url = formatUrl(
                baseUrl + '/' + contents + "('{}{}')/Document/Content",
                application.name,
                extension
            );
            return await this.rest.patch(url, application.content, {
                headers: this.binaryHttpHeader
            });
        }

        const url = baseUrl + '/' + contents;
        return await this.rest.post(url, application.body);
    }

    public async delete(
        path: string,
        applicationType: ApplicationTypes,
        name: string,
        isPrivate: boolean = false,
        useCache: boolean = false
    ): Promise<AxiosResponse> {
        const requestName = this.withLegacySuffix(name, applicationType);
        const { baseUrl, inPrivateContext } = await this._resolvePath(path, isPrivate, useCache);
        const contents = (isPrivate || inPrivateContext) ? 'PrivateContents' : 'Contents';
        const url = formatUrl(
            baseUrl + '/' + contents + "('{}')",
            requestName
        );
        return await this.rest.delete(url);
    }

    public async rename(
        path: string,
        applicationType: ApplicationTypes,
        currentName: string,
        newName: string,
        isPrivate: boolean = false,
        useCache: boolean = false
    ): Promise<AxiosResponse> {
        const requestName = this.withLegacySuffix(currentName, applicationType);
        const { baseUrl, inPrivateContext } = await this._resolvePath(path, isPrivate, useCache);
        const contents = (isPrivate || inPrivateContext) ? 'PrivateContents' : 'Contents';
        const url = formatUrl(
            baseUrl + '/' + contents + "('{}')/tm1.Move",
            requestName
        );
        const payload = { Name: newName };
        return await this.rest.post(url, JSON.stringify(payload));
    }

    public async exists(
        path: string,
        applicationType: ApplicationTypes,
        name: string,
        isPrivate: boolean = false,
        useCache: boolean = false
    ): Promise<boolean> {
        const requestName = this.withLegacySuffix(name, applicationType);
        const base = "/Contents('Applications')";

        if (!isPrivate) {
            const segments = path.trim() ? path.split('/') : [];
            const mid = this._buildPathUrl(segments, segments.length);
            const url = base + mid + "/Contents('" + requestName + "')";
            return await this._exists(url);
        }

        const segments = path.trim() ? path.split('/') : [];

        if (segments.length === 0) {
            const url = base + "/PrivateContents('" + requestName + "')";
            return await this._exists(url);
        }

        const cacheKey = segments.join('/');

        if (useCache && this.privatePathCache.has(cacheKey)) {
            const boundary = this.privatePathCache.get(cacheKey)!;
            const mid = this._buildPathUrl(segments, boundary);
            const inPrivateContext = boundary < segments.length;
            const contents = inPrivateContext ? 'PrivateContents' : 'Contents';
            const url = base + mid + '/' + contents + "('" + requestName + "')";
            return await this._exists(url);
        }

        const midPublic = this._buildPathUrl(segments, segments.length);
        const urlPublic = base + midPublic + "/PrivateContents('" + requestName + "')";
        if (await this._exists(urlPublic)) {
            if (useCache) {
                this.privatePathCache.set(cacheKey, segments.length);
            }
            return true;
        }

        const boundary = await this._findPrivateBoundary(segments);
        if (boundary === -1) {
            return false;
        }

        if (useCache) {
            this.privatePathCache.set(cacheKey, boundary);
        }

        const mid = this._buildPathUrl(segments, boundary);
        const contents = boundary < segments.length ? 'PrivateContents' : 'PrivateContents';
        const url = base + mid + '/' + contents + "('" + requestName + "')";
        return await this._exists(url);
    }

    public async updateOrCreate(
        application: Application,
        isPrivate: boolean = false,
        useCache: boolean = false
    ): Promise<AxiosResponse> {
        const exists = await this.exists(
            application.path,
            application.applicationType,
            application.name,
            isPrivate,
            useCache
        );
        if (exists) {
            return await this.update(application, isPrivate, useCache);
        }
        return await this.create(application, isPrivate, useCache);
    }

    public async updateOrCreateDocumentFromFile(
        path: string,
        name: string,
        filePath: string,
        isPrivate: boolean = false,
        useCache: boolean = false
    ): Promise<AxiosResponse> {
        const exists = await this.exists(path, ApplicationTypes.DOCUMENT, name, isPrivate, useCache);
        if (exists) {
            return await this.updateDocumentFromFile(filePath, path, name, isPrivate, useCache);
        }
        return await this.createDocumentFromFile(filePath, path, name, isPrivate, useCache);
    }

    public async createDocumentFromFile(
        filePath: string,
        applicationPath: string,
        applicationName: string,
        isPrivate: boolean = false,
        useCache: boolean = false
    ): Promise<AxiosResponse> {
        const content = await fs.readFile(filePath);
        const document = new DocumentApplication(applicationPath, applicationName, content);
        return await this.create(document, isPrivate, useCache);
    }

    public async updateDocumentFromFile(
        filePath: string,
        applicationPath: string,
        applicationName: string,
        isPrivate: boolean = false,
        useCache: boolean = false
    ): Promise<AxiosResponse> {
        const content = await fs.readFile(filePath);
        const document = new DocumentApplication(applicationPath, applicationName, content);
        return await this.update(document, isPrivate, useCache);
    }

    public async discover(
        path: string = '',
        includePrivate: boolean = false,
        recursive: boolean = false,
        flat: boolean = false
    ): Promise<DiscoverItem[]> {
        const results: DiscoverItem[] = [];

        let inPrivateContext = false;
        if (path.trim() && includePrivate) {
            const resolved = await this._resolvePath(path, true, false);
            inPrivateContext = resolved.inPrivateContext;
        }

        const items = await this._discoverAtPath(
            path,
            includePrivate,
            recursive,
            flat,
            inPrivateContext,
            results
        );

        return flat ? results : items;
    }

    private async _discoverAtPath(
        path: string,
        includePrivate: boolean,
        recursive: boolean,
        flat: boolean,
        inPrivateContext: boolean,
        results: DiscoverItem[]
    ): Promise<DiscoverItem[]> {
        const items: DiscoverItem[] = [];

        if (inPrivateContext) {
            const rawItems = await this._getContentsRaw(path, true, true);
            await this._processItems(
                rawItems, path, true, true,
                includePrivate, recursive, flat, results, items
            );
        } else {
            const rawPublic = await this._getContentsRaw(path, false, false);
            await this._processItems(
                rawPublic, path, false, false,
                includePrivate, recursive, flat, results, items
            );

            if (includePrivate) {
                const rawPrivate = await this._getContentsRaw(path, true, false);
                await this._processItems(
                    rawPrivate, path, true, false,
                    includePrivate, recursive, flat, results, items
                );
            }
        }

        return flat ? results : items;
    }

    private async _processItems(
        rawItems: any[],
        path: string,
        isPrivate: boolean,
        inPrivateContext: boolean,
        includePrivate: boolean,
        recursive: boolean,
        flat: boolean,
        results: DiscoverItem[],
        items: DiscoverItem[]
    ): Promise<void> {
        for (const raw of rawItems) {
            const odataType = raw['@odata.type'] || '';
            const itemType = this._extractTypeFromOdata(odataType);
            const itemName = raw.Name || '';
            const itemId = raw.ID || '';
            const itemPath = path ? `${path}/${itemName}` : itemName;

            const item: DiscoverItem = {
                '@odata.type': odataType,
                type: itemType,
                id: itemId,
                name: itemName,
                path: itemPath,
                is_private: isPrivate || inPrivateContext
            };

            if (recursive && itemType === 'Folder') {
                const newCtx = isPrivate || inPrivateContext;
                const children = await this._discoverAtPath(
                    itemPath, includePrivate, recursive, flat, newCtx, results
                );
                if (!flat) {
                    item.children = children;
                }
            }

            if (flat) {
                results.push(item);
            } else {
                items.push(item);
            }
        }
    }

    private async _getContentsRaw(
        path: string,
        isPrivate: boolean,
        inPrivateContext: boolean
    ): Promise<any[]> {
        const base = "/Contents('Applications')";
        let url: string;

        if (!path.trim()) {
            url = base + (isPrivate ? '/PrivateContents' : '/Contents');
        } else {
            const segments = path.split('/');
            let mid: string;
            if (inPrivateContext || isPrivate) {
                const boundary = await this._findPrivateBoundary(segments);
                if (boundary === -1) {
                    return [];
                }
                mid = this._buildPathUrl(segments, boundary);
            } else {
                mid = this._buildPathUrl(segments, segments.length);
            }
            const collection = (isPrivate || inPrivateContext) ? 'PrivateContents' : 'Contents';
            url = base + mid + '/' + collection;
        }

        try {
            const response = await this.rest.get(url);
            return response.data?.value || [];
        } catch (error: any) {
            if (error instanceof TM1RestException && error.statusCode === 404) {
                return [];
            }
            throw error;
        }
    }

    private _extractTypeFromOdata(odataType: string): string {
        if (odataType && odataType.includes('.')) {
            const parts = odataType.split('.');
            return parts[parts.length - 1];
        }
        return odataType || 'Unknown';
    }

    private async _findPrivateBoundary(segments: string[]): Promise<number> {
        let prefix = "/Contents('Applications')";
        for (let i = 0; i < segments.length; i++) {
            const publicUrl = prefix + formatUrl("/Contents('{}')", segments[i]) + "?$top=0";
            try {
                await this.rest.get(publicUrl);
                prefix += formatUrl("/Contents('{}')", segments[i]);
            } catch (error: any) {
                if (!(error instanceof TM1RestException && error.statusCode === 404)) {
                    throw error;
                }
                const privateUrl = prefix + formatUrl("/PrivateContents('{}')", segments[i]) + "?$top=0";
                try {
                    await this.rest.get(privateUrl);
                    return i;
                } catch (innerError: any) {
                    if (innerError instanceof TM1RestException && innerError.statusCode === 404) {
                        return -1;
                    }
                    throw innerError;
                }
            }
        }
        return segments.length;
    }

    private _buildPathUrl(segments: string[], privateBoundary?: number): string {
        if (segments.length === 0) {
            return '';
        }

        const boundary = privateBoundary === undefined ? segments.length : privateBoundary;

        if (boundary >= segments.length) {
            return segments.map(s => formatUrl("/Contents('{}')", s)).join('');
        }
        if (boundary <= 0) {
            return segments.map(s => formatUrl("/PrivateContents('{}')", s)).join('');
        }

        const publicPart = segments.slice(0, boundary).map(s => formatUrl("/Contents('{}')", s)).join('');
        const privatePart = segments.slice(boundary).map(s => formatUrl("/PrivateContents('{}')", s)).join('');
        return publicPart + privatePart;
    }

    private async _resolvePath(
        path: string,
        isPrivate: boolean = false,
        useCache: boolean = false
    ): Promise<{ baseUrl: string; inPrivateContext: boolean }> {
        const base = "/Contents('Applications')";

        if (!path.trim()) {
            return { baseUrl: base, inPrivateContext: false };
        }

        const segments = path.split('/');

        if (!isPrivate) {
            const mid = this._buildPathUrl(segments, segments.length);
            return { baseUrl: base + mid, inPrivateContext: false };
        }

        const cacheKey = segments.join('/');

        if (useCache && this.privatePathCache.has(cacheKey)) {
            const boundary = this.privatePathCache.get(cacheKey)!;
            const mid = this._buildPathUrl(segments, boundary);
            return {
                baseUrl: base + mid,
                inPrivateContext: boundary < segments.length
            };
        }

        const midPublic = this._buildPathUrl(segments, segments.length);
        const urlPublic = base + midPublic;
        try {
            await this.rest.get(urlPublic + '?$top=0');
            if (useCache) {
                this.privatePathCache.set(cacheKey, segments.length);
            }
            return { baseUrl: urlPublic, inPrivateContext: false };
        } catch (error: any) {
            if (!(error instanceof TM1RestException && error.statusCode === 404)) {
                throw error;
            }
        }

        const midPrivate = this._buildPathUrl(segments, 0);
        const urlPrivate = base + midPrivate;
        try {
            await this.rest.get(urlPrivate + '?$top=0');
            if (useCache) {
                this.privatePathCache.set(cacheKey, 0);
            }
            return { baseUrl: urlPrivate, inPrivateContext: true };
        } catch (error: any) {
            if (!(error instanceof TM1RestException && error.statusCode === 404)) {
                throw error;
            }
        }

        const boundary = await this._findPrivateBoundary(segments);

        if (boundary === -1) {
            return { baseUrl: urlPublic, inPrivateContext: false };
        }

        if (useCache) {
            this.privatePathCache.set(cacheKey, boundary);
        }

        const mid = this._buildPathUrl(segments, boundary);
        return {
            baseUrl: base + mid,
            inPrivateContext: boundary < segments.length
        };
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
