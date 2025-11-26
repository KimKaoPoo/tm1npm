/**
 * PowerBiService Unit Tests
 *
 * Comprehensive tests for Power BI integration functionality
 */

import {
    PowerBiService,
    PowerBIDataset,
    PowerBITable,
    PowerBIColumn,
    PowerBIRelationship,
    PowerBISchema,
    PowerBIConfig,
    PowerBIExportOptions,
    PowerBIFormatOptions,
    CubeMetadata,
    DimensionMetadata
} from '../services/PowerBiService';
import { RestService } from '../services/RestService';

// Mock RestService
jest.mock('../services/RestService');

// Mock dependent services
jest.mock('../services/CellService', () => ({
    CellService: jest.fn().mockImplementation(() => ({
        executeMdxDataFrameShaped: jest.fn().mockResolvedValue([
            { Dim1: 'A', Dim2: 'X', Value: 100 },
            { Dim1: 'A', Dim2: 'Y', Value: 200 },
            { Dim1: 'B', Dim2: 'X', Value: 150 }
        ]),
        executeViewDataFrameShaped: jest.fn().mockResolvedValue([
            { Dim1: 'A', Dim2: 'X', Value: 100 },
            { Dim1: 'B', Dim2: 'Y', Value: 200 }
        ])
    }))
}));

jest.mock('../services/ElementService', () => ({
    ElementService: jest.fn().mockImplementation(() => ({
        getElementAttributes: jest.fn().mockResolvedValue([
            { Name: 'Description', Type: 'String' },
            { Name: 'Code', Type: 'String' }
        ]),
        getElementsDataframe: jest.fn().mockResolvedValue({
            columns: ['Name', 'Description', 'Code'],
            data: [
                ['Element1', 'Desc 1', 'E001'],
                ['Element2', 'Desc 2', 'E002']
            ]
        }),
        getNumberOfElements: jest.fn().mockResolvedValue(100)
    }))
}));

jest.mock('../services/CubeService', () => ({
    CubeService: jest.fn().mockImplementation(() => ({
        get: jest.fn().mockResolvedValue({
            name: 'TestCube',
            dimensions: ['Dim1', 'Dim2', 'Measures'],
            rules: null
        }),
        exists: jest.fn().mockResolvedValue(true),
        getLastDataUpdate: jest.fn().mockResolvedValue('2024-01-15T10:30:00Z')
    }))
}));

jest.mock('../services/DimensionService', () => ({
    DimensionService: jest.fn().mockImplementation(() => ({
        get: jest.fn().mockResolvedValue({
            name: 'TestDimension',
            defaultHierarchy: { name: 'TestDimension' }
        }),
        exists: jest.fn().mockResolvedValue(true)
    }))
}));

jest.mock('../services/ViewService', () => ({
    ViewService: jest.fn().mockImplementation(() => ({
        get: jest.fn().mockResolvedValue({
            name: 'TestView',
            cube: 'TestCube'
        }),
        exists: jest.fn().mockResolvedValue(true)
    }))
}));

describe('PowerBiService', () => {
    let powerBiService: PowerBiService;
    let mockRestService: jest.Mocked<RestService>;

    beforeEach(() => {
        jest.clearAllMocks();
        mockRestService = new RestService({
            address: 'localhost',
            port: 8010,
            user: 'admin',
            password: 'admin',
            ssl: true
        }) as jest.Mocked<RestService>;
        powerBiService = new PowerBiService(mockRestService);
    });

    // ==================== Dataset Management Tests ====================

    describe('Dataset Management', () => {
        describe('generatePowerBIDataset', () => {
            it('should generate a dataset from single cube', async () => {
                const dataset = await powerBiService.generatePowerBIDataset(['TestCube']);

                expect(dataset).toBeDefined();
                expect(dataset.name).toContain('TM1_Dataset_');
                expect(dataset.tables).toBeDefined();
                expect(dataset.relationships).toBeDefined();
                expect(dataset.id).toBeDefined();
                expect(dataset.createdAt).toBeInstanceOf(Date);
            });

            it('should generate a dataset with custom name', async () => {
                const dataset = await powerBiService.generatePowerBIDataset(
                    ['TestCube'],
                    'MyCustomDataset'
                );

                expect(dataset.name).toBe('MyCustomDataset');
            });

            it('should create dimension tables for each cube dimension', async () => {
                const dataset = await powerBiService.generatePowerBIDataset(['TestCube']);

                // Should have dimension tables (Dim1, Dim2, Measures) + fact table (TestCube)
                expect(dataset.tables.length).toBeGreaterThanOrEqual(1);
            });

            it('should create relationships between fact and dimension tables', async () => {
                const dataset = await powerBiService.generatePowerBIDataset(['TestCube']);

                expect(dataset.relationships).toBeDefined();
                expect(dataset.relationships!.length).toBeGreaterThan(0);

                const relationship = dataset.relationships![0];
                expect(relationship.fromTable).toBeDefined();
                expect(relationship.toTable).toBeDefined();
                expect(relationship.fromColumn).toBeDefined();
                expect(relationship.toColumn).toBeDefined();
            });

            it('should store dataset for later retrieval', async () => {
                const dataset = await powerBiService.generatePowerBIDataset(['TestCube']);

                const retrieved = powerBiService.getDataset(dataset.id!);
                expect(retrieved).toEqual(dataset);
            });

            it('should apply export options when generating dataset', async () => {
                const options: PowerBIExportOptions = {
                    skipConsolidations: true,
                    skipZeros: true,
                    maxRows: 1000
                };

                const dataset = await powerBiService.generatePowerBIDataset(
                    ['TestCube'],
                    'TestDataset',
                    options
                );

                expect(dataset).toBeDefined();
            });
        });

        describe('createPowerBIConnection', () => {
            it('should create a connection and return connection ID', async () => {
                const config: PowerBIConfig = {
                    datasetName: 'TestDataset',
                    workspaceId: 'workspace-123'
                };

                const connectionId = await powerBiService.createPowerBIConnection(config);

                expect(connectionId).toBeDefined();
                expect(connectionId).toContain('conn_');
            });

            it('should store connection for status tracking', async () => {
                const config: PowerBIConfig = {
                    datasetName: 'TestDataset'
                };

                const connectionId = await powerBiService.createPowerBIConnection(config);
                const status = powerBiService.getConnectionStatus(connectionId);

                expect(status).toBeDefined();
                expect(status!.status).toBe('active');
                expect(status!.config).toEqual(config);
            });
        });

        describe('refreshPowerBIDataset', () => {
            it('should refresh dataset with new data', async () => {
                const dataset = await powerBiService.generatePowerBIDataset(['TestCube']);
                const originalUpdatedAt = dataset.updatedAt;

                // Wait a bit to ensure timestamp difference
                await new Promise(resolve => setTimeout(resolve, 10));

                const refreshed = await powerBiService.refreshPowerBIDataset(dataset.id!);

                expect(refreshed.updatedAt!.getTime()).toBeGreaterThanOrEqual(
                    originalUpdatedAt!.getTime()
                );
            });

            it('should throw error for non-existent dataset', async () => {
                await expect(
                    powerBiService.refreshPowerBIDataset('non-existent-id')
                ).rejects.toThrow('Dataset not found');
            });
        });

        describe('deletePowerBIDataset', () => {
            it('should delete existing dataset', async () => {
                const dataset = await powerBiService.generatePowerBIDataset(['TestCube']);

                await powerBiService.deletePowerBIDataset(dataset.id!);

                const retrieved = powerBiService.getDataset(dataset.id!);
                expect(retrieved).toBeUndefined();
            });

            it('should throw error for non-existent dataset', async () => {
                await expect(
                    powerBiService.deletePowerBIDataset('non-existent-id')
                ).rejects.toThrow('Dataset not found');
            });
        });

        describe('listDatasets', () => {
            it('should return empty array when no datasets exist', () => {
                const datasets = powerBiService.listDatasets();
                expect(datasets).toEqual([]);
            });

            it('should return all created datasets', async () => {
                await powerBiService.generatePowerBIDataset(['TestCube'], 'Dataset1');
                await powerBiService.generatePowerBIDataset(['TestCube'], 'Dataset2');

                const datasets = powerBiService.listDatasets();
                expect(datasets.length).toBe(2);
            });
        });
    });

    // ==================== Data Export Tests ====================

    describe('Data Export', () => {
        describe('exportCubeForPowerBI', () => {
            it('should export cube data as array', async () => {
                const data = await powerBiService.exportCubeForPowerBI('TestCube');

                expect(Array.isArray(data)).toBe(true);
            });

            it('should export cube data using view when specified', async () => {
                const data = await powerBiService.exportCubeForPowerBI('TestCube', 'TestView');

                expect(Array.isArray(data)).toBe(true);
            });

            it('should apply export options', async () => {
                const options: PowerBIExportOptions = {
                    skipZeros: true,
                    maxRows: 100
                };

                const data = await powerBiService.exportCubeForPowerBI('TestCube', undefined, options);

                expect(data.length).toBeLessThanOrEqual(100);
            });
        });

        describe('exportViewForPowerBI', () => {
            it('should export view data as array', async () => {
                const data = await powerBiService.exportViewForPowerBI('TestCube', 'TestView');

                expect(Array.isArray(data)).toBe(true);
            });

            it('should handle private views', async () => {
                const data = await powerBiService.exportViewForPowerBI(
                    'TestCube',
                    'TestView',
                    true
                );

                expect(Array.isArray(data)).toBe(true);
            });
        });

        describe('generatePowerBISchema', () => {
            it('should generate schema for cubes', async () => {
                const schema = await powerBiService.generatePowerBISchema(['TestCube']);

                expect(schema).toBeDefined();
                expect(schema.tables).toBeDefined();
                expect(schema.relationships).toBeDefined();
            });

            it('should include dimension tables in schema', async () => {
                const schema = await powerBiService.generatePowerBISchema(['TestCube']);

                // Schema should have tables for dimensions and fact
                expect(schema.tables.length).toBeGreaterThan(0);
            });

            it('should create relationships in schema', async () => {
                const schema = await powerBiService.generatePowerBISchema(['TestCube']);

                expect(schema.relationships.length).toBeGreaterThan(0);

                const rel = schema.relationships[0];
                expect(rel.fromTable).toBeDefined();
                expect(rel.toTable).toBeDefined();
            });
        });
    });

    // ==================== Power BI Formatting Tests ====================

    describe('Power BI Formatting', () => {
        describe('formatDataForPowerBI', () => {
            it('should format array data with columns', () => {
                const data = [
                    ['Value1', 'Value2', 100],
                    ['Value3', 'Value4', 200]
                ];
                const columns = ['Col1', 'Col2', 'Col3'];

                const formatted = powerBiService.formatDataForPowerBI(data, columns);

                expect(formatted.length).toBe(2);
                expect(formatted[0]).toHaveProperty('Col1', 'Value1');
                expect(formatted[0]).toHaveProperty('Col2', 'Value2');
                expect(formatted[0]).toHaveProperty('Col3', 100);
            });

            it('should format object data with columns', () => {
                const data = [
                    { Col1: 'Value1', Col2: 'Value2' },
                    { Col1: 'Value3', Col2: 'Value4' }
                ];
                const columns = ['Col1', 'Col2'];

                const formatted = powerBiService.formatDataForPowerBI(data, columns);

                expect(formatted.length).toBe(2);
                expect(formatted[0]).toHaveProperty('Col1', 'Value1');
            });

            it('should trim strings when option is set', () => {
                const data = [['  Value1  ', '  Value2  ']];
                const columns = ['Col1', 'Col2'];

                const formatted = powerBiService.formatDataForPowerBI(data, columns, {
                    trimStrings: true
                });

                expect(formatted[0].Col1).toBe('Value1');
                expect(formatted[0].Col2).toBe('Value2');
            });

            it('should convert empty strings to null when option is set', () => {
                const data = [['Value1', '']];
                const columns = ['Col1', 'Col2'];

                const formatted = powerBiService.formatDataForPowerBI(data, columns, {
                    convertEmptyToNull: true
                });

                expect(formatted[0].Col1).toBe('Value1');
                expect(formatted[0].Col2).toBeNull();
            });

            it('should apply custom null value', () => {
                const data = [[null, 'Value2']];
                const columns = ['Col1', 'Col2'];

                const formatted = powerBiService.formatDataForPowerBI(data, columns, {
                    nullValue: 'N/A'
                });

                expect(formatted[0].Col1).toBe('N/A');
            });

            it('should format booleans with custom format', () => {
                const data = [[true, false]];
                const columns = ['Col1', 'Col2'];

                const formatted = powerBiService.formatDataForPowerBI(data, columns, {
                    booleanFormat: { true: 'Yes', false: 'No' }
                });

                expect(formatted[0].Col1).toBe('Yes');
                expect(formatted[0].Col2).toBe('No');
            });
        });

        describe('createPowerBIRelationships', () => {
            it('should create relationships for cubes', async () => {
                const relationships = await powerBiService.createPowerBIRelationships(['TestCube']);

                expect(relationships.length).toBeGreaterThan(0);
            });

            it('should create relationships to dimension tables', async () => {
                const relationships = await powerBiService.createPowerBIRelationships(['TestCube']);

                const toDimension = relationships.filter(r => r.toColumn === 'Name');
                expect(toDimension.length).toBeGreaterThan(0);
            });

            it('should set cross-filtering behavior', async () => {
                const relationships = await powerBiService.createPowerBIRelationships(['TestCube']);

                relationships.forEach(rel => {
                    expect(rel.crossFilteringBehavior).toBeDefined();
                });
            });
        });

        describe('optimizeForPowerBI', () => {
            it('should filter out zero values when skipZeros is true', () => {
                const data = [
                    { Dim1: 'A', Value: 100 },
                    { Dim1: 'B', Value: 0 },
                    { Dim1: 'C', Value: 200 }
                ];

                const optimized = powerBiService.optimizeForPowerBI(data, { skipZeros: true });

                expect(optimized.length).toBe(2);
                expect(optimized.every(row => row.Value !== 0)).toBe(true);
            });

            it('should keep zero values when skipZeros is false', () => {
                const data = [
                    { Dim1: 'A', Value: 100 },
                    { Dim1: 'B', Value: 0 }
                ];

                const optimized = powerBiService.optimizeForPowerBI(data, { skipZeros: false });

                expect(optimized.length).toBe(2);
            });

            it('should limit rows when maxRows is set', () => {
                const data = Array.from({ length: 100 }, (_, i) => ({
                    Dim1: `Element${i}`,
                    Value: i
                }));

                const optimized = powerBiService.optimizeForPowerBI(data, {
                    skipZeros: false,
                    maxRows: 50
                });

                expect(optimized.length).toBe(50);
            });

            it('should convert BigInt to Number', () => {
                const data = [{ Value: BigInt(12345) }];

                const optimized = powerBiService.optimizeForPowerBI(data, { skipZeros: false });

                expect(typeof optimized[0].Value).toBe('number');
                expect(optimized[0].Value).toBe(12345);
            });

            it('should convert Date to ISO string', () => {
                const date = new Date('2024-01-15');
                const data = [{ Date: date }];

                const optimized = powerBiService.optimizeForPowerBI(data, { skipZeros: false });

                expect(typeof optimized[0].Date).toBe('string');
                expect(optimized[0].Date).toContain('2024-01-15');
            });

            it('should convert NaN to null', () => {
                const data = [{ Value: NaN }];

                const optimized = powerBiService.optimizeForPowerBI(data, { skipZeros: false });

                expect(optimized[0].Value).toBeNull();
            });

            it('should convert Infinity to null', () => {
                const data = [{ Value: Infinity }];

                const optimized = powerBiService.optimizeForPowerBI(data, { skipZeros: false });

                expect(optimized[0].Value).toBeNull();
            });
        });
    });

    // ==================== Original Methods Tests ====================

    describe('Original Methods (Compatibility)', () => {
        describe('executeMdx', () => {
            it('should execute MDX and return data', async () => {
                const data = await powerBiService.executeMdx('SELECT FROM [TestCube]');

                expect(Array.isArray(data)).toBe(true);
            });
        });

        describe('executeView', () => {
            it('should execute view and return data', async () => {
                const data = await powerBiService.executeView('TestCube', 'TestView', false);

                expect(Array.isArray(data)).toBe(true);
            });

            it('should support iterative JSON option', async () => {
                const data = await powerBiService.executeView('TestCube', 'TestView', false, true);

                expect(Array.isArray(data)).toBe(true);
            });

            it('should support blob option', async () => {
                const data = await powerBiService.executeView('TestCube', 'TestView', false, false, true);

                expect(Array.isArray(data)).toBe(true);
            });
        });

        describe('getMemberProperties', () => {
            it('should get member properties for dimension', async () => {
                const properties = await powerBiService.getMemberProperties('TestDimension');

                expect(Array.isArray(properties)).toBe(true);
            });

            it('should throw error when dimensionName is not provided', async () => {
                await expect(powerBiService.getMemberProperties()).rejects.toThrow(
                    'dimensionName is required'
                );
            });

            it('should throw error when skip_weights is false and skip_parents is true', async () => {
                await expect(
                    powerBiService.getMemberProperties(
                        'TestDimension',
                        undefined,
                        undefined,
                        true,
                        undefined,
                        true,
                        undefined,
                        undefined,
                        false
                    )
                ).rejects.toThrow('skip_weights must not be false if skip_parents is true');
            });

            it('should support custom hierarchy name', async () => {
                const properties = await powerBiService.getMemberProperties(
                    'TestDimension',
                    'CustomHierarchy'
                );

                expect(Array.isArray(properties)).toBe(true);
            });

            it('should support member selection', async () => {
                const properties = await powerBiService.getMemberProperties(
                    'TestDimension',
                    undefined,
                    ['Element1', 'Element2']
                );

                expect(Array.isArray(properties)).toBe(true);
            });
        });
    });

    // ==================== Metadata Tests ====================

    describe('Metadata', () => {
        describe('getCubeMetadata', () => {
            it('should return cube metadata', async () => {
                const metadata = await powerBiService.getCubeMetadata('TestCube');

                expect(metadata).toBeDefined();
                expect(metadata.name).toBe('TestCube');
                expect(metadata.dimensions).toBeDefined();
                expect(Array.isArray(metadata.dimensions)).toBe(true);
            });

            it('should include dimension metadata', async () => {
                const metadata = await powerBiService.getCubeMetadata('TestCube');

                expect(metadata.dimensions.length).toBeGreaterThan(0);

                const dim = metadata.dimensions[0];
                expect(dim.name).toBeDefined();
                expect(dim.hierarchyName).toBeDefined();
            });

            it('should identify measure dimension', async () => {
                const metadata = await powerBiService.getCubeMetadata('TestCube');

                // The mock cube has 'Measures' dimension which should be identified
                expect(metadata.measureDimension).toBeDefined();
            });
        });

        describe('getDimensionMetadata', () => {
            it('should return dimension metadata', async () => {
                const metadata = await powerBiService.getDimensionMetadata('TestDimension');

                expect(metadata).toBeDefined();
                expect(metadata.name).toBe('TestDimension');
                expect(metadata.hierarchyName).toBeDefined();
            });

            it('should include attributes', async () => {
                const metadata = await powerBiService.getDimensionMetadata('TestDimension');

                expect(metadata.attributes).toBeDefined();
                expect(Array.isArray(metadata.attributes)).toBe(true);
            });

            it('should include element count', async () => {
                const metadata = await powerBiService.getDimensionMetadata('TestDimension');

                expect(metadata.elementCount).toBeDefined();
                expect(typeof metadata.elementCount).toBe('number');
            });
        });
    });

    // ==================== Connection Management Tests ====================

    describe('Connection Management', () => {
        describe('getConnectionStatus', () => {
            it('should return undefined for non-existent connection', () => {
                const status = powerBiService.getConnectionStatus('non-existent');

                expect(status).toBeUndefined();
            });

            it('should return connection status for existing connection', async () => {
                const config: PowerBIConfig = { datasetName: 'Test' };
                const connectionId = await powerBiService.createPowerBIConnection(config);

                const status = powerBiService.getConnectionStatus(connectionId);

                expect(status).toBeDefined();
                expect(status!.id).toBe(connectionId);
                expect(status!.status).toBe('active');
            });
        });

        describe('listConnections', () => {
            it('should return empty array when no connections exist', () => {
                const connections = powerBiService.listConnections();

                expect(connections).toEqual([]);
            });

            it('should return all connections', async () => {
                await powerBiService.createPowerBIConnection({ datasetName: 'Test1' });
                await powerBiService.createPowerBIConnection({ datasetName: 'Test2' });

                const connections = powerBiService.listConnections();

                expect(connections.length).toBe(2);
            });
        });

        describe('closeConnection', () => {
            it('should close existing connection', async () => {
                const connectionId = await powerBiService.createPowerBIConnection({
                    datasetName: 'Test'
                });

                powerBiService.closeConnection(connectionId);

                const status = powerBiService.getConnectionStatus(connectionId);
                expect(status).toBeUndefined();
            });

            it('should handle closing non-existent connection gracefully', () => {
                expect(() => {
                    powerBiService.closeConnection('non-existent');
                }).not.toThrow();
            });
        });

        describe('updateConnectionConfig', () => {
            it('should update connection configuration', async () => {
                const connectionId = await powerBiService.createPowerBIConnection({
                    datasetName: 'Test',
                    maxRows: 100
                });

                powerBiService.updateConnectionConfig(connectionId, { maxRows: 500 });

                const status = powerBiService.getConnectionStatus(connectionId);
                expect(status!.config.maxRows).toBe(500);
            });

            it('should preserve existing config values', async () => {
                const connectionId = await powerBiService.createPowerBIConnection({
                    datasetName: 'Test',
                    workspaceId: 'workspace-123'
                });

                powerBiService.updateConnectionConfig(connectionId, { maxRows: 500 });

                const status = powerBiService.getConnectionStatus(connectionId);
                expect(status!.config.datasetName).toBe('Test');
                expect(status!.config.workspaceId).toBe('workspace-123');
            });
        });
    });

    // ==================== Interface Validation Tests ====================

    describe('Interface Validation', () => {
        describe('PowerBIDataset', () => {
            it('should have correct structure', async () => {
                const dataset = await powerBiService.generatePowerBIDataset(['TestCube']);

                expect(dataset).toMatchObject({
                    id: expect.any(String),
                    name: expect.any(String),
                    tables: expect.any(Array),
                    relationships: expect.any(Array)
                });
            });
        });

        describe('PowerBITable', () => {
            it('should have correct structure', async () => {
                const dataset = await powerBiService.generatePowerBIDataset(['TestCube']);
                const table = dataset.tables[0];

                expect(table).toMatchObject({
                    name: expect.any(String),
                    columns: expect.any(Array)
                });
            });
        });

        describe('PowerBIColumn', () => {
            it('should have correct structure', async () => {
                const dataset = await powerBiService.generatePowerBIDataset(['TestCube']);
                const column = dataset.tables[0].columns[0];

                expect(column).toMatchObject({
                    name: expect.any(String),
                    dataType: expect.any(String)
                });
            });
        });

        describe('PowerBIRelationship', () => {
            it('should have correct structure', async () => {
                const dataset = await powerBiService.generatePowerBIDataset(['TestCube']);
                const relationship = dataset.relationships![0];

                expect(relationship).toMatchObject({
                    name: expect.any(String),
                    fromTable: expect.any(String),
                    fromColumn: expect.any(String),
                    toTable: expect.any(String),
                    toColumn: expect.any(String)
                });
            });
        });

        describe('PowerBISchema', () => {
            it('should have correct structure', async () => {
                const schema = await powerBiService.generatePowerBISchema(['TestCube']);

                expect(schema).toMatchObject({
                    tables: expect.any(Array),
                    relationships: expect.any(Array)
                });
            });
        });
    });

    // ==================== Edge Cases Tests ====================

    describe('Edge Cases', () => {
        it('should handle empty cube list gracefully', async () => {
            const dataset = await powerBiService.generatePowerBIDataset([]);

            expect(dataset.tables).toEqual([]);
            expect(dataset.relationships).toEqual([]);
        });

        it('should handle empty data array in formatting', () => {
            const formatted = powerBiService.formatDataForPowerBI([], ['Col1', 'Col2']);

            expect(formatted).toEqual([]);
        });

        it('should handle null values in data', () => {
            const data = [{ Value: null }];

            const optimized = powerBiService.optimizeForPowerBI(data, { skipZeros: false });

            expect(optimized[0].Value).toBeNull();
        });

        it('should handle undefined values in data', () => {
            const data = [{ Value: undefined }];

            const optimized = powerBiService.optimizeForPowerBI(data, { skipZeros: false });

            expect(optimized[0].Value).toBeNull();
        });

        it('should handle special characters in column names', () => {
            const data = [['Value1', 'Value2']];
            const columns = ['Col With Space', 'Col-With-Dash'];

            const formatted = powerBiService.formatDataForPowerBI(data, columns);

            expect(formatted[0]['Col With Space']).toBe('Value1');
            expect(formatted[0]['Col-With-Dash']).toBe('Value2');
        });

        it('should handle very large numbers', () => {
            const data = [{ Value: Number.MAX_SAFE_INTEGER }];

            const optimized = powerBiService.optimizeForPowerBI(data, { skipZeros: false });

            expect(optimized[0].Value).toBe(Number.MAX_SAFE_INTEGER);
        });

        it('should handle negative numbers', () => {
            const data = [{ Value: -100 }];

            const optimized = powerBiService.optimizeForPowerBI(data, { skipZeros: false });

            expect(optimized[0].Value).toBe(-100);
        });

        it('should handle string zeros correctly', () => {
            const data = [
                { Value: '0' },
                { Value: '100' }
            ];

            const optimized = powerBiService.optimizeForPowerBI(data, { skipZeros: true });

            // String '0' should be filtered out when skipZeros is true
            expect(optimized.length).toBe(1);
        });
    });

    // ==================== Error Scenario Tests ====================

    describe('Error Scenarios', () => {
        describe('generatePowerBIDataset validation', () => {
            it('should throw error for non-array cubeNames', async () => {
                await expect(
                    powerBiService.generatePowerBIDataset('TestCube' as any)
                ).rejects.toThrow('cubeNames must be an array');
            });

            it('should throw error for null cubeNames', async () => {
                await expect(
                    powerBiService.generatePowerBIDataset(null as any)
                ).rejects.toThrow('cubeNames must be an array');
            });

            it('should throw error for undefined cubeNames', async () => {
                await expect(
                    powerBiService.generatePowerBIDataset(undefined as any)
                ).rejects.toThrow('cubeNames must be an array');
            });
        });

        describe('exportCubeForPowerBI validation', () => {
            it('should throw error for empty cubeName', async () => {
                await expect(
                    powerBiService.exportCubeForPowerBI('')
                ).rejects.toThrow('cubeName is required and cannot be empty');
            });

            it('should throw error for whitespace-only cubeName', async () => {
                await expect(
                    powerBiService.exportCubeForPowerBI('   ')
                ).rejects.toThrow('cubeName is required and cannot be empty');
            });

            it('should throw error for null cubeName', async () => {
                await expect(
                    powerBiService.exportCubeForPowerBI(null as any)
                ).rejects.toThrow('cubeName is required and cannot be empty');
            });

            it('should throw error for undefined cubeName', async () => {
                await expect(
                    powerBiService.exportCubeForPowerBI(undefined as any)
                ).rejects.toThrow('cubeName is required and cannot be empty');
            });
        });

        describe('createPowerBIConnection validation', () => {
            it('should throw error for empty datasetName', async () => {
                await expect(
                    powerBiService.createPowerBIConnection({ datasetName: '' })
                ).rejects.toThrow('config.datasetName is required and cannot be empty');
            });

            it('should throw error for whitespace-only datasetName', async () => {
                await expect(
                    powerBiService.createPowerBIConnection({ datasetName: '   ' })
                ).rejects.toThrow('config.datasetName is required and cannot be empty');
            });

            it('should throw error for null datasetName', async () => {
                await expect(
                    powerBiService.createPowerBIConnection({ datasetName: null as any })
                ).rejects.toThrow('config.datasetName is required and cannot be empty');
            });

            it('should throw error for undefined datasetName', async () => {
                await expect(
                    powerBiService.createPowerBIConnection({ datasetName: undefined as any })
                ).rejects.toThrow('config.datasetName is required and cannot be empty');
            });

            it('should throw error for missing config', async () => {
                await expect(
                    powerBiService.createPowerBIConnection(undefined as any)
                ).rejects.toThrow();
            });
        });
    });

    // ==================== Performance Tests ====================

    describe('Performance', () => {
        it('should handle large datasets efficiently', () => {
            const largeData = Array.from({ length: 10000 }, (_, i) => ({
                Dim1: `Element${i}`,
                Value: Math.random() * 1000
            }));

            const startTime = Date.now();
            const optimized = powerBiService.optimizeForPowerBI(largeData, {
                skipZeros: false,
                maxRows: 10000
            });
            const endTime = Date.now();

            expect(optimized.length).toBe(10000);
            expect(endTime - startTime).toBeLessThan(1000); // Should complete in less than 1 second
        });

        it('should format large datasets efficiently', () => {
            const largeData = Array.from({ length: 10000 }, (_, i) => [
                `Element${i}`,
                `Description${i}`,
                i * 100
            ]);
            const columns = ['Name', 'Description', 'Value'];

            const startTime = Date.now();
            const formatted = powerBiService.formatDataForPowerBI(largeData, columns);
            const endTime = Date.now();

            expect(formatted.length).toBe(10000);
            expect(endTime - startTime).toBeLessThan(1000);
        });
    });
});
