# Getting Started with tm1npm

## Installation

Install tm1npm using npm:

```bash
npm install tm1npm
```

For TypeScript development, you may also want:

```bash
npm install --save-dev typescript @types/node
```

## Basic Usage

### 1. Import and Configure

```typescript
import { TM1Service } from 'tm1npm';

const tm1 = new TM1Service({
    address: 'localhost',
    port: 8001,
    user: 'admin',
    password: 'apple',
    ssl: true
});
```

### 2. Connect and Perform Operations

**⚠️ CRITICAL**: Always use the connect/logout pattern:

```typescript
try {
    // Step 1: Connect to TM1 server (REQUIRED!)
    await tm1.connect();

    // Step 2: Perform your operations
    const version = await tm1.server.getProductVersion();
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

## Next Steps

- **[Connection Guide](connection-guide.md)** - Connect to different TM1 deployments
- **[API Reference](api-reference.md)** - Explore all available services
- **[Examples](examples/)** - Real-world code examples
- **[Configuration](configuration.md)** - Advanced configuration options

## Quick Examples

### Read Data from a Cube

```typescript
const value = await tm1.cubes.cells.getValue(
    'Budget',
    ['Jan', 'Revenue', 'Actual']
);
console.log('Cell value:', value);
```

### Execute MDX Query

```typescript
const mdx = `
    SELECT
        [Time].[Jan] ON COLUMNS,
        [Account].[Revenue] ON ROWS
    FROM [Budget]
`;

const cellset = await tm1.cubes.cells.executeMdx(mdx);
console.log('Data:', cellset);
```

### Write Data

```typescript
await tm1.cubes.cells.writeValue(
    'Budget',
    ['Jan', 'Revenue', 'Budget'],
    1000
);
```

### Execute a Process

```typescript
const result = await tm1.processes.execute('ImportData', {
    pFilename: 'data.csv',
    pYear: '2024'
});
console.log('Process executed:', result);
```

## Common Pitfalls

### ❌ Don't Forget to Connect

```typescript
// ❌ WRONG - Will fail
const tm1 = new TM1Service(config);
const cubes = await tm1.cubes.getAllNames(); // Error!
```

```typescript
// ✅ CORRECT
const tm1 = new TM1Service(config);
await tm1.connect();
const cubes = await tm1.cubes.getAllNames(); // Works!
```

### ❌ Don't Forget to Logout

```typescript
// ❌ WRONG - Memory leak
await tm1.connect();
const cubes = await tm1.cubes.getAllNames();
// Missing logout!
```

```typescript
// ✅ CORRECT
try {
    await tm1.connect();
    const cubes = await tm1.cubes.getAllNames();
} finally {
    await tm1.logout(); // Always cleanup
}
```

## Error Handling

```typescript
import { TM1Exception, TM1RestException } from 'tm1npm';

try {
    await tm1.connect();
    await tm1.cubes.cells.writeValue('Budget', ['Invalid'], 1000);
} catch (error) {
    if (error instanceof TM1RestException) {
        console.error('REST API Error:', error.response);
        console.error('Status Code:', error.status);
    } else if (error instanceof TM1Exception) {
        console.error('TM1 Error:', error.message);
    }
} finally {
    await tm1.logout();
}
```

## TypeScript Support

tm1npm is written in TypeScript and provides full type definitions:

```typescript
import { TM1Service, Element, ElementType } from 'tm1npm';

// TypeScript provides full intellisense
const element: Element = new Element('MyElement', ElementType.NUMERIC);
element.addAttribute('Description', 'This is my element');

// Async operations are properly typed
const cubeNames: string[] = await tm1.cubes.getAllNames();
const version: string = await tm1.server.getProductVersion();
```

## Next: Connection Guide

Learn how to connect to different TM1 deployments:
- [Connection Guide →](connection-guide.md)
