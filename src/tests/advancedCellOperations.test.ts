/**
 * Unit tests for Advanced Cell Operations (Issue #12)
 * Tests new cell tracing, analysis, and validation methods
 */

import { CellService } from '../services/CellService';
import { RestService } from '../services/RestService';
import { AxiosResponse } from 'axios';

// Mock RestService
jest.mock('../services/RestService');

// Helper to create mock AxiosResponse
const createMockResponse = <T>(data: T): AxiosResponse<T> => ({
    data,
    status: 200,
    statusText: 'OK',
    headers: {},
    config: {} as any
});

describe('Advanced Cell Operations (Issue #12)', () => {
    let cellService: CellService;
    let mockRestService: jest.Mocked<RestService>;

    beforeEach(() => {
        mockRestService = new RestService({
            address: 'localhost',
            port: 8001,
            user: 'admin',
            password: 'apple'
        }) as jest.Mocked<RestService>;

        cellService = new CellService(mockRestService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('Cell Tracing Methods', () => {
        describe('traceCellDependents', () => {
            it('should trace cell dependents successfully', async () => {
                const mockDependentsData = {
                    Dependents: [
                        { Cube: 'Sales', Coordinates: ['2024', 'Total', 'Revenue'] },
                        { Cube: 'Sales', Coordinates: ['2024', 'YTD', 'Revenue'] }
                    ]
                };

                mockRestService.get.mockResolvedValue(createMockResponse(mockDependentsData));

                const result = await cellService.traceCellDependents(
                    'Sales',
                    ['2024', 'Q1', 'Revenue']
                );

                expect(mockRestService.get).toHaveBeenCalledWith(
                    "/Cubes('Sales')/tm1.TraceCellDependents(coordinates=['2024','Q1','Revenue'])"
                );
                expect(result).toEqual(mockDependentsData);
            });

            it('should trace cell dependents with sandbox', async () => {
                mockRestService.get.mockResolvedValue(createMockResponse({ Dependents: [] }));

                await cellService.traceCellDependents(
                    'Sales',
                    ['2024', 'Q1', 'Revenue'],
                    'Development'
                );

                const callUrl = mockRestService.get.mock.calls[0][0] as string;
                expect(callUrl).toContain('$sandbox=Development');
            });
        });

        describe('traceCellPrecedents', () => {
            it('should trace cell precedents successfully', async () => {
                const mockPrecedentsData = {
                    Precedents: [
                        { Cube: 'Sales', Coordinates: ['2024', 'Jan', 'Revenue'] },
                        { Cube: 'Sales', Coordinates: ['2024', 'Feb', 'Revenue'] },
                        { Cube: 'Sales', Coordinates: ['2024', 'Mar', 'Revenue'] }
                    ]
                };

                mockRestService.get.mockResolvedValue(createMockResponse(mockPrecedentsData));

                const result = await cellService.traceCellPrecedents(
                    'Sales',
                    ['2024', 'Q1', 'Revenue']
                );

                expect(mockRestService.get).toHaveBeenCalledWith(
                    "/Cubes('Sales')/tm1.TraceCellPrecedents(coordinates=['2024','Q1','Revenue'])"
                );
                expect(result).toEqual(mockPrecedentsData);
            });

            it('should trace cell precedents with sandbox', async () => {
                mockRestService.get.mockResolvedValue(createMockResponse({ Precedents: [] }));

                await cellService.traceCellPrecedents(
                    'Sales',
                    ['2024', 'Q1', 'Revenue'],
                    'TestSandbox'
                );

                const callUrl = mockRestService.get.mock.calls[0][0] as string;
                expect(callUrl).toContain('$sandbox=TestSandbox');
            });
        });

        describe('getCellDrillThroughInformation', () => {
            it('should get drill-through information', async () => {
                const mockDrillThroughData = {
                    DrillThrough: {
                        Available: true,
                        Rules: ['Rule1', 'Rule2'],
                        SourceData: 'TransactionDetails'
                    }
                };

                mockRestService.get.mockResolvedValue(createMockResponse(mockDrillThroughData));

                const result = await cellService.getCellDrillThroughInformation(
                    'Sales',
                    ['2024', 'Q1', 'Revenue']
                );

                expect(mockRestService.get).toHaveBeenCalledWith(
                    "/Cubes('Sales')/tm1.GetDrillThrough(coordinates=['2024','Q1','Revenue'])"
                );
                expect(result).toEqual(mockDrillThroughData);
            });

            it('should get drill-through with sandbox', async () => {
                mockRestService.get.mockResolvedValue(createMockResponse({ DrillThrough: {} }));

                await cellService.getCellDrillThroughInformation(
                    'Sales',
                    ['2024', 'Q1', 'Revenue'],
                    'Production'
                );

                const callUrl = mockRestService.get.mock.calls[0][0] as string;
                expect(callUrl).toContain('$sandbox=Production');
            });
        });
    });

    describe('Cell Analysis Methods', () => {
        describe('getCellAttributes', () => {
            it('should get cell attributes', async () => {
                const mockCellData = {
                    Value: 1000,
                    RuleDerived: true,
                    Updateable: false,
                    Consolidated: false,
                    Annotated: true,
                    FormatString: '#,##0.00',
                    HasPicklist: false
                };

                mockRestService.get.mockResolvedValue(createMockResponse(mockCellData));

                const result = await cellService.getCellAttributes(
                    'Sales',
                    ['2024', 'Q1', 'Revenue']
                );

                expect(result).toEqual({
                    Value: 1000,
                    RuleDerived: true,
                    Updateable: false,
                    Consolidated: false,
                    Annotated: true,
                    FormatString: '#,##0.00',
                    HasPicklist: false
                });
            });

            it('should handle missing optional fields with defaults', async () => {
                mockRestService.get.mockResolvedValue(createMockResponse({ Value: 500 }));

                const result = await cellService.getCellAttributes(
                    'Sales',
                    ['2024', 'Q1', 'Revenue']
                );

                expect(result.RuleDerived).toBe(false);
                expect(result.Updateable).toBe(false);
                expect(result.FormatString).toBe('');
            });
        });

        describe('getCellAnnotation', () => {
            it('should get cell annotation when it exists', async () => {
                mockRestService.get.mockResolvedValue(createMockResponse({
                    Text: 'This is an important cell'
                }));

                const result = await cellService.getCellAnnotation(
                    'Sales',
                    ['2024', 'Q1', 'Revenue']
                );

                expect(result).toBe('This is an important cell');
                expect(mockRestService.get).toHaveBeenCalledWith(
                    "/Cubes('Sales')/Cells('2024','Q1','Revenue')/Annotation"
                );
            });

            it('should return null when cell has no annotation (404)', async () => {
                mockRestService.get.mockRejectedValue({
                    response: { status: 404 }
                });

                const result = await cellService.getCellAnnotation(
                    'Sales',
                    ['2024', 'Q1', 'Revenue']
                );

                expect(result).toBeNull();
            });

            it('should throw error for non-404 errors', async () => {
                mockRestService.get.mockRejectedValue({
                    response: { status: 500, data: { message: 'Server error' } }
                });

                await expect(
                    cellService.getCellAnnotation('Sales', ['2024', 'Q1', 'Revenue'])
                ).rejects.toBeDefined();
            });
        });

        describe('checkCellSecurity', () => {
            it('should check cell security and return permissions', async () => {
                // Mock getCellAttributes response
                mockRestService.get.mockResolvedValueOnce(createMockResponse({
                    Value: 1000,
                    Updateable: true,
                    RuleDerived: false
                }));

                // Mock getDimensionNamesForWriting - correct structure
                mockRestService.get.mockResolvedValueOnce(createMockResponse({
                    Dimensions: [
                        { Name: 'Year' },
                        { Name: 'Period' },
                        { Name: 'Account' }
                    ]
                }));

                // Mock element security checks
                mockRestService.get.mockResolvedValue(createMockResponse({
                    Rights: 'WRITE'
                }));

                const result = await cellService.checkCellSecurity(
                    'Sales',
                    ['2024', 'Q1', 'Revenue']
                );

                expect(result).toMatchObject({
                    canRead: true,
                    canWrite: true,
                    canReserve: true,
                    isUpdateable: true,
                    isRuleDerived: false
                });
            });

            it('should return canWrite false when cell is not updateable', async () => {
                mockRestService.get.mockResolvedValueOnce(createMockResponse({
                    Value: 1000,
                    Updateable: false,
                    RuleDerived: true
                }));

                mockRestService.get.mockResolvedValueOnce(createMockResponse({
                    Dimensions: []
                }));

                const result = await cellService.checkCellSecurity(
                    'Sales',
                    ['2024', 'Q1', 'Revenue']
                );

                expect(result.canWrite).toBe(false);
                expect(result.isRuleDerived).toBe(true);
            });
        });

        describe('getCellDimensionElements', () => {
            it('should return cell dimension elements', async () => {
                const coordinates = ['2024', 'Q1', 'Revenue'];
                const result = await cellService.getCellDimensionElements('Sales', coordinates);

                expect(result).toEqual(['2024', 'Q1', 'Revenue']);
                expect(result).not.toBe(coordinates); // Should be a copy
            });
        });
    });

    describe('Cell Validation Methods', () => {
        describe('validateCellCoordinates', () => {
            it('should return true for valid coordinates', async () => {
                // Mock dimension names
                mockRestService.get.mockResolvedValueOnce(createMockResponse({
                    Dimensions: [
                        { Name: 'Year' },
                        { Name: 'Period' },
                        { Name: 'Account' }
                    ]
                }));

                // Mock element existence checks
                mockRestService.get.mockResolvedValue(createMockResponse({
                    Name: 'Element'
                }));

                const isValid = await cellService.validateCellCoordinates(
                    'Sales',
                    ['2024', 'Q1', 'Revenue']
                );

                expect(isValid).toBe(true);
            });

            it('should return false when coordinate count does not match dimensions', async () => {
                mockRestService.get.mockResolvedValueOnce(createMockResponse({
                    Dimensions: [
                        { Name: 'Year' },
                        { Name: 'Period' }
                    ]
                }));

                const isValid = await cellService.validateCellCoordinates(
                    'Sales',
                    ['2024', 'Q1', 'Revenue'] // 3 coordinates but only 2 dimensions
                );

                expect(isValid).toBe(false);
            });

            it('should return false when element does not exist', async () => {
                mockRestService.get.mockResolvedValueOnce(createMockResponse({
                    Dimensions: [
                        { Name: 'Year' },
                        { Name: 'Period' }
                    ]
                }));

                // First element exists, second does not
                mockRestService.get.mockResolvedValueOnce(createMockResponse({ Name: '2024' }));
                mockRestService.get.mockRejectedValueOnce({ response: { status: 404 } });

                const isValid = await cellService.validateCellCoordinates(
                    'Sales',
                    ['2024', 'InvalidPeriod']
                );

                expect(isValid).toBe(false);
            });

            it('should return false on error', async () => {
                mockRestService.get.mockRejectedValue(new Error('API Error'));

                const isValid = await cellService.validateCellCoordinates(
                    'Sales',
                    ['2024', 'Q1', 'Revenue']
                );

                expect(isValid).toBe(false);
            });
        });

        describe('getCellType', () => {
            it('should return NUMERIC for numeric values', async () => {
                mockRestService.get.mockResolvedValue(createMockResponse({
                    Value: 1000,
                    Consolidated: false
                }));

                const type = await cellService.getCellType(
                    'Sales',
                    ['2024', 'Q1', 'Revenue']
                );

                expect(type).toBe('NUMERIC');
            });

            it('should return STRING for string values', async () => {
                mockRestService.get.mockResolvedValue(createMockResponse({
                    Value: 'Active',
                    Consolidated: false
                }));

                const type = await cellService.getCellType(
                    'Sales',
                    ['2024', 'Q1', 'Status']
                );

                expect(type).toBe('STRING');
            });

            it('should return CONSOLIDATED for consolidated cells', async () => {
                mockRestService.get.mockResolvedValue(createMockResponse({
                    Value: 3000,
                    Consolidated: true
                }));

                const type = await cellService.getCellType(
                    'Sales',
                    ['2024', 'Total', 'Revenue']
                );

                expect(type).toBe('CONSOLIDATED');
            });

            it('should work with sandbox parameter', async () => {
                mockRestService.get.mockResolvedValue(createMockResponse({
                    Value: 500,
                    Consolidated: false
                }));

                await cellService.getCellType(
                    'Sales',
                    ['2024', 'Q1', 'Revenue'],
                    'TestSandbox'
                );

                const callUrl = mockRestService.get.mock.calls[0][0] as string;
                expect(callUrl).toContain('$sandbox=TestSandbox');
            });
        });
    });

    describe('Integration Scenarios', () => {
        it('should handle cell analysis workflow', async () => {
            // 1. Get cell attributes
            mockRestService.get.mockResolvedValueOnce(createMockResponse({
                Value: 1000,
                RuleDerived: true,
                Updateable: false,
                Annotated: true
            }));

            const attributes = await cellService.getCellAttributes(
                'Sales',
                ['2024', 'Q1', 'Revenue']
            );
            expect(attributes.RuleDerived).toBe(true);

            // 2. Get annotation if annotated
            if (attributes.Annotated) {
                mockRestService.get.mockResolvedValueOnce(createMockResponse({
                    Text: 'Important calculation'
                }));

                const annotation = await cellService.getCellAnnotation(
                    'Sales',
                    ['2024', 'Q1', 'Revenue']
                );
                expect(annotation).toBe('Important calculation');
            }

            // 3. Trace precedents if rule-derived
            if (attributes.RuleDerived) {
                mockRestService.get.mockResolvedValueOnce(createMockResponse({
                    Precedents: [{ Cube: 'Sales', Coordinates: ['2024', 'Jan', 'Revenue'] }]
                }));

                const precedents = await cellService.traceCellPrecedents(
                    'Sales',
                    ['2024', 'Q1', 'Revenue']
                );
                expect(precedents.Precedents).toHaveLength(1);
            }
        });
    });
});
