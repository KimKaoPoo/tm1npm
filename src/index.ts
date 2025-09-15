// Core service exports
export { TM1Service } from './services/TM1Service';
export { RestService, AuthenticationMode } from './services/RestService';
export { DimensionService } from './services/DimensionService';
export { HierarchyService } from './services/HierarchyService';
export { SubsetService } from './services/SubsetService';
export { ObjectService } from './services/ObjectService';

// Additional services from index
export {
    CubeService,
    ElementService,
    CellService,
    ProcessService,
    ViewService,
    SecurityService,
    FileService,
    SessionService,
    ConfigurationService,
    ServerService,
    MonitoringService,
    AnnotationService,
    ApplicationService,
    AuditLogService,
    ChoreService,
    GitService,
    JobService,
    LoggerService,
    ManageService,
    MessageLogService,
    PowerBiService,
    SandboxService,
    ThreadService,
    TransactionLogService,
    UserService
} from './services';

// Object exports
export { TM1Object } from './objects/TM1Object';
export { Dimension } from './objects/Dimension';
export { Hierarchy } from './objects/Hierarchy';
export { Element, ElementType } from './objects/Element';
export { ElementAttribute, ElementAttributeType } from './objects/ElementAttribute';

// Additional object exports
export { Annotation } from './objects/Annotation';
export { Application } from './objects/Application';
export { Chore } from './objects/Chore';
export { ChoreFrequency } from './objects/ChoreFrequency';
export { ChoreStartTime } from './objects/ChoreStartTime';
export { ChoreTask, ChoreTaskParameter } from './objects/ChoreTask';
export { Cube } from './objects/Cube';
export { Git } from './objects/Git';
export { GitCommit } from './objects/GitCommit';
export { GitPlan, GitPushPlan, GitPullPlan } from './objects/GitPlan';
export { GitRemote } from './objects/GitRemote';
export { Process } from './objects/Process';
export { ProcessDebugBreakpoint, HitMode, BreakPointType } from './objects/ProcessDebugBreakpoint';
export { Rules } from './objects/Rules';
export { Sandbox } from './objects/Sandbox';
export { Server } from './objects/Server';
export { Subset, AnonymousSubset } from './objects/Subset';
export { TM1Project, TM1ProjectTask, TM1ProjectDeployment } from './objects/TM1Project';
export { User } from './objects/User';
export { View, MDXView, NativeView } from './objects/View';
export { ViewAxisSelection, ViewTitleSelection } from './objects/Axis';

// Enum exports
export { LogLevel } from './services/ServerService';

// Exception exports
export { 
    TM1Exception,
    TM1RestException,
    TM1TimeoutException,
    TM1VersionDeprecationException
} from './exceptions/TM1Exception';

// Utility exports
export { Utils } from './utils/Utils';
export {
    CaseAndSpaceInsensitiveMap,
    CaseAndSpaceInsensitiveSet,
    caseAndSpaceInsensitiveEquals,
    lowerAndDropSpaces,
    formatUrl
} from './utils/Utils';

// Type exports
export type { RestServiceConfig } from './services/RestService';
export type { DatabaseResourceConfig } from './services/ManageService';

// Version
export const version = '2.1.0';