import path from 'path';
import { AxiosRequestConfig, AxiosResponse } from 'axios';
import { RestService } from './RestService';
import { ObjectService } from './ObjectService';
import { verifyVersion } from '../utils/Utils';

export class FileService extends ObjectService {
    /** Service to handle File operations for TM1
     */

    private static readonly SUBFOLDER_REQUIRED_VERSION = '12.0.0';
    private static readonly MPU_REQUIRED_VERSION = '12.0.0';
    private readonly versionContentPath: string;

    constructor(rest: RestService) {
        super(rest);
        this.versionContentPath = verifyVersion(rest.version ?? '', '12.0.0') ? 'Files' : 'Blobs';
    }

    public async getNames(): Promise<string[]> {
        const url = `/Contents('${encodeURIComponent(this.versionContentPath)}')/Contents?$select=Name`;
        const response = await this.rest.get(url);
        return response.data.value.map((entry: any) => entry.Name);
    }

    public async getAllNames(directory: string = ''): Promise<string[]> {
        const segments = this.normalizePath(directory);
        const url = this.constructContentUrl(segments, false, "Contents?$select=Name");
        const response = await this.rest.get(url);
        return response.data.value.map((entry: any) => entry.Name);
    }

    public async get(fileName: string): Promise<Buffer> {
        const segments = this.normalizePath(fileName);
        this.checkSubfolderSupport(segments, 'FileService.get');
        const url = this.constructContentUrl(segments, false, 'Content');
        const response = await this.rest.get(url, { responseType: 'arraybuffer' });
        return Buffer.from(response.data);
    }

    public async create(
        fileName: string,
        content: Buffer | string,
        multiPartUpload?: boolean,
        maxMbPerPart: number = 200,
        maxWorkers: number = 1
    ): Promise<AxiosResponse> {
        const segments = this.normalizePath(fileName);
        this.checkSubfolderSupport(segments, 'FileService.create');
        if (segments.length > 1) {
            await this.ensureFolderHierarchy(segments.slice(0, -1));
        }

        return await this.uploadFileContent(
            segments,
            this.toBuffer(content),
            multiPartUpload,
            maxMbPerPart,
            maxWorkers
        );
    }

    public async update(
        fileName: string,
        content: Buffer | string,
        multiPartUpload?: boolean,
        maxMbPerPart: number = 200,
        maxWorkers: number = 1
    ): Promise<AxiosResponse> {
        const segments = this.normalizePath(fileName);
        this.checkSubfolderSupport(segments, 'FileService.update');
        return await this.uploadFileContent(
            segments,
            this.toBuffer(content),
            multiPartUpload,
            maxMbPerPart,
            maxWorkers
        );
    }

    public async updateOrCreate(
        fileName: string,
        content: Buffer | string,
        multiPartUpload?: boolean,
        maxMbPerPart: number = 200,
        maxWorkers: number = 1
    ): Promise<AxiosResponse> {
        if (await this.exists(fileName)) {
            return await this.update(fileName, content, multiPartUpload, maxMbPerPart, maxWorkers);
        }
        return await this.create(fileName, content, multiPartUpload, maxMbPerPart, maxWorkers);
    }

    public async exists(fileName: string): Promise<boolean> {
        const segments = this.normalizePath(fileName);
        const url = this.constructContentUrl(segments, false, '');
        return await this._exists(url);
    }

    public async delete(fileName: string): Promise<AxiosResponse> {
        const segments = this.normalizePath(fileName);
        this.checkSubfolderSupport(segments, 'FileService.delete');
        const url = this.constructContentUrl(segments, false, '');
        return await this.rest.delete(url);
    }

    public async searchStringInName(
        nameStartsWith?: string,
        nameContains?: string | string[],
        nameContainsOperator: 'and' | 'or' = 'and',
        directory: string = ''
    ): Promise<string[]> {
        const op = nameContainsOperator.trim().toLowerCase();
        if (op !== 'and' && op !== 'or') {
            throw new Error("'name_contains_operator' must be either 'and' or 'or'");
        }

        const filters: string[] = [];
        if (nameStartsWith) {
            filters.push(`startswith(tolower(Name),tolower('${nameStartsWith}'))`);
        }
        if (nameContains) {
            if (typeof nameContains === 'string') {
                filters.push(`contains(tolower(Name),tolower('${nameContains}'))`);
            } else {
                const clauses = nameContains.map(fragment =>
                    `contains(tolower(Name),tolower('${fragment}'))`
                );
                filters.push(`(${clauses.join(` ${op} `)})`);
            }
        }

        const segments = this.normalizePath(directory);
        this.checkSubfolderSupport(segments, 'FileService.searchStringInName');
        const extension = filters.length > 0
            ? `Contents?$select=Name&$filter=${filters.join(' and ')}`
            : 'Contents?$select=Name';
        const url = this.constructContentUrl(segments, false, extension);
        const response = await this.rest.get(url);
        return response.data.value.map((entry: any) => entry.Name);
    }

    // snake_case aliases for tm1py parity
    public async get_names(): Promise<string[]> {
        return this.getNames();
    }

    public async get_all_names(path: string = ''): Promise<string[]> {
        return this.getAllNames(path);
    }

    public async update_or_create(
        fileName: string,
        content: Buffer | string,
        multiPartUpload?: boolean,
        maxMbPerPart: number = 200,
        maxWorkers: number = 1
    ): Promise<AxiosResponse> {
        return this.updateOrCreate(fileName, content, multiPartUpload, maxMbPerPart, maxWorkers);
    }

    public async search_string_in_name(
        nameStartsWith?: string,
        nameContains?: string | string[],
        nameContainsOperator: 'and' | 'or' = 'and',
        directory: string = ''
    ): Promise<string[]> {
        return this.searchStringInName(nameStartsWith, nameContains, nameContainsOperator, directory);
    }

    private async ensureFolderHierarchy(segments: string[]): Promise<void> {
        const folders: string[] = [];
        for (const segment of segments) {
            folders.push(segment);
            const url = this.constructContentUrl(folders, true, 'Contents');
            const body = {
                '@odata.type': '#ibm.tm1.api.v1.Folder',
                Name: folders[folders.length - 1]
            };
            try {
                await this.rest.post(url, JSON.stringify(body));
            } catch (error: any) {
                if (!(error instanceof Error && (error as any).response?.status === 409)) {
                    throw error;
                }
            }
        }
    }

    private async uploadFileContent(
        pathSegments: string[],
        content: Buffer,
        multiPartUpload: boolean | undefined,
        maxMbPerPart: number,
        maxWorkers: number
    ): Promise<AxiosResponse> {
        const url = this.constructContentUrl(pathSegments, false, 'Content');

        if (this.fileContentIsEmpty(content)) {
            return await this.uploadFileContentWithoutMpu(url, content);
        }

        const shouldUseMpu = multiPartUpload !== undefined
            ? multiPartUpload
            : verifyVersion(this.version ?? '', FileService.MPU_REQUIRED_VERSION);

        if (shouldUseMpu) {
            this.ensureMpuSupport('FileService.create');
            return await this.uploadFileContentWithMpu(url, content, maxMbPerPart, maxWorkers);
        }

        return await this.uploadFileContentWithoutMpu(url, content);
    }

    private async uploadFileContentWithoutMpu(url: string, content: Buffer): Promise<AxiosResponse> {
        const config: AxiosRequestConfig = {
            headers: this.binaryHttpHeader
        };
        return await this.rest.put(url, content, config);
    }

    private async uploadFileContentWithMpu(
        contentUrl: string,
        content: Buffer,
        maxMbPerPart: number,
        maxWorkers: number
    ): Promise<AxiosResponse> {
        const initResponse = await this.rest.post(
            `${contentUrl}/mpu.CreateMultipartUpload`,
            '{}'
        );
        const uploadId = initResponse.data?.UploadID;
        if (!uploadId) {
            throw new Error('Failed to initiate multipart upload: missing UploadID');
        }

        const parts = this.splitIntoParts(content, Math.max(1, Math.floor(maxMbPerPart * 1024 * 1024)));
        const results: Array<{ partNumber: number; etag: string }> = [];

        const uploadPart = async (index: number, data: Buffer): Promise<void> => {
            const response = await this.rest.post(
                `${contentUrl}/!uploads('${uploadId}')/Parts`,
                data,
                {
                    headers: {
                        ...this.binaryHttpHeader,
                        'Accept': 'application/json,text/plain'
                    }
                }
            );
            const partNumber = response.data?.PartNumber ?? index + 1;
            const etag = response.data?.['@odata.etag'] || response.headers?.etag || '';
            results.push({ partNumber, etag });
        };

        if (maxWorkers > 1) {
            const chunks = parts.map((part, idx) => ({ part, idx }));
            const queue = [...chunks];
            const workers: Promise<void>[] = [];
            for (let w = 0; w < Math.min(maxWorkers, queue.length); w++) {
                const run = async () => {
                    while (queue.length > 0) {
                        const next = queue.shift();
                        if (!next) break;
                        await uploadPart(next.idx, next.part);
                    }
                };
                workers.push(run());
            }
            await Promise.all(workers);
        } else {
            for (let i = 0; i < parts.length; i++) {
                await uploadPart(i, parts[i]);
            }
        }

        results.sort((a, b) => a.partNumber - b.partNumber);
        const body = {
            Parts: results.map(part => ({ PartNumber: part.partNumber, ETag: part.etag }))
        };

        const completeResponse = await this.rest.post(
            `${contentUrl}/!uploads('${uploadId}')/mpu.Complete`,
            JSON.stringify(body)
        );

        return completeResponse;
    }

    private constructContentUrl(pathSegments: string[], excludePathEnd: boolean, extension: string): string {
        const segments = excludePathEnd ? pathSegments.slice(0, -1) : [...pathSegments];
        let url = `/Contents('${encodeURIComponent(this.versionContentPath)}')`;
        for (const segment of segments) {
            url += `/Contents('${encodeURIComponent(segment)}')`;
        }
        if (extension) {
            if (!extension.startsWith('/')) {
                url += '/';
            }
            url += extension;
        }
        return url;
    }

    private normalizePath(inputPath: string): string[] {
        if (!inputPath) {
            return [];
        }
        const normalized = path.posix.normalize(inputPath.replace(/\\/g, '/'));
        return normalized
            .split('/')
            .map(segment => segment.trim())
            .filter(segment => segment.length > 0);
    }

    private toBuffer(content: Buffer | string): Buffer {
        return Buffer.isBuffer(content) ? content : Buffer.from(content);
    }

    private splitIntoParts(data: Buffer, maxChunkSize: number): Buffer[] {
        const chunks: Buffer[] = [];
        for (let i = 0; i < data.length; i += maxChunkSize) {
            chunks.push(data.slice(i, i + maxChunkSize));
        }
        return chunks;
    }

    private fileContentIsEmpty(fileContent: Buffer): boolean {
        return fileContent.length === 0;
    }

    private checkSubfolderSupport(pathSegments: string[], functionName: string): void {
        if (pathSegments.length <= 1) {
            return;
        }
        if (!verifyVersion(this.version ?? '', FileService.SUBFOLDER_REQUIRED_VERSION)) {
            throw new Error(`Function ${functionName} requires TM1 version ${FileService.SUBFOLDER_REQUIRED_VERSION}`);
        }
    }

    private ensureMpuSupport(functionName: string): void {
        if (!verifyVersion(this.version ?? '', FileService.MPU_REQUIRED_VERSION)) {
            throw new Error(`Function ${functionName} requires TM1 version ${FileService.MPU_REQUIRED_VERSION}`);
        }
    }
}
