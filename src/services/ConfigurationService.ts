import { AxiosResponse } from 'axios';
import { RestService } from './RestService';
import { ObjectService } from './ObjectService';

export class ConfigurationService extends ObjectService {
    constructor(rest: RestService) {
        super(rest);
    }

    public async getServerConfiguration(): Promise<any> {
        const url = "/Configuration";
        const response = await this.rest.get(url);
        return response.data;
    }

    public async getProductVersion(): Promise<string> {
        const url = "/Configuration/ProductVersion";
        const response = await this.rest.get(url);
        return response.data.value;
    }

    public async getServerName(): Promise<string> {
        const url = "/Configuration/ServerName";
        const response = await this.rest.get(url);
        return response.data.value;
    }

    public async updateConfiguration(config: any): Promise<AxiosResponse> {
        const url = "/Configuration";
        return await this.rest.patch(url, config);
    }

    public async updateStatic(config: any): Promise<AxiosResponse> {
        const url = "/StaticConfiguration";
        return await this.rest.patch(url, config);
    }

    public async getStaticConfiguration(): Promise<any> {
        const url = "/StaticConfiguration";
        const response = await this.rest.get(url);
        return response.data;
    }

    public async getAdminHost(): Promise<string> {
        const url = "/Configuration/AdminHost";
        const response = await this.rest.get(url);
        return response.data.value;
    }

    public async getDataDirectory(): Promise<string> {
        const url = "/Configuration/DataBaseDirectory";
        const response = await this.rest.get(url);
        return response.data.value;
    }

    public async getAll(): Promise<any> {
        return await this.getServerConfiguration();
    }

    public async getStatic(): Promise<any> {
        return await this.getStaticConfiguration();
    }

    public async getActive(): Promise<any> {
        const url = "/ActiveConfiguration";
        const response = await this.rest.get(url);
        return response.data;
    }
}