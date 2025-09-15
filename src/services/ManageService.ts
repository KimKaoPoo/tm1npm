import axios, { AxiosResponse } from 'axios';

export interface DatabaseResourceConfig {
    cpuRequests?: string;
    cpuLimits?: string;
    memoryRequests?: string;
    memoryLimits?: string;
    storageSize?: string;
}

export class ManageService {
    /** Manage service to interact with the manage endpoint.
     * The manage endpoint uses basic auth using the root client and secret
     */

    private _domain: string;
    private _rootClient: string;
    private _rootSecret: string;
    private _rootUrl: string;
    private _authConfig: any;

    constructor(domain: string, rootClient: string, rootSecret: string) {
        this._domain = domain;
        this._rootClient = rootClient;
        this._rootSecret = rootSecret;
        this._rootUrl = `${this._domain}/manage/v1`;
        this._authConfig = {
            auth: {
                username: this._rootClient,
                password: this._rootSecret
            }
        };
    }

    public async getInstances(): Promise<any[]> {
        const url = `${this._rootUrl}/Instances`;
        const response = await axios.get(url, this._authConfig);
        return response.data.value;
    }

    public async getInstance(instanceName: string): Promise<any> {
        const url = `${this._rootUrl}/Instances('${instanceName}')`;
        const response = await axios.get(url, this._authConfig);
        return response.data;
    }

    public async createInstance(instanceName: string): Promise<AxiosResponse> {
        const url = `${this._rootUrl}/Instances`;
        const payload = { "Name": instanceName };
        const response = await axios.post(url, payload, this._authConfig);
        return response;
    }

    public async deleteInstance(instanceName: string): Promise<AxiosResponse> {
        const url = `${this._rootUrl}/Instances('${instanceName}')`;
        const response = await axios.delete(url, this._authConfig);
        return response;
    }

    public async instanceExists(instanceName: string): Promise<boolean> {
        const url = `${this._rootUrl}/Instances('${instanceName}')`;
        try {
            const response = await axios.get(url, this._authConfig);
            return response.status === 200;
        } catch (error) {
            return false;
        }
    }

    public async getDatabases(instanceName: string): Promise<any[]> {
        const url = `${this._rootUrl}/Instances('${instanceName}')/Databases`;
        const response = await axios.get(url, this._authConfig);
        return response.data.value;
    }

    public async getDatabase(instanceName: string, databaseName: string): Promise<any> {
        const url = `${this._rootUrl}/Instances('${instanceName}')/Databases('${databaseName}')`;
        const response = await axios.get(url, this._authConfig);
        return response.data;
    }

    public async createDatabase(
        instanceName: string,
        databaseName: string,
        numberReplicas: number,
        productVersion: string,
        resourceConfig: DatabaseResourceConfig = {}
    ): Promise<AxiosResponse> {
        const {
            cpuRequests = "1000m",
            cpuLimits = "2000m",
            memoryRequests = "1G",
            memoryLimits = "2G",
            storageSize = "20Gi"
        } = resourceConfig;

        const url = `${this._rootUrl}/Instances('${instanceName}')/Databases`;

        const payload = {
            "Name": databaseName,
            "Replicas": numberReplicas,
            "ProductVersion": productVersion,
            "Resources": {
                "Replica": {
                    "CPU": {
                        "Requests": cpuRequests,
                        "Limits": cpuLimits
                    },
                    "Memory": {
                        "Requests": memoryRequests,
                        "Limits": memoryLimits
                    }
                },
                "Storage": {
                    "Size": storageSize
                }
            }
        };

        const response = await axios.post(url, payload, this._authConfig);
        return response;
    }

    public async updateDatabaseCpu(
        instanceName: string,
        databaseName: string,
        cpuRequests: string,
        cpuLimits: string
    ): Promise<AxiosResponse> {
        const url = `${this._rootUrl}/Instances('${instanceName}')/Databases('${databaseName}')`;

        const payload = {
            "Resources": {
                "Replica": {
                    "CPU": {
                        "Requests": cpuRequests,
                        "Limits": cpuLimits
                    }
                }
            }
        };

        const response = await axios.patch(url, payload, this._authConfig);
        return response;
    }

    public async updateDatabaseMemory(
        instanceName: string,
        databaseName: string,
        memoryRequests: string,
        memoryLimits: string
    ): Promise<AxiosResponse> {
        const url = `${this._rootUrl}/Instances('${instanceName}')/Databases('${databaseName}')`;

        const payload = {
            "Resources": {
                "Replica": {
                    "Memory": {
                        "Requests": memoryRequests,
                        "Limits": memoryLimits
                    }
                }
            }
        };

        const response = await axios.patch(url, payload, this._authConfig);
        return response;
    }

    public async updateDatabaseStorage(
        instanceName: string,
        databaseName: string,
        storageSize: string
    ): Promise<AxiosResponse> {
        const url = `${this._rootUrl}/Instances('${instanceName}')/Databases('${databaseName}')`;

        const payload = {
            "Resources": {
                "Storage": {
                    "Size": storageSize
                }
            }
        };

        const response = await axios.patch(url, payload, this._authConfig);
        return response;
    }

    public async deleteDatabase(instanceName: string, databaseName: string): Promise<AxiosResponse> {
        const url = `${this._rootUrl}/Instances('${instanceName}')/Databases('${databaseName}')`;
        const response = await axios.delete(url, this._authConfig);
        return response;
    }

    public async databaseExists(instanceName: string, databaseName: string): Promise<boolean> {
        const url = `${this._rootUrl}/Instances('${instanceName}')/Databases('${databaseName}')`;
        try {
            const response = await axios.get(url, this._authConfig);
            return response.status === 200;
        } catch (error) {
            return false;
        }
    }

    public async upgradeDatabase(
        instanceName: string,
        databaseName: string,
        targetVersion: string = ""
    ): Promise<AxiosResponse> {
        const url = `${this._rootUrl}/Instances('${instanceName}')/Databases('${databaseName}')/tm1s.Upgrade`;
        const payload = { "ProductVersion": targetVersion };
        const response = await axios.post(url, payload, this._authConfig);
        return response;
    }

    public async createDatabaseBackup(
        instanceName: string,
        databaseName: string,
        backupSetName: string
    ): Promise<AxiosResponse> {
        const url = `${this._rootUrl}/Instances('${instanceName}')/Databases('${databaseName}')/tm1s.Backup`;
        const payload = { "URL": `${backupSetName}.tgz` };
        const response = await axios.post(url, payload, this._authConfig);
        return response;
    }

    public async createAndUploadDatabaseBackupSetFile(
        instanceName: string,
        databaseName: string,
        backupSetName: string
    ): Promise<AxiosResponse> {
        const createUrl = `${this._rootUrl}/Instances('${instanceName}')/Databases('${databaseName}')/Contents('Files')/Contents('.backupsets')/Contents`;
        const payload = {
            "@odata.type": "#ibm.tm1.api.v1.Document",
            "Name": `${backupSetName}.tgz`
        };
        await axios.post(createUrl, payload, this._authConfig);

        const uploadUrl = `${this._rootUrl}/Instances('${instanceName}')/Databases('${databaseName}')/Contents('Files')/Contents('.backupsets')/Contents('${backupSetName}.tgz')/Content`;
        const response = await axios.post(uploadUrl, payload, this._authConfig);
        return response;
    }

    public async restoreDatabase(
        instanceName: string,
        databaseName: string,
        backupUrl: string
    ): Promise<AxiosResponse> {
        const url = `${this._rootUrl}/Instances('${instanceName}')/Databases('${databaseName}')/tm1s.Restore`;
        const payload = { "URL": backupUrl };
        const response = await axios.post(url, payload, this._authConfig);
        return response;
    }

    public async scaleDatabase(
        instanceName: string,
        databaseName: string,
        replicas: number
    ): Promise<AxiosResponse> {
        const url = `${this._rootUrl}/Instances('${instanceName}')/Databases('${databaseName}')`;
        const payload = { "Replicas": replicas };
        const response = await axios.patch(url, payload, this._authConfig);
        return response;
    }

    public async getApplications(instanceName: string): Promise<any> {
        const url = `${this._rootUrl}/Instances('${instanceName}')/Applications`;
        const response = await axios.get(url, this._authConfig);
        return response.data;
    }

    public async getApplication(instanceName: string, applicationName: string): Promise<any> {
        const url = `${this._rootUrl}/Instances('${instanceName}')/Applications('${applicationName}')`;
        const response = await axios.get(url, this._authConfig);
        return response.data;
    }

    public async createApplication(
        instanceName: string,
        applicationName: string
    ): Promise<{ clientId: string; clientSecret: string }> {
        const url = `${this._rootUrl}/Instances('${instanceName}')/Applications`;
        const payload = { "Name": applicationName };
        const response = await axios.post(url, payload, this._authConfig);
        const responseJson = response.data;
        return {
            clientId: responseJson['ClientID'],
            clientSecret: responseJson['ClientSecret']
        };
    }

    public async getMetadata(): Promise<any> {
        const url = `${this._rootUrl}/$metadata?$format=json`;
        const response = await axios.get(url, this._authConfig);
        return response.data;
    }

    public async subscribeToDataChanges(
        instanceName: string,
        databaseName: string,
        targetUrl: string,
        additionalProperties: Record<string, any> = {}
    ): Promise<AxiosResponse> {
        const url = `${this._rootUrl}/Instances('${instanceName}')/Databases('${databaseName}')/tm1.Subscribe`;
        const payload = {
            "URL": targetUrl,
            "AdditionalProperties": additionalProperties
        };
        const response = await axios.post(url, payload, this._authConfig);
        return response;
    }

    public async unsubscribeFromDataChanges(
        instanceName: string,
        databaseName: string,
        targetUrl: string
    ): Promise<AxiosResponse> {
        const url = `${this._rootUrl}/Instances('${instanceName}')/Databases('${databaseName}')/tm1.Unsubscribe`;
        const response = await axios.post(url, this._authConfig);
        return response;
    }
}