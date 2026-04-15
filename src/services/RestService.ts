import axios, { AxiosInstance, AxiosResponse, AxiosRequestConfig } from 'axios';
import * as https from 'https';
import * as fs from 'fs';
import { TM1RestException, TM1TimeoutException } from '../exceptions/TM1Exception';

type UrlTopology = 'base_url' | 'v11' | 'ibm_cloud' | 'pa_proxy' | 's2s';

const PRODUCT_VERSION_AUTH_SUFFIX = '/Configuration/ProductVersion/$value';

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

    // v12 / Cloud URL components
    iamUrl?: string;
    paUrl?: string;
    cpdUrl?: string;

    // SSO / CAM
    gateway?: string;

    // Integrated Windows Auth / Kerberos (config surface; auth flow unchanged)
    integratedLogin?: boolean;
    integratedLoginDomain?: string;
    integratedLoginService?: string;
    integratedLoginHost?: string;
    integratedLoginDelegate?: boolean;

    // Network / TLS
    proxies?: { http?: string; https?: string };
    sslContext?: https.Agent;
    cert?: string | [string, string];
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

    public get version(): string | undefined {
        return this._serverVersion;
    }

    constructor(config: RestServiceConfig) {
        this.config = { ...config };
        this.setupAxiosInstance();
        if (this.config.sessionId) {
            // Mirror tm1py's _set_session_id_cookie: v12 topologies use paSession,
            // v11 and baseUrl overrides use TM1SessionId.
            const topo = this.determineTopology();
            const cookieName = (topo === 'ibm_cloud' || topo === 'pa_proxy' || topo === 's2s')
                ? 'paSession'
                : 'TM1SessionId';
            this.sessionCookies.set(cookieName, this.config.sessionId);
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

        const axiosConfig: AxiosRequestConfig = {
            baseURL,
            timeout: (this.config.timeout || 60) * 1000,
            headers: {
                ...RestService.HEADERS,
                ...(this.config.sessionContext && { 'TM1-SessionContext': this.config.sessionContext })
            }
        };

        if (this.config.proxies) {
            const proxyUrl = this.config.proxies.https || this.config.proxies.http;
            if (proxyUrl) {
                const parsed = new URL(proxyUrl);
                axiosConfig.proxy = {
                    host: parsed.hostname,
                    port: parsed.port
                        ? parseInt(parsed.port, 10)
                        : (parsed.protocol === 'https:' ? 443 : 80),
                    protocol: parsed.protocol.replace(':', ''),
                    ...(parsed.username && {
                        auth: {
                            username: decodeURIComponent(parsed.username),
                            password: decodeURIComponent(parsed.password)
                        }
                    })
                };
            }
        }

        if (this.config.sslContext) {
            axiosConfig.httpsAgent = this.config.sslContext;
        } else if (this.config.cert) {
            const [certPath, keyPath] = Array.isArray(this.config.cert)
                ? this.config.cert
                : [this.config.cert, undefined];
            axiosConfig.httpsAgent = new https.Agent({
                cert: fs.readFileSync(certPath),
                key: keyPath ? fs.readFileSync(keyPath) : undefined
            });
        }

        this.axiosInstance = axios.create(axiosConfig);

        this.setupInterceptors();
    }

    private buildBaseUrl(): string {
        return this.resolveRoots().serviceRoot;
    }

    /**
     * Pick the deployment topology based on the provided config, mirroring
     * tm1py's _determine_auth_mode + _construct_service_and_auth_root dispatch.
     *
     * Note: authUrl is intentionally excluded from the v12 signal set because
     * tm1npm historically uses authUrl for CAM SSO (unlike tm1py, where auth_url
     * is a v12-only field). apiKey is also excluded to avoid collision with the
     * existing BASIC_API_KEY auth flow.
     */
    private determineTopology(): UrlTopology {
        const c = this.config;
        const hasV12Signal = !!(c.instance || c.database || c.iamUrl || c.paUrl || c.tenant);
        // tm1py's _construct_service_and_auth_root routes v12 modes (IBM Cloud / PA
        // Proxy / S2S) through their dedicated constructors even if base_url is
        // supplied. Only non-v12 configs fall through to the base_url override.
        if (!hasV12Signal) return c.baseUrl ? 'base_url' : 'v11';
        if (c.iamUrl) return 'ibm_cloud';
        if (c.address && c.user && !c.instance) return 'pa_proxy';
        return 's2s';
    }

    /**
     * Resolve the TM1 service root and auth root URLs for the configured topology.
     * Mirrors tm1py's _construct_service_and_auth_root return tuple.
     */
    private resolveRoots(): { serviceRoot: string; authRoot: string } {
        switch (this.determineTopology()) {
            case 'base_url':  return this.rootsFromBaseUrl();
            case 'ibm_cloud': return this.rootsIbmCloud();
            case 'pa_proxy':  return this.rootsPaProxy();
            case 's2s':       return this.rootsS2s();
            case 'v11':
            default:          return this.rootsV11();
        }
    }

    private rootsV11(): { serviceRoot: string; authRoot: string } {
        const protocol = this.config.ssl ? 'https' : 'http';
        const address = this.config.address || 'localhost';
        const port = this.config.port ?? 8001;
        const serviceRoot = `${protocol}://${address}:${port}/api/v1`;
        return { serviceRoot, authRoot: serviceRoot + PRODUCT_VERSION_AUTH_SUFFIX };
    }

    private rootsIbmCloud(): { serviceRoot: string; authRoot: string } {
        const { address, tenant, database, ssl } = this.config;
        if (!address || !tenant || !database) {
            throw new Error("'address', 'tenant' and 'database' must be provided to connect to TM1 > v12 in IBM Cloud");
        }
        if (ssl === false) {
            throw new Error("'ssl' must be true to connect to TM1 > v12 in IBM Cloud");
        }
        const t = encodeURIComponent(tenant);
        const d = encodeURIComponent(database);
        const serviceRoot = `https://${address}/api/${t}/v0/tm1/${d}`;
        return { serviceRoot, authRoot: serviceRoot + PRODUCT_VERSION_AUTH_SUFFIX };
    }

    private rootsPaProxy(): { serviceRoot: string; authRoot: string } {
        const { address, database, ssl } = this.config;
        if (!address || !database) {
            throw new Error("'address' and 'database' must be provided to connect to TM1 > v12 using PA Proxy");
        }
        const protocol = ssl ? 'https' : 'http';
        const d = encodeURIComponent(database);
        const serviceRoot = `${protocol}://${address}/tm1/${d}/api/v1`;
        const authRoot = `${protocol}://${address}/login`;
        return { serviceRoot, authRoot };
    }

    private rootsS2s(): { serviceRoot: string; authRoot: string } {
        const { instance, database, ssl, port } = this.config;
        if (!instance || !database) {
            throw new Error("'instance' and 'database' arguments are required for v12 authentication with 'address'");
        }
        const protocol = ssl ? 'https' : 'http';
        const address = this.config.address && this.config.address.length > 0
            ? this.config.address
            : 'localhost';
        const portPart = port != null ? `:${port}` : '';
        const i = encodeURIComponent(instance);
        const d = encodeURIComponent(database);
        const serviceRoot = `${protocol}://${address}${portPart}/${i}/api/v1/Databases('${d}')`;
        const authRoot = `${protocol}://${address}${portPart}/${i}/auth/v1/session`;
        return { serviceRoot, authRoot };
    }

    private rootsFromBaseUrl(): { serviceRoot: string; authRoot: string } {
        const base = this.config.baseUrl!;
        if (this.config.address) {
            throw new Error("Base URL and Address cannot be specified at the same time");
        }
        if (/api\/v1\/Databases/.test(base)) {
            if (!this.config.authUrl) {
                throw new Error("Auth_url missing — when connecting to planning analytics engine using base_url, you must specify a corresponding auth_url");
            }
            return { serviceRoot: base, authRoot: this.config.authUrl };
        }
        // Recognize baseUrl shapes documented in docs/connection-guide.md
        // (TM1 11 IBM Cloud `/tm1/api/tm1`, TM1 12 PaaS/access-token `/v0/tm1/...`)
        // and use them verbatim. Only fall through to /api/v1 suffixing when the
        // URL clearly lacks any TM1 API path — matching tm1py's fallback.
        const trimmed = base.replace(/\/+$/, '');
        const hasApiSuffix = /\/api\/v1$|\/v0\/tm1\/|\/tm1\/api\/tm1$/.test(trimmed);
        const serviceRoot = hasApiSuffix ? trimmed : `${trimmed}/api/v1`;
        return { serviceRoot, authRoot: serviceRoot + PRODUCT_VERSION_AUTH_SUFFIX };
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
                if (error.response?.status === 401 && !originalRequest._retry && this.isConnected) {
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
                if (this.shouldRetryRequest(error) && this.canRetryRequest(originalRequest)) {
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

        // Both v11 and v11-style baseUrl topologies resolve authRoot to
        // /Configuration/ProductVersion/$value — a metadata probe, not a token
        // endpoint. Require callers to supply authUrl explicitly in those cases.
        // Validation lives outside the try/catch so its message is not double-wrapped.
        if (!this.config.authUrl) {
            const topo = this.determineTopology();
            const baseUrlIsV12 = topo === 'base_url'
                && /api\/v1\/Databases/.test(this.config.baseUrl ?? '');
            if (topo === 'v11' || (topo === 'base_url' && !baseUrlIsV12)) {
                throw new Error("'authUrl' is required for Service-to-Service authentication on v11 topology");
            }
        }

        try {
            const tokenEndpoint = this.config.authUrl || this.resolveRoots().authRoot;

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