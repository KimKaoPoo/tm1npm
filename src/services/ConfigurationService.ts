import { AxiosResponse } from 'axios';
import { RestService } from './RestService';
import { ObjectService } from './ObjectService';

export class ConfigurationService extends ObjectService {
    constructor(rest: RestService) {
        super(rest);
    }

    public async getAll(): Promise<Record<string, any>> {
        const response = await this.rest.get('/Configuration');
        return this.stripODataContext(response.data);
    }

    public async getServerConfiguration(): Promise<Record<string, any>> {
        return await this.getAll();
    }

    public async getServerName(): Promise<string> {
        const response = await this.rest.get('/Configuration/ServerName/$value');
        return typeof response.data === 'string' ? response.data : response.data?.value;
    }

    public async getProductVersion(): Promise<string> {
        const response = await this.rest.get('/Configuration/ProductVersion/$value');
        return typeof response.data === 'string' ? response.data : response.data?.value;
    }

    public async getAdminHost(): Promise<string> {
        const response = await this.rest.get('/Configuration/AdminHost/$value');
        return typeof response.data === 'string' ? response.data : response.data?.value;
    }

    public async getDataDirectory(): Promise<string> {
        const response = await this.rest.get('/Configuration/DataBaseDirectory/$value');
        return typeof response.data === 'string' ? response.data : response.data?.value;
    }

    public async getStatic(): Promise<Record<string, any>> {
        const response = await this.rest.get('/StaticConfiguration');
        return this.stripODataContext(response.data);
    }

    public async getStaticConfiguration(): Promise<Record<string, any>> {
        return await this.getStatic();
    }

    public async getActive(): Promise<Record<string, any>> {
        const response = await this.rest.get('/ActiveConfiguration');
        return this.stripODataContext(response.data);
    }

    public async getActiveConfiguration(): Promise<Record<string, any>> {
        return await this.getActive();
    }

    public async updateConfiguration(configuration: Record<string, any>): Promise<AxiosResponse> {
        return await this.rest.patch('/Configuration', JSON.stringify(configuration));
    }

    public async updateStatic(configuration: Record<string, any>): Promise<AxiosResponse> {
        return await this.rest.patch('/StaticConfiguration', JSON.stringify(configuration));
    }

    private stripODataContext(payload: any): any {
        if (payload && typeof payload === 'object' && '@odata.context' in payload) {
            const clone = { ...payload };
            delete clone['@odata.context'];
            return clone;
        }
        return payload;
    }
}
