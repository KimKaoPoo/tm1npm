/**
 * Unit tests for CellService extract methods — Issue #67.
 * All tests mock RestService.get; no live TM1 connection required.
 */

import { CellService, ExtractCellsetRawOptions, ExtractCellsetCompositionResult } from '../services/CellService';
import { RestService } from '../services/RestService';
import {
    CaseAndSpaceInsensitiveTuplesDict,
    dimensionNameFromElementUniqueName,
    hierarchyNameFromElementUniqueName,
    elementNameFromElementUniqueName,
    dimensionNamesFromElementUniqueNames,
    extractAxesFromCellset,
    extractUniqueNamesFromMembers,
    sortCoordinates,
    buildContentFromCellsetDict,
    buildCsvFromCellsetDict,
    TUPLE_KEY_SEPARATOR,
    RawCellsetDict,
} from '../utils/Utils';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeMockRest(): jest.Mocked<RestService> {
    return {
        get: jest.fn(),
        post: jest.fn(),
        put: jest.fn(),
        patch: jest.fn(),
        delete: jest.fn(),
        add_compact_json_header: jest.fn().mockReturnValue('application/json'),
        add_http_header: jest.fn(),
    } as unknown as jest.Mocked<RestService>;
}

function mockResp(data: any, status: number = 200) {
    return {
        data,
        status,
        statusText: status === 200 ? 'OK' : status === 204 ? 'No Content' : 'Error',
        headers: {},
        config: {} as any,
    };
}

function makeCellService(rest: jest.Mocked<RestService>): CellService {
    return new CellService(rest);
}

// ─── Utils helpers ────────────────────────────────────────────────────────────

describe('Utils helpers', () => {
    describe('dimensionNameFromElementUniqueName', () => {
        it("'[Year].[Year].[2024]' → 'Year'", () => {
            expect(dimensionNameFromElementUniqueName('[Year].[Year].[2024]')).toBe('Year');
        });
        it("'[Sales Region].[Region].[North America]' → 'Sales Region'", () => {
            expect(dimensionNameFromElementUniqueName('[Sales Region].[Region].[North America]')).toBe('Sales Region');
        });
    });

    describe('hierarchyNameFromElementUniqueName', () => {
        it("'[Year].[Hier1].[2024]' → 'Hier1'", () => {
            expect(hierarchyNameFromElementUniqueName('[Year].[Hier1].[2024]')).toBe('Hier1');
        });
        it("'[Year].[Year].[2024]' → 'Year'", () => {
            expect(hierarchyNameFromElementUniqueName('[Year].[Year].[2024]')).toBe('Year');
        });
    });

    describe('elementNameFromElementUniqueName', () => {
        it("'[Year].[Year].[2024]' → '2024'", () => {
            expect(elementNameFromElementUniqueName('[Year].[Year].[2024]')).toBe('2024');
        });
        it("double-bracket escape: '[a].[a].[bracket]]name]' → 'bracket]name'", () => {
            expect(elementNameFromElementUniqueName('[a].[a].[bracket]]name]')).toBe('bracket]name');
        });
        it("'[Region].[Region].[North America]' → 'North America'", () => {
            expect(elementNameFromElementUniqueName('[Region].[Region].[North America]')).toBe('North America');
        });
    });

    describe('dimensionNamesFromElementUniqueNames', () => {
        it('extracts dimension names from iterable', () => {
            const names = ['[Year].[Year].[2024]', '[Region].[Region].[NA]'];
            expect(dimensionNamesFromElementUniqueNames(names)).toEqual(['Year', 'Region']);
        });
    });

    describe('extractAxesFromCellset', () => {
        it('drops axes with empty Tuples', () => {
            const raw: any = {
                Axes: [
                    { Cardinality: 2, Tuples: [{ Members: [] }, { Members: [] }] },
                    { Cardinality: 0, Tuples: [] },
                ],
                Cells: [],
            };
            const axes = extractAxesFromCellset(raw);
            expect(axes).toHaveLength(1);
            expect(axes[0].Cardinality).toBe(2);
        });

        it('drops null/undefined axes', () => {
            const raw: any = {
                Axes: [null, { Cardinality: 1, Tuples: [{ Members: [{ UniqueName: '[Y].[Y].[2024]' }] }] }],
                Cells: [],
            };
            const axes = extractAxesFromCellset(raw);
            expect(axes).toHaveLength(1);
        });
    });

    describe('extractUniqueNamesFromMembers', () => {
        it('prefers Element.UniqueName', () => {
            const members = [{ UniqueName: 'bad', Element: { UniqueName: '[Y].[Y].[2024]' } }];
            expect(extractUniqueNamesFromMembers(members)).toEqual(['[Y].[Y].[2024]']);
        });

        it('falls back to UniqueName when Element missing', () => {
            const members = [{ UniqueName: '[Y].[Y].[2024]' }];
            expect(extractUniqueNamesFromMembers(members)).toEqual(['[Y].[Y].[2024]']);
        });

        it('falls back to UniqueName when Element null', () => {
            const members = [{ UniqueName: '[Y].[Y].[2024]', Element: null }];
            expect(extractUniqueNamesFromMembers(members)).toEqual(['[Y].[Y].[2024]']);
        });
    });

    describe('sortCoordinates', () => {
        it('sorts by cube dimension order', () => {
            const cubeDims = ['Region', 'Year'];
            const unsorted = ['[Year].[Year].[2024]', '[Region].[Region].[NA]'];
            const sorted = sortCoordinates(cubeDims, unsorted, true);
            expect(sorted[0]).toBe('[Region].[Region].[NA]');
            expect(sorted[1]).toBe('[Year].[Year].[2024]');
        });

        it('strips to element name when elementUniqueNames=false', () => {
            const cubeDims = ['Year'];
            const unsorted = ['[Year].[Year].[2024]'];
            const sorted = sortCoordinates(cubeDims, unsorted, false);
            expect(sorted[0]).toBe('2024');
        });
    });

    describe('buildContentFromCellsetDict', () => {
        it('golden-test: 2x2 cellset → 4-entry dict', () => {
            const raw: RawCellsetDict = {
                Cube: { Name: 'C', Dimensions: [{ Name: 'Year' }, { Name: 'Region' }] },
                Axes: [
                    {
                        Cardinality: 2,
                        Tuples: [
                            { Members: [{ Element: { UniqueName: '[Year].[Year].[2024]' }, UniqueName: '' }] },
                            { Members: [{ Element: { UniqueName: '[Year].[Year].[2025]' }, UniqueName: '' }] },
                        ]
                    },
                    {
                        Cardinality: 2,
                        Tuples: [
                            { Members: [{ Element: { UniqueName: '[Region].[Region].[NA]' }, UniqueName: '' }] },
                            { Members: [{ Element: { UniqueName: '[Region].[Region].[EU]' }, UniqueName: '' }] },
                        ]
                    },
                ],
                Cells: [
                    { Value: 10 }, { Value: 20 }, { Value: 30 }, { Value: 40 }
                ],
            };

            const result = buildContentFromCellsetDict(raw);
            expect(result.size).toBe(4);
            // year=2024, region=NA → ordinal 0
            expect(result.get(`[year].[year].[2024]${TUPLE_KEY_SEPARATOR}[region].[region].[na]`)).toBeDefined();
        });

        it('applies top truncation', () => {
            const raw: RawCellsetDict = {
                Cube: { Name: 'C', Dimensions: [{ Name: 'D' }] },
                Axes: [
                    {
                        Cardinality: 3,
                        Tuples: [
                            { Members: [{ UniqueName: '[D].[D].[a]', Element: null as any }] },
                            { Members: [{ UniqueName: '[D].[D].[b]', Element: null as any }] },
                            { Members: [{ UniqueName: '[D].[D].[c]', Element: null as any }] },
                        ]
                    }
                ],
                Cells: [{ Value: 1 }, { Value: 2 }, { Value: 3 }],
            };
            const result = buildContentFromCellsetDict(raw, 2);
            expect(result.size).toBe(2);
        });

        it('skipCellProperties=true returns only cell.Value', () => {
            const raw: RawCellsetDict = {
                Cube: { Name: 'C', Dimensions: [{ Name: 'D' }] },
                Axes: [
                    { Cardinality: 1, Tuples: [{ Members: [{ UniqueName: '[D].[D].[x]', Element: null as any }] }] }
                ],
                Cells: [{ Value: 42, Ordinal: 0, RuleDerived: false }],
            };
            const result = buildContentFromCellsetDict(raw, null, true, true);
            expect(result.get('[d].[d].[x]')).toBe(42);
        });

        it('top > cells.length clamps (no TypeError) — tm1py slicing parity', () => {
            // tm1py: cells[: top or len(cells)] never indexes past end.
            const raw: RawCellsetDict = {
                Cube: { Name: 'C', Dimensions: [{ Name: 'D' }] },
                Axes: [
                    { Cardinality: 1, Tuples: [{ Members: [{ UniqueName: '[D].[D].[a]', Element: null as any }] }] }
                ],
                Cells: [{ Value: 1 }],
            };
            // top=10, only 1 cell present — should clamp, not throw
            expect(() => buildContentFromCellsetDict(raw, 10)).not.toThrow();
            const result = buildContentFromCellsetDict(raw, 10);
            expect(result.size).toBe(1);
        });

        it('coordinate tuples with element names containing "," do NOT collide', () => {
            // tm1py uses Python tuples as dict keys (Utils.py:412); the TS port joins
            // with TUPLE_KEY_SEPARATOR (\x00), which can't appear in TM1 element names.
            // Joining with ',' instead would silently merge ['a,b','c'] and ['a','b,c'].
            const raw: RawCellsetDict = {
                Cube: { Name: 'C', Dimensions: [{ Name: 'D1' }, { Name: 'D2' }] },
                Axes: [
                    {
                        Cardinality: 2,
                        Tuples: [
                            { Members: [{ UniqueName: '[D1].[D1].[a,b]', Element: null as any }] },
                            { Members: [{ UniqueName: '[D1].[D1].[a]', Element: null as any }] },
                        ]
                    },
                    {
                        Cardinality: 2,
                        Tuples: [
                            { Members: [{ UniqueName: '[D2].[D2].[c]', Element: null as any }] },
                            { Members: [{ UniqueName: '[D2].[D2].[b,c]', Element: null as any }] },
                        ]
                    },
                ],
                Cells: [{ Value: 1 }, { Value: 2 }, { Value: 3 }, { Value: 4 }],
            };
            const result = buildContentFromCellsetDict(raw);
            expect(result.size).toBe(4);
            expect(result.get(`[d1].[d1].[a,b]${TUPLE_KEY_SEPARATOR}[d2].[d2].[c]`)).toBeDefined();
            expect(result.get(`[d1].[d1].[a]${TUPLE_KEY_SEPARATOR}[d2].[d2].[b,c]`)).toBeDefined();
        });

        it('skipSandboxDimension drops Sandboxes first dimension', () => {
            const raw: RawCellsetDict = {
                Cube: { Name: 'C', Dimensions: [{ Name: 'Sandboxes' }, { Name: 'Year' }] },
                Axes: [
                    {
                        Cardinality: 1,
                        Tuples: [{
                            Members: [
                                { UniqueName: '[Year].[Year].[2024]', Element: null as any },
                            ]
                        }]
                    }
                ],
                Cells: [{ Value: 5 }],
            };
            const result = buildContentFromCellsetDict(raw, null, true, false, true);
            expect(result.size).toBe(1);
        });
    });

    describe('buildCsvFromCellsetDict', () => {
        const raw2x2: RawCellsetDict = {
            Cube: { Name: 'C', Dimensions: [{ Name: 'Year' }, { Name: 'Region' }] },
            Axes: [
                {
                    Cardinality: 1,
                    Tuples: [{ Members: [{ Name: '2024' }] }]
                },
                {
                    Cardinality: 2,
                    Tuples: [
                        { Members: [{ Name: 'NA' }] },
                        { Members: [{ Name: 'EU' }] },
                    ]
                },
            ],
            Cells: [{ Value: 10 }, { Value: 20 }],
        };

        it('golden-test: produces correct CSV string', () => {
            const csv = buildCsvFromCellsetDict(
                ['[Region].[Region]'],
                ['[Year].[Year]'],
                raw2x2,
                { lineSeparator: '\r\n', valueSeparator: ',' }
            );
            expect(csv).toContain('Region');
            expect(csv).toContain('Year');
            expect(csv).toContain('10');
            expect(csv).toContain('20');
        });

        it('empty cellset → returns ""', () => {
            const emptyCellset: RawCellsetDict = {
                Cube: { Name: 'C', Dimensions: [] },
                Axes: [],
                Cells: [],
            };
            const csv = buildCsvFromCellsetDict([], [], emptyCellset);
            expect(csv).toBe('');
        });

        it('top > cells.length clamps (no TypeError) — tm1py slicing parity', () => {
            const csv = buildCsvFromCellsetDict(
                ['[Region].[Region]'], ['[Year].[Year]'], raw2x2,
                { top: 100, includeHeaders: false }
            );
            // raw2x2 has 2 cells; top=100 must NOT throw and must emit 2 lines.
            expect(csv.trim().split(/\r\n|\n/).length).toBe(2);
        });

        it('falsy cell values serialize to "" — tm1py `or` semantics (0/false/"")', () => {
            // tm1py Utils.py:548: str(cell["Value"] or "") — Python `or` treats 0, False, ""
            // as falsy. JS `||` matches that; `??` does not (the bug we're fixing).
            const cellsetWithZero: RawCellsetDict = {
                Cube: { Name: 'C', Dimensions: [{ Name: 'Year' }] },
                Axes: [
                    { Cardinality: 1, Tuples: [{ Members: [{ Name: '2024' }] }] },
                ],
                Cells: [{ Value: 0 }],
            };
            const csv = buildCsvFromCellsetDict([], ['[Year].[Year]'], cellsetWithZero,
                { includeHeaders: false });
            // tm1py strips trailing whitespace; last field is empty (not "0").
            expect(csv).toBe('2024,');
        });

        it('quotes values containing bare \\n (tm1py csv.writer QUOTE_MINIMAL parity)', () => {
            const cellsetWithNewline: RawCellsetDict = {
                Cube: { Name: 'C', Dimensions: [{ Name: 'Year' }] },
                Axes: [
                    { Cardinality: 1, Tuples: [{ Members: [{ Name: 'foo\nbar' }] }] },
                ],
                Cells: [{ Value: 1 }],
            };
            const csv = buildCsvFromCellsetDict([], ['[Year].[Year]'], cellsetWithNewline,
                { includeHeaders: false });
            // bare \n inside default lineterminator '\r\n' must trigger quoting.
            expect(csv).toBe('"foo\nbar",1');
        });

        it('quotes values containing bare \\r (tm1py csv.writer QUOTE_MINIMAL parity)', () => {
            const cellsetWithCR: RawCellsetDict = {
                Cube: { Name: 'C', Dimensions: [{ Name: 'Year' }] },
                Axes: [
                    { Cardinality: 1, Tuples: [{ Members: [{ Name: 'foo\rbar' }] }] },
                ],
                Cells: [{ Value: 1 }],
            };
            const csv = buildCsvFromCellsetDict([], ['[Year].[Year]'], cellsetWithCR,
                { includeHeaders: false });
            expect(csv).toBe('"foo\rbar",1');
        });

        it('prefers Element.Name over member.Name (tm1py Utils.py:641-656)', () => {
            const cellset: RawCellsetDict = {
                Cube: { Name: 'C', Dimensions: [{ Name: 'Year' }] },
                Axes: [
                    {
                        Cardinality: 1,
                        Tuples: [{ Members: [{ Name: 'fallback', Element: { Name: 'preferred' } }] }],
                    },
                ],
                Cells: [{ Value: 1 }],
            };
            const csv = buildCsvFromCellsetDict([], ['[Year].[Year]'], cellset,
                { includeHeaders: false });
            expect(csv).toBe('preferred,1');
        });

        it('default lineSeparator is CRLF', () => {
            const csv = buildCsvFromCellsetDict(['[Region].[Region]'], ['[Year].[Year]'], raw2x2);
            expect(csv).toContain('\r\n');
        });

        it('custom valueSeparator', () => {
            const csv = buildCsvFromCellsetDict(
                ['[Region].[Region]'], ['[Year].[Year]'], raw2x2,
                { valueSeparator: '~' }
            );
            expect(csv).toContain('~');
        });

        it('includeHeaders=false → no header row', () => {
            const csv = buildCsvFromCellsetDict(
                ['[Region].[Region]'], ['[Year].[Year]'], raw2x2,
                { includeHeaders: false }
            );
            expect(csv).not.toContain('Region');
            expect(csv).not.toContain('Year');
            expect(csv).toContain('10');
        });

        it('quotes commas, embedded newlines, double-quotes', () => {
            const raw: RawCellsetDict = {
                Cube: { Name: 'C', Dimensions: [{ Name: 'Region' }] },
                Axes: [
                    {
                        Cardinality: 1,
                        Tuples: [{ Members: [{ Name: 'London, UK' }] }]
                    }
                ],
                Cells: [{ Value: 'Hello, "World"\r\nNewline' }],
            };
            const csv = buildCsvFromCellsetDict([], ['[Region].[Region]'], raw, { includeHeaders: false });
            expect(csv).toContain('"London, UK"');
            expect(csv).toContain('"Hello, ""World""\r\nNewline"');
        });

        it('csvDialect overrides lineSeparator/valueSeparator', () => {
            const csv = buildCsvFromCellsetDict(
                ['[Region].[Region]'], ['[Year].[Year]'], raw2x2,
                { csvDialect: { delimiter: '|', lineterminator: '\n' } }
            );
            expect(csv).toContain('|');
            expect(csv).not.toContain('\r\n');
        });

        it('mdxHeaders=true → headers are full unique names', () => {
            const csv = buildCsvFromCellsetDict(
                ['[Region].[Region]'], ['[Year].[Year]'], raw2x2,
                { mdxHeaders: true }
            );
            expect(csv).toContain('[Region].[Region]');
            expect(csv).toContain('[Year].[Year]');
        });
    });
});

// ─── URL builder tests ────────────────────────────────────────────────────────

describe('_buildCellsetRawUrl (via extractCellsetRaw URL inspection)', () => {
    let rest: jest.Mocked<RestService>;
    let svc: CellService;

    beforeEach(() => {
        rest = makeMockRest();
        svc = makeCellService(rest);
        // always return an empty raw cellset so extractCellsetRaw completes
        rest.get.mockResolvedValue(mockResp({
            Cube: { Name: 'C', Dimensions: [] },
            Axes: [],
            Cells: [],
        }));
        rest.delete.mockResolvedValue(mockResp({}));
    });

    async function captureUrl(opts: ExtractCellsetRawOptions): Promise<string> {
        rest.get.mockResolvedValue(mockResp({
            Cube: { Name: 'C', Dimensions: [] },
            Axes: [],
            Cells: [],
        }));
        await svc.extractCellsetRaw('CS1', { ...opts, deleteCellset: false });
        return (rest.get.mock.calls[0][0] as string);
    }

    it('builds default URL with cellProperties=[Value]', async () => {
        const url = await captureUrl({});
        expect(url).toContain("/Cellsets('CS1')?$expand=");
        expect(url).toContain('Cube($select=Name;$expand=Dimensions($select=Name))');
        expect(url).toContain('Cells($select=Value)');
        expect(url).toContain('$select=Name');  // member properties default
    });

    it('cellProperties=[] is treated as falsy and defaults to ["Value"] (tm1py parity)', async () => {
        // tm1py: `if not cell_properties:` treats [] as falsy. JS `??` would let
        // [] through and emit `Cells($select=)` — malformed.
        const url = await captureUrl({ cellProperties: [] });
        expect(url).toContain('Cells($select=Value)');
        expect(url).not.toContain('Cells($select=)');
    });

    it('appends Ordinal when skip is set', async () => {
        const url = await captureUrl({ skip: 5 });
        expect(url).toContain('Value,Ordinal');
        expect(url).toContain(';$skip=5');
    });

    it('appends RuleDerived+Updateable when skipRuleDerivedCells', async () => {
        const url = await captureUrl({ skipRuleDerivedCells: true });
        expect(url).toContain('Value,RuleDerived,Updateable');
    });

    it('appends Consolidated when skipConsolidatedCells', async () => {
        const url = await captureUrl({ skipConsolidatedCells: true });
        expect(url).toContain('Value,Consolidated');
    });

    it('adds top to tuples when top && !skip', async () => {
        const url = await captureUrl({ top: 10 });
        // top in tuples and cells
        expect(url).toContain(';$top=10');
    });

    it('does NOT add top to tuples when skip is also set', async () => {
        const url = await captureUrl({ top: 10, skip: 5 });
        // top in cells, no top in tuples
        const axesPart = url.split('Cells(')[0];
        expect(axesPart).not.toContain(';$top=10');
        expect(url).toContain(';$skip=5');
    });

    it('uses !sandbox query param not $sandbox', async () => {
        const url = await captureUrl({ sandboxName: 'sb1' });
        expect(url).toContain('&!sandbox=sb1');
        expect(url).not.toContain('$sandbox');
    });

    it('combines filters with " and " for all 3 skip flags', async () => {
        const url = await captureUrl({ skipZeros: true, skipConsolidatedCells: true, skipRuleDerivedCells: true });
        expect(url).toContain("Value ne 0 and Value ne null and Value ne ''");
        expect(url).toContain('Consolidated eq false');
        expect(url).toContain('RuleDerived eq false');
    });

    it('applies includeHierarchies', async () => {
        const url = await captureUrl({ includeHierarchies: true });
        expect(url).toContain('Hierarchies($select=Name;$expand=Dimension($select=Name))');
    });

    it('filterAxis included when skipContexts=true', async () => {
        const url = await captureUrl({ skipContexts: true });
        expect(url).toContain('$filter=Ordinal ne 2;');
    });
});

// ─── Tidy / cleanup tests ─────────────────────────────────────────────────────

describe('extractCellsetRaw tidy / cleanup', () => {
    let rest: jest.Mocked<RestService>;
    let svc: CellService;
    const emptyRaw = {
        Cube: { Name: 'C', Dimensions: [] },
        Axes: [],
        Cells: [],
    };

    beforeEach(() => {
        rest = makeMockRest();
        svc = makeCellService(rest);
        rest.get.mockResolvedValue(mockResp(emptyRaw));
        rest.delete.mockResolvedValue(mockResp({}));
    });

    it('calls _safeDeleteCellset by default', async () => {
        const spy = jest.spyOn(svc, '_safeDeleteCellset').mockResolvedValue();
        await svc.extractCellsetRaw('CS1');
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy).toHaveBeenCalledWith('CS1', undefined);
    });

    it('skips cleanup when deleteCellset=false', async () => {
        const spy = jest.spyOn(svc, '_safeDeleteCellset').mockResolvedValue();
        await svc.extractCellsetRaw('CS1', { deleteCellset: false });
        expect(spy).not.toHaveBeenCalled();
    });

    it('still cleans up when inner GET throws', async () => {
        rest.get.mockRejectedValueOnce(new Error('network'));
        const spy = jest.spyOn(svc, '_safeDeleteCellset').mockResolvedValue();
        await expect(svc.extractCellsetRaw('CS1')).rejects.toThrow('network');
        expect(spy).toHaveBeenCalledTimes(1);
    });

    it('_safeDeleteCellset suppresses 404 only', async () => {
        rest.delete.mockRejectedValueOnce({ status: 404 });
        await expect(svc._safeDeleteCellset('CS1')).resolves.toBeUndefined();

        rest.delete.mockRejectedValueOnce({ status: 500 });
        await expect(svc._safeDeleteCellset('CS1')).rejects.toMatchObject({ status: 500 });
    });
});

// ─── extractCellset (new signature) ──────────────────────────────────────────

describe('extractCellset (returns CaseAndSpaceInsensitiveTuplesDict)', () => {
    let rest: jest.Mocked<RestService>;
    let svc: CellService;

    beforeEach(() => {
        rest = makeMockRest();
        svc = makeCellService(rest);
        rest.delete.mockResolvedValue(mockResp({}));
    });

    it('4-cell 2x2 cellset → dict with 4 entries', async () => {
        const raw: RawCellsetDict = {
            Cube: { Name: 'C', Dimensions: [{ Name: 'Year' }, { Name: 'Region' }] },
            Axes: [
                {
                    Cardinality: 2,
                    Tuples: [
                        { Members: [{ Element: { UniqueName: '[Year].[Year].[2024]' }, UniqueName: '' }] },
                        { Members: [{ Element: { UniqueName: '[Year].[Year].[2025]' }, UniqueName: '' }] },
                    ]
                },
                {
                    Cardinality: 2,
                    Tuples: [
                        { Members: [{ Element: { UniqueName: '[Region].[Region].[NA]' }, UniqueName: '' }] },
                        { Members: [{ Element: { UniqueName: '[Region].[Region].[EU]' }, UniqueName: '' }] },
                    ]
                },
            ],
            Cells: [
                { Value: 10 }, { Value: 20 }, { Value: 30 }, { Value: 40 }
            ],
        };

        rest.get.mockResolvedValue(mockResp(raw));

        const result = await svc.extractCellset('CS1');
        expect(result).toBeInstanceOf(CaseAndSpaceInsensitiveTuplesDict);
        expect(result.size).toBe(4);
    });

    it('applies top truncation', async () => {
        const raw: RawCellsetDict = {
            Cube: { Name: 'C', Dimensions: [{ Name: 'D' }] },
            Axes: [
                {
                    Cardinality: 3,
                    Tuples: [
                        { Members: [{ UniqueName: '[D].[D].[a]', Element: null as any }] },
                        { Members: [{ UniqueName: '[D].[D].[b]', Element: null as any }] },
                        { Members: [{ UniqueName: '[D].[D].[c]', Element: null as any }] },
                    ]
                }
            ],
            Cells: [{ Value: 1 }, { Value: 2 }, { Value: 3 }],
        };
        rest.get.mockResolvedValue(mockResp(raw));

        const result = await svc.extractCellset('CS1', { top: 2 });
        expect(result.size).toBe(2);
    });

    it('skipCellProperties=true returns Value not full cell object', async () => {
        const raw: RawCellsetDict = {
            Cube: { Name: 'C', Dimensions: [{ Name: 'D' }] },
            Axes: [
                { Cardinality: 1, Tuples: [{ Members: [{ UniqueName: '[D].[D].[x]', Element: null as any }] }] }
            ],
            Cells: [{ Value: 42, Ordinal: 0, RuleDerived: false }],
        };
        rest.get.mockResolvedValue(mockResp(raw));

        const result = await svc.extractCellset('CS1', { skipCellProperties: true });
        const val = result.get('[d].[d].[x]');
        expect(val).toBe(42);
    });

    it('elementUniqueNames=false returns short element names as keys', async () => {
        const raw: RawCellsetDict = {
            Cube: { Name: 'C', Dimensions: [{ Name: 'D' }] },
            Axes: [
                { Cardinality: 1, Tuples: [{ Members: [{ UniqueName: '[D].[D].[elem1]', Element: null as any }] }] }
            ],
            Cells: [{ Value: 99 }],
        };
        rest.get.mockResolvedValue(mockResp(raw));

        const result = await svc.extractCellset('CS1', { elementUniqueNames: false });
        expect(result.has('elem1')).toBe(true);
    });
});

// ─── extractCellsetCellsRaw ───────────────────────────────────────────────────

describe('extractCellsetCellsRaw', () => {
    let rest: jest.Mocked<RestService>;
    let svc: CellService;

    beforeEach(() => {
        rest = makeMockRest();
        svc = makeCellService(rest);
        rest.get.mockResolvedValue(mockResp({ Cells: [{ Value: 1 }] }));
    });

    it('URL has only Cells expand, no Cube/Axes', async () => {
        await svc.extractCellsetCellsRaw('CS1');
        const url = rest.get.mock.calls[0][0] as string;
        expect(url).toContain("?$expand=Cells(");
        expect(url).not.toContain('Cube');
        expect(url).not.toContain('Axes');
    });

    it('withCompactJson wraps when useCompactJson=true', async () => {
        const spy = jest.spyOn(rest, 'add_compact_json_header').mockReturnValue('application/json');
        rest.get.mockResolvedValue(mockResp({
            '@odata.context': '$metadata#Cellsets(Cells(Value))/$entity',
            value: [['CS_ID'], [[42]]]
        }));
        await svc.extractCellsetCellsRaw('CS1', { useCompactJson: true });
        expect(spy).toHaveBeenCalled();
    });
});

// ─── extractCellsetAxesRawAsync ───────────────────────────────────────────────

describe('extractCellsetAxesRawAsync', () => {
    let rest: jest.Mocked<RestService>;
    let svc: CellService;

    beforeEach(() => {
        rest = makeMockRest();
        svc = makeCellService(rest);
    });

    it('throws when asyncAxis >= cardinality.Axes.length', async () => {
        rest.get.mockResolvedValueOnce(mockResp({ Axes: [{ Cardinality: 5 }, { Cardinality: 3 }] }));
        await expect(svc.extractCellsetAxesRawAsync('CS1', { asyncAxis: 2 }))
            .rejects.toThrow("'async_axis'");
    });

    it('fans out maxWorkers chunked requests', async () => {
        // Call 1: cardinality
        rest.get
            .mockResolvedValueOnce(mockResp({ Axes: [{ Cardinality: 100 }, { Cardinality: 50 }] }))
            // Call 2: fetch non-async axis (axis 0 when asyncAxis=1)
            .mockResolvedValueOnce(mockResp({ Axes: [{ Tuples: [] }] }))
            // Calls 3-6: 4 chunk requests for axis 1 (maxWorkers=4)
            .mockResolvedValue(mockResp({ Axes: [{ Tuples: [] }] }));
        // Call for context axis
        // total: 1 + 1 + 4 + 1 = 7

        await svc.extractCellsetAxesRawAsync('CS1', { asyncAxis: 1, maxWorkers: 4 });
        // 1 cardinality + 1 other-axis + 4 chunks + 1 context = 7
        expect(rest.get).toHaveBeenCalledTimes(7);
    });

    it('skipContexts=true skips context fetch', async () => {
        rest.get
            .mockResolvedValueOnce(mockResp({ Axes: [{ Cardinality: 100 }, { Cardinality: 50 }] }))
            .mockResolvedValueOnce(mockResp({ Axes: [{ Tuples: [] }] }))
            .mockResolvedValue(mockResp({ Axes: [{ Tuples: [] }] }));

        await svc.extractCellsetAxesRawAsync('CS1', { asyncAxis: 1, maxWorkers: 4, skipContexts: true });
        // 1 cardinality + 1 other-axis + 4 chunks = 6 (no context call)
        expect(rest.get).toHaveBeenCalledTimes(6);
    });

    it('concatenates Tuples in order across chunks', async () => {
        const chunk1Tuples = [{ Ordinal: 0, Members: [] }, { Ordinal: 1, Members: [] }];
        const chunk2Tuples = [{ Ordinal: 2, Members: [] }];

        rest.get
            .mockResolvedValueOnce(mockResp({ Axes: [{ Cardinality: 3 }, { Cardinality: 1 }] }))
            .mockResolvedValueOnce(mockResp({ Axes: [{ Tuples: [{ Ordinal: 0, Members: [] }] }] }))
            .mockResolvedValueOnce(mockResp({ Axes: [{ Tuples: chunk1Tuples }] }))
            .mockResolvedValueOnce(mockResp({ Axes: [{ Tuples: chunk2Tuples }] }))
            .mockResolvedValue(mockResp({ Axes: [] })); // context

        const result = await svc.extractCellsetAxesRawAsync('CS1', { asyncAxis: 1, maxWorkers: 2, skipContexts: true });
        const asyncAxisData = result.Axes[1];
        expect(asyncAxisData.Tuples).toHaveLength(3);
    });
});

// ─── extractCellsetCellsRawAsync ──────────────────────────────────────────────

describe('extractCellsetCellsRawAsync', () => {
    let rest: jest.Mocked<RestService>;
    let svc: CellService;

    beforeEach(() => {
        rest = makeMockRest();
        svc = makeCellService(rest);
    });

    it('cellcount=0 → still issues maxWorkers chunk requests (tm1py wire parity)', async () => {
        // tm1py issues max_workers parallel chunks even when cellcount=0 — partition_size=0
        // produces no `;$top=` clause so each chunk fetches the full (empty) cellset.
        rest.get
            .mockResolvedValueOnce(mockResp(0))
            .mockResolvedValue(mockResp({ '@odata.context': 'ctx', ID: 'id', Cells: [] }));
        const result = await svc.extractCellsetCellsRawAsync('CS1', { maxWorkers: 8 });
        expect(result.Cells).toEqual([]);
        expect(rest.get).toHaveBeenCalledTimes(9); // 1 count + 8 chunks
    });

    it('passes !sandbox to getCellsetCellsCount via the count GET (?-prefixed)', async () => {
        rest.get
            .mockResolvedValueOnce(mockResp(0))
            .mockResolvedValue(mockResp({ '@odata.context': 'ctx', ID: 'id', Cells: [] }));
        await svc.extractCellsetCellsRawAsync('CS1', { maxWorkers: 1, sandboxName: 'sb1' });
        const countUrl = rest.get.mock.calls[0][0] as string;
        // First (and only) query param on the $count URL must use `?`, not `&`.
        expect(countUrl).toContain("/Cells/$count?!sandbox=sb1");
        expect(countUrl).not.toContain("/Cells/$count&");
    });

    it('cellcount=100 maxWorkers=4 → 4 GETs + 1 count', async () => {
        rest.get
            .mockResolvedValueOnce(mockResp(100))   // getCellsetCellsCount
            .mockResolvedValue(mockResp({ '@odata.context': 'ctx', ID: 'id', Cells: [] }));

        await svc.extractCellsetCellsRawAsync('CS1', { maxWorkers: 4 });
        expect(rest.get).toHaveBeenCalledTimes(5); // 1 count + 4 chunk
    });

    it('applies skipZeros filter to all chunks', async () => {
        rest.get
            .mockResolvedValueOnce(mockResp(10))
            .mockResolvedValue(mockResp({ '@odata.context': '', ID: '', Cells: [] }));

        await svc.extractCellsetCellsRawAsync('CS1', { maxWorkers: 2, skipZeros: true });
        // Verify each chunk URL contains the filter
        const chunkUrls = rest.get.mock.calls.slice(1).map(c => c[0] as string);
        for (const url of chunkUrls) {
            expect(url).toContain("Value ne 0 and Value ne null and Value ne ''");
        }
    });

    it('chunk failure rejects via Promise.all', async () => {
        rest.get
            .mockResolvedValueOnce(mockResp(10))
            .mockRejectedValueOnce(new Error('chunk failed'))
            .mockResolvedValue(mockResp({ '@odata.context': '', ID: '', Cells: [] }));

        await expect(svc.extractCellsetCellsRawAsync('CS1', { maxWorkers: 2 }))
            .rejects.toThrow('chunk failed');
    });
});

// ─── extractCellsetComposition ────────────────────────────────────────────────

describe('extractCellsetComposition', () => {
    let rest: jest.Mocked<RestService>;
    let svc: CellService;

    beforeEach(() => {
        rest = makeMockRest();
        svc = makeCellService(rest);
    });

    it('1-axis cellset → only columns populated', async () => {
        rest.get.mockResolvedValue(mockResp({
            Cube: { Name: 'MyCube' },
            Axes: [{ Hierarchies: [{ UniqueName: '[Year].[Year]' }] }]
        }));
        const result = await svc.extractCellsetComposition('CS1');
        expect(result.cube).toBe('MyCube');
        expect(result.columns).toEqual(['[Year].[Year]']);
        expect(result.rows).toEqual([]);
        expect(result.titles).toEqual([]);
    });

    it('2-axis → columns + rows, no titles', async () => {
        rest.get.mockResolvedValue(mockResp({
            Cube: { Name: 'C' },
            Axes: [
                { Hierarchies: [{ UniqueName: '[Year].[Year]' }] },
                { Hierarchies: [{ UniqueName: '[Region].[Region]' }] },
            ]
        }));
        const result = await svc.extractCellsetComposition('CS1');
        expect(result.columns).toEqual(['[Year].[Year]']);
        expect(result.rows).toEqual(['[Region].[Region]']);
        expect(result.titles).toEqual([]);
    });

    it('3-axis → columns + rows + titles', async () => {
        rest.get.mockResolvedValue(mockResp({
            Cube: { Name: 'C' },
            Axes: [
                { Hierarchies: [{ UniqueName: '[Year].[Year]' }] },
                { Hierarchies: [{ UniqueName: '[Region].[Region]' }] },
                { Hierarchies: [{ UniqueName: '[Version].[Version]' }] },
            ]
        }));
        const result = await svc.extractCellsetComposition('CS1');
        expect(result.titles).toEqual(['[Version].[Version]']);
    });

    it('URL is correct shape', async () => {
        rest.get.mockResolvedValue(mockResp({
            Cube: { Name: 'C' },
            Axes: [{ Hierarchies: [] }]
        }));
        await svc.extractCellsetComposition('CS1');
        const url = rest.get.mock.calls[0][0] as string;
        expect(url).toContain("Cellsets('CS1')");
        expect(url).toContain('Cube($select=Name)');
        expect(url).toContain('Axes($expand=Hierarchies($select=UniqueName))');
    });
});

// ─── extractCellsetCsv ────────────────────────────────────────────────────────

describe('extractCellsetCsv', () => {
    let rest: jest.Mocked<RestService>;
    let svc: CellService;

    const compositionResp = {
        Cube: { Name: 'C' },
        Axes: [
            { Hierarchies: [{ UniqueName: '[Year].[Year]' }] },
            { Hierarchies: [{ UniqueName: '[Region].[Region]' }] },
        ]
    };

    const rawCellset: RawCellsetDict = {
        Cube: { Name: 'C', Dimensions: [{ Name: 'Year' }, { Name: 'Region' }] },
        Axes: [
            { Cardinality: 1, Tuples: [{ Members: [{ Name: '2024' }] }] },
            { Cardinality: 2, Tuples: [
                { Members: [{ Name: 'NA' }] },
                { Members: [{ Name: 'EU' }] },
            ]},
        ],
        Cells: [{ Value: 10 }, { Value: 0 }, { Value: 30 }],
    };

    beforeEach(() => {
        rest = makeMockRest();
        svc = makeCellService(rest);
        rest.delete.mockResolvedValue(mockResp({}));
    });

    it('default skipZeros=true', async () => {
        rest.get
            .mockResolvedValueOnce(mockResp(compositionResp))
            .mockResolvedValueOnce(mockResp({
                ...rawCellset,
                Cells: [{ Value: 10 }, { Value: 0 }]
            }));
        const url1 = await captureRawUrl(svc, rest, compositionResp, {
            ...rawCellset,
            Cells: [{ Value: 10 }, { Value: 0 }]
        });
        expect(url1).toContain("Value ne 0 and Value ne null and Value ne ''");
    });

    it('default lineSeparator is CRLF', async () => {
        rest.get
            .mockResolvedValueOnce(mockResp(compositionResp))
            .mockResolvedValueOnce(mockResp(rawCellset));
        const csv = await svc.extractCellsetCsv('CS1', { skipZeros: false });
        expect(csv).toContain('\r\n');
    });

    it('valueSeparator=~', async () => {
        rest.get
            .mockResolvedValueOnce(mockResp(compositionResp))
            .mockResolvedValueOnce(mockResp(rawCellset));
        const csv = await svc.extractCellsetCsv('CS1', { valueSeparator: '~', skipZeros: false });
        expect(csv).toContain('~');
    });

    it('includeHeaders=false → no header row', async () => {
        rest.get
            .mockResolvedValueOnce(mockResp(compositionResp))
            .mockResolvedValueOnce(mockResp(rawCellset));
        const csv = await svc.extractCellsetCsv('CS1', { includeHeaders: false, skipZeros: false });
        expect(csv).not.toContain('Year');
        expect(csv).not.toContain('Region');
    });

    it('mdxHeaders=true → headers are full unique names', async () => {
        rest.get
            .mockResolvedValueOnce(mockResp(compositionResp))
            .mockResolvedValueOnce(mockResp(rawCellset));
        const csv = await svc.extractCellsetCsv('CS1', { mdxHeaders: true, skipZeros: false });
        expect(csv).toContain('[Year].[Year]');
        expect(csv).toContain('[Region].[Region]');
    });

    it('empty cellset → returns ""', async () => {
        rest.get
            .mockResolvedValueOnce(mockResp(compositionResp))
            .mockResolvedValueOnce(mockResp({
                ...rawCellset,
                Cells: []
            }));
        const csv = await svc.extractCellsetCsv('CS1');
        expect(csv).toBe('');
    });
});

async function captureRawUrl(
    svc: CellService,
    rest: jest.Mocked<RestService>,
    compositionResp: any,
    rawCellset: any
): Promise<string> {
    rest.get
        .mockResolvedValueOnce(mockResp(compositionResp))
        .mockResolvedValueOnce(mockResp(rawCellset));
    await svc.extractCellsetCsv('CS1');
    // second call is extractCellsetRaw URL
    return rest.get.mock.calls[1][0] as string;
}

// ─── extractCellsetCsvIterJson ────────────────────────────────────────────────

describe('extractCellsetCsvIterJson', () => {
    let rest: jest.Mocked<RestService>;
    let svc: CellService;

    const compositionResp = {
        Cube: { Name: 'C' },
        Axes: [
            { Hierarchies: [{ UniqueName: '[Year].[Year]' }] },
            { Hierarchies: [{ UniqueName: '[Region].[Region]' }] },
        ]
    };

    beforeEach(() => {
        rest = makeMockRest();
        svc = makeCellService(rest);
        rest.delete.mockResolvedValue(mockResp({}));
    });

    function makeReadableStream(data: any) {
        // Create a mock readable stream from a Buffer
        const { Readable } = require('stream');
        const json = JSON.stringify(data);
        return Readable.from([json]);
    }

    it('empty cellset → returns ""', async () => {
        const rawData = {
            Cube: { Name: 'C', Dimensions: [{ Name: 'Year' }, { Name: 'Region' }] },
            Axes: [
                { Ordinal: 0, Tuples: [{ Ordinal: 0, Members: [{ Name: '2024' }] }] },
                { Ordinal: 1, Tuples: [] }
            ],
            Cells: []
        };

        rest.get
            .mockResolvedValueOnce(mockResp(compositionResp))
            .mockResolvedValueOnce(mockResp(makeReadableStream(rawData)));

        const csv = await svc.extractCellsetCsvIterJson('CS1');
        expect(csv).toBe('');
    });

    it('produces CSV with correct headers and values', async () => {
        const rawData = {
            Cube: { Name: 'C', Dimensions: [{ Name: 'Year' }, { Name: 'Region' }] },
            Axes: [
                {
                    Ordinal: 0,
                    Tuples: [{ Ordinal: 0, Members: [{ Name: 'Jan' }] }]
                },
                {
                    Ordinal: 1,
                    Tuples: [
                        { Ordinal: 0, Members: [{ Name: 'North' }] },
                        { Ordinal: 1, Members: [{ Name: 'South' }] },
                    ]
                }
            ],
            Cells: [{ Value: 10, Ordinal: 0 }, { Value: 20, Ordinal: 1 }]
        };

        rest.get
            .mockResolvedValueOnce(mockResp(compositionResp))
            .mockResolvedValueOnce(mockResp(makeReadableStream(rawData)));

        const csv = await svc.extractCellsetCsvIterJson('CS1');
        expect(csv).toContain('Year');
        expect(csv).toContain('Region');
        expect(csv).toContain('Jan');
        expect(csv).toContain('North');
        expect(csv).toContain('10');
        expect(csv).toContain('20');
    });

    it('mdxHeaders=true → fully-qualified column/row headers', async () => {
        const rawData = {
            Cube: { Name: 'C', Dimensions: [{ Name: 'Year' }, { Name: 'Region' }] },
            Axes: [
                { Ordinal: 0, Tuples: [{ Ordinal: 0, Members: [{ Name: 'Jan' }] }] },
                { Ordinal: 1, Tuples: [{ Ordinal: 0, Members: [{ Name: 'North' }] }] }
            ],
            Cells: [{ Value: 10, Ordinal: 0 }]
        };

        rest.get
            .mockResolvedValueOnce(mockResp(compositionResp))
            .mockResolvedValueOnce(mockResp(makeReadableStream(rawData)));

        const csv = await svc.extractCellsetCsvIterJson('CS1', { mdxHeaders: true });
        expect(csv).toContain('[Region].[Region]');
        expect(csv).toContain('[Year].[Year]');
    });

    it('JSON tokens split across chunks produce same result', async () => {
        const rawData = {
            Cube: { Name: 'C', Dimensions: [{ Name: 'Year' }, { Name: 'Region' }] },
            Axes: [
                { Ordinal: 0, Tuples: [{ Ordinal: 0, Members: [{ Name: 'Jan' }] }] },
                { Ordinal: 1, Tuples: [{ Ordinal: 0, Members: [{ Name: 'North' }] }] }
            ],
            Cells: [{ Value: 42, Ordinal: 0 }]
        };

        const { Readable } = require('stream');
        const json = JSON.stringify(rawData);
        // Split into 2 chunks
        const half = Math.floor(json.length / 2);
        const splitStream = Readable.from([json.slice(0, half), json.slice(half)]);

        rest.get
            .mockResolvedValueOnce(mockResp(compositionResp))
            .mockResolvedValueOnce(mockResp(splitStream));

        const csv = await svc.extractCellsetCsvIterJson('CS1');
        expect(csv).toContain('42');
    });

    it('null cell value serializes to "None" (Python str(None) parity)', async () => {
        // tm1py: row = … + [str(value)]. Python str(None) → "None", not "null".
        // Downstream dataframe NA detection looks for "None" specifically.
        const rawData = {
            Cube: { Name: 'C', Dimensions: [{ Name: 'Year' }, { Name: 'Region' }] },
            Axes: [
                { Ordinal: 0, Tuples: [{ Ordinal: 0, Members: [{ Name: 'Jan' }] }] },
                { Ordinal: 1, Tuples: [{ Ordinal: 0, Members: [{ Name: 'North' }] }] }
            ],
            Cells: [{ Value: null, Ordinal: 0 }]
        };

        rest.get
            .mockResolvedValueOnce(mockResp(compositionResp))
            .mockResolvedValueOnce(mockResp(makeReadableStream(rawData)));

        const csv = await svc.extractCellsetCsvIterJson('CS1');
        expect(csv).toContain('None');
        expect(csv).not.toContain('null');
    });

    it('rejects when visit() throws (Cells.item.Value before any axes tuples)', async () => {
        // tm1py raises ZeroDivisionError when divmod(ordinal, len(axes0_list))
        // sees axes0_list==[] — port mirrors via explicit throw. Stream-data
        // listener throws don't auto-propagate, so we catch+reject explicitly.
        const malformedRawData = {
            Cube: { Name: 'C', Dimensions: [{ Name: 'Year' }, { Name: 'Region' }] },
            // No Axes population (no Axes.item.Tuples.item.Members.item.Name event
            // fires before Cells.item.Value).
            Axes: [],
            Cells: [{ Value: 42, Ordinal: 0 }]
        };

        rest.get
            .mockResolvedValueOnce(mockResp(compositionResp))
            .mockResolvedValueOnce(mockResp(makeReadableStream(malformedRawData)));

        await expect(svc.extractCellsetCsvIterJson('CS1'))
            .rejects.toThrow(/division by zero/);
    });
});
