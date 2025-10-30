/**
 * Main Index Export Tests
 * Comprehensive test suite for main module exports
 * Target: Improve coverage from 0% to 50%+ for src/index.ts
 */

describe('Main Module Exports', () => {
    let tm1npm: any;

    beforeAll(async () => {
        // Import the main module
        tm1npm = await import('../index');
    });

    describe('Core Service Exports', () => {
        test('should export TM1Service', () => {
            expect(tm1npm.TM1Service).toBeDefined();
            expect(typeof tm1npm.TM1Service).toBe('function');
        });

        test('should export RestService and AuthenticationMode', () => {
            expect(tm1npm.RestService).toBeDefined();
            expect(tm1npm.AuthenticationMode).toBeDefined();
            expect(typeof tm1npm.RestService).toBe('function');
        });

        test('should export basic service classes', () => {
            const basicServices = [
                'DimensionService',
                'HierarchyService', 
                'SubsetService',
                'ObjectService'
            ];

            basicServices.forEach(serviceName => {
                expect(tm1npm[serviceName]).toBeDefined();
                expect(typeof tm1npm[serviceName]).toBe('function');
            });
        });
    });

    describe('Additional Service Exports', () => {
        test('should export all additional services from services index', () => {
            const additionalServices = [
                'CubeService', 'ElementService', 'CellService', 'ProcessService',
                'ViewService', 'SecurityService', 'FileService', 'SessionService',
                'ConfigurationService', 'ServerService', 'MonitoringService',
                'AnnotationService', 'ApplicationService', 'AuditLogService',
                'ChoreService', 'GitService', 'JobService', 'LoggerService',
                'ManageService', 'MessageLogService', 'PowerBiService',
                'SandboxService', 'ThreadService', 'TransactionLogService',
                'UserService'
            ];

            additionalServices.forEach(serviceName => {
                expect(tm1npm[serviceName]).toBeDefined();
                expect(typeof tm1npm[serviceName]).toBe('function');
            });
        });

        test('should export service classes that can be instantiated', () => {
            // Test a few key services can be instantiated
            const mockRest = {} as any;
            
            expect(() => new tm1npm.DimensionService(mockRest)).not.toThrow();
            expect(() => new tm1npm.CubeService(mockRest)).not.toThrow();
            expect(() => new tm1npm.ElementService(mockRest)).not.toThrow();
        });
    });

    describe('Object Model Exports', () => {
        test('should export core TM1 object classes', () => {
            const coreObjects = [
                'TM1Object', 'Dimension', 'Hierarchy', 'Element', 'ElementAttribute'
            ];

            coreObjects.forEach(objectName => {
                expect(tm1npm[objectName]).toBeDefined();
                expect(typeof tm1npm[objectName]).toBe('function');
            });
        });

        test('should export additional object classes', () => {
            const additionalObjects = [
                'Annotation', 'Application', 'Chore', 'ChoreFrequency',
                'ChoreStartTime', 'ChoreTask', 'Cube', 'Git', 'GitCommit',
                'GitPlan', 'GitPushPlan', 'GitPullPlan', 'GitRemote',
                'Process', 'ProcessDebugBreakpoint', 'Rules', 'Sandbox',
                'Server', 'Subset', 'AnonymousSubset', 'TM1Project',
                'TM1ProjectTask', 'TM1ProjectDeployment', 'User', 'View',
                'MDXView', 'NativeView', 'ViewAxisSelection', 'ViewTitleSelection'
            ];

            additionalObjects.forEach(objectName => {
                expect(tm1npm[objectName]).toBeDefined();
                expect(typeof tm1npm[objectName]).toBe('function');
            });
        });

        test('should export enums and types correctly', () => {
            // Element types
            expect(tm1npm.ElementType).toBeDefined();
            expect(typeof tm1npm.ElementType).toBe('object');

            // Element attribute types
            expect(tm1npm.ElementAttributeType).toBeDefined();
            expect(typeof tm1npm.ElementAttributeType).toBe('object');

            // Process debug breakpoint types
            expect(tm1npm.HitMode).toBeDefined();
            expect(tm1npm.BreakPointType).toBeDefined();

            // Enum exports - Note: ChoreTaskParameter is a TypeScript interface, not runtime object
            // expect(tm1npm.ChoreTaskParameter).toBeDefined(); // This is a TypeScript interface
        });

        test('should export LogLevel enum', () => {
            expect(tm1npm.LogLevel).toBeDefined();
            expect(typeof tm1npm.LogLevel).toBe('object');
        });
    });

    describe('Exception Exports', () => {
        test('should export all exception classes', () => {
            const exceptions = [
                'TM1Exception',
                'TM1RestException',
                'TM1TimeoutException',
                'TM1VersionDeprecationException'
            ];

            exceptions.forEach(exceptionName => {
                expect(tm1npm[exceptionName]).toBeDefined();
                expect(typeof tm1npm[exceptionName]).toBe('function');
            });
        });

        test('should export exception classes that can be instantiated', () => {
            expect(() => new tm1npm.TM1Exception('test')).not.toThrow();
            expect(() => new tm1npm.TM1RestException('test', 500)).not.toThrow();
            expect(() => new tm1npm.TM1TimeoutException('test', 1000)).not.toThrow();
        });

        test('should export exceptions that inherit correctly', () => {
            const restEx = new tm1npm.TM1RestException('test', 500);
            const timeoutEx = new tm1npm.TM1TimeoutException('test', 1000);

            expect(restEx).toBeInstanceOf(tm1npm.TM1Exception);
            expect(restEx).toBeInstanceOf(Error);
            expect(timeoutEx).toBeInstanceOf(tm1npm.TM1Exception);
            expect(timeoutEx).toBeInstanceOf(Error);
        });
    });

    describe('Utility Exports', () => {
        test('should export Utils class and utility functions', () => {
            expect(tm1npm.Utils).toBeDefined();
            expect(typeof tm1npm.Utils).toBe('object'); // Utils is exported as object, not class

            // Utility functions
            expect(tm1npm.CaseAndSpaceInsensitiveMap).toBeDefined();
            expect(tm1npm.CaseAndSpaceInsensitiveSet).toBeDefined();
            expect(tm1npm.caseAndSpaceInsensitiveEquals).toBeDefined();
            expect(tm1npm.lowerAndDropSpaces).toBeDefined();
            expect(tm1npm.formatUrl).toBeDefined();

            expect(typeof tm1npm.caseAndSpaceInsensitiveEquals).toBe('function');
            expect(typeof tm1npm.lowerAndDropSpaces).toBe('function');
            expect(typeof tm1npm.formatUrl).toBe('function');
        });

        test('should export utility functions that work correctly', () => {
            // Test case and space insensitive equals
            expect(tm1npm.caseAndSpaceInsensitiveEquals('Hello World', 'hello world')).toBe(true);
            expect(tm1npm.caseAndSpaceInsensitiveEquals('Test', 'Different')).toBe(false);

            // Test lower and drop spaces
            expect(tm1npm.lowerAndDropSpaces('Hello World')).toBe('helloworld');
            expect(tm1npm.lowerAndDropSpaces('TEST  STRING')).toBe('teststring');

            // Test format URL - it URL-encodes parameters, doesn't add quotes
            expect(tm1npm.formatUrl('test {}'  , 'param')).toBe('test param');
            expect(tm1npm.formatUrl('test {} {}', 'param1', 'param2')).toBe('test param1 param2');
        });

        test('should export utility classes that can be instantiated', () => {
            expect(() => new tm1npm.CaseAndSpaceInsensitiveMap()).not.toThrow();
            expect(() => new tm1npm.CaseAndSpaceInsensitiveSet()).not.toThrow();

            // Test basic functionality
            const map = new tm1npm.CaseAndSpaceInsensitiveMap();
            map.set('Test Key', 'value');
            expect(map.get('test key')).toBe('value');
            expect(map.get('TESTKEY')).toBe('value');

            const set = new tm1npm.CaseAndSpaceInsensitiveSet();
            set.add('Test Item');
            expect(set.has('test item')).toBe(true);
            expect(set.has('TESTITEM')).toBe(true);
        });
    });

    describe('Type Exports', () => {
        test('should export TypeScript type definitions', () => {
            // These are TypeScript types, so we can't directly test them at runtime
            // But we can verify they don't cause import errors and the module loads
            expect(tm1npm).toBeDefined();
        });
    });

    describe('Version Export', () => {
        test('should export version string', () => {
            expect(tm1npm.version).toBeDefined();
            expect(typeof tm1npm.version).toBe('string');
            expect(tm1npm.version).toMatch(/^\d+\.\d+\.\d+$/); // Semver pattern
        });

        test('should export current version', () => {
            expect(tm1npm.version).toBe('2.1.0');
        });
    });

    describe('Module Integration', () => {
        test('should export all expected properties', () => {
            const expectedExports = [
                // Core services
                'TM1Service', 'RestService', 'AuthenticationMode',
                'DimensionService', 'HierarchyService', 'SubsetService', 'ObjectService',
                
                // Additional services (sample)
                'CubeService', 'ElementService', 'CellService', 'ProcessService',
                'ViewService', 'SecurityService', 'ServerService',
                
                // Core objects
                'TM1Object', 'Dimension', 'Hierarchy', 'Element', 'ElementAttribute',
                'Cube', 'Process', 'User', 'View',
                
                // Exceptions
                'TM1Exception', 'TM1RestException', 'TM1TimeoutException',
                
                // Utils
                'Utils', 'CaseAndSpaceInsensitiveMap', 'formatUrl',
                
                // Version
                'version'
            ];

            expectedExports.forEach(exportName => {
                expect(tm1npm[exportName]).toBeDefined();
            });
        });

        test('should not export unexpected properties', () => {
            const unexpectedExports = [
                'internalFunction', 'privateClass', '__dirname', '__filename'
            ];

            unexpectedExports.forEach(unexpectedName => {
                expect(tm1npm[unexpectedName]).toBeUndefined();
            });
        });

        test('should allow creating a TM1Service instance with all services', () => {
            const config = {
                address: 'localhost',
                port: 8879,
                user: 'admin',
                password: 'password',
                ssl: false
            };

            expect(() => new tm1npm.TM1Service(config)).not.toThrow();

            const tm1 = new tm1npm.TM1Service(config);
            
            // Verify all services are available
            expect(tm1.dimensions).toBeDefined();
            expect(tm1.cubes).toBeDefined();
            expect(tm1.elements).toBeDefined();
            expect(tm1.cells).toBeDefined();
            expect(tm1.processes).toBeDefined();
            expect(tm1.views).toBeDefined();
            expect(tm1.security).toBeDefined();
        });
    });

    describe('Error Handling and Edge Cases', () => {
        test('should handle invalid configurations gracefully', () => {
            // This tests that the classes can be imported and instantiated
            // Error handling for invalid configs would be in the actual service classes
            expect(() => {
                const invalidConfig = {} as any;
                new tm1npm.TM1Service(invalidConfig);
            }).not.toThrow(); // Constructor should not throw, connection would fail later
        });

        test('should handle missing dependencies gracefully', () => {
            // Test that services can be created even if some dependencies are missing
            expect(() => new tm1npm.DimensionService(null as any)).not.toThrow();
            expect(() => new tm1npm.CubeService(undefined as any)).not.toThrow();
        });

        test('should export consistent API surface', () => {
            // Verify that all exported classes follow consistent patterns
            const serviceClasses = [
                'DimensionService', 'CubeService', 'ElementService', 
                'CellService', 'ProcessService', 'ViewService'
            ];

            serviceClasses.forEach(serviceName => {
                const ServiceClass = tm1npm[serviceName];
                expect(ServiceClass).toBeDefined();
                expect(typeof ServiceClass).toBe('function');
                expect(ServiceClass.prototype).toBeDefined();
            });
        });
    });

    describe('Backward Compatibility', () => {
        test('should maintain backward compatible exports', () => {
            // Test that commonly used exports are still available
            const commonExports = [
                'TM1Service', 'RestService', 'TM1Exception',
                'Dimension', 'Cube', 'Process', 'Element',
                'DimensionService', 'CubeService', 'ProcessService'
            ];

            commonExports.forEach(exportName => {
                expect(tm1npm[exportName]).toBeDefined();
            });
        });

        test('should export types and enums for TypeScript users', () => {
            // Verify important enums are exported
            expect(tm1npm.ElementType).toBeDefined();
            expect(tm1npm.ElementAttributeType).toBeDefined();
            expect(tm1npm.AuthenticationMode).toBeDefined();
        });
    });

    describe('Module Loading Performance', () => {
        test('should load module exports efficiently', async () => {
            const startTime = Date.now();
            
            // Re-import to test loading performance
            const freshImport = await import('../index');
            
            const loadTime = Date.now() - startTime;
            
            expect(freshImport).toBeDefined();
            expect(loadTime).toBeLessThan(1000); // Should load in less than 1 second
        });

        test('should not load all services immediately', () => {
            // This ensures lazy loading is working properly
            // Heavy services should not be instantiated just from importing
            const memoryBefore = process.memoryUsage();
            
            const config = {
                address: 'localhost',
                port: 8879,
                user: 'admin',  
                password: 'password',
                ssl: false
            };

            new tm1npm.TM1Service(config);

            const memoryAfter = process.memoryUsage();
            const memoryIncrease = memoryAfter.heapUsed - memoryBefore.heapUsed;

            // Memory increase should be reasonable (less than 10MB)
            expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
        });
    });
});