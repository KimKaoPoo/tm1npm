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
    asyncPollingInitialDelay?: number;
    asyncPollingMaxDelay?: number;
    asyncPollingBackoffFactor?: number;
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

export interface RequestOptions extends Omit<AxiosRequestConfig, 'timeout'> {
    asyncRequestsMode?: boolean;
    returnAsyncId?: boolean;
    timeout?: number;
    cancelAtTimeout?: boolean;
    idempotent?: boolean;
    verifyResponse?: boolean;
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

    private static readonly SESSION_COOKIE_NAMES = ['TM1SessionId', 'paSession'] as const;

    private axiosInstance!: AxiosInstance;
    private config: RestServiceConfig;
    private sessionCookies: Map<string, string> = new Map();
    private sandboxName?: string;
    private isConnected: boolean = false;
    private _serverVersion?: string;
    private _asyncRequestsMode: boolean;
    private _cancelAtTimeout: boolean;
    private _timeout: number;
    private _asyncPollingInitialDelay: number;
    private _asyncPollingMaxDelay: number;
    private _asyncPollingBackoffFactor: number;

    public get version(): string | undefined {
        return this._serverVersion;
    }

    constructor(config: RestServiceConfig) {
        this.config = { ...config };
        this._asyncRequestsMode = config.asyncRequestsMode ?? false;
        this._cancelAtTimeout = config.cancelAtTimeout ?? false;
        this._timeout = config.timeout ?? 60;
        this._asyncPollingInitialDelay = config.asyncPollingInitialDelay ?? 0.1;
        this._asyncPollingMaxDelay = config.asyncPollingMaxDelay ?? 1.0;
        this._asyncPollingBackoffFactor = config.asyncPollingBackoffFactor ?? 2.0;
        this.setupAxiosInstance();
        if (this.config.sessionId) {
            // v12 paSession seeding via config is not yet modeled.
            this.sessionCookies.set(RestService.SESSION_COOKIE_NAMES[0], this.config.sessionId);
        }
    }

    private getSessionCookieValue(): string | undefined {
        for (const name of RestService.SESSION_COOKIE_NAMES) {
            const value = this.sessionCookies.get(name);
            if (value) return value;
        }
        return undefined;
    }

    private buildCookieHeader(): string | undefined {
        if (this.sessionCookies.size === 0) return undefined;
        const parts: string[] = [];
        for (const [name, value] of this.sessionCookies) {
            parts.push(`${name}=${value}`);
        }
        return parts.join('; ');
    }

    private parseSetCookieHeaders(setCookie: string[] | string | undefined): void {
        if (!setCookie) return;
        const list = Array.isArray(setCookie) ? setCookie : [setCookie];
        for (const raw of list) {
            const firstSegment = raw.split(';')[0];
            const eqIdx = firstSegment.indexOf('=');
            if (eqIdx <= 0) continue;
            // Strip CR/LF/NUL defensively to block header-injection via compromised response
            const sanitize = (s: string) => s.replace(/[\r\n\0]/g, '').trim();
            const name = sanitize(firstSegment.slice(0, eqIdx));
            const value = sanitize(firstSegment.slice(eqIdx + 1));
            if (!(RestService.SESSION_COOKIE_NAMES as readonly string[]).includes(name)) continue;
            if (value === '') {
                this.sessionCookies.delete(name);
            } else {
                this.sessionCookies.set(name, value);
            }
        }
    }

    private removeAuthorizationHeader(): void {
        delete this.axiosInstance.defaults.headers.common['Authorization'];
    }

    private deleteHeaderCaseInsensitive(headers: Record<string, unknown> | undefined, name: string): void {
        if (!headers) return;
        // axios 1.x may supply an AxiosHeaders instance with case-insensitive lookup; plain objects
        // (common in retry paths and test mocks) are case-sensitive and require explicit iteration
        const target = name.toLowerCase();
        for (const key of Object.keys(headers)) {
            if (key.toLowerCase() === target) {
                delete (headers as Record<string, unknown>)[key];
            }
        }
    }

    private setupAxiosInstance(): void {
        const baseURL = this.buildBaseUrl();
        
        this.axiosInstance = axios.create({
            baseURL,
            timeout: this._timeout * 1000,
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
                const cookieHeader = this.buildCookieHeader();
                if (cookieHeader) {
                    config.headers['Cookie'] = cookieHeader;
                }
                if (this.sandboxName) {
                    config.headers['TM1-Sandbox'] = this.sandboxName;
                }
                return config;
            },
            (error) => Promise.reject(error)
        );

        // Response interceptor with retry logic
        this.axiosInstance.interceptors.response.use(
            (response) => {
                this.parseSetCookieHeaders(response.headers?.['set-cookie']);
                return response;
            },
            async (error) => {
                if (error.response) {
                    this.parseSetCookieHeaders(error.response.headers?.['set-cookie']);
                }
                const originalRequest = error.config;

                // Handle timeout errors
                if (error.code === 'ECONNABORTED' || error.message?.includes?.('timeout')) {
                    throw new TM1TimeoutException(`Request timeout: ${error.message}`);
                }

                // Handle authentication errors with retry. Guarded by this.isConnected so a 401
                // during disconnect()'s tm1.Close POST cannot recurse back into reAuthenticate().
                if (error.response?.status === 401 && originalRequest && !originalRequest._retry && this.isConnected) {
                    originalRequest._retry = true;

                    try {
                        await this.reAuthenticate();

                        // Stale values would defeat the rebuild by the request interceptor on replay
                        this.deleteHeaderCaseInsensitive(originalRequest.headers, 'Cookie');
                        this.deleteHeaderCaseInsensitive(originalRequest.headers, 'Authorization');

                        return this.axiosInstance(originalRequest);
                    } catch (reAuthError) {
                        // Re-authentication failed, throw original error
                        console.warn('Re-authentication failed:', reAuthError);
                    }
                }

                // Handle connection errors with retry
                if (originalRequest && this.shouldRetryRequest(error) && this.canRetryRequest(originalRequest)) {
                    return this.retryRequest(originalRequest);
                }

                const response = error.response;
                if (response) {
                    const message = this.extractErrorMessage(response);
                    throw new TM1RestException(message, response.status, response);
                }

                throw new TM1RestException(error.message);
            }
        );
    }

    /**
     * Determine if a request should be retried
     */
    private shouldRetryRequest(error: any): boolean {
        // Retry on network errors, timeouts, and 5xx server errors
        return !error.response ||
               error.code === 'ECONNRESET' ||
               error.code === 'ENOTFOUND' ||
               error.code === 'ECONNREFUSED' ||
               (error.response.status >= 500 && error.response.status < 600);
    }

    /**
     * Check if a request can be retried
     */
    private canRetryRequest(config: any): boolean {
        if (config._idempotent === false) {
            return false;
        }
        // Don't retry if already retried maximum times
        config._retryCount = config._retryCount || 0;
        return config._retryCount < 3;
    }

    /**
     * Retry a failed request with exponential backoff
     */
    private async retryRequest(config: any): Promise<any> {
        config._retryCount = config._retryCount || 0;
        config._retryCount++;

        const retryDelay = Math.pow(2, config._retryCount) * 1000; // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, retryDelay));

        return this.axiosInstance(config);
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

    private *waitTimeGenerator(timeout: number): Generator<number> {
        let delay = this._asyncPollingInitialDelay;
        let elapsed = 0;

        if (timeout) {
            while (elapsed < timeout) {
                yield delay;
                elapsed += delay;
                delay = Math.min(delay * this._asyncPollingBackoffFactor, this._asyncPollingMaxDelay);
            }
        } else {
            while (true) {
                yield delay;
                delay = Math.min(delay * this._asyncPollingBackoffFactor, this._asyncPollingMaxDelay);
            }
        }
    }

    private async _executeSyncRequest(
        method: string,
        url: string,
        data?: any,
        timeout?: number,
        idempotent?: boolean,
        axiosExtras?: Partial<AxiosRequestConfig>
    ): Promise<AxiosResponse> {
        const config: AxiosRequestConfig = {
            method: method as AxiosRequestConfig['method'],
            url,
            data,
            ...axiosExtras
        };

        if (timeout !== undefined) {
            config.timeout = timeout * 1000;
        }

        (config as any)._idempotent = idempotent ?? false;

        return this.axiosInstance.request(config);
    }

    private async _executeAsyncRequest(
        method: string,
        url: string,
        data?: any,
        timeout?: number,
        cancelAtTimeout?: boolean,
        returnAsyncId?: boolean,
        idempotent?: boolean,
        axiosExtras?: Partial<AxiosRequestConfig>
    ): Promise<AxiosResponse | string> {
        const preferValue = returnAsyncId ? 'respond-async' : 'respond-async,wait=55';
        const config: AxiosRequestConfig = {
            method: method as AxiosRequestConfig['method'],
            url,
            data,
            ...axiosExtras,
            headers: {
                ...axiosExtras?.headers,
                Prefer: preferValue
            }
        };

        if (timeout !== undefined) {
            config.timeout = timeout * 1000;
        }

        (config as any)._idempotent = idempotent ?? false;

        const response = await this.axiosInstance.request(config);

        if (response.status !== 202) {
            return response;
        }

        const location = response.headers['location'] || response.headers['Location'] || '';
        const match = typeof location === 'string' ? location.match(/\('([^']+)'\)/) : null;
        const asyncId = match ? match[1] : undefined;

        if (!asyncId) {
            throw new TM1RestException(
                `Async request returned 202 but no valid async ID in Location header: ${location}`
            );
        }

        if (returnAsyncId) {
            return asyncId;
        }

        return this._pollAsyncResponse(
            asyncId,
            timeout ?? this._timeout,
            cancelAtTimeout ?? this._cancelAtTimeout
        );
    }

    private async _pollAsyncResponse(
        asyncId: string,
        timeout: number,
        cancelAtTimeout: boolean
    ): Promise<AxiosResponse> {
        for (const wait of this.waitTimeGenerator(timeout)) {
            const response = await this.retrieve_async_response(asyncId);

            if (response.status === 200 || response.status === 201) {
                return response;
            }

            await new Promise(resolve => setTimeout(resolve, wait * 1000));
        }

        if (cancelAtTimeout) {
            try {
                await this.cancel_async_operation(asyncId);
            } catch (cancelError) {
                console.warn(`Failed to cancel async operation ${asyncId} at timeout:`, cancelError);
            }
        }

        throw new TM1TimeoutException(
            `Async operation ${asyncId} timed out after ${timeout} seconds`,
            timeout
        );
    }

    private async _request(
        method: string,
        url: string,
        data?: any,
        options?: RequestOptions
    ): Promise<AxiosResponse | string> {
        const timeout = options?.timeout || this._timeout;
        const cancelAtTimeout = options?.cancelAtTimeout ?? this._cancelAtTimeout;
        const asyncMode = options?.returnAsyncId || (options?.asyncRequestsMode ?? this._asyncRequestsMode);
        const verifyResponse = options?.verifyResponse ?? true;
        const idempotent = options?.idempotent ?? false;
        const {
            asyncRequestsMode: _asyncModeOpt,
            returnAsyncId,
            cancelAtTimeout: _cancelAtTimeoutOpt,
            idempotent: _idempotentOpt,
            verifyResponse: _verifyResponseOpt,
            timeout: _timeoutOpt,
            ...axiosExtras
        } = options ?? {};

        if (!verifyResponse && axiosExtras.validateStatus === undefined) {
            axiosExtras.validateStatus = () => true;
        }

        if (asyncMode) {
            return this._executeAsyncRequest(
                method,
                url,
                data,
                timeout,
                cancelAtTimeout,
                returnAsyncId,
                idempotent,
                axiosExtras
            );
        }

        return this._executeSyncRequest(method, url, data, timeout, idempotent, axiosExtras);
    }

    public async connect(): Promise<void> {
        try {
            if (this.getSessionCookieValue() === undefined) {
                await this.setupAuthentication();
            }

            await this.axiosInstance.get('/Configuration/ServerName');

            // Strip Authorization only if the session cookie is established; Bearer/API-key
            // modes that never issue a cookie must keep Authorization to stay authenticated
            if (this.getSessionCookieValue()) {
                this.removeAuthorizationHeader();
            }

            this.isConnected = true;
        } catch (error) {
            throw new TM1RestException(`Failed to connect to TM1: ${error}`);
        }
    }

    public async disconnect(): Promise<void> {
        const shouldClose = this.isConnected && !!this.getSessionCookieValue();
        // Flip isConnected first so a 401 on tm1.Close cannot trigger reAuthenticate recursion
        this.isConnected = false;
        if (shouldClose) {
            try {
                await this.axiosInstance.post('/ActiveSession/tm1.Close', {});
            } catch (error) {
                // Ignore errors during disconnect
            }
        }
        this.sessionCookies.clear();
    }

    /**
     * When `returnAsyncId: true`, the caller receives the async id string
     * iff the server returns `202 Accepted`. If TM1 short-circuits with
     * `200/201`, the full `AxiosResponse` is returned instead — the
     * declared `Promise<string>` return type is a best-effort narrowing.
     */
    public async get(url: string, options: RequestOptions & { returnAsyncId: true }): Promise<string>;
    public async get(url: string, options?: RequestOptions): Promise<AxiosResponse>;
    public async get(url: string, options?: RequestOptions): Promise<AxiosResponse | string> {
        return this._request('GET', url, undefined, { idempotent: true, ...options });
    }

    public async post(url: string, data: any, options: RequestOptions & { returnAsyncId: true }): Promise<string>;
    public async post(url: string, data?: any, options?: RequestOptions): Promise<AxiosResponse>;
    public async post(url: string, data?: any, options?: RequestOptions): Promise<AxiosResponse | string> {
        return this._request('POST', url, data, options);
    }

    public async patch(url: string, data: any, options: RequestOptions & { returnAsyncId: true }): Promise<string>;
    public async patch(url: string, data?: any, options?: RequestOptions): Promise<AxiosResponse>;
    public async patch(url: string, data?: any, options?: RequestOptions): Promise<AxiosResponse | string> {
        return this._request('PATCH', url, data, options);
    }

    public async put(url: string, data: any, options: RequestOptions & { returnAsyncId: true }): Promise<string>;
    public async put(url: string, data?: any, options?: RequestOptions): Promise<AxiosResponse>;
    public async put(url: string, data?: any, options?: RequestOptions): Promise<AxiosResponse | string> {
        return this._request('PUT', url, data, options);
    }

    public async delete(url: string, options: RequestOptions & { returnAsyncId: true }): Promise<string>;
    public async delete(url: string, options?: RequestOptions): Promise<AxiosResponse>;
    public async delete(url: string, options?: RequestOptions): Promise<AxiosResponse | string> {
        return this._request('DELETE', url, undefined, options);
    }

    public getSessionId(): string | undefined {
        return this.getSessionCookieValue();
    }

    public setSandbox(sandboxName?: string): void {
        this.sandboxName = sandboxName;
    }

    public getSandbox(): string | undefined {
        return this.sandboxName;
    }

    public isLoggedIn(): boolean {
        return this.isConnected && !!this.getSessionCookieValue();
    }

    public async getApiMetadata(): Promise<any> {
        const response = await this.get("/$metadata");
        return response.data;
    }

    /**
     * Set up authentication based on configuration
     */
    private async setupAuthentication(): Promise<void> {
        // Access Token authentication (TM1 12+ with JWT tokens)
        if (this.config.accessToken) {
            this.axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${this.config.accessToken}`;
            return;
        }

        // API Key authentication (TM1 12+ PAaaS)
        if (this.config.apiKey) {
            if (this.config.user === 'apikey') {
                // IBM Cloud API Key style
                this.axiosInstance.defaults.headers.common['Authorization'] = `Basic ${Buffer.from(`apikey:${this.config.apiKey}`).toString('base64')}`;
            } else {
                // Basic API Key style
                this.axiosInstance.defaults.headers.common['API-Key'] = this.config.apiKey;
            }
            return;
        }

        // CAM (Cognos Access Manager) authentication
        if (this.config.authUrl && this.config.camPassport) {
            await this.setupCamAuthentication();
            return;
        }

        // CAM SSO authentication
        if (this.config.authUrl && this.config.user && this.config.password && this.config.namespace) {
            await this.setupCamSsoAuthentication();
            return;
        }

        // Service-to-Service authentication
        if (this.config.applicationClientId && this.config.applicationClientSecret) {
            await this.setupServiceToServiceAuthentication();
            return;
        }

        // Basic authentication (default)
        if (this.config.user && this.config.password) {
            const credentials = Buffer.from(`${this.config.user}:${this.config.password}`).toString('base64');
            this.axiosInstance.defaults.headers.common['Authorization'] = `Basic ${credentials}`;

            // Add namespace for TM1 Cloud
            if (this.config.namespace) {
                this.axiosInstance.defaults.headers.common['TM1-Namespace'] = this.config.namespace;
            }
            return;
        }

        throw new Error('No valid authentication configuration provided');
    }

    /**
     * Set up CAM (Cognos Access Manager) authentication
     */
    private async setupCamAuthentication(): Promise<void> {
        if (!this.config.authUrl || !this.config.camPassport) {
            throw new Error('CAM authentication requires authUrl and camPassport');
        }

        try {
            const authResponse = await axios.post(this.config.authUrl, {
                parameters: [{
                    name: 'CAMPassport',
                    value: this.config.camPassport
                }]
            }, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (authResponse.data && authResponse.data.sessionId) {
                this.sessionCookies.set(RestService.SESSION_COOKIE_NAMES[0], authResponse.data.sessionId);
            } else {
                throw new Error('CAM authentication failed: No session ID returned');
            }
        } catch (error) {
            throw new Error(`CAM authentication failed: ${error}`);
        }
    }

    /**
     * Set up CAM SSO authentication
     */
    private async setupCamSsoAuthentication(): Promise<void> {
        if (!this.config.authUrl || !this.config.user || !this.config.password || !this.config.namespace) {
            throw new Error('CAM SSO authentication requires authUrl, user, password, and namespace');
        }

        try {
            const authPayload = {
                username: this.config.user,
                password: this.config.password,
                namespace: this.config.namespace
            };

            const authResponse = await axios.post(this.config.authUrl, authPayload, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (authResponse.data && authResponse.data.token) {
                this.axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${authResponse.data.token}`;
            } else if (authResponse.data && authResponse.data.sessionId) {
                this.sessionCookies.set(RestService.SESSION_COOKIE_NAMES[0], authResponse.data.sessionId);
            } else {
                throw new Error('CAM SSO authentication failed: No token or session ID returned');
            }
        } catch (error) {
            throw new Error(`CAM SSO authentication failed: ${error}`);
        }
    }

    /**
     * Set up Service-to-Service authentication
     */
    private async setupServiceToServiceAuthentication(): Promise<void> {
        if (!this.config.applicationClientId || !this.config.applicationClientSecret) {
            throw new Error('Service-to-Service authentication requires applicationClientId and applicationClientSecret');
        }

        try {
            const tokenEndpoint = this.config.authUrl || `${this.buildBaseUrl()}/oauth/token`;

            const tokenPayload = {
                grant_type: 'client_credentials',
                client_id: this.config.applicationClientId,
                client_secret: this.config.applicationClientSecret
            };

            const tokenResponse = await axios.post(tokenEndpoint, tokenPayload, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            if (tokenResponse.data && tokenResponse.data.access_token) {
                this.axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${tokenResponse.data.access_token}`;
            } else {
                throw new Error('Service-to-Service authentication failed: No access token returned');
            }
        } catch (error) {
            throw new Error(`Service-to-Service authentication failed: ${error}`);
        }
    }

    /**
     * Get the authentication mode being used
     */
    public getAuthenticationMode(): AuthenticationMode {
        if (this.config.accessToken) {
            return AuthenticationMode.ACCESS_TOKEN;
        }
        if (this.config.apiKey) {
            return this.config.user === 'apikey' ?
                AuthenticationMode.IBM_CLOUD_API_KEY :
                AuthenticationMode.BASIC_API_KEY;
        }
        if (this.config.authUrl && this.config.camPassport) {
            return AuthenticationMode.CAM;
        }
        if (this.config.authUrl && this.config.user && this.config.password && this.config.namespace) {
            return AuthenticationMode.CAM_SSO;
        }
        if (this.config.applicationClientId && this.config.applicationClientSecret) {
            return AuthenticationMode.SERVICE_TO_SERVICE;
        }
        return AuthenticationMode.BASIC;
    }

    /**
     * Re-authenticate using stored configuration
     */
    public async reAuthenticate(): Promise<void> {
        await this.disconnect();
        await this.connect();
    }

    /**
     * Perform health check to verify connection status
     */
    public async healthCheck(): Promise<{ healthy: boolean; latency: number; serverName?: string; error?: string }> {
        const startTime = Date.now();

        try {
            const response = await this.axiosInstance.get('/Configuration/ServerName', {
                timeout: 5000 // 5 second timeout for health check
            });

            const latency = Date.now() - startTime;

            return {
                healthy: true,
                latency,
                serverName: response.data.value
            };
        } catch (error: any) {
            const latency = Date.now() - startTime;

            return {
                healthy: false,
                latency,
                error: error.message || 'Health check failed'
            };
        }
    }

    /**
     * Get connection statistics
     */
    public getConnectionStats(): {
        isConnected: boolean;
        sessionId?: string;
        authMode: AuthenticationMode;
        baseUrl: string;
        timeout: number;
        sandbox?: string;
    } {
        return {
            isConnected: this.isConnected,
            sessionId: this.getSessionCookieValue(),
            authMode: this.getAuthenticationMode(),
            baseUrl: this.buildBaseUrl(),
            timeout: this._timeout,
            sandbox: this.sandboxName
        };
    }

    /**
     * Test connection with detailed diagnostics
     */
    public async testConnection(): Promise<{
        success: boolean;
        details: {
            baseUrl: string;
            authMode: string;
            serverReachable: boolean;
            authenticationValid: boolean;
            sessionActive: boolean;
            serverName?: string;
            version?: string;
            errorMessage?: string;
        }
    }> {
        const result = {
            success: false,
            details: {
                baseUrl: this.buildBaseUrl(),
                authMode: AuthenticationMode[this.getAuthenticationMode()],
                serverReachable: false,
                authenticationValid: false,
                sessionActive: false
            } as any
        };

        try {
            // Test 1: Server reachability
            const healthCheck = await this.healthCheck();
            result.details.serverReachable = healthCheck.healthy;
            result.details.serverName = healthCheck.serverName;

            if (!healthCheck.healthy) {
                result.details.errorMessage = healthCheck.error;
                return result;
            }

            // Test 2: Authentication
            try {
                const versionResponse = await this.get('/Configuration/ProductVersion');
                result.details.authenticationValid = true;
                result.details.version = versionResponse.data.value;
            } catch (authError: any) {
                result.details.errorMessage = `Authentication failed: ${authError.message}`;
                return result;
            }

            // Test 3: Session activity
            result.details.sessionActive = this.isLoggedIn();

            result.success = result.details.serverReachable &&
                           result.details.authenticationValid &&
                           result.details.sessionActive;

        } catch (error: any) {
            result.details.errorMessage = `Connection test failed: ${error.message}`;
        }

        return result;
    }

    /**
     * Monitor connection with periodic health checks
     */
    public startConnectionMonitoring(
        intervalMs: number = 30000,
        onStatusChange?: (healthy: boolean, stats: any) => void
    ): () => void {
        let lastHealthy = true;

        const monitor = setInterval(async () => {
            const health = await this.healthCheck();

            if (health.healthy !== lastHealthy) {
                lastHealthy = health.healthy;
                onStatusChange?.(health.healthy, health);
            }
        }, intervalMs);

        // Return stop function
        return () => clearInterval(monitor);
    }

    // ===== CRITICAL MISSING METHODS FOR TM1PY PARITY =====

    /**
     * Logout and close the session
     */
    public async logout(): Promise<void> {
        await this.disconnect();
    }

    /**
     * Check if currently connected to TM1
     */
    public is_connected(): boolean {
        return this.isConnected && !!this.getSessionCookieValue();
    }

    /**
     * Get the current session ID
     */
    public session_id(): string | undefined {
        return this.getSessionCookieValue();
    }

    /**
     * Get TM1 server version (async method for tm1py compatibility)
     */
    public async getVersion(): Promise<string> {
        if (this._serverVersion) {
            return this._serverVersion;
        }

        const response = await this.get('/Configuration/ProductVersion');
        this._serverVersion = response.data.value;
        if (!this._serverVersion) {
            throw new TM1RestException('Failed to get server version: No version returned');
        }
        return this._serverVersion;
    }

    /**
     * Set the server version (for compatibility checks)
     */
    public set_version(version: string): void {
        this._serverVersion = version;
    }

    /**
     * Check if current user is admin
     */
    public async is_admin(): Promise<boolean> {
        try {
            const response = await this.get('/ActiveUser/Groups');
            const groups = response.data.value || [];
            return groups.some((g: any) => g.Name === 'ADMIN');
        } catch (error) {
            return false;
        }
    }

    /**
     * Check if current user is data admin
     */
    public async is_data_admin(): Promise<boolean> {
        try {
            const response = await this.get('/ActiveUser/Groups');
            const groups = response.data.value || [];
            return groups.some((g: any) => g.Name === 'ADMIN' || g.Name === 'DataAdmin');
        } catch (error) {
            return false;
        }
    }

    /**
     * Check if current user is ops admin
     */
    public async is_ops_admin(): Promise<boolean> {
        try {
            const response = await this.get('/ActiveUser/Groups');
            const groups = response.data.value || [];
            return groups.some((g: any) => g.Name === 'ADMIN' || g.Name === 'OperationsAdmin');
        } catch (error) {
            return false;
        }
    }

    /**
     * Check if current user is security admin
     */
    public async is_security_admin(): Promise<boolean> {
        try {
            const response = await this.get('/ActiveUser/Groups');
            const groups = response.data.value || [];
            return groups.some((g: any) => g.Name === 'ADMIN' || g.Name === 'SecurityAdmin');
        } catch (error) {
            return false;
        }
    }

    /**
     * Add custom HTTP header to all requests
     */
    public add_http_header(key: string, value: string): void {
        this.axiosInstance.defaults.headers.common[key] = value;
    }

    /**
     * Remove custom HTTP header
     */
    public remove_http_header(key: string): void {
        delete this.axiosInstance.defaults.headers.common[key];
    }

    /**
     * Get all custom HTTP headers
     */
    public get_http_headers(): { [key: string]: string } {
        const headers: { [key: string]: string } = {};
        const commonHeaders = this.axiosInstance.defaults.headers.common;

        for (const key in commonHeaders) {
            const value = commonHeaders[key];
            if (value !== undefined) {
                headers[key] = String(value);
            }
        }

        return headers;
    }

    /**
     * Cancel an async operation by ID
     */
    public async cancel_async_operation(async_id: string): Promise<void> {
        await this.delete(`/_async('${async_id}')`, { asyncRequestsMode: false });
    }

    /**
     * Retrieve async operation response
     */
    public async retrieve_async_response(async_id: string): Promise<AxiosResponse> {
        return this.get(`/_async('${async_id}')`, { asyncRequestsMode: false }) as Promise<AxiosResponse>;
    }

    /**
     * TM1 v12 returns completed async results with HTTP 200 and encodes
     * the true operation status in the `asyncresult` header (e.g.
     * "500 Internal Server Error"). Mirror tm1py's
     * `_transform_async_response` by throwing on any embedded non-2xx
     * status so callers are not handed a 500 as "success".
     */
    private verifyAsyncResultHeader(response: AxiosResponse): void {
        const headerValue = response.headers?.['asyncresult'] ?? response.headers?.['AsyncResult'];
        if (typeof headerValue !== 'string') return;
        const embeddedStatus = parseInt(headerValue.trim().split(/\s+/)[0], 10);
        if (Number.isNaN(embeddedStatus)) return;
        if (embeddedStatus >= 200 && embeddedStatus < 300) return;
        throw new TM1RestException(
            `Async operation failed with status ${headerValue}`,
            embeddedStatus,
            response
        );
    }

    /**
     * Wait for async operation to complete using a fixed polling cadence.
     *
     * Unlike the internal dispatcher's {@link waitTimeGenerator} (capped
     * exponential backoff), this public helper polls every
     * {@link poll_interval_seconds} seconds so existing callers who tuned
     * the cadence keep their original behavior.
     */
    public async wait_for_async_operation(
        async_id: string,
        timeout_seconds: number = 300,
        poll_interval_seconds: number = 1,
        cancel_at_timeout: boolean = false
    ): Promise<any> {
        const deadline = Date.now() + timeout_seconds * 1000;

        while (Date.now() < deadline) {
            const response = await this.retrieve_async_response(async_id);
            if (response.status === 200 || response.status === 201) {
                this.verifyAsyncResultHeader(response);
                return response.data;
            }
            await new Promise(resolve => setTimeout(resolve, poll_interval_seconds * 1000));
        }

        if (cancel_at_timeout) {
            try {
                await this.cancel_async_operation(async_id);
            } catch (cancelError) {
                console.warn(`Failed to cancel async operation ${async_id} at timeout:`, cancelError);
            }
        }

        throw new TM1TimeoutException(
            `Async operation ${async_id} timed out after ${timeout_seconds} seconds`,
            timeout_seconds
        );
    }

    /**
     * Get active user name
     */
    public async get_active_user(): Promise<string> {
        try {
            const response = await this.get('/ActiveUser/Name/$value');
            return response.data;
        } catch (error) {
            throw new TM1RestException(`Failed to get active user: ${error}`);
        }
    }

    /**
     * Get active user's friendly name
     */
    public async get_active_user_friendly_name(): Promise<string> {
        try {
            const response = await this.get('/ActiveUser/FriendlyName/$value');
            return response.data;
        } catch (error) {
            throw new TM1RestException(`Failed to get active user friendly name: ${error}`);
        }
    }

    /**
     * Impersonate another user (requires admin privileges)
     */
    public async impersonate(user_name: string): Promise<void> {
        this.add_http_header('TM1-Impersonate', user_name);
    }

    /**
     * Cancel impersonation
     */
    public async cancel_impersonation(): Promise<void> {
        this.remove_http_header('TM1-Impersonate');
    }

    /**
     * Get server name
     */
    public async get_server_name(): Promise<string> {
        try {
            const response = await this.get('/Configuration/ServerName/$value');
            return response.data;
        } catch (error) {
            throw new TM1RestException(`Failed to get server name: ${error}`);
        }
    }

    /**
     * Get admin host
     */
    public async get_admin_host(): Promise<string> {
        try {
            const response = await this.get('/Configuration/AdminHost/$value');
            return response.data;
        } catch (error) {
            throw new TM1RestException(`Failed to get admin host: ${error}`);
        }
    }

    /**
     * Get data directory
     */
    public async get_data_directory(): Promise<string> {
        try {
            const response = await this.get('/Configuration/ServerDataDirectory/$value');
            return response.data;
        } catch (error) {
            throw new TM1RestException(`Failed to get data directory: ${error}`);
        }
    }
}
