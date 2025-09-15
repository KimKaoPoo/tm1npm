import { RestService } from './RestService';
import { ObjectService } from './ObjectService';
import { Process } from '../objects/Process';
import { ProcessService } from './ProcessService';
import { 
    verifyVersion, 
    deprecatedInVersion, 
    odataTrackChangesHeader, 
    requireOpsAdmin,
    requireDataAdmin,
    formatUrl,
    CaseAndSpaceInsensitiveDict,
    CaseAndSpaceInsensitiveSet,
    utcLocalizeTime
} from '../utils/Utils';

export class MessageLogService extends ObjectService {

    private lastDeltaRequest?: string;

    constructor(rest: RestService) {
        super(rest);
        if (verifyVersion("12.0.0", rest.version || "11.0.0")) {
            // warn only due to use in Monitoring Service
            console.warn("Message Logs are not available in this version of TM1, removed as of 12.0.0");
        }
        this.lastDeltaRequest = undefined;
    }

    @deprecatedInVersion("12.0.0")
    public async initializeDeltaRequests(filter?: string): Promise<void> {
        let url = "/TailMessageLog()";
        if (filter) {
            url += `?$filter=${filter}`;
        }
        const response = await this.rest.get(url);
        // Read the next delta-request-url from the response
        const responseText = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
        this.lastDeltaRequest = responseText.substring(
            responseText.lastIndexOf("MessageLogEntries/!delta('"),
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
            responseText.lastIndexOf("MessageLogEntries/!delta('"),
            responseText.length - 2
        );
        return response.data.value;
    }

    @deprecatedInVersion("12.0.0")
    
    public async getEntries(
        reverse: boolean = true,
        since?: Date,
        until?: Date,
        top?: number,
        logger?: string,
        level?: string,
        msgContains?: string | string[],
        msgContainsOperator: string = 'and'
    ): Promise<any[]> {
        /**
         * :param reverse: Boolean
         * :param since: of type datetime. If it doesn't have tz information, UTC is assumed.
         * :param until: of type datetime. If it doesn't have tz information, UTC is assumed.
         * :param top: Integer
         * :param logger: string, eg TM1.Server, TM1.Chore, TM1.Mdx.Interface, TM1.Process
         * :param level: string, ERROR, WARNING, INFO, DEBUG, UNKNOWN
         * :param msg_contains: iterable, find substring in log message; list of substrings will be queried as AND statement
         * :param msg_contains_operator: 'and' or 'or'
         *
         * :return: Dict of server log
         */
        const msgContainsOperatorLower = msgContainsOperator.trim().toLowerCase();
        if (msgContainsOperatorLower !== "and" && msgContainsOperatorLower !== "or") {
            throw new Error("'msg_contains_operator' must be either 'and' or 'or'");
        }

        const reverseOrder = reverse ? 'desc' : 'asc';
        let url = `/MessageLogEntries?$orderby=TimeStamp ${reverseOrder}`;

        if (since || until || logger || level || msgContains) {
            const logFilters: string[] = [];

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

            if (logger) {
                logFilters.push(formatUrl("Logger eq '{}'", logger));
            }

            if (level) {
                const levelDict = new CaseAndSpaceInsensitiveDict([
                    ['ERROR', 1], ['WARNING', 2], ['INFO', 3], ['DEBUG', 4], ['UNKNOWN', 5]
                ]);
                const levelIndex = levelDict.get(level);
                if (levelIndex) {
                    logFilters.push(`Level eq ${levelIndex}`);
                }
            }

            if (msgContains) {
                if (typeof msgContains === 'string') {
                    logFilters.push(formatUrl(
                        "contains(toupper(Message),toupper('{}'))", msgContains
                    ));
                } else {
                    const msgFilters = msgContains.map(wildcard =>
                        formatUrl("contains(toupper(Message),toupper('{}'))", wildcard)
                    );
                    logFilters.push(`(${msgFilters.join(` ${msgContainsOperatorLower} `)})`);
                }
            }

            url += `&$filter=${logFilters.join(" and ")}`;
        }

        if (top) {
            url += `&$top=${top}`;
        }

        const response = await this.rest.get(url);
        return response.data.value;
    }

    
    public async createEntry(level: string, message: string): Promise<void> {
        /**
         * :param level: string, FATAL, ERROR, WARN, INFO, DEBUG
         * :param message: string
         * :return:
         */

        const validLevels = new CaseAndSpaceInsensitiveSet(
            ['FATAL', 'ERROR', 'WARN', 'INFO', 'DEBUG']
        );
        if (!validLevels.has(level)) {
            throw new Error(`Invalid level: '${level}'`);
        }

        const processService = new ProcessService(this.rest);
        
        // Execute TI code directly instead of creating a process
        const tiCode = `LogOutput('${level}', '${message}');`;
        const response = await processService.executeTiCode([tiCode]);
        const success = response.status === 200;

        if (!success) {
            throw new Error(
                `Failed to write to TM1 Message Log through unbound process. Status: '${response.status}'`
            );
        }
    }

    
    @deprecatedInVersion("12.0.0")
    public async getLastProcessMessage(processName: string): Promise<string | null> {
        /** Get the latest message log entry for a process
         *
         *    :param process_name: name of the process
         *    :return: String - the message, for instance: "Ausführung normal beendet, verstrichene Zeit 0.03  Sekunden"
         */
        const url = formatUrl(
            "/MessageLog()?$orderby='TimeStamp'&$filter=Logger eq 'TM1.Process' and contains(Message, '{}')",
            processName
        );
        const response = await this.rest.get(url);
        const responseAsList = response.data.value;
        if (responseAsList.length > 0) {
            const messageLogEntry = responseAsList[0];
            return messageLogEntry.Message;
        }
        return null;
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