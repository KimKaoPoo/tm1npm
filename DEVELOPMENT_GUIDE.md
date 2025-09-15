# 📖 tm1npm Development Guide

Welcome to the tm1npm development guide! This document will help you understand how to develop, build, and maintain the tm1npm TypeScript/Node.js module for IBM TM1 and Planning Analytics.

## 📋 Table of Contents

- [🚀 Getting Started](#-getting-started)
- [🏗️ Build System](#️-build-system)
- [🔗 TM1 Connection Testing](#-tm1-connection-testing)
- [🔍 Code Quality](#-code-quality)
- [🧹 Maintenance](#-maintenance)
- [📁 Project Structure](#-project-structure)
- [⚙️ Configuration](#️-configuration)
- [🛠️ Development Workflow](#️-development-workflow)
- [📦 Publishing](#-publishing)

## 🚀 Getting Started

### Prerequisites
- **Node.js**: >= 16.0.0
- **npm**: >= 7.0.0
- **TypeScript**: ^5.0.0

### Installation
```bash
git clone https://github.com/KimKaoPoo/tm1npm.git
cd tm1npm
npm install
```

## 🏗️ Build System

### Core Build Commands

#### `npm run build`
Compiles TypeScript source code to JavaScript in the `lib/` directory.

```bash
npm run build
```

**What it does:**
- Transpiles all `.ts` files from `src/` to `lib/`
- Generates type declaration files (`.d.ts`)
- Applies TypeScript compiler optimizations
- Creates source maps for debugging

**Output:**
- `lib/` - Compiled JavaScript files
- `lib/index.js` - Main entry point
- `lib/index.d.ts` - Type definitions

#### `npm run dev`
Runs TypeScript compiler in watch mode for active development.

```bash
npm run dev
```

**What it does:**
- Monitors `src/` directory for file changes
- Automatically recompiles on save
- Provides fast incremental compilation
- Perfect for active development

**Use when:**
- Developing new features
- Making frequent code changes
- Need immediate feedback on compilation errors

#### `npm run clean`
Removes build artifacts and coverage reports.

```bash
npm run clean
```

**What it does:**
- Deletes `lib/` directory
- Removes `coverage/` reports
- Cleans up temporary build files

**Use when:**
- Preparing for fresh build
- Troubleshooting build issues
- Before publishing

#### `npm run prepare`
Automatically runs before publishing to npm.

```bash
npm run prepare
```

**What it does:**
- Automatically triggers `npm run build`
- Ensures fresh build before package distribution
- Runs automatically during `npm publish`

## 🔗 TM1 Connection Testing

⚠️ **Important**: These scripts are designed to test connections to **actual TM1 server instances**. They require a running TM1 server and proper credentials.

### Connection Test Scripts

#### `npm run test:connection`
Tests connection to your TM1 server instance.

```bash
npm run test:connection
```

**What it does:**
- Connects to your configured TM1 server
- Validates authentication credentials
- Tests basic REST API connectivity
- Verifies server accessibility

**Prerequisites:**
- Running TM1 server instance
- Valid TM1 user credentials
- Network access to TM1 server
- Properly configured `.env` file

#### `npm run test:simple`
Runs simplified connection test with minimal operations.

```bash
npm run test:simple
```

**What it does:**
- Performs basic TM1 server connection
- Tests fundamental service availability
- Minimal server impact
- Quick connectivity verification

#### `npm run test:minimal`
Most basic connection test for initial setup verification.

```bash
npm run test:minimal
```

**What it does:**
- Validates server reachability
- Tests authentication only
- No data operations
- Perfect for initial setup testing

### Advanced TM1 Testing Scripts

#### `npm run test:working`
Comprehensive integration test with real TM1 operations.

```bash
npm run test:working
```

**What it does:**
- Tests multiple TM1 services (dimensions, cubes, processes)
- Performs read/write operations on server
- Validates service functionality end-to-end
- **⚠️ May modify server data** - use with caution

#### `npm run test:security`
Tests TM1 security and authentication features.

```bash
npm run test:security
```

**What it does:**
- Validates user authentication methods
- Tests security permissions
- Verifies access control functionality
- Requires TM1 security admin privileges

#### `npm run test:performance`
Performance testing against TM1 server.

```bash
npm run test:performance
```

**What it does:**
- Measures response times for TM1 operations
- Tests concurrent connection handling
- Evaluates server performance under load
- **⚠️ May impact server performance**

#### `npm run test:edge-cases`
Tests edge cases and error handling with TM1 server.

```bash
npm run test:edge-cases
```

**What it does:**
- Tests error conditions and exception handling
- Validates edge case scenarios
- Tests server behavior with invalid data
- May generate expected errors in server logs

### Setting Up TM1 Connection

#### 1. Environment Configuration
Create and configure your `.env` file:

```bash
# Copy the example environment file
cp .env.example .env

# Edit with your TM1 server details
nano .env
```

#### 2. Required Environment Variables
```env
# TM1 Server Connection Settings
TM1_ADDRESS=your-tm1-server.company.com
TM1_PORT=8080
TM1_USER=your-username
TM1_PASSWORD=your-password
TM1_SSL=true

# Optional Settings
TM1_NAMESPACE=LDAP
TM1_DATABASE=tm1srv01
TM1_TIMEOUT=30000
```

#### 3. Connection Test Workflow
```bash
# 1. Start with minimal connection test
npm run test:minimal

# 2. If successful, try simple test
npm run test:simple

# 3. For full validation, run connection test
npm run test:connection

# 4. Advanced testing (use carefully)
npm run test:working
```

### 🔒 Security Considerations

**Important Notes:**
- **Never commit `.env` files** to version control
- **Use dedicated test credentials** when possible
- **Test on development servers** before production
- **Be aware of data modification** in working tests
- **Monitor server logs** during testing

### 🚨 Troubleshooting Connection Issues

#### Common Connection Problems
```bash
# Network connectivity
ping your-tm1-server.company.com

# Port accessibility
telnet your-tm1-server.company.com 8080

# SSL certificate issues
# Set TM1_SSL=false for testing (not recommended for production)
```

#### Error Messages and Solutions

| Error | Likely Cause | Solution |
|-------|--------------|----------|
| `ECONNREFUSED` | Server not running or wrong port | Check server status and port |
| `Authentication failed` | Invalid credentials | Verify username/password |
| `SSL/TLS errors` | Certificate issues | Check SSL configuration |
| `Timeout` | Network/server issues | Increase timeout or check network |

### Connection Testing Best Practices

1. **Start Small**: Begin with `test:minimal` before advanced tests
2. **Use Test Servers**: Don't test against production TM1 instances
3. **Monitor Impact**: Watch server performance during testing
4. **Clean Up**: Remove any test data created during testing
5. **Document Results**: Keep track of successful connection configurations

## 🔍 Code Quality

### Linting Commands

#### `npm run lint`
Analyzes code for style and potential issues.

```bash
npm run lint
```

**What it does:**
- Runs ESLint on all TypeScript files in `src/`
- Checks for code style violations
- Identifies potential bugs and issues
- Enforces consistent coding standards

**Example output:**
```
src/services/RestService.ts
  45:12  error  Missing return type annotation  @typescript-eslint/explicit-function-return-type
  67:8   warning  'unusedVar' is assigned a value but never used  @typescript-eslint/no-unused-vars
```

#### `npm run lint:fix`
Automatically fixes linting issues where possible.

```bash
npm run lint:fix
```

**What it does:**
- Runs ESLint with `--fix` flag
- Automatically corrects style issues
- Formats code according to project standards
- Reports issues that require manual fixes

**Use when:**
- Before committing code
- Cleaning up code formatting
- Preparing for code review

## 🧹 Maintenance

### Environment Management

#### Environment Files
The project uses environment files for configuration:

```bash
# Create your local environment file
cp .env.example .env
# Edit with your TM1 server details
nano .env
```

**Environment variables:**
```env
TM1_ADDRESS=localhost
TM1_PORT=8080
TM1_USER=admin
TM1_PASSWORD=apple
TM1_SSL=false
```

### Development Utilities

#### File Watching
```bash
# Watch mode for development
npm run dev

# In another terminal, run your code
node lib/index.js
```

#### Debugging Setup
```typescript
// Add debug configuration to your IDE
{
  "type": "node",
  "request": "launch",
  "name": "Debug tm1npm",
  "program": "${workspaceFolder}/lib/index.js",
  "preLaunchTask": "npm: build"
}
```

## 📁 Project Structure

```
tm1npm/
├── src/                    # TypeScript source code
│   ├── services/          # TM1 service classes
│   ├── objects/           # TM1 object models
│   ├── exceptions/        # Custom exceptions
│   ├── utils/             # Utility functions
│   └── index.ts           # Main entry point
├── lib/                   # Compiled JavaScript (generated)
├── coverage/              # Coverage reports (generated)
├── tests/                 # Integration test files
├── .env                   # Environment configuration
├── .gitignore            # Git ignore patterns
├── tsconfig.json         # TypeScript configuration
├── jest.config.js        # Jest configuration
├── eslint.config.js      # ESLint configuration
└── package.json          # NPM package configuration
```

## ⚙️ Configuration

### TypeScript Configuration
The project uses `tsconfig.json` for TypeScript compilation settings:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "outDir": "./lib",
    "rootDir": "./src",
    "strict": true,
    "declaration": true,
    "esModuleInterop": true
  }
}
```

### ESLint Configuration
Code quality rules are defined in `eslint.config.js`:

- **Style**: Consistent code formatting
- **Type Safety**: TypeScript-specific rules
- **Best Practices**: JavaScript/Node.js conventions
- **Custom Rules**: TM1-specific patterns

## 🛠️ Development Workflow

### 1. Feature Development
```bash
# Start development mode
npm run dev

# In another terminal, make your changes
# The build will automatically update

# Check code quality
npm run lint

# Fix any issues
npm run lint:fix
```

### 2. Code Quality Checks
```bash
# Before committing
npm run lint
npm run build

# Verify everything works
node lib/index.js
```

### 3. Pre-commit Checklist
- [ ] `npm run lint` passes without errors
- [ ] `npm run build` completes successfully
- [ ] Code follows project conventions
- [ ] Environment files are not committed

### 4. Build Verification
```bash
# Clean build
npm run clean
npm run build

# Verify package contents
ls -la lib/
```

## 📦 Publishing

### Pre-publication Steps
```bash
# 1. Clean previous builds
npm run clean

# 2. Fresh build
npm run build

# 3. Verify package contents
npm pack --dry-run

# 4. Update version (if needed)
npm version patch|minor|major
```

### Package Contents
When published, the package includes:
- `lib/` - Compiled JavaScript
- `lib/index.d.ts` - Type definitions
- `package.json` - Package metadata
- `README.md` - Documentation

### npm Scripts Summary

#### Build & Development Scripts
| Script | Purpose | When to Use |
|--------|---------|-------------|
| `build` | Compile TypeScript | Before testing production build |
| `dev` | Watch mode compilation | During active development |
| `clean` | Remove build artifacts | Before fresh build or troubleshooting |
| `prepare` | Pre-publish build | Automatic before npm publish |
| `lint` | Check code quality | Before committing code |
| `lint:fix` | Fix linting issues | Code cleanup and formatting |

#### TM1 Connection Testing Scripts
| Script | Purpose | Prerequisites |
|--------|---------|---------------|
| `test:minimal` | Basic connection test | Running TM1 server, valid credentials |
| `test:simple` | Simple connection validation | Running TM1 server, configured `.env` |
| `test:connection` | Full connection test | TM1 server, network access, credentials |
| `test:working` | ⚠️ Comprehensive integration test | TM1 server, **may modify data** |
| `test:security` | Security & authentication test | TM1 server, admin privileges |
| `test:performance` | Performance testing | TM1 server, **may impact performance** |
| `test:edge-cases` | Error handling validation | TM1 server, expect errors in logs |

**⚠️ Important**: All TM1 connection tests require an actual TM1 server instance. Use development servers only!

## 🔧 Troubleshooting

### Common Issues

#### Build Errors
```bash
# Clear cache and rebuild
npm run clean
rm -rf node_modules package-lock.json
npm install
npm run build
```

#### Linting Issues
```bash
# Auto-fix common issues
npm run lint:fix

# For complex issues, check:
# - Import/export statements
# - Type annotations
# - Unused variables
```

#### TypeScript Errors
```bash
# Check TypeScript configuration
npx tsc --showConfig

# Verify types are installed
npm list @types/node
```

## 💡 Tips and Best Practices

### Development Tips
1. **Use watch mode** (`npm run dev`) for active development
2. **Run linting frequently** to catch issues early
3. **Clean builds** before major testing or publishing
4. **Keep environment files** out of version control

### Code Quality
1. **Follow TypeScript strict mode** - enabled in tsconfig.json
2. **Use explicit return types** for better documentation
3. **Handle errors properly** with custom TM1 exceptions
4. **Write self-documenting code** with clear variable names

### Performance
1. **Use incremental compilation** in development
2. **Minimize dependencies** in production builds
3. **Leverage TypeScript optimizations** through proper configuration

---

## 🤝 Contributing

When contributing to tm1npm:

1. **Fork the repository** and create a feature branch
2. **Follow the development workflow** outlined above
3. **Ensure all checks pass**: `npm run lint && npm run build`
4. **Write clear commit messages** describing your changes
5. **Test your changes** thoroughly before submitting

## 📞 Support

For development questions:
- **GitHub Issues**: Report bugs and feature requests
- **Documentation**: Check README.md for usage examples
- **Code Examples**: See `/tests` directory for integration patterns

Happy coding! 🚀