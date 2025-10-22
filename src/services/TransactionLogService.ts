import { RestService } from './RestService';
import { ObjectService } from './ObjectService';
import {
    verifyVersion,
    deprecatedInVersion,
    odataTrackChangesHeader,
    requireDataAdmin,
    formatUrl
} from '../utils/Utils';

export class TransactionLogService extends ObjectService {

    private lastDeltaRequest?: string;

    constructor(rest: RestService) {
        super(rest);
        if (verifyVersion("12.0.0", rest.version || "11.0.0")) {
            // warn only due to use in Monitoring Service
            console.warn("Transaction Logs are not available in this version of TM1, removed as of 12.0.0");
        }
        this.lastDeltaRequest = undefined;
    }

    @deprecatedInVersion("12.0.0")
    public async initializeDeltaRequests(filter?: string): Promise<void> {
        let url = "/TailTransactionLog()";
        if (filter) {
            url += `?$filter=${filter}`;
        }
        const response = await this.rest.get(url, {
            headers: odataTrackChangesHeader(),
            responseType: 'text'
        });
        this.lastDeltaRequest = this.extractDeltaUrl(response.data);
    }

    @deprecatedInVersion("12.0.0")
    public async executeDeltaRequest(): Promise<any[]> {
        if (!this.lastDeltaRequest) {
            throw new Error("Delta request not initialized. Call initializeDeltaRequests first.");
        }
        const response = await this.rest.get(`/${this.lastDeltaRequest}`, {
            headers: odataTrackChangesHeader(),
            responseType: 'text'
        });
        this.lastDeltaRequest = this.extractDeltaUrl(response.data);
        const payload = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
        return payload.value || [];
    }

    @deprecatedInVersion("12.0.0")
    
    @requireDataAdmin
    public async getEntries(
        reverse: boolean = true,
        user?: string,
        cube?: string,
        since?: Date,
        until?: Date,
        top?: number,
        elementTupleFilter?: Record<string, string>,
        elementPositionFilter?: Record<number, Record<string, string>>
    ): Promise<any[]> {
        /**
         * :param reverse: Boolean
         * :param user: UserName
         * :param cube: CubeName
         * :param since: of type datetime. If it doesn't have tz information, UTC is assumed.
         * :param until: of type datetime. If it doesn't have tz information, UTC is assumed.
         * :param top: int
         * :param element_tuple_filter: of type dict. Element name as key and comparison operator as value
         * :param element_position_filter: not yet implemented
         * tuple={'Actual':'eq','2020': 'ge'}
         * :return:
         */
        if (elementPositionFilter) {
            throw new Error("Feature expected in upcoming releases of TM1, ");
        }

        const reverseOrder = reverse ? 'desc' : 'asc';
        let url = `/TransactionLogEntries?$orderby=TimeStamp ${reverseOrder} `;

        // filter on user, cube, time and elements
        if (user || cube || since || until || elementTupleFilter || elementPositionFilter) {
            const logFilters: string[] = [];
            
            if (user) {
                logFilters.push(formatUrl("User eq '{}'", user));
            }
            
            if (cube) {
                logFilters.push(formatUrl("Cube eq '{}'", cube));
            }
            
            if (elementTupleFilter) {
                const tupleFilters = Object.entries(elementTupleFilter).map(
                    ([k, v]) => `e ${v} '${k}'`
                );
                logFilters.push(formatUrl(
                    "Tuple/any(e: {})", 
                    tupleFilters.join(" or ")
                ));
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

    private ensureUtc(date: Date): Date {
        return new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
    }

    private extractDeltaUrl(raw: string): string {
        const payload = typeof raw === 'string' ? raw : JSON.stringify(raw);
        const match = payload.match(/TransactionLogEntries\/!delta\('([^']+)'\)/);
        if (!match) {
            throw new Error('Unable to determine next delta request URL from response');
        }
        return `TransactionLogEntries/!delta('${match[1]}')`;
    }
}
