# API Reference

Complete reference for all tm1npm services and methods.

## Core Services

### TM1Service

Main entry point for all TM1 operations.

```typescript
import { TM1Service } from 'tm1npm';

const tm1 = new TM1Service(config);
await tm1.connect();     // Establish connection
await tm1.logout();      // Close connection
```

**Methods:**
- `connect()` - Establish connection to TM1 server
- `logout()` - Close connection and cleanup
- `getVersion()` - Get TM1 server version

**Properties:**
- `cubes` - CubeService instance
- `dimensions` - DimensionService instance
- `processes` - ProcessService instance
- `chores` - ChoreService instance
- `server` - ServerService instance
- `security` - SecurityService instance
- And 20+ more services...

## Data Services

### CellService

Read and write cell data.

**Access:** `tm1.cubes.cells`

**Reading Methods:**
- `getValue(cubeName, coordinates)` - Read single cell
- `executeMdx(mdx, options?)` - Execute MDX query
- `executeMdxDataFrame(mdx, options?)` - Execute MDX, return DataFrame
- `executeMdxCsv(mdx, options?)` - Execute MDX, return CSV
- `executeView(cubeName, viewName, private?, options?)` - Execute view
- `executeViewCsv(cubeName, viewName, private?, options?)` - Execute view as CSV

**Writing Methods:**
- `writeValue(cubeName, coordinates, value)` - Write single cell
- `write(cubeName, cellset, options?)` - Write multiple cells
- `writeAsync(cubeName, cellset, options?)` - Async write operation
- `writeDataframe(cubeName, dataframe, options?)` - Write DataFrame

**Analysis Methods:**
- `traceCellCalculation(cubeName, coordinates)` - Trace cell calculation
- `traceCellFeeders(cubeName, coordinates)` - Trace cell feeders
- `checkCellFeeders(cubeName, coordinates)` - Check feeder validity

**Utility Methods:**
- `clear(cubeName, sandbox?)` - Clear cube data
- `relativeProportionalSpread(cubeName, value, coordinates)` - Proportional spreading
- `clearSpread(cubeName, coordinates)` - Clear spread area

### CubeService

Manage cubes and their metadata.

**Access:** `tm1.cubes`

**CRUD Operations:**
- `get(cubeName)` - Get cube object
- `getAll()` - Get all cubes
- `getAllNames()` - Get all cube names
- `create(cube)` - Create new cube
- `update(cube)` - Update cube
- `delete(cubeName)` - Delete cube
- `exists(cubeName)` - Check if cube exists

**Search & Query:**
- `searchCubes(options)` - Advanced cube search
- `searchForDimension(dimensionName)` - Find cubes using dimension
- `getNumberOfCubes(skipControlCubes?)` - Count cubes

**Rules Management:**
- `getRules(cubeName)` - Get cube rules
- `updateRules(cubeName, rules)` - Update rules
- `deleteRules(cubeName)` - Delete rules

## Metadata Services

### DimensionService

Manage dimensions and hierarchies.

**Access:** `tm1.dimensions`

**Methods:**
- `get(dimensionName)` - Get dimension
- `getAll()` - Get all dimensions
- `getAllNames()` - Get dimension names
- `create(dimension)` - Create dimension
- `update(dimension)` - Update dimension
- `delete(dimensionName)` - Delete dimension
- `exists(dimensionName)` - Check existence

**Properties:**
- `hierarchies` - HierarchyService instance
- `subsets` - SubsetService instance

### HierarchyService

Manage hierarchies within dimensions.

**Access:** `tm1.dimensions.hierarchies`

**Methods:**
- `get(dimensionName, hierarchyName)` - Get hierarchy
- `getAll(dimensionName)` - Get all hierarchies
- `create(hierarchy)` - Create hierarchy
- `update(hierarchy)` - Update hierarchy
- `delete(dimensionName, hierarchyName)` - Delete hierarchy
- `exists(dimensionName, hierarchyName)` - Check existence

**Utility:**
- `isBalanced(dimensionName, hierarchyName)` - Check if balanced
- `getDefaultMember(dimensionName, hierarchyName)` - Get default element

**Properties:**
- `elements` - ElementService instance

### ElementService

Manage elements within hierarchies.

**Access:** `tm1.dimensions.hierarchies.elements`

**CRUD:**
- `get(dimensionName, hierarchyName, elementName)` - Get element
- `getAll(dimensionName, hierarchyName)` - Get all elements
- `create(element, dimensionName, hierarchyName)` - Create element
- `update(element, dimensionName, hierarchyName)` - Update element
- `delete(dimensionName, hierarchyName, elementName)` - Delete element

**Bulk Operations:**
- `deleteElements(dimensionName, hierarchyName, elements)` - Delete multiple
- `deleteElementsUseTi(dimensionName, hierarchyName, elements)` - Delete via TI

**DataFrame Support:**
- `getElementsDataFrame(dimensionName, hierarchyName, options?)` - Get as DataFrame

## Process Services

### ProcessService

Execute and manage TI processes.

**Access:** `tm1.processes`

**Execution:**
- `execute(processName, parameters?)` - Execute process
- `executeWithReturn(processName, parameters?)` - Execute and return result
- `executeProcessWithReturn(processName, parameters?)` - Alias for above
- `pollExecuteWithReturn(processName, parameters?, timeout?, interval?)` - Poll until complete

**Management:**
- `get(processName)` - Get process object
- `getAll()` - Get all processes
- `getAllNames()` - Get process names
- `create(process)` - Create process
- `update(process)` - Update process
- `delete(processName)` - Delete process

**Debugging:**
- `compileProcess(processName)` - Compile and check for errors
- `debugStepOver(processName)` - Debug step over
- `debugStepIn(processName)` - Debug step into
- `debugStepOut(processName)` - Debug step out
- `debugContinue(processName)` - Continue debugging

## Administration Services

### ServerService

Server administration and monitoring.

**Access:** `tm1.server`

**Information:**
- `getProductVersion()` - Get TM1 version
- `getServerName()` - Get server name
- `getAdminHost()` - Get admin host
- `getDataDirectory()` - Get data directory

**Logs:**
- `getTransactionLogEntries(options?)` - Get transaction log
- `getMessageLogEntries(options?)` - Get message log
- `getAuditLogEntries(options?)` - Get audit log

**Properties:**
- `transactionLogs` - TransactionLogService
- `messagelog` - MessageLogService
- `auditlog` - AuditLogService

### SecurityService

User and group management.

**Access:** `tm1.security`

**User Management:**
- `getUser(userName)` - Get user
- `getAllUsers()` - Get all users
- `createUser(user)` - Create user
- `updateUser(user)` - Update user
- `deleteUser(userName)` - Delete user

**Group Management:**
- `getGroup(groupName)` - Get group
- `getAllGroups()` - Get all groups
- `createGroup(group)` - Create group
- `addUserToGroup(userName, groupName)` - Add user to group
- `removeUserFromGroup(userName, groupName)` - Remove user

**Current User:**
- `getCurrentUser()` - Get current user
- `getCurrentUserName()` - Get current username

## Configuration Objects

### RestServiceConfig

```typescript
interface RestServiceConfig {
    // Connection
    address?: string;
    port?: number;
    baseUrl?: string;
    ssl?: boolean;
    verify?: boolean;

    // Authentication
    user: string;
    password?: string;
    namespace?: string;
    accessToken?: string;

    // Cloud/Container
    instance?: string;
    database?: string;
    applicationClientId?: string;
    applicationClientSecret?: string;

    // Advanced
    timeout?: number;
    connectionPoolSize?: number;
    integratedLogin?: boolean;
    impersonate?: string;
}
```

### MDXViewOptions

```typescript
interface MDXViewOptions {
    sandbox_name?: string;
    element_unique_names?: boolean;
    skip_zeros?: boolean;
    skip_consolidated?: boolean;
    skip_rule_derived?: boolean;
    private?: boolean;
}
```

### WriteOptions

```typescript
interface WriteOptions {
    sandbox_name?: string;
    changeset?: string;
    deactivate_transaction_log?: boolean;
    reactivate_transaction_log?: boolean;
    increment?: boolean;
}
```

## Object Classes

### Element

```typescript
import { Element, ElementType } from 'tm1npm';

const element = new Element(
    'MyElement',             // name
    ElementType.NUMERIC      // type: NUMERIC, STRING, CONSOLIDATED
);

element.addAttribute('Description', 'My element description');
element.addComponent('ChildElement', 1.0);  // weight
```

### Dimension

```typescript
import { Dimension, Hierarchy, Element } from 'tm1npm';

const elements = [
    new Element('Total', ElementType.CONSOLIDATED),
    new Element('Value1', ElementType.NUMERIC),
    new Element('Value2', ElementType.NUMERIC)
];

const hierarchy = new Hierarchy('DimName', 'DimName', elements);
const dimension = new Dimension('DimName', [hierarchy]);
```

### Cube

```typescript
import { Cube } from 'tm1npm';

const cube = new Cube('MyCube', ['Dim1', 'Dim2', 'Dim3']);
cube.rules = 'SKIPCHECK;\n[]=N:1;';
```

### Process

```typescript
import { Process } from 'tm1npm';

const process = new Process('MyProcess');
process.prologProcedure = 'sMessage = "Hello";';
process.addParameter('pYear', 'Numeric', 2024);
```

## Exception Classes

```typescript
import {
    TM1Exception,
    TM1RestException,
    TM1TimeoutException
} from 'tm1npm';

try {
    await tm1.cubes.get('NonExistent');
} catch (error) {
    if (error instanceof TM1RestException) {
        console.error('Status:', error.status);
        console.error('Response:', error.response);
    }
}
```

## DataFrame

```typescript
import { DataFrame } from 'tm1npm';

// Create from data
const df = new DataFrame(
    ['A', 'B', 'C'],              // columns
    [[1, 2, 3], [4, 5, 6]]       // data
);

// Methods
df.shape;                          // [rows, cols]
df.columns;                        // column names
df.head(n);                        // first n rows
df.tail(n);                        // last n rows
df.filter(fn);                     // filter rows
df.sortBy(column, ascending?);     // sort
df.groupBy(column);                // group
df.toCsv(delimiter);              // to CSV string
df.toJson();                       // to JSON array
```

## Complete Service List

- ✅ **CellService** - Cell data operations
- ✅ **CubeService** - Cube management
- ✅ **DimensionService** - Dimension operations
- ✅ **ElementService** - Element management
- ✅ **HierarchyService** - Hierarchy operations
- ✅ **ProcessService** - Process execution
- ✅ **ViewService** - View management
- ✅ **SubsetService** - Subset operations
- ✅ **ChoreService** - Chore scheduling
- ✅ **SecurityService** - User/group management
- ✅ **ServerService** - Server administration
- ✅ **SessionService** - Session management
- ✅ **ConfigurationService** - Configuration
- ✅ **SandboxService** - Sandbox operations
- ✅ **ApplicationService** - Application management
- ✅ **FileService** - File operations
- ✅ **GitService** - Git integration
- ✅ **MonitoringService** - Performance monitoring
- ✅ **PowerBiService** - Power BI integration
- And more...

## See Also

- [Getting Started](getting-started.md)
- [Examples](examples/)
- [Connection Guide](connection-guide.md)
