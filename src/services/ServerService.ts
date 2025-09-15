import { AxiosResponse } from 'axios';
import { RestService } from './RestService';
import { ObjectService } from './ObjectService';
import { TransactionLogService } from './TransactionLogService';
import { MessageLogService } from './MessageLogService';
import { AuditLogService } from './AuditLogService';
import { LoggerService } from './LoggerService';
import { ConfigurationService } from './ConfigurationService';
import { ProcessService } from './ProcessService';
import { 
    requireAdmin, 
    requireVersion, 
    deprecatedInVersion,
    requireDataAdmin,
    requireOpsAdmin
} from '../utils/Utils';

export enum LogLevel {
    FATAL = "fatal",
    ERROR = "error", 
    WARNING = "warning",
    INFO = "info",
    DEBUG = "debug",
    OFF = "off"
}

export class ServerService extends ObjectService {
    /** Service to query common information from the TM1 Server
     */

    public transactionLogs: TransactionLogService;
    public messageLogs: MessageLogService;
    public configuration: ConfigurationService;
    public auditLogs: AuditLogService;
    public loggers: LoggerService;

    constructor(rest: RestService) {
        super(rest);
        console.warn("Server Service will be moved to a new location in a future version");
        this.transactionLogs = new TransactionLogService(rest);
        this.messageLogs = new MessageLogService(rest);
        this.configuration = new ConfigurationService(rest);
        this.auditLogs = new AuditLogService(rest);
        this.loggers = new LoggerService(rest);
    }

    public async initializeTransactionLogDeltaRequests(filter?: string): Promise<void> {
        return await this.transactionLogs.initializeDeltaRequests(filter);
    }

    public async executeTransactionLogDeltaRequest(): Promise<any[]> {
        return await this.transactionLogs.executeDeltaRequest();
    }

    public async initializeAuditLogDeltaRequests(filter?: string): Promise<void> {
        return await this.auditLogs.initializeDeltaRequests(filter);
    }

    public async executeAuditLogDeltaRequest(): Promise<any[]> {
        return await this.auditLogs.executeDeltaRequest();
    }

    public async initializeMessageLogDeltaRequests(filter?: string): Promise<void> {
        return await this.messageLogs.initializeDeltaRequests(filter);
    }

    public async executeMessageLogDeltaRequest(): Promise<any[]> {
        return await this.messageLogs.executeDeltaRequest();
    }

    @deprecatedInVersion("12.0.0")
    
    public async getMessageLogEntries(
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

        return await this.messageLogs.getEntries(
            reverse,
            since,
            until,
            top,
            logger,
            level,
            msgContains,
            msgContainsOperator
        );
    }

    
    public async writeToMessageLog(level: string, message: string): Promise<void> {
        /**
         * :param level: string, FATAL, ERROR, WARN, INFO, DEBUG
         * :param message: string
         * :return:
         */

        return await this.messageLogs.createEntry(level, message);
    }

    @deprecatedInVersion("12.0.0")
    
    public async getTransactionLogEntries(
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
        return await this.transactionLogs.getEntries(
            reverse,
            user,
            cube,
            since,
            until,
            top,
            elementTupleFilter,
            elementPositionFilter
        );
    }

    
    @deprecatedInVersion("12.0.0")
    @requireVersion("11.6")
    public async getAuditLogEntries(
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
         * :param since: of type datetime. If it doesn't have tz information, UTC is assumed.
         * :param until: of type datetime. If it doesn't have tz information, UTC is assumed.
         * :param top: int
         * :return:
         */
        return await this.auditLogs.getEntries(
            user,
            objectType,
            objectName,
            since,
            until,
            top
        );
    }

    
    @deprecatedInVersion("12.0.0")
    public async getLastProcessMessageFromMessageLog(processName: string): Promise<string | null> {
        /** Get the latest message log entry for a process
         *
         *    :param process_name: name of the process
         *    :return: String - the message, for instance: "Ausführung normal beendet, verstrichene Zeit 0.03  Sekunden"
         */
        return await this.messageLogs.getLastProcessMessage(processName);
    }

    public async getServerName(): Promise<string> {
        /** Ask TM1 Server for its name
         *
         * :Returns:
         *     String, the server name
         */
        return await this.configuration.getServerName();
    }

    public async getProductVersion(): Promise<string> {
        /** Ask TM1 Server for its version
         *
         * :Returns:
         *     String, the version
         */
        return await this.configuration.getProductVersion();
    }

    public async getAdminHost(): Promise<string> {
        return await this.configuration.getAdminHost();
    }

    public async getDataDirectory(): Promise<string> {
        return await this.configuration.getDataDirectory();
    }

    public async getConfiguration(): Promise<Record<string, any>> {
        return await this.configuration.getAll();
    }

    public async getStaticConfiguration(): Promise<Record<string, any>> {
        return await this.configuration.getStatic();
    }

    public async getActiveConfiguration(): Promise<Record<string, any>> {
        /** Read effective(!) TM1 config settings as dictionary from TM1 Server
         *
         * :return: config as dictionary
         */
        return await this.configuration.getActive();
    }

    public async getApiMetadata(): Promise<Record<string, any>> {
        /** Read effective(!) TM1 config settings as dictionary from TM1 Server
         *
         * :return: config as dictionary
         */
        return await this.rest.getApiMetadata();
    }

    public async updateStaticConfiguration(configuration: Record<string, any>): Promise<AxiosResponse> {
        /** Update the .cfg file and triggers TM1 to re-read the file.
         *
         * :param configuration:
         * :return: Response
         */
        return await this.configuration.updateStatic(configuration);
    }

    @deprecatedInVersion("12.0.0")
    
    public async saveData(): Promise<AxiosResponse> {
        const ti = "SaveDataAll;";
        const processService = new ProcessService(this.rest);
        return await processService.executeTiCode([ti]);
    }

    
    public async deletePersistentFeeders(): Promise<AxiosResponse> {
        const ti = "DeleteAllPersistentFeeders;";
        const processService = new ProcessService(this.rest);
        return await processService.executeTiCode([ti]);
    }

    public async startPerformanceMonitor(): Promise<AxiosResponse> {
        const config = {
            "Administration": {"PerformanceMonitorOn": true}
        };
        return await this.configuration.updateStatic(config);
    }

    public async stopPerformanceMonitor(): Promise<AxiosResponse> {
        const config = {
            "Administration": {"PerformanceMonitorOn": false}
        };
        return await this.configuration.updateStatic(config);
    }

    public async activateAuditLog(): Promise<void> {
        await this.auditLogs.activate();
    }

    
    public async deactivateAuditLog(): Promise<AxiosResponse> {
        const config = {'Administration': {'AuditLog': {'Enable': false}}};
        return await this.updateStaticConfiguration(config);
    }

    
    public async updateMessageLoggerLevel(logger: string, level: string): Promise<AxiosResponse> {
        /**
         * Updates tm1 message log levels
         * :param logger:
         * :param level:
         * :return:
         */
        return await this.loggers.setLevel(logger, level);
    }

    
    public async getAllMessageLoggerLevel(): Promise<any[]> {
        /**
         * Get tm1 message log levels
         * :return:
         */
        return await this.loggers.getAll();
    }
}