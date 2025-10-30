# Connection Guide

This guide covers all supported TM1 deployment types and their connection configurations.

## Connection Overview

All connections follow the same pattern:

```typescript
import { TM1Service } from 'npm';

const tm1 = new TM1Service(config);

try {
    await tm1.connect();
    // ... perform operations
} finally {
    await tm1.logout();
}
```

## TM1 11 On-Premise

For standard TM1 11 installations on your own infrastructure:

```typescript
const tm1 = new TM1Service({
    address: 'localhost',
    port: 8001,
    user: 'admin',
    password: 'apple',
    ssl: true
});
```

## TM1 11 IBM Cloud

For TM1 instances hosted on IBM Cloud:

```typescript
const tm1 = new TM1Service({
    baseUrl: 'https://mycompany.planning-analytics.ibmcloud.com/tm1/api/tm1/',
    user: 'non_interactive_user',
    namespace: 'LDAP',
    password: 'U3lSn5QLwoQZY2',
    ssl: true,
    verify: true
});
```

## TM1 12 PAaaS (Planning Analytics as a Service)

For SaaS deployments:

```typescript
const tm1 = new TM1Service({
    baseUrl: 'https://us-east-1.planninganalytics.saas.ibm.com/api/<TenantId>/v0/tm1/<DatabaseName>/',
    user: 'apikey',
    password: '<TheActualApiKey>',
    ssl: true,
    verify: true
});
```

## TM1 12 On-Premise & Cloud Pak for Data

For containerized TM1 on Cloud Pak for Data:

```typescript
const tm1 = new TM1Service({
    address: 'tm1-ibm-operands-services.apps.cluster.your-cluster.company.com',
    instance: 'your instance name',
    database: 'your database name',
    applicationClientId: 'client id',
    applicationClientSecret: 'client secret',
    user: 'admin',
    ssl: true
});
```

## TM1 12 with Access Token

For token-based authentication:

```typescript
const tm1 = new TM1Service({
    baseUrl: 'https://pa12.dev.net/api/<InstanceId>/v0/tm1/<DatabaseName>',
    user: '8643fd6....8a6b',
    accessToken: '<TheActualAccessToken>',
    ssl: true,
    verify: true
});
```

## Configuration Options Reference

### Basic Connection

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `address` | string | No* | TM1 server address |
| `port` | number | No* | TM1 server port |
| `baseUrl` | string | No* | Full base URL (alternative to address/port) |
| `ssl` | boolean | No | Use HTTPS (default: false) |
| `verify` | boolean | No | Verify SSL certificates (default: true) |

*Either `address`+`port` OR `baseUrl` is required

### Authentication

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `user` | string | Yes | Username |
| `password` | string | No* | Password |
| `namespace` | string | No | Authentication namespace (e.g., 'LDAP') |
| `gateway` | string | No | Gateway URL for CAM authentication |
| `accessToken` | string | No* | Access token for token-based auth |

*Either `password` OR `accessToken` is required

### Cloud/Container Specific

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `instance` | string | No | Instance name (Cloud Pak for Data) |
| `database` | string | No | Database name (Cloud Pak for Data) |
| `applicationClientId` | string | No | OAuth client ID |
| `applicationClientSecret` | string | No | OAuth client secret |

### Advanced Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `timeout` | number | 60 | Request timeout in seconds |
| `connectionPoolSize` | number | 10 | HTTP connection pool size |
| `integratedLogin` | boolean | false | Use integrated Windows authentication |
| `impersonate` | string | - | Impersonate another user |

## Connection Pooling

For high-performance scenarios, configure connection pooling:

```typescript
const tm1 = new TM1Service({
    address: 'localhost',
    port: 8001,
    user: 'admin',
    password: 'apple',
    connectionPoolSize: 50,  // Increase pool size
    timeout: 120             // Increase timeout
});
```

## Error Handling

Always handle connection errors:

```typescript
import { TM1Exception, TM1RestException } from 'tm1npm';

try {
    await tm1.connect();
    console.log('Connected successfully');
} catch (error) {
    if (error instanceof TM1RestException) {
        if (error.status === 401) {
            console.error('Authentication failed: Check credentials');
        } else if (error.status === 404) {
            console.error('Server not found: Check address/port');
        } else {
            console.error('Connection error:', error.message);
        }
    }
    throw error;
}
```

## Testing Connections

Quick connection test:

```typescript
async function testConnection(config) {
    const tm1 = new TM1Service(config);

    try {
        await tm1.connect();
        const version = await tm1.server.getProductVersion();
        console.log('✅ Connected successfully! TM1 version:', version);
        return true;
    } catch (error) {
        console.error('❌ Connection failed:', error.message);
        return false;
    } finally {
        try {
            await tm1.logout();
        } catch (e) {
            // Ignore logout errors if connection failed
        }
    }
}

// Test your configuration
await testConnection({
    address: 'localhost',
    port: 8001,
    user: 'admin',
    password: 'apple'
});
```

## Next Steps

- **[Getting Started](getting-started.md)** - Basic usage patterns
- **[API Reference](api-reference.md)** - Explore available services
- **[Examples](examples/)** - Real-world code examples
