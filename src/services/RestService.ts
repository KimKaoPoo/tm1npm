import axios, { AxiosInstance, AxiosResponse, AxiosRequestConfig } from 'axios';
import * as https from 'https';
import * as fs from 'fs';
import { TM1RestException, TM1TimeoutException } from '../exceptions/TM1Exception';
import { formatUrl } from '../utils/Utils';

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
        const list = RestService.normaliseSetCookie(setCookie);
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
            timeout: this._timeout * 1000,
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
        if (!ssl) {
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
        // Each alternative is $-anchored (after trailing-slash trim above) so the
        // match intent is explicit: the URL already ends in a TM1 API suffix.
        const hasApiSuffix = /\/api\/v1$|\/v0\/tm1\/[^/]+$|\/tm1\/api\/tm1$/.test(trimmed);
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
            // Server completed synchronously. If the caller asked for an async
            // ID (returnAsyncId: true) there is none to return — hand back the
            // full response so the caller can inspect the result directly.
            return response;
        }

        const location = response.headers['location'] || '';
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
                this.verifyAsyncResultHeader(response);
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
        const timeout = options?.timeout ?? this._timeout;
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
        const shouldClose = this.isConnected;
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
    public async get(url: string, options: RequestOptions & { returnAsyncId: true }): Promise<string | AxiosResponse>;
    public async get(url: string, options?: RequestOptions): Promise<AxiosResponse>;
    public async get(url: string, options?: RequestOptions): Promise<AxiosResponse | string> {
        return this._request('GET', url, undefined, { idempotent: true, ...options });
    }

    public async post(url: string, data: any, options: RequestOptions & { returnAsyncId: true }): Promise<string | AxiosResponse>;
    public async post(url: string, data?: any, options?: RequestOptions): Promise<AxiosResponse>;
    public async post(url: string, data?: any, options?: RequestOptions): Promise<AxiosResponse | string> {
        return this._request('POST', url, data, options);
    }

    public async patch(url: string, data: any, options: RequestOptions & { returnAsyncId: true }): Promise<string | AxiosResponse>;
    public async patch(url: string, data?: any, options?: RequestOptions): Promise<AxiosResponse>;
    public async patch(url: string, data?: any, options?: RequestOptions): Promise<AxiosResponse | string> {
        return this._request('PATCH', url, data, options);
    }

    public async put(url: string, data: any, options: RequestOptions & { returnAsyncId: true }): Promise<string | AxiosResponse>;
    public async put(url: string, data?: any, options?: RequestOptions): Promise<AxiosResponse>;
    public async put(url: string, data?: any, options?: RequestOptions): Promise<AxiosResponse | string> {
        return this._request('PUT', url, data, options);
    }

    public async delete(url: string, options: RequestOptions & { returnAsyncId: true }): Promise<string | AxiosResponse>;
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
        return this.isConnected && (
            !!this.getSessionCookieValue() ||
            !!this.axiosInstance.defaults.headers.common['Authorization']
        );
    }

    public async getApiMetadata(): Promise<any> {
        const response = await this.get("/$metadata");
        return response.data;
    }

    // =========================================================================
    // Authentication helpers — mirror tm1py's _build_authorization_token*,
    // _generate_*_access_token, and _start_session flows
    // =========================================================================

    /**
     * Decode Base64-encoded password (tm1py parity: b64_decode_password).
     */
    private static b64DecodePassword(encoded: string): string {
        return Buffer.from(encoded, 'base64').toString('utf-8');
    }

    /**
     * Build an httpsAgent option that skips TLS verification when verify is false.
     */
    private static insecureAgentOption(
        verify?: boolean | string
    ): { httpsAgent: https.Agent } | Record<string, never> {
        return verify === false
            ? { httpsAgent: new https.Agent({ rejectUnauthorized: false }) }
            : {};
    }

    /**
     * Normalise a Set-Cookie header value (string | string[] | undefined) into a string[].
     */
    private static normaliseSetCookie(raw: string | string[] | undefined): string[] {
        if (!raw) return [];
        return Array.isArray(raw) ? raw : [raw];
    }

    /**
     * Extract a named cookie value from raw Set-Cookie headers.
     */
    private static extractCookieValue(
        raw: string | string[] | undefined,
        name: string
    ): string | undefined {
        const prefix = name + '=';
        for (const header of RestService.normaliseSetCookie(raw)) {
            const segment = header.split(';')[0];
            if (segment.startsWith(prefix)) {
                return segment.slice(prefix.length);
            }
        }
        return undefined;
    }

    /**
     * Build Basic Authorization header.
     * Mirrors tm1py's _build_authorization_token_basic.
     */
    private static _buildAuthorizationTokenBasic(user: string, password: string): string {
        return 'Basic ' + Buffer.from(`${user}:${password}`).toString('base64');
    }

    /**
     * Build CAMNamespace Authorization header.
     * Mirrors tm1py's _build_authorization_token_cam (non-gateway path).
     */
    private static _buildAuthorizationTokenCam(
        user: string,
        password: string,
        namespace: string
    ): string {
        return 'CAMNamespace ' + Buffer.from(`${user}:${password}:${namespace}`).toString('base64');
    }

    /**
     * Build CAMPassport Authorization token via gateway SSO.
     * Mirrors tm1py's _build_authorization_token_cam (gateway path).
     * Makes a GET request to the gateway URL with CAMNamespace as a query
     * parameter and extracts the cam_passport cookie from the response.
     *
     * Note: tm1py uses HttpNegotiateAuth (NTLM/Kerberos) for gateway requests,
     * which is Windows-only. This implementation sends a plain GET and relies on
     * the gateway being accessible without NTLM. For environments requiring NTLM,
     * pass a pre-obtained cam_passport via config.camPassport instead.
     */
    private static async _buildAuthorizationTokenCamSso(
        gateway: string,
        namespace: string,
        verify?: boolean | string
    ): Promise<string> {
        const response = await axios.get(gateway, {
            params: { CAMNamespace: namespace },
            ...RestService.insecureAgentOption(verify)
        });
        if (response.status !== 200) {
            throw new Error(
                'Failed to authenticate through CAM. Expected status_code 200, received status_code: ' +
                response.status
            );
        }
        const passport = RestService.extractCookieValue(
            response.headers['set-cookie'], 'cam_passport'
        );
        if (!passport) {
            throw new Error(
                "Failed to authenticate through CAM. HTTP response does not contain 'cam_passport' cookie"
            );
        }
        return 'CAMPassport ' + passport;
    }

    /**
     * Generate IBM IAM Cloud access token.
     * Mirrors tm1py's _generate_ibm_iam_cloud_access_token.
     */
    private async _generateIbmIamCloudAccessToken(): Promise<string> {
        const { iamUrl, apiKey } = this.config;
        if (!iamUrl || !apiKey) {
            throw new Error("'iamUrl' and 'apiKey' must be provided to generate access token from IBM Cloud");
        }
        const payload = `grant_type=urn%3Aibm%3Aparams%3Aoauth%3Agrant-type%3Aapikey&apikey=${encodeURIComponent(apiKey)}`;
        const headers = {
            'Accept': 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded'
        };
        const response = await axios.post(iamUrl, payload, {
            headers,
            ...RestService.insecureAgentOption(this.config.verify)
        });
        if (!response.data?.access_token) {
            throw new Error(`Failed to generate access_token from URL: '${iamUrl}'`);
        }
        return response.data.access_token;
    }

    /**
     * Generate CPD (Cloud Pak for Data) access token.
     * Mirrors tm1py's _generate_cpd_access_token.
     */
    private async _generateCpdAccessToken(
        credentials: { username: string; password: string }
    ): Promise<string> {
        const { cpdUrl } = this.config;
        if (!cpdUrl) {
            throw new Error("'cpdUrl' must be provided to authenticate via CPD/Cloud Pak for Data");
        }
        const url = `${cpdUrl}/v1/preauth/signin`;
        const headers = { 'Content-Type': 'application/json;charset=UTF-8' };
        const response = await axios.post(url, credentials, {
            headers,
            ...RestService.insecureAgentOption(this.config.verify)
        });
        if (!response.data?.token) {
            throw new Error(`Failed to generate CPD access token from URL: '${url}'`);
        }
        return response.data.token;
    }

    /**
     * Authenticate with PA Proxy using a CPD JWT token.
     * Mirrors tm1py's PA_PROXY flow in _start_session.
     */
    private async _authenticateWithPaProxy(jwt: string): Promise<void> {
        const authRoot = this.resolveRoots().authRoot;
        const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
        const payload = `jwt=${jwt}`;
        const response = await axios.post(authRoot, payload, {
            headers,
            ...RestService.insecureAgentOption(this.config.verify)
        });
        const setCookie = response.headers['set-cookie'];
        const csrfValue = RestService.extractCookieValue(setCookie, 'ba-sso-csrf');
        if (csrfValue) {
            this.axiosInstance.defaults.headers.common['ba-sso-authenticity'] = csrfValue;
        }
        this.parseSetCookieHeaders(setCookie);
    }

    /**
     * Authenticate Service-to-Service (v12).
     * Mirrors tm1py's SERVICE_TO_SERVICE flow in _start_session:
     * Uses Basic auth with applicationClientId:applicationClientSecret,
     * then POSTs {"User": user} to the auth endpoint.
     */
    private async _authenticateServiceToService(): Promise<void> {
        const { applicationClientId, applicationClientSecret, user } = this.config;
        if (!applicationClientId || !applicationClientSecret) {
            throw new Error(
                'Service-to-Service authentication requires applicationClientId and applicationClientSecret'
            );
        }

        // Guard: v11 and plain baseUrl topologies resolve authRoot to a metadata
        // probe URL, not a token endpoint. Require explicit authUrl in those cases.
        if (!this.config.authUrl) {
            const topo = this.determineTopology();
            const baseUrlIsV12 = topo === 'base_url'
                && /api\/v1\/Databases/.test(this.config.baseUrl ?? '');
            if (topo === 'v11' || (topo === 'base_url' && !baseUrlIsV12)) {
                throw new Error(
                    "'authUrl' is required for Service-to-Service authentication on v11 topology"
                );
            }
        }

        const authRoot = this.config.authUrl || this.resolveRoots().authRoot;
        const basicAuth = Buffer.from(
            `${applicationClientId}:${applicationClientSecret}`
        ).toString('base64');

        this.axiosInstance.defaults.headers.common['Authorization'] = `Basic ${basicAuth}`;

        const response = await axios.post(
            authRoot,
            JSON.stringify({ User: user }),
            {
                headers: {
                    ...RestService.HEADERS,
                    'Authorization': `Basic ${basicAuth}`
                },
                ...RestService.insecureAgentOption(this.config.verify)
            }
        );

        this.parseSetCookieHeaders(response.headers['set-cookie']);
    }

    /**
     * Determine the authentication mode from config.
     * Mirrors tm1py's _determine_auth_mode, using the URL topology as the
     * primary discriminator for v12 modes.
     */
    public getAuthenticationMode(): AuthenticationMode {
        const topo = this.determineTopology();
        const c = this.config;

        switch (topo) {
            case 'ibm_cloud':
                return AuthenticationMode.IBM_CLOUD_API_KEY;
            case 'pa_proxy':
                return AuthenticationMode.PA_PROXY;
            case 's2s':
                return AuthenticationMode.SERVICE_TO_SERVICE;

            case 'v11':
            case 'base_url':
            default: {
                // v11 / base_url: check auth-specific config flags
                if (c.accessToken) return AuthenticationMode.ACCESS_TOKEN;
                if (c.apiKey) return AuthenticationMode.BASIC_API_KEY;
                if (c.applicationClientId && c.applicationClientSecret) {
                    return AuthenticationMode.SERVICE_TO_SERVICE;
                }
                if (c.camPassport) return AuthenticationMode.CAM;
                if (c.gateway && c.namespace) return AuthenticationMode.CAM_SSO;
                if (c.integratedLogin) return AuthenticationMode.WIA;
                if (c.namespace) return AuthenticationMode.CAM;
                return AuthenticationMode.BASIC;
            }
        }
    }

    /**
     * Set up authentication based on configuration.
     * Mirrors tm1py's _start_session routing.
     */
    private async setupAuthentication(): Promise<void> {
        const authMode = this.getAuthenticationMode();
        const password = this.config.decodeB64 && this.config.password
            ? RestService.b64DecodePassword(this.config.password)
            : this.config.password;

        switch (authMode) {
            case AuthenticationMode.ACCESS_TOKEN:
                this.axiosInstance.defaults.headers.common['Authorization'] =
                    `Bearer ${this.config.accessToken}`;
                break;

            case AuthenticationMode.BASIC_API_KEY:
                if (this.config.user === 'apikey') {
                    this.axiosInstance.defaults.headers.common['Authorization'] =
                        RestService._buildAuthorizationTokenBasic('apikey', this.config.apiKey!);
                } else {
                    this.axiosInstance.defaults.headers.common['API-Key'] = this.config.apiKey!;
                }
                break;

            case AuthenticationMode.IBM_CLOUD_API_KEY: {
                const accessToken = await this._generateIbmIamCloudAccessToken();
                this.axiosInstance.defaults.headers.common['Authorization'] =
                    `Bearer ${accessToken}`;
                break;
            }

            case AuthenticationMode.PA_PROXY: {
                if (!this.config.user || !password) {
                    throw new Error('PA Proxy authentication requires user and password');
                }
                const jwt = await this._generateCpdAccessToken({
                    username: this.config.user,
                    password
                });
                await this._authenticateWithPaProxy(jwt);
                break;
            }

            case AuthenticationMode.SERVICE_TO_SERVICE:
                await this._authenticateServiceToService();
                break;

            case AuthenticationMode.CAM_SSO: {
                // CAM_SSO is only reached when gateway is set (see getAuthenticationMode)
                const token = await RestService._buildAuthorizationTokenCamSso(
                    this.config.gateway!,
                    this.config.namespace!,
                    this.config.verify
                );
                this.axiosInstance.defaults.headers.common['Authorization'] = token;
                break;
            }

            case AuthenticationMode.CAM: {
                if (this.config.camPassport) {
                    this.axiosInstance.defaults.headers.common['Authorization'] =
                        'CAMPassport ' + this.config.camPassport;
                } else if (this.config.namespace && this.config.user && password) {
                    this.axiosInstance.defaults.headers.common['Authorization'] =
                        RestService._buildAuthorizationTokenCam(
                            this.config.user, password, this.config.namespace
                        );
                } else {
                    throw new Error(
                        'CAM authentication requires either camPassport or user/password/namespace'
                    );
                }
                break;
            }

            case AuthenticationMode.WIA:
                throw new Error(
                    'Windows Integrated Authentication (WIA) is not supported in Node.js. ' +
                    'Use CAM or Basic authentication instead.'
                );

            case AuthenticationMode.BASIC:
            default: {
                if (!this.config.user || !password) {
                    throw new Error('No valid authentication configuration provided');
                }
                this.axiosInstance.defaults.headers.common['Authorization'] =
                    RestService._buildAuthorizationTokenBasic(this.config.user, password);
                break;
            }
        }
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
        return this.isConnected && (
            !!this.getSessionCookieValue() ||
            !!this.axiosInstance.defaults.headers.common['Authorization']
        );
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
        await this.delete(formatUrl("/_async('{}')", async_id), { asyncRequestsMode: false });
    }

    /**
     * Retrieve async operation response
     */
    public async retrieve_async_response(async_id: string): Promise<AxiosResponse> {
        // tm1py's retrieve_async_response returns the raw response without
        // raising on non-2xx because its caller (_poll_async_response) gates
        // on status_code in [200, 201]. Mirror that: accept all statuses so
        // transient 404s (resource not yet materialized) or 202s (still
        // running) flow through to the polling loop rather than aborting it.
        return this.get(formatUrl("/_async('{}')", async_id), {
            asyncRequestsMode: false,
            verifyResponse: false,
            validateStatus: () => true
        }) as Promise<AxiosResponse>;
    }

    /**
     * TM1 v12 returns completed async results with HTTP 200 and encodes
     * the true operation status in the `asyncresult` header (e.g.
     * "500 Internal Server Error"). Mirror tm1py's
     * `_transform_async_response` by throwing on any embedded non-2xx
     * status so callers are not handed a 500 as "success".
     */
    private verifyAsyncResultHeader(response: AxiosResponse): void {
        const headerValue = response.headers?.['asyncresult'];
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
