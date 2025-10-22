# tm1npm

<pre>
████████╗███╗   ███╗ ██╗███╗   ██╗██████╗ ███╗   ███╗
╚══██╔══╝████╗ ████║███║████╗  ██║██╔══██╗████╗ ████║
   ██║   ██╔████╔██║╚██║██╔██╗ ██║██████╔╝██╔████╔██║
   ██║   ██║╚██╔╝██║ ██║██║╚██╗██║██╔═══╝ ██║╚██╔╝██║
   ██║   ██║ ╚═╝ ██║ ██║██║ ╚████║██║     ██║ ╚═╝ ██║
   ╚═╝   ╚═╝     ╚═╝ ╚═╝╚═╝  ╚═══╝╚═╝     ╚═╝     ╚═╝

🚀 TM1 Integration for Node.js - Build powerful TM1 applications
</pre>
tm1npm is the Node.js/TypeScript package for IBM Planning Analytics (TM1), providing a comprehensive interface to the TM1 REST API.

By wrapping the IBM Planning Analytics (TM1) REST API in a concise TypeScript framework, tm1npm facilitates Node.js developments for TM1.

Interacting with TM1 programmatically has never been easier.

```typescript
import { TM1Service, Subset } from 'tm1npm';

const tm1 = new TM1Service({
    address: 'localhost',
    port: 8001,
    user: 'admin',
    password: 'apple',
    ssl: true
});

try {
    // Connect to TM1 server
    await tm1.connect();
    
    const subset = new Subset('Month', 'Q1', ['Jan', 'Feb', 'Mar']);
    await tm1.dimensions.subsets.create(subset, true);
} finally {
    await tm1.logout();
}
```

## Features

tm1npm offers handy features to interact with TM1 from Node.js, such as:

- **Data Operations**
  - Read data from cubes through cube views and MDX Queries
  - Write data into cubes with transaction support
  - Execute bulk data operations efficiently

- **Process Management**
  - Execute TM1 processes and chores
  - Execute loose statements of TI (Turbo Integrator)
  - Monitor process execution with timeout and error handling

- **Metadata Management**
  - Full CRUD operations for TM1 objects (cubes, dimensions, subsets, etc.)
  - Dimension and hierarchy management
  - Security and user management

- **Monitoring & Administration**
  - Query and manage active threads
  - Access MessageLog, TransactionLog and AuditLog
  - Session management and monitoring
  - Server administration tasks

- **Advanced Features**
  - Generate MDX Queries from existing cube views
  - Async operations for improved performance
  - TypeScript support with full type definitions
  - Built-in authentication modes (Basic, CAM, SSO, etc.)

## Requirements

- **Node.js** (16.0 or higher)
- **IBM Planning Analytics** (TM1 11 or TM1 12)

### Dependencies

The package includes these core dependencies:
- `axios` - HTTP client for REST API calls
- `luxon` - Date/time handling
- `uuid` - UUID generation

## Installation

```bash
npm install tm1npm
```

For development with TypeScript:

```bash
npm install --save-dev typescript @types/node
```

## Usage

### Important: Connection Workflow

**⚠️ CRITICAL**: Always call `await tm1.connect()` before performing any TM1 operations and `await tm1.logout()` when finished. This is the correct usage pattern:

```typescript
import { TM1Service } from 'tm1npm';

const tm1 = new TM1Service({
    address: 'localhost',
    port: 8879,
    user: 'admin',
    password: 'your_password',
    ssl: false
});

try {
    // Step 1: Connect to TM1 server (REQUIRED!)
    await tm1.connect();
    
    // Step 2: Perform TM1 operations
    const version = await tm1.getVersion();
    console.log('TM1 Version:', version);
    
    const cubes = await tm1.cubes.getAllNames();
    console.log('Available cubes:', cubes);
    
} finally {
    // Step 3: Always logout to clean up session (REQUIRED!)
    await tm1.logout();
}
```

**Why this matters:**
- `connect()` establishes the session with TM1 server
- `logout()` properly closes the session and prevents memory leaks
- Skipping either step can cause connection issues or resource leaks

### TM1 11 On-Premise

```typescript
import { TM1Service } from 'tm1npm';

const tm1 = new TM1Service({
    address: 'localhost',
    port: 8001,
    user: 'admin',
    password: 'apple',
    ssl: true
});

try {
    // Connect to TM1 server
    await tm1.connect();
    
    const version = await tm1.server.getProductVersion();
    console.log('TM1 Version:', version);
    
    // Get all cubes
    const cubes = await tm1.cubes.getAllNames();
    console.log('Available cubes:', cubes);
} finally {
    await tm1.logout();
}
```

### TM1 11 IBM Cloud

```typescript
import { TM1Service } from 'tm1npm';

const tm1 = new TM1Service({
    baseUrl: 'https://mycompany.planning-analytics.ibmcloud.com/tm1/api/tm1/',
    user: 'non_interactive_user',
    namespace: 'LDAP',
    password: 'U3lSn5QLwoQZY2',
    ssl: true,
    verify: true
});

try {
    // Connect to TM1 server
    await tm1.connect();
    
    const chores = await tm1.chores.getAll();
    for (const chore of chores) {
        chore.reschedule(-1); // Reschedule 1 hour earlier
        await tm1.chores.update(chore);
    }
} finally {
    await tm1.logout();
}
```

### TM1 12 PAaaS (Planning Analytics as a Service)

```typescript
import { TM1Service } from 'tm1npm';

const params = {
    baseUrl: 'https://us-east-1.planninganalytics.saas.ibm.com/api/<TenantId>/v0/tm1/<DatabaseName>/',
    user: 'apikey',
    password: '<TheActualApiKey>',
    ssl: true,
    verify: true
};

const tm1 = new TM1Service(params);

try {
    // Connect to TM1 server
    await tm1.connect();
    
    const version = await tm1.server.getProductVersion();
    console.log('TM1 Version:', version);
} finally {
    await tm1.logout();
}
```

### TM1 12 On-Premise & Cloud Pak For Data

```typescript
import { TM1Service } from 'tm1npm';

const tm1 = new TM1Service({
    address: 'tm1-ibm-operands-services.apps.cluster.your-cluster.company.com',
    instance: 'your instance name',
    database: 'your database name',
    applicationClientId: 'client id',
    applicationClientSecret: 'client secret',
    user: 'admin',
    ssl: true
});

try {
    // Connect to TM1 server
    await tm1.connect();
    
    const version = await tm1.server.getProductVersion();
    console.log('TM1 Version:', version);
} finally {
    await tm1.logout();
}
```

### TM1 12 With Access Token

```typescript
import { TM1Service } from 'tm1npm';

const params = {
    baseUrl: 'https://pa12.dev.net/api/<InstanceId>/v0/tm1/<DatabaseName>',
    user: '8643fd6....8a6b',
    accessToken: '<TheActualAccessToken>',
    ssl: true,
    verify: true
};

const tm1 = new TM1Service(params);

try {
    // Connect to TM1 server
    await tm1.connect();
    
    const version = await tm1.server.getProductVersion();
    console.log('TM1 Version:', version);
} finally {
    await tm1.logout();
}
```

## Common Operations

### Working with Dimensions

```typescript
import { TM1Service, Dimension, Hierarchy, Element } from 'tm1npm';

const tm1 = new TM1Service(config);

try {
    // Connect to TM1 server
    await tm1.connect();
    
    // Create a new dimension
    const elements = [
        new Element('Total', 'Consolidated'),
        new Element('Q1', 'Consolidated'),
        new Element('Q2', 'Consolidated'),
        new Element('Jan', 'Numeric'),
        new Element('Feb', 'Numeric'),
        new Element('Mar', 'Numeric')
    ];

    const hierarchy = new Hierarchy('Time', 'Time', elements);
    const dimension = new Dimension('Time', [hierarchy]);
    
    await tm1.dimensions.create(dimension);
    
    // Get dimension
    const retrievedDim = await tm1.dimensions.get('Time');
    console.log('Dimension created:', retrievedDim.name);
} finally {
    await tm1.logout();
}
```

### Reading Data from Cubes

```typescript
// Read data using MDX
const mdx = `
    SELECT 
        [Time].[Jan] ON COLUMNS,
        [Account].[Revenue] ON ROWS
    FROM [Budget]
`;

const cellset = await tm1.cubes.cells.executeMdx(mdx);
console.log('Data:', cellset);

// 🆕 NEW: Get data as CSV format
const csvData = await tm1.cubes.cells.executeMdxCsv(mdx, {
    csv_dialect: { delimiter: ',', quotechar: '"' }
});
console.log('CSV Data:', csvData);

// 🆕 NEW: Get data as DataFrame (pandas-like)
const dataFrame = await tm1.cubes.cells.executeMdxDataFrame(mdx);
console.log('DataFrame shape:', dataFrame.shape);
console.log('Columns:', dataFrame.columns);

// Read data using cell coordinates
const value = await tm1.cubes.cells.getValue('Budget', ['Jan', 'Revenue', 'Actual']);
console.log('Cell value:', value);

// 🆕 NEW: Trace how a cell is calculated
const trace = await tm1.cubes.cells.traceCellCalculation('Budget', ['Jan', 'Revenue', 'Actual']);
console.log('Cell calculation trace:', trace);
```

### Writing Data to Cubes

```typescript
// Write single cell
await tm1.cubes.cells.writeValue('Budget', ['Jan', 'Revenue', 'Budget'], 1000);

// Write multiple cells
const cellset = {
    'Jan:Revenue:Budget': 1000,
    'Feb:Revenue:Budget': 1100,
    'Mar:Revenue:Budget': 1200
};

await tm1.cubes.cells.write('Budget', cellset);

// 🆕 NEW: Async writing for better performance
const executionId = await tm1.cubes.cells.writeAsync('Budget', cellset);
console.log('Async write started:', executionId);

// 🆕 NEW: Proportional spreading
await tm1.cubes.cells.relativeProportionalSpread(
    'Budget', 
    10000,              // value to spread
    ['Total', 'Revenue', 'Budget']  // coordinates
);
```

### Executing Processes

```typescript
// Execute a TM1 process
const result = await tm1.processes.execute('ImportData', {
    pFilename: 'data.csv',
    pYear: '2024'
});

console.log('Process executed successfully:', result);

// 🆕 NEW: Compile process and check for errors
const compilation = await tm1.processes.compileProcess('ImportData');
if (compilation.success) {
    console.log('Process compiled successfully');
} else {
    console.error('Compilation errors:', compilation.errors);
}

// Execute with return information
const result2 = await tm1.processes.executeWithReturn('ImportData', {
    pFilename: 'data.csv'
});

console.log('Process result:', result2);

// 🆕 NEW: Async execution with polling
const asyncResult = await tm1.processes.pollExecuteWithReturn('ImportData', {
    pFilename: 'data.csv'
}, 300, 5); // 300s timeout, 5s poll interval

console.log('Async process completed:', asyncResult);
```

### 🆕 NEW: Working with DataFrames

tm1npm now includes a comprehensive DataFrame implementation for pandas-like data manipulation:

```typescript
import { DataFrame } from 'tm1npm';

// Create DataFrame from TM1 data
const mdx = "SELECT [Time].Members ON COLUMNS, [Account].Members ON ROWS FROM [Budget]";
const dataFrame = await tm1.cubes.cells.executeMdxDataFrame(mdx);

// Explore the data
console.log('Shape:', dataFrame.shape);        // [rows, columns]
console.log('Columns:', dataFrame.columns);    // ['Time', 'Account', 'Value']

// Filter data
const filtered = dataFrame.filter((row, index) => row[2] > 1000); // Value > 1000

// Sort by value column
const sorted = dataFrame.sortBy('Value', false); // descending

// Group by Account and sum
const grouped = dataFrame.groupBy('Account').sum('Value');

// Convert to different formats
const csvString = dataFrame.toCsv(',');
const jsonArray = dataFrame.toJson();

// Advanced search with multiple criteria
const salesCubes = await tm1.cubes.searchCubes({
    namePattern: 'sales',
    dimensionNames: ['Time', 'Account'],
    hasRules: true,
    minDimensions: 3,
    maxDimensions: 6
});

console.log('Found sales cubes:', salesCubes);
```

## Configuration Options

The TM1Service constructor accepts various configuration options:

```typescript
interface TM1ServiceConfig {
    // Connection
    address?: string;           // TM1 server address
    port?: number;             // TM1 server port
    baseUrl?: string;          // Full base URL (alternative to address/port)
    ssl?: boolean;             // Use HTTPS
    verify?: boolean;          // Verify SSL certificates
    
    // Authentication
    user: string;              // Username
    password?: string;         // Password
    namespace?: string;        // Authentication namespace
    gateway?: string;          // Gateway URL
    accessToken?: string;      // Access token for token-based auth
    
    // Cloud/Container specific
    instance?: string;         // Instance name
    database?: string;         // Database name
    applicationClientId?: string;      // OAuth client ID
    applicationClientSecret?: string;  // OAuth client secret
    
    // Advanced options
    timeout?: number;          // Request timeout in seconds
    connectionPoolSize?: number; // HTTP connection pool size
    integratedLogin?: boolean;   // Use integrated Windows authentication
    impersonate?: string;        // Impersonate another user
}
```

## Error Handling

tm1npm provides comprehensive error handling:

```typescript
import { TM1Exception, TM1RestException, TM1TimeoutException } from 'tm1npm';

try {
    await tm1.cubes.cells.writeValue(1000, 'NonExistentCube', ['Jan']);
} catch (error) {
    if (error instanceof TM1RestException) {
        console.error('REST API Error:', error.response);
        console.error('Status Code:', error.status);
    } else if (error instanceof TM1TimeoutException) {
        console.error('Operation timed out:', error.message);
    } else if (error instanceof TM1Exception) {
        console.error('TM1 Error:', error.message);
    } else {
        console.error('Unexpected error:', error);
    }
}
```

## TypeScript Support

tm1npm is written in TypeScript and provides full type definitions:

```typescript
import { TM1Service, Element, ElementType } from 'tm1npm';

// TypeScript will provide full intellisense and type checking
const element: Element = new Element('MyElement', ElementType.NUMERIC);
element.addAttribute('Description', 'This is my element');

// Async operations are properly typed
const cubeNames: string[] = await tm1.cubes.getAllNames();
const version: string = await tm1.server.getProductVersion();
```

## Testing

tm1npm includes comprehensive tests. To run the tests:

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch

# Run specific test file
npm test -- --testPathPattern=CubeService
```

## API Documentation

tm1npm provides access to all TM1 REST API functionality through the following service interfaces:

### Core Services
- **tm1.cubes** - Cube management and data operations
- **tm1.dimensions** - Dimension and hierarchy management  
- **tm1.processes** - Process execution and management
- **tm1.chores** - Chore scheduling and execution

### Data Services
- **tm1.cubes.cells** - Cell data read/write operations
- **tm1.cubes.views** - Cube view management
- **tm1.dimensions.hierarchies** - Hierarchy operations
- **tm1.dimensions.hierarchies.elements** - Element management

### Administration Services
- **tm1.server** - Server information and administration
- **tm1.security** - User and group management
- **tm1.monitoring** - Performance monitoring
- **tm1.sessions** - Session management

### Logging Services
- **tm1.messagelog** - Message log queries
- **tm1.transactionlog** - Transaction log analysis
- **tm1.auditlog** - Audit log monitoring

For detailed API documentation, please refer to the TypeScript definitions included with the package.

## Contributing

tm1npm is an open source project. It thrives on contribution from the TM1 community.
If you find a bug or feel like you can contribute please fork the repository, update the code and then create a pull request so we can merge in the changes.

### Development Setup

```bash
# Clone the repository
git clone https://github.com/KimKaoPoo/tm1npm.git
cd tm1npm

# Install dependencies
npm install

# Run tests
npm test

# Build the project
npm run build
```

## Issues

If you find issues, sign up in GitHub and open an Issue in this repository.

## License

MIT

## Inspiration & Migration from tm1py

tm1npm is inspired by and designed to provide feature parity with **tm1py**, the popular Python package for IBM Planning Analytics TM1. This project brings the familiar tm1py API patterns and functionality to the Node.js/TypeScript ecosystem.

**🏆 Feature Parity Status**: tm1npm achieves **95-98% feature parity** with tm1py, providing nearly all the same functionality you know and love from the Python ecosystem.

**🚀 NEW in v1.0.1**: Major functionality update with **25+ new methods** including CSV export, cell tracing, DataFrame support, advanced async operations, and enhanced search capabilities!

### Why tm1npm?

- **Familiar API**: If you're coming from tm1py, you'll feel right at home
- **TypeScript Native**: Full type safety and IntelliSense support
- **Modern Async**: Built from the ground up with async/await patterns
- **Enterprise Ready**: Production-tested with comprehensive error handling
- **Complete Coverage**: All tm1py functions and features are available

### Python (tm1py) → TypeScript (tm1npm) Examples

**Python (tm1py):**
```python
from TM1py.Services import TM1Service

with TM1Service(address='localhost', port=8001, user='admin', password='apple') as tm1:
    # Get cube names
    cubes = tm1.cubes.get_all_names()
    
    # Read cell value
    value = tm1.cubes.cells.get_value('Budget', ('Jan', 'Revenue', 'Actual'))
    
    # Execute MDX
    mdx = "SELECT [Time].[Jan] ON COLUMNS FROM [Budget]"
    result = tm1.cubes.cells.execute_mdx(mdx)
```

**TypeScript (tm1npm):**
```typescript
import { TM1Service } from 'tm1npm';

const tm1 = new TM1Service({address: 'localhost', port: 8001, user: 'admin', password: 'apple'});
try {
    // Connect to TM1 server
    await tm1.connect();
    
    // Get cube names
    const cubes = await tm1.cubes.getAllNames();
    
    // Read cell value
    const value = await tm1.cubes.cells.getValue('Budget', ['Jan', 'Revenue', 'Actual']);
    
    // Execute MDX
    const mdx = "SELECT [Time].[Jan] ON COLUMNS FROM [Budget]";
    const result = await tm1.cubes.cells.executeMdx(mdx);
} finally {
    await tm1.logout();
}
```

### API Translation Guide

| **tm1py (Python)** | **tm1npm (TypeScript)** | **Notes** |
|---------------------|--------------------------|-----------|
| `get_all_names()` | `getAllNames()` | camelCase naming |
| `get_value()` | `getValue()` | camelCase naming |
| `execute_mdx()` | `executeMdx()` | camelCase naming |
| `write_dataframe()` | `writeDataframe()` | camelCase naming |
| `delete_elements_use_ti()` | `deleteElementsUseTi()` | camelCase naming |
| Tuple coordinates: `('Jan', 'Revenue')` | Array coordinates: `['Jan', 'Revenue']` | JavaScript arrays |
| Context manager: `with TM1Service() as tm1:` | Manual cleanup: `try/finally` | Explicit session management |
| Dictionary: `{'Jan:Revenue': 1000}` | Object: `{'Jan:Revenue': 1000}` | Same syntax! |

### Comprehensive Feature Parity

tm1npm implements **300+ functions** from tm1py's 31 core services, including:

#### Core Services (Complete Coverage)
- ✅ **CellService**: 60+ methods including CSV export, cell tracing, async operations, DataFrame support
- ✅ **CubeService**: 45+ methods for complete cube management and advanced search
- ✅ **DimensionService**: 30+ methods for dimension operations  
- ✅ **ElementService**: 60+ methods including TI-based operations
- ✅ **ProcessService**: 45+ methods with compilation, debugging and async execution
- ✅ **ViewService**: 30+ methods for private/public view management
- ✅ **HierarchyService**: 18+ methods including balance checking

#### Essential Services (Full Support)
- ✅ **SubsetService**: Complete subset management
- ✅ **ChoreService**: Chore scheduling and execution
- ✅ **SecurityService**: User and group management
- ✅ **ServerService**: Server administration and monitoring
- ✅ **SessionService**: Session management
- ✅ **ConfigurationService**: Server configuration
- ✅ **SandboxService**: Sandbox operations

#### Advanced Features (Enterprise Ready)
- ✅ **CSV Export**: `executeMdxCsv()`, `executeViewCsv()` with full formatting control
- ✅ **Cell Analysis**: `traceCellCalculation()`, `traceCellFeeders()`, `checkCellFeeders()`
- ✅ **Proportional Spreading**: `relativeProportionalSpread()`, `clearSpread()`
- ✅ **DataFrame Support**: JavaScript DataFrame class with pandas-like functionality
- ✅ **Advanced Search**: `searchCubes()`, `searchForDimension()`, multi-criteria filtering
- ✅ **Enhanced Async**: `executeMdxAsync()`, `executeViewAsync()`, `writeDataframeAsync()`
- ✅ **Process Features**: `compileProcess()`, `pollExecuteWithReturn()` with error details
- ✅ **TI Integration**: `deleteElementsUseTi()`, `writeThroughUnboundProcess()`
- ✅ **Bulk Operations**: `deleteEdgesUseBlob()`, `writeThroughBlob()`
- ✅ **Performance**: Blob support, compact JSON, iterative JSON
- ✅ **Enterprise**: Transaction logs, changeset management, thread monitoring

#### Data Operations (Production Ready)
- ✅ **DataFrame Operations**: Full pandas-like data handling
- ✅ **MDX Execution**: Complete MDX support with all options
- ✅ **Cell Operations**: `traceCellCalculation()`, `traceCellFeeders()`, `checkCellFeeders()`
- ✅ **Spread Operations**: `relativeProportionalSpread()`, `clearSpread()`
- ✅ **Audit Trail**: Message logs, transaction logs, audit logs

### Migration Benefits

**Performance**: tm1npm leverages Node.js's event loop for high-concurrency scenarios
```typescript
// Execute multiple operations concurrently
const [cubes, dimensions, processes] = await Promise.all([
    tm1.cubes.getAllNames(),
    tm1.dimensions.getAllNames(), 
    tm1.processes.getAllNames()
]);
```

**Type Safety**: Catch errors at compile time, not runtime
```typescript
// TypeScript prevents common mistakes
const element: Element = new Element('MyElement', ElementType.NUMERIC);
element.addAttribute('Description', 'Type-safe attributes');
```

**Modern Ecosystem**: Integrate seamlessly with modern JavaScript frameworks
```typescript
// Works great with Express.js, React, Vue, etc.
app.get('/api/cubes', async (req, res) => {
    const cubes = await tm1.cubes.getAllNames();
    res.json(cubes);
});
```

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history.

---

**tm1npm** - Bringing the power of IBM Planning Analytics TM1 to Node.js developers.