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
    await tm1.connect();

    const subset = new Subset('Month', 'Q1', ['Jan', 'Feb', 'Mar']);
    await tm1.dimensions.subsets.create(subset, true);
} finally {
    await tm1.logout();
}
```

## 🌟 Features

- **📊 Data Operations** - Read/write data with MDX, CSV, and DataFrame support
- **⚙️ Process Management** - Execute and monitor TM1 processes with debugging
- **🗂️ Metadata Management** - Full CRUD for cubes, dimensions, hierarchies, and more
- **🔒 Security** - User and group management with role-based access
- **📈 Monitoring** - Access logs, sessions, and performance metrics
- **🚀 Advanced Features** - Async operations, type safety, and modern TypeScript

## 📦 Installation

```bash
npm install tm1npm
```

## 🚀 Quick Start

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
    const cubes = await tm1.cubes.getAllNames();
    console.log('Available cubes:', cubes);

} finally {
    // Step 3: Always logout (REQUIRED!)
    await tm1.logout();
}
```

**⚠️ CRITICAL**: Always call `await tm1.connect()` before operations and `await tm1.logout()` when finished!

## 📚 Documentation

- **[Getting Started](docs/getting-started.md)** - Installation and basic usage
- **[Connection Guide](docs/connection-guide.md)** - All deployment types (Cloud, On-Premise, PAaaS)
- **[API Reference](docs/api-reference.md)** - Complete service documentation
- **[Examples](docs/examples/)** - Real-world code examples
- **[Migration from tm1py](docs/migration-from-tm1py.md)** - Python to TypeScript guide

## 💡 Common Examples

### Read Data
```typescript
const mdx = "SELECT [Time].[Jan] ON COLUMNS FROM [Budget]";
const data = await tm1.cubes.cells.executeMdx(mdx);
```

### Write Data
```typescript
await tm1.cubes.cells.writeValue('Budget', ['Jan', 'Revenue', 'Actual'], 1000);
```

### Execute Process
```typescript
const result = await tm1.processes.execute('ImportData', {
    pFilename: 'data.csv',
    pYear: '2024'
});
```

**[→ See More Examples](docs/examples/)**

## 🏆 Feature Parity with tm1py

tm1npm achieves **95-98% feature parity** with tm1py (Python), providing:
- ✅ **300+ functions** across 25+ services
- ✅ **DataFrame support** for pandas-like data manipulation
- ✅ **CSV export** with full formatting control
- ✅ **Cell tracing** and analysis tools
- ✅ **Async operations** for high performance

**[→ Full Feature Comparison](docs/feature-parity.md)**

## 🔧 Requirements

- **Node.js** 16.0 or higher
- **IBM Planning Analytics** (TM1 11 or TM1 12)

## 🧪 Testing

```bash
npm test                    # Run all tests
npm run test:coverage       # Run with coverage
npm run test:watch          # Watch mode
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md).

```bash
# Clone and setup
git clone https://github.com/KimKaoPoo/tm1npm.git
cd tm1npm
npm install

# Run tests
npm test

# Build
npm run build
```

## 📝 License

MIT - See [LICENSE](LICENSE) file for details

## 🙏 Inspiration

tm1npm is inspired by **tm1py**, bringing familiar Python API patterns to Node.js/TypeScript with full type safety and modern async patterns.

---

**tm1npm** - Bringing the power of IBM Planning Analytics TM1 to Node.js developers.
