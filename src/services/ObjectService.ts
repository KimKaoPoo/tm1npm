import crypto from 'crypto';
import { RestService } from './RestService';
import { TM1RestException } from '../exceptions/TM1Exception';
import { formatUrl, caseAndSpaceInsensitiveEquals, verifyVersion } from '../utils/Utils';

const BINARY_HTTP_HEADER_PRE_V12 = {
    'Content-Type': 'application/octet-stream; odata.streaming=true'
};

const BINARY_HTTP_HEADER = {
    'Content-Type': 'application/json;charset=UTF-8'
};

export abstract class ObjectService {
    protected readonly rest: RestService;
    protected readonly binaryHttpHeader: Record<string, string>;

    constructor(rest: RestService) {
        this.rest = rest;
        this.binaryHttpHeader = this.determineBinaryHeader();
    }

    /**
     * Suggest a unique object name using session context, process id, and an optional random seed.
     */
    public suggestUniqueObjectName(randomSeed?: number): string {
        const sessionId = this.rest.getSessionId?.() || 'tm1npm';
        const base = `${sessionId}:${process.pid}:${randomSeed ?? Math.random()}`;
        const hash = crypto.createHash('sha256').update(base).digest('hex').slice(0, 12);
        return `tm1npm.${hash}`;
    }

    /**
     * Determine the canonical object name as stored on the TM1 server, respecting case sensitivity.
     */
    public async determineActualObjectName(objectClass: string, objectName: string): Promise<string> {
        const url = formatUrl(
            "/{}?$select=Name&$filter=tolower(replace(Name, ' ', '')) eq '{}'",
            objectClass,
            objectName.replace(/\s+/g, '').toLowerCase()
        );

        const response = await this.rest.get(url);
        const values = response.data?.value;
        if (Array.isArray(values) && values.length > 0 && values[0]?.Name) {
            return values[0].Name;
        }

        throw new Error(`Object '${objectName}' of type '${objectClass}' does not exist`);
    }

    protected formatUrl(template: string, ...args: string[]): string {
        return formatUrl(template, ...args);
    }

    protected caseAndSpaceInsensitiveEquals(str1: string, str2: string): boolean {
        return caseAndSpaceInsensitiveEquals(str1, str2);
    }

    protected async _exists(url: string): Promise<boolean> {
        try {
            await this.rest.get(url);
            return true;
        } catch (error: any) {
            if (error instanceof TM1RestException && error.statusCode === 404) {
                return false;
            }
            throw error;
        }
    }

    protected get version(): string | undefined {
        return this.rest.version;
    }

    protected get isAdmin(): boolean {
        return Boolean((this.rest as unknown as { isAdmin?: boolean }).isAdmin);
    }

    protected get isDataAdmin(): boolean {
        return Boolean((this.rest as unknown as { isDataAdmin?: boolean }).isDataAdmin);
    }

    protected get isSecurityAdmin(): boolean {
        return Boolean((this.rest as unknown as { isSecurityAdmin?: boolean }).isSecurityAdmin);
    }

    protected get isOpsAdmin(): boolean {
        return Boolean((this.rest as unknown as { isOpsAdmin?: boolean }).isOpsAdmin);
    }

    private determineBinaryHeader(): Record<string, string> {
        const version = this.rest?.version;
        if (!version) {
            return BINARY_HTTP_HEADER;
        }
        return verifyVersion(version, '12.0.0') ? BINARY_HTTP_HEADER : BINARY_HTTP_HEADER_PRE_V12;
    }
}
