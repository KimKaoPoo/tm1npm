import { RestService } from './RestService';
import { ObjectService } from './ObjectService';
import { ConfigurationService } from './ConfigurationService';
import { 
    verifyVersion, 
    deprecatedInVersion, 
    odataTrackChangesHeader, 
    requireDataAdmin,
    formatUrl,
    requireVersion,
    requireOpsAdmin,
    utcLocalizeTime
} from '../utils/Utils';

export class AuditLogService extends ObjectService {

    private lastDeltaRequest?: string;
    private configuration: ConfigurationService;

    constructor(rest: RestService) {
        super(rest);
        
        if (verifyVersion("12.0.0", rest.version || "11.0.0")) {
            // warn only due to use in Monitoring Service
            console.warn("Audit Logs are not available in this version of TM1, removed as of 12.0.0");
        }
        this.lastDeltaRequest = undefined;
        this.configuration = new ConfigurationService(rest);
    }

    @deprecatedInVersion("12.0.0")
    public async initializeDeltaRequests(filter?: string): Promise<void> {
        let url = "/TailAuditLog()";
        if (filter) {
            url += `?$filter=${filter}`;
        }
        const response = await this.rest.get(url);
        // Read the next delta-request-url from the response
        const responseText = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
        this.lastDeltaRequest = responseText.substring(
            responseText.lastIndexOf("AuditLogEntries/!delta('"),
            responseText.length - 2
        );
    }

    @deprecatedInVersion("12.0.0")
    public async executeDeltaRequest(): Promise<any[]> {
        if (!this.lastDeltaRequest) {
            throw new Error("Delta request not initialized. Call initializeDeltaRequests first.");
        }
        
        const response = await this.rest.get("/" + this.lastDeltaRequest);
        const responseText = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
        this.lastDeltaRequest = responseText.substring(
            responseText.lastIndexOf("AuditLogEntries/!delta('"),
            responseText.length - 2
        );
        return response.data.value;
    }

    
    @deprecatedInVersion("12.0.0")
    @requireVersion("11.6")
    public async getEntries(
        user?: string,
        objectType?: string,
        objectName?: string,
        since?: Date,
        until?: Date,
        top?: number
    ): Promise<any[]> {
        /**
         * :param user: UserName
         * :param object_type: ObjectType
         * :param object_name: ObjectName
         * :param since: of type Date. If it doesn't have tz information, UTC is assumed.
         * :param until: of type Date. If it doesn't have tz information, UTC is assumed.
         * :param top: int
         * :return:
         */

        let url = '/AuditLogEntries?$expand=AuditDetails';
        
        // filter on user, object_type, object_name and time
        if (user || objectType || objectName || since || until) {
            const logFilters: string[] = [];
            
            if (user) {
                logFilters.push(formatUrl("UserName eq '{}'", user));
            }
            if (objectType) {
                logFilters.push(formatUrl("ObjectType eq '{}'", objectType));
            }
            if (objectName) {
                logFilters.push(formatUrl("ObjectName eq '{}'", objectName));
            }
            if (since) {
                // If since doesn't have tz information, UTC is assumed
                const sinceUtc = this.ensureUtc(since);
                logFilters.push(formatUrl(
                    "TimeStamp ge {}", 
                    sinceUtc.toISOString().replace(/\.\d{3}Z$/, 'Z')
                ));
            }
            if (until) {
                // If until doesn't have tz information, UTC is assumed
                const untilUtc = this.ensureUtc(until);
                logFilters.push(formatUrl(
                    "TimeStamp le {}", 
                    untilUtc.toISOString().replace(/\.\d{3}Z$/, 'Z')
                ));
            }
            url += `&$filter=${logFilters.join(" and ")}`;
        }
        
        // top limit
        if (top) {
            url += `&$top=${top}`;
        }
        
        const response = await this.rest.get(url);
        return response.data.value;
    }

    
    public async activate(): Promise<void> {
        const config = {
            'Administration': {
                'AuditLog': {
                    'Enable': true
                }
            }
        };
        await this.configuration.updateStatic(config);
    }

    
    public async deactivate(): Promise<void> {
        const config = {
            'Administration': {
                'AuditLog': {
                    'Enable': false
                }
            }
        };
        await this.configuration.updateStatic(config);
    }

    public async isActive(): Promise<boolean> {
        /** Check if audit logging is active
         *
         * :return: boolean indicating if audit logging is enabled
         */
        try {
            const config = await this.configuration.getStaticConfiguration();
            return config?.Administration?.AuditLog?.Enable === true;
        } catch {
            return false;
        }
    }

    private ensureUtc(date: Date): Date {
        /** Ensure date is treated as UTC if no timezone info
         *
         * :param date: Date object
         * :return: Date object with UTC timezone
         */
        // In JavaScript, Date objects are always timezone-aware (local timezone)
        // To treat as UTC, we need to adjust for the timezone offset
        return new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
    }
}