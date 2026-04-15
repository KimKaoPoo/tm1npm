import axios, { AxiosInstance, AxiosResponse, AxiosRequestConfig } from 'axios';
import { TM1RestException, TM1TimeoutException } from '../exceptions/TM1Exception';
import { CaseAndSpaceInsensitiveSet, caseAndSpaceInsensitiveEquals } from '../utils/Utils';

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
    reConnectOnSessionTimeout?: boolean;
    reConnectOnRemoteDisconnect?: boolean;
    remoteDisconnectMaxRetries?: number;
    remoteDisconnectDelay?: number;
    remoteDisconnectMaxDelay?: number;
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

    private _isAdmin?: boolean;
    private _isDataAdmin?: boolean;
    private _isSecurityAdmin?: boolean;
    private _isOpsAdmin?: boolean;
    private _rolesLoading?: Promise<void>;

    private reConnectOnSessionTimeout!: boolean;
    private reConnectOnRemoteDisconnect!: boolean;
    private remoteDisconnectMaxRetries!: number;
    private remoteDisconnectDelay!: number;
    private remoteDisconnectMaxDelay!: number;

    public get version(): string | undefined {
        return this._serverVersion;
    }

    public get isAdmin(): boolean { return this._isAdmin ?? false; }
    public get isDataAdmin(): boolean { return this._isDataAdmin ?? false; }
    public get isSecurityAdmin(): boolean { return this._isSecurityAdmin ?? false; }
    public get isOpsAdmin(): boolean { return this._isOpsAdmin ?? false; }

    constructor(config: RestServiceConfig) {
        this.config = { ...config };

        this.reConnectOnSessionTimeout = config.reConnectOnSessionTimeout ?? true;
        this.reConnectOnRemoteDisconnect = config.reConnectOnRemoteDisconnect ?? true;
        this.remoteDisconnectMaxRetries = config.remoteDisconnectMaxRetries ?? 3;
        this.remoteDisconnectDelay = config.remoteDisconnectDelay ?? 1;
        this.remoteDisconnectMaxDelay = config.remoteDisconnectMaxDelay ?? 30;

        // ADMIN username fast-path (tm1py RestService.py:173-177)
        if (config.user && caseAndSpaceInsensitiveEquals(config.user, 'ADMIN')) {
            this._isAdmin = true;
            this._isDataAdmin = true;
            this._isSecurityAdmin = true;
            this._isOpsAdmin = true;
        }

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
                if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
                    throw new TM1TimeoutException(`Request timeout: ${error.message}`);
                }

                // Handle authentication errors with retry. Guarded by this.isConnected so a 401
                // during disconnect()'s tm1.Close POST cannot recurse back into reAuthenticate().
                if (this.reConnectOnSessionTimeout && error.response?.status === 401
                    && !originalRequest._retry && this.isConnected) {
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

                // Handle connection errors with retry (gated by reConnectOnRemoteDisconnect)
                if (this.reConnectOnRemoteDisconnect
                    && this.shouldRetryRequest(error) && this.canRetryRequest(originalRequest)) {
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
        // Don't retry if already retried maximum times
        config._retryCount = config._retryCount || 0;
        return config._retryCount < this.remoteDisconnectMaxRetries;
    }

    /**
     * Retry a failed request with exponential backoff, capped by remoteDisconnectMaxDelay
     */
    private async retryRequest(config: any): Promise<any> {
        config._retryCount = (config._retryCount || 0) + 1;

        const baseMs = this.remoteDisconnectDelay * 1000;
        const capMs = this.remoteDisconnectMaxDelay * 1000;
        const delay = Math.min(baseMs * Math.pow(2, config._retryCount - 1), capMs);
        await new Promise(resolve => setTimeout(resolve, delay));

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
            timeout: (this.config.timeout || 60) * 1000,
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
     * Load /ActiveUser/Groups once and populate all four admin role caches.
     * Deduplicates concurrent callers via _rolesLoading so parallel is_*_admin()
     * calls share a single HTTP request.
     * Uses CaseAndSpaceInsensitiveSet to match group names (tm1py RestService.py:961-994).
     */
    private loadActiveUserRoles(): Promise<void> {
        if (this._rolesLoading) return this._rolesLoading;
        this._rolesLoading = (async () => {
            try {
                const response = await this.get('/ActiveUser/Groups');
                const groups = new CaseAndSpaceInsensitiveSet();
                for (const g of (response.data.value || [])) {
                    if (g && typeof g.Name === 'string') groups.add(g.Name);
                }
                if (this._isAdmin === undefined)         this._isAdmin         = groups.has('ADMIN');
                if (this._isDataAdmin === undefined)     this._isDataAdmin     = groups.has('ADMIN') || groups.has('DataAdmin');
                if (this._isSecurityAdmin === undefined) this._isSecurityAdmin = groups.has('ADMIN') || groups.has('SecurityAdmin');
                if (this._isOpsAdmin === undefined)      this._isOpsAdmin      = groups.has('ADMIN') || groups.has('OperationsAdmin');
            } catch (err) {
                // Transient errors must not poison the cache: leave _is*Admin undefined so the
                // next call retries the fetch. Clear _rolesLoading so the next call doesn't
                // await this same already-failed promise.
                console.warn('Failed to load /ActiveUser/Groups; admin role flags will retry on next call:', err);
                this._rolesLoading = undefined;
                throw err;
            }
        })();
        return this._rolesLoading;
    }

    private async tryLoadActiveUserRoles(): Promise<void> {
        try { await this.loadActiveUserRoles(); } catch { /* transient — caller returns false */ }
    }

    /** Check if current user is admin (cached, case/space-insensitive). */
    public async is_admin(): Promise<boolean> {
        if (this._isAdmin === undefined) await this.tryLoadActiveUserRoles();
        return this._isAdmin ?? false;
    }

    /** Check if current user is data admin (cached, case/space-insensitive). */
    public async is_data_admin(): Promise<boolean> {
        if (this._isDataAdmin === undefined) await this.tryLoadActiveUserRoles();
        return this._isDataAdmin ?? false;
    }

    /** Check if current user is ops admin (cached, case/space-insensitive). */
    public async is_ops_admin(): Promise<boolean> {
        if (this._isOpsAdmin === undefined) await this.tryLoadActiveUserRoles();
        return this._isOpsAdmin ?? false;
    }

    /** Check if current user is security admin (cached, case/space-insensitive). */
    public async is_security_admin(): Promise<boolean> {
        if (this._isSecurityAdmin === undefined) await this.tryLoadActiveUserRoles();
        return this._isSecurityAdmin ?? false;
    }

    /**
     * Base64-decode an encoded password (tm1py RestService.py:1025-1031).
     */
    public static b64_decode_password(encryptedPassword: string): string {
        return Buffer.from(encryptedPassword, 'base64').toString('utf-8');
    }

    /**
     * Convert bool/number/string to boolean (tm1py RestService.py:1012-1023).
     * Strings: whitespace stripped, lowercased, compared to 'true'.
     */
    public static translate_to_boolean(value: boolean | number | string): boolean {
        if (typeof value === 'boolean') return value;
        if (typeof value === 'number') return Boolean(value);
        if (typeof value === 'string') return value.replace(/\s+/g, '').toLowerCase() === 'true';
        const rendered = (() => { try { return JSON.stringify(value); } catch { return String(value); } })();
        throw new Error(`Invalid argument: '${rendered}'. Must be of type 'bool', 'number', or 'str'`);
    }

    /**
     * Insert 'tm1.compact=v0' into the Accept header at position 1 and return the prior value.
     * Mirrors tm1py RestService.py:1105-1114 exactly (no idempotency guard).
     */
    public add_compact_json_header(): string {
        const original = (this.axiosInstance.defaults.headers.common['Accept'] as string | undefined)
            ?? RestService.HEADERS['Accept'];
        const parts = original.split(';');
        parts.splice(1, 0, 'tm1.compact=v0');
        const modified = parts.join(';');
        this.add_http_header('Accept', modified);
        return original;
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
        try {
            await this.post(`/AsyncOperations('${async_id}')/tm1.Cancel`);
        } catch (error) {
            throw new TM1RestException(`Failed to cancel async operation ${async_id}: ${error}`);
        }
    }

    /**
     * Retrieve async operation response
     */
    public async retrieve_async_response(async_id: string): Promise<any> {
        try {
            const response = await this.get(`/AsyncOperations('${async_id}')`);
            // Axios treats 2xx as success, but 202 means the operation is still running
            if (response.status === 202) {
                throw new TM1RestException('Async operation still running', 202, response);
            }
            return response.data;
        } catch (error: any) {
            if (error instanceof TM1RestException) {
                throw error;
            }
            const status = error?.status ?? error?.response?.status;
            throw new TM1RestException(
                `Failed to retrieve async response ${async_id}: ${error}`,
                status,
                error?.response
            );
        }
    }

    /**
     * Get async operation status
     */
    public async get_async_operation_status(async_id: string): Promise<string> {
        try {
            const response = await this.get(`/AsyncOperations('${async_id}')/Status/$value`);
            return response.data;
        } catch (error) {
            throw new TM1RestException(`Failed to get async operation status ${async_id}: ${error}`);
        }
    }

    /**
     * Wait for async operation to complete
     */
    public async wait_for_async_operation(
        async_id: string,
        timeout_seconds: number = 300,
        poll_interval_seconds: number = 1
    ): Promise<any> {
        const start_time = Date.now();
        const timeout_ms = timeout_seconds * 1000;
        const poll_interval_ms = poll_interval_seconds * 1000;

        while (Date.now() - start_time < timeout_ms) {
            const status = await this.get_async_operation_status(async_id);

            if (status === 'Completed' || status === 'CompletedSuccessfully') {
                return await this.retrieve_async_response(async_id);
            }

            if (status === 'Failed' || status === 'CompletedWithError') {
                const response = await this.retrieve_async_response(async_id);
                throw new TM1RestException(`Async operation failed: ${JSON.stringify(response)}`);
            }

            // Wait before polling again
            await new Promise(resolve => setTimeout(resolve, poll_interval_ms));
        }

        throw new TM1TimeoutException(`Async operation ${async_id} timed out after ${timeout_seconds} seconds`);
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