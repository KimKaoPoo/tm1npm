import { RestService, RestServiceConfig } from './RestService';
import { DimensionService } from './DimensionService';
import { HierarchyService } from './HierarchyService';
import { SubsetService } from './SubsetService';
import { DataFrameService } from './DataFrameService';
import { DebuggerService } from './DebuggerService';
import { BulkService } from './BulkService';
import { AsyncOperationService } from './AsyncOperationService';
import { PowerBiService } from './PowerBiService';
import { ApplicationService } from './ApplicationService';
import { AnnotationService } from './AnnotationService';
import { ChoreService } from './ChoreService';
import { GitService } from './GitService';
import { SandboxService } from './SandboxService';
import { JobService } from './JobService';
import { UserService } from './UserService';
import { ThreadService } from './ThreadService';
import { TransactionLogService } from './TransactionLogService';
import { MessageLogService } from './MessageLogService';
import { ConfigurationService } from './ConfigurationService';
import { AuditLogService } from './AuditLogService';
import { LoggerService } from './LoggerService';
import { User } from '../objects/User';
import {
    CubeService,
    ElementService,
    CellService,
    ProcessService,
    ViewService,
    SecurityService,
    FileService,
    SessionService,
    ServerService,
    MonitoringService
} from './index';

export class TM1Service {
    private _tm1Rest: RestService;
    private _server?: ServerService;
    private _monitoring?: MonitoringService;

    private _annotations?: AnnotationService;
    private _chores?: ChoreService;
    private _git?: GitService;
    private _sandboxes?: SandboxService;
    private _jobs?: JobService;
    private _users?: UserService;
    private _threads?: ThreadService;
    private _transactionLogs?: TransactionLogService;
    private _messageLogs?: MessageLogService;
    private _configuration?: ConfigurationService;
    private _auditLogs?: AuditLogService;
    private _loggers?: LoggerService;

    public dimensions: DimensionService;
    public hierarchies: HierarchyService;
    public subsets: SubsetService;
    public cubes: CubeService;
    public elements: ElementService;
    public cells: CellService;
    public processes: ProcessService;
    public views: ViewService;
    public security: SecurityService;
    public files: FileService;
    public sessions: SessionService;
    public dataframes: DataFrameService;
    public debugger: DebuggerService;
    public bulk: BulkService;
    public asyncOperations: AsyncOperationService;
    public powerbi: PowerBiService;
    public applications: ApplicationService;

    constructor(config: RestServiceConfig) {
        this._tm1Rest = new RestService(config);

        // Initialize AsyncOperationService first
        this.asyncOperations = new AsyncOperationService(this._tm1Rest);

        // Attach to RestService for access by other services
        (this._tm1Rest as any).asyncOperationService = this.asyncOperations;

        // Initialize all services
        this.dimensions = new DimensionService(this._tm1Rest);
        this.hierarchies = new HierarchyService(this._tm1Rest);
        this.subsets = new SubsetService(this._tm1Rest);
        this.cubes = new CubeService(this._tm1Rest);
        this.elements = new ElementService(this._tm1Rest);
        this.cells = new CellService(this._tm1Rest);
        this.processes = new ProcessService(this._tm1Rest);
        this.views = new ViewService(this._tm1Rest);
        this.security = new SecurityService(this._tm1Rest);
        this.files = new FileService(this._tm1Rest);
        this.sessions = new SessionService(this._tm1Rest);
        this.dataframes = new DataFrameService(this._tm1Rest);
        this.debugger = new DebuggerService(this._tm1Rest);
        this.bulk = new BulkService(this._tm1Rest, this.cells, this.views);
        this.powerbi = new PowerBiService(this._tm1Rest);
        this.applications = new ApplicationService(this._tm1Rest);
    }

    public async connect(): Promise<void> {
        await this._tm1Rest.connect();
    }

    public async logout(): Promise<void> {
        await this._tm1Rest.disconnect();
    }

    public async disconnect(): Promise<void> {
        await this.logout();
    }

    public get server(): ServerService {
        if (!this._server) {
            this._server = new ServerService(this._tm1Rest);
        }
        return this._server;
    }

    public get monitoring(): MonitoringService {
        if (!this._monitoring) {
            this._monitoring = new MonitoringService(this._tm1Rest);
        }
        return this._monitoring;
    }

    public get annotations(): AnnotationService {
        if (!this._annotations) {
            this._annotations = new AnnotationService(this._tm1Rest);
        }
        return this._annotations;
    }

    public get chores(): ChoreService {
        if (!this._chores) {
            this._chores = new ChoreService(this._tm1Rest);
        }
        return this._chores;
    }

    public get git(): GitService {
        if (!this._git) {
            this._git = new GitService(this._tm1Rest);
        }
        return this._git;
    }

    public get sandboxes(): SandboxService {
        if (!this._sandboxes) {
            this._sandboxes = new SandboxService(this._tm1Rest);
        }
        return this._sandboxes;
    }

    public get jobs(): JobService {
        if (!this._jobs) {
            this._jobs = new JobService(this._tm1Rest);
        }
        return this._jobs;
    }

    public get users(): UserService {
        if (!this._users) {
            this._users = new UserService(this._tm1Rest);
        }
        return this._users;
    }

    public get threads(): ThreadService {
        if (!this._threads) {
            this._threads = new ThreadService(this._tm1Rest);
        }
        return this._threads;
    }

    public get transactionLogs(): TransactionLogService {
        if (!this._transactionLogs) {
            this._transactionLogs = new TransactionLogService(this._tm1Rest);
        }
        return this._transactionLogs;
    }

    public get messageLogs(): MessageLogService {
        if (!this._messageLogs) {
            this._messageLogs = new MessageLogService(this._tm1Rest);
        }
        return this._messageLogs;
    }

    public get configuration(): ConfigurationService {
        if (!this._configuration) {
            this._configuration = new ConfigurationService(this._tm1Rest);
        }
        return this._configuration;
    }

    public get auditLogs(): AuditLogService {
        if (!this._auditLogs) {
            this._auditLogs = new AuditLogService(this._tm1Rest);
        }
        return this._auditLogs;
    }

    public get loggers(): LoggerService {
        if (!this._loggers) {
            this._loggers = new LoggerService(this._tm1Rest);
        }
        return this._loggers;
    }

    public async whoami(): Promise<User> {
        return await this.security.getCurrentUser();
    }

    public async getMetadata(): Promise<any> {
        const response = await this._tm1Rest.get('/$metadata');
        return response.data;
    }

    public get version(): string | undefined {
        return this._tm1Rest.version;
    }

    public async getVersion(): Promise<string> {
        return await this._tm1Rest.getVersion();
    }

    public get connection(): RestService {
        return this._tm1Rest;
    }

    public getSessionId(): string | undefined {
        return this._tm1Rest.getSessionId();
    }

    public setSandbox(sandboxName?: string): void {
        this._tm1Rest.setSandbox(sandboxName);
    }

    public getSandbox(): string | undefined {
        return this._tm1Rest.getSandbox();
    }

    public isLoggedIn(): boolean {
        return this._tm1Rest.isLoggedIn();
    }

    /** Reconnects without teardown. Use reAuthenticate() for full disconnect+reconnect. */
    public async reConnect(): Promise<void> {
        await this._tm1Rest.connect();
    }

    /** Full teardown + reconnect. If disconnect() throws, connect() is not attempted. */
    public async reAuthenticate(): Promise<void> {
        await this._tm1Rest.disconnect();
        await this._tm1Rest.connect();
    }

    // For use with try-with pattern in async contexts
    public static async create(config: RestServiceConfig): Promise<TM1Service> {
        const service = new TM1Service(config);
        await service.connect();
        return service;
    }

    // Disposal method for cleanup
    public async dispose(): Promise<void> {
        try {
            await this.logout();
        } catch (error) {
            console.warn(`Logout failed due to exception: ${error}`);
        }
    }
}
