import axios, { AxiosInstance, AxiosResponse, AxiosRequestConfig } from 'axios';
import { TM1RestException, TM1TimeoutException } from '../exceptions/TM1Exception';

export enum AuthenticationMode {
    BASIC = 1,
    WIA = 2,
    CAM = 3,
    CAM_SSO = 4,
    IBM_CLOUD_API_KEY = 5,
    SERVICE_TO_SERVICE = 6,
    PA_PROXY = 7,
    BASIC_API_KEY = 8,
    ACCESS_TOKEN = 9
}

export interface RestServiceConfig {
    address?: string;
    port?: number;
    ssl?: boolean;
    baseUrl?: string;
    user?: string;
    password?: string;
    decodeB64?: boolean;
    namespace?: string;
    sessionId?: string;
    sessionContext?: string;
    verify?: boolean | string;
    timeout?: number;
    cancelAtTimeout?: boolean;
    asyncRequestsMode?: boolean;
    connectionPoolSize?: number;
    poolConnections?: number;
    instance?: string;
    database?: string;
    authUrl?: string;
    camPassport?: string;
    applicationClientId?: string;
    applicationClientSecret?: string;
    apiKey?: string;
    accessToken?: string;
    tenant?: string;
}

export class RestService {
    private static readonly HEADERS = {
        'Connection': 'keep-alive',
        'User-Agent': 'tm1npm',
        'Content-Type': 'application/json; odata.streaming=true; charset=utf-8',
        'Accept': 'application/json;odata.metadata=none,text/plain',
        'TM1-SessionContext': 'tm1npm'
    };

    private static readonly DEFAULT_CONNECTION_POOL_SIZE = 10;
    private static readonly DEFAULT_POOL_CONNECTIONS = 1;

    private axiosInstance!: AxiosInstance;
    private config: RestServiceConfig;
    private sessionId?: string;
    private sandboxName?: string;
    private isConnected: boolean = false;
    public version?: string;

    constructor(config: RestServiceConfig) {
        this.config = { ...config };
        this.setupAxiosInstance();
    }

    private setupAxiosInstance(): void {
        const baseURL = this.buildBaseUrl();
        
        this.axiosInstance = axios.create({
            baseURL,
            timeout: (this.config.timeout || 60) * 1000,
            headers: {
                ...RestService.HEADERS,
                ...(this.config.sessionContext && { 'TM1-SessionContext': this.config.sessionContext })
            }
        });

        this.setupInterceptors();
    }

    private buildBaseUrl(): string {
        if (this.config.baseUrl) {
            return this.config.baseUrl;
        }

        const protocol = this.config.ssl ? 'https' : 'http';
        const address = this.config.address || 'localhost';
        const port = this.config.port || 8001;
        
        return `${protocol}://${address}:${port}/api/v1`;
    }

    private setupInterceptors(): void {
        // Request interceptor
        this.axiosInstance.interceptors.request.use(
            (config) => {
                if (this.sessionId) {
                    config.headers['TM1SessionId'] = this.sessionId;
                }
                if (this.sandboxName) {
                    config.headers['TM1-Sandbox'] = this.sandboxName;
                }
                return config;
            },
            (error) => Promise.reject(error)
        );

        // Response interceptor
        this.axiosInstance.interceptors.response.use(
            (response) => response,
            (error) => {
                if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
                    throw new TM1TimeoutException(`Request timeout: ${error.message}`);
                }
                
                const response = error.response;
                if (response) {
                    const message = this.extractErrorMessage(response);
                    throw new TM1RestException(message, response);
                }
                
                throw new TM1RestException(error.message);
            }
        );
    }

    private extractErrorMessage(response: AxiosResponse): string {
        try {
            if (response.data && response.data.error) {
                if (response.data.error.message) {
                    return response.data.error.message;
                }
                return JSON.stringify(response.data.error);
            }
            return `HTTP ${response.status}: ${response.statusText}`;
        } catch {
            return `HTTP ${response.status}: ${response.statusText}`;
        }
    }

    public async connect(): Promise<void> {
        try {
            // Basic authentication
            if (this.config.user && this.config.password) {
                const credentials = Buffer.from(`${this.config.user}:${this.config.password}`).toString('base64');
                this.axiosInstance.defaults.headers.common['Authorization'] = `Basic ${credentials}`;
            }

            // Test connection
            const response = await this.axiosInstance.get('/Configuration/ServerName');
            
            // Extract session ID from response headers
            const setCookie = response.headers['set-cookie'];
            if (setCookie) {
                for (const cookie of setCookie) {
                    const match = cookie.match(/TM1SessionId=([^;]+)/);
                    if (match) {
                        this.sessionId = match[1];
                        break;
                    }
                }
            }

            this.isConnected = true;
        } catch (error) {
            throw new TM1RestException(`Failed to connect to TM1: ${error}`);
        }
    }

    public async disconnect(): Promise<void> {
        if (this.isConnected && this.sessionId) {
            try {
                await this.axiosInstance.post('/ActiveSession/tm1.Close', {});
            } catch (error) {
                // Ignore errors during disconnect
            }
            this.isConnected = false;
            this.sessionId = undefined;
        }
    }

    public async get(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse> {
        return this.axiosInstance.get(url, config);
    }

    public async post(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse> {
        return this.axiosInstance.post(url, data, config);
    }

    public async patch(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse> {
        return this.axiosInstance.patch(url, data, config);
    }

    public async put(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse> {
        return this.axiosInstance.put(url, data, config);
    }

    public async delete(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse> {
        return this.axiosInstance.delete(url, config);
    }

    public getSessionId(): string | undefined {
        return this.sessionId;
    }

    public setSandbox(sandboxName?: string): void {
        this.sandboxName = sandboxName;
    }

    public getSandbox(): string | undefined {
        return this.sandboxName;
    }

    public isLoggedIn(): boolean {
        return this.isConnected && !!this.sessionId;
    }

    public async getApiMetadata(): Promise<any> {
        const response = await this.get("/$metadata");
        return response.data;
    }
}