import { AxiosResponse } from 'axios';
import { RestService } from './RestService';
import { ObjectService } from './ObjectService';

export class FileService extends ObjectService {
    /** Service to handle File operations for TM1
     */

    constructor(rest: RestService) {
        super(rest);
    }

    public async getNames(): Promise<string[]> {
        /** Get names of all files
         * :return: List of file names
         */
        const url = "/Files";
        const response = await this.rest.get(url);
        return response.data.value.map((file: any) => file.Name);
    }

    public async get(fileName: string): Promise<Buffer> {
        /** Get file content as Buffer
         * :param fileName: name of the file
         * :return: file content as Buffer
         */
        const url = `/Files('${encodeURIComponent(fileName)}')/Content`;
        const response = await this.rest.get(url, { responseType: 'arraybuffer' });
        return Buffer.from(response.data);
    }

    public async create(fileName: string, fileContent: Buffer | string): Promise<AxiosResponse> {
        /** Create or update a file
         * :param fileName: name of the file
         * :param fileContent: content as Buffer or string
         * :return: response
         */
        const url = `/Files('${encodeURIComponent(fileName)}')/Content`;
        return await this.rest.put(url, fileContent);
    }

    public async exists(fileName: string): Promise<boolean> {
        /** Check if file exists
         * :param fileName: name of the file
         * :return: true if exists
         */
        try {
            const url = `/Files('${encodeURIComponent(fileName)}')`;
            await this.rest.get(url);
            return true;
        } catch (error: any) {
            if (error.response?.status === 404) {
                return false;
            }
            throw error;
        }
    }

    public async delete(fileName: string): Promise<AxiosResponse> {
        /** Delete a file
         * :param fileName: name of the file
         * :return: response
         */
        const url = `/Files('${encodeURIComponent(fileName)}')`;
        return await this.rest.delete(url);
    }
}