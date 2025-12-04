import { RestService, RestServiceConfig } from './RestService';
import { DimensionService } from './DimensionService';
import { HierarchyService } from './HierarchyService';
import { SubsetService } from './SubsetService';
import { DataFrameService } from './DataFrameService';
import { DebuggerService } from './DebuggerService';
import { BulkService } from './BulkService';
import { AsyncOperationService } from './AsyncOperationService';
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

    public async whoami(): Promise<string> {
        const user = await this.security.getCurrentUser();
        return user.name;
    }

    public async getMetadata(): Promise<any> {
        const response = await this._tm1Rest.get('/$metadata');
        return response.data;
    }

    public async getVersion(): Promise<string> {
        const response = await this._tm1Rest.get('/Configuration/ProductVersion');
        return response.data.value;
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