/**
 * Behavioral parity tests for CellService execute methods (issue #65).
 *
 * Verifies that executeMdx, executeMdxRaw, executeView, executeViewRaw,
 * executeMdxCsv, executeViewCsv accept and forward the full tm1py
 * parameter surface to the underlying extract helpers and match tm1py's
 * default values. tm1py's useBlob CSV path is intentionally not exposed
 * yet (see ExecuteMdxCsvOptions / ExecuteViewCsvOptions deferral note).
 */

import { CellService } from '../services/CellService';
import { RestService } from '../services/RestService';
import { CaseAndSpaceInsensitiveTuplesDict } from '../utils/Utils';

const mkResp = (data: any) => ({ data, status: 200, statusText: 'OK', headers: {}, config: {} as any });

describe('CellService execute methods — tm1py parity (#65)', () => {
    let cellService: CellService;
    let rest: jest.Mocked<RestService>;

    beforeEach(() => {
        rest = {
            get: jest.fn(),
            post: jest.fn(),
            patch: jest.fn(),
            delete: jest.fn(),
            put: jest.fn(),
            config: {} as any,
            rest: {} as any,
            buildBaseUrl: jest.fn(),
            extractErrorMessage: jest.fn(),
        } as any;
        cellService = new CellService(rest);
    });

    // ── executeMdx ───────────────────────────────────────────────────────

    describe('executeMdx', () => {
        test('returns CaseAndSpaceInsensitiveTuplesDict, not raw cellset', async () => {
            jest.spyOn(cellService, 'createCellset').mockResolvedValue('cs1');
            jest.spyOn(cellService, 'extractCellset').mockResolvedValue(new CaseAndSpaceInsensitiveTuplesDict<any>());

            const result = await cellService.executeMdx('SELECT 1 ON 0 FROM [c]');

            expect(result).toBeInstanceOf(CaseAndSpaceInsensitiveTuplesDict);
            // Raw cellset shape should NOT be present on the TuplesDict result.
            expect((result as any).Axes).toBeUndefined();
            expect((result as any).Cells).toBeUndefined();
        });

        test('forwards all tm1py params to extractCellset', async () => {
            jest.spyOn(cellService, 'createCellset').mockResolvedValue('cs1');
            const extractSpy = jest.spyOn(cellService, 'extractCellset')
                .mockResolvedValue(new CaseAndSpaceInsensitiveTuplesDict<any>());

            await cellService.executeMdx('SELECT 1 ON 0 FROM [c]', {
                cellProperties: ['Value', 'RuleDerived'],
                top: 5,
                skip: 2,
                skipContexts: true,
                skipZeros: true,
                skipConsolidatedCells: true,
                skipRuleDerivedCells: true,
                sandboxName: 'sb',
                elementUniqueNames: false,
                skipCellProperties: true,
                useCompactJson: true,
                skipSandboxDimension: true,
            });

            expect(extractSpy).toHaveBeenCalledWith('cs1', expect.objectContaining({
                cellProperties: ['Value', 'RuleDerived'],
                top: 5,
                skip: 2,
                skipContexts: true,
                skipZeros: true,
                skipConsolidatedCells: true,
                skipRuleDerivedCells: true,
                sandboxName: 'sb',
                elementUniqueNames: false,
                skipCellProperties: true,
                useCompactJson: true,
                skipSandboxDimension: true,
                deleteCellset: true,
            }));
        });

        test('maxWorkers > 1 dispatches to executeMdxAsync with full options forwarded (tm1py parity)', async () => {
            const dict = new CaseAndSpaceInsensitiveTuplesDict<any>();
            dict.set('a', 1);
            const asyncSpy = jest.spyOn(cellService, 'executeMdxAsync').mockResolvedValue(dict);
            const extractSpy = jest.spyOn(cellService, 'extractCellset');

            // tm1py's execute_mdx with max_workers>1 forwards every named option to
            // execute_mdx_async (CellService.py:2102-2119). tm1npm now forwards the
            // full ExecuteMdxOptions surface.
            const result = await cellService.executeMdx('SELECT 1 ON 0 FROM [c]', {
                maxWorkers: 8, sandboxName: 'sb', cellProperties: ['Value'],
                top: 100, skipZeros: true,
            });

            expect(asyncSpy).toHaveBeenCalledWith('SELECT 1 ON 0 FROM [c]', expect.objectContaining({
                maxWorkers: 8,
                sandboxName: 'sb',
                cellProperties: ['Value'],
                top: 100,
                skipZeros: true,
            }));
            expect(extractSpy).not.toHaveBeenCalled();
            expect(result).toBeInstanceOf(CaseAndSpaceInsensitiveTuplesDict);
        });

        test('default skipZeros is false (parity with tm1py execute_mdx)', async () => {
            jest.spyOn(cellService, 'createCellset').mockResolvedValue('cs1');
            const extractSpy = jest.spyOn(cellService, 'extractCellset')
                .mockResolvedValue(new CaseAndSpaceInsensitiveTuplesDict<any>());

            await cellService.executeMdx('SELECT 1 ON 0 FROM [c]');

            expect(extractSpy).toHaveBeenCalledWith('cs1', expect.objectContaining({
                skipZeros: undefined,
            }));
        });
    });

    // ── executeMdxRaw ────────────────────────────────────────────────────

    describe('executeMdxRaw', () => {
        test('forwards elemProperties/memberProperties/includeHierarchies', async () => {
            jest.spyOn(cellService, 'createCellset').mockResolvedValue('cs1');
            const extractSpy = jest.spyOn(cellService, 'extractCellsetRaw')
                .mockResolvedValue({ Axes: [], Cells: [] } as any);

            await cellService.executeMdxRaw('SELECT 1 ON 0 FROM [c]', {
                cellProperties: ['Value'],
                elemProperties: ['Name', 'Type'],
                memberProperties: ['Name', 'UniqueName'],
                top: 3,
                skip: 1,
                skipContexts: true,
                skipZeros: true,
                sandboxName: 'sb',
                includeHierarchies: true,
                useCompactJson: true,
            });

            expect(extractSpy).toHaveBeenCalledWith('cs1', expect.objectContaining({
                elemProperties: ['Name', 'Type'],
                memberProperties: ['Name', 'UniqueName'],
                includeHierarchies: true,
                useCompactJson: true,
                deleteCellset: true,
            }));
        });

        test('returns raw cellset (preserves Axes/Cells)', async () => {
            jest.spyOn(cellService, 'createCellset').mockResolvedValue('cs1');
            const raw = { Axes: [{ Tuples: [] }], Cells: [{ Value: 42 }] } as any;
            jest.spyOn(cellService, 'extractCellsetRaw').mockResolvedValue(raw);

            const result = await cellService.executeMdxRaw('SELECT 1 ON 0 FROM [c]');
            expect(result.Cells).toEqual([{ Value: 42 }]);
            expect(result.Axes).toBeDefined();
        });
    });

    // ── createCellsetFromView URL escaping ───────────────────────────────

    describe('createCellsetFromView URL parity (build_url_friendly_object_name)', () => {
        test('escapes & in cube/view names (real-world names like "Sales & Revenue")', async () => {
            const postSpy = jest.spyOn((cellService as any).rest, 'post')
                .mockResolvedValue({ data: { ID: 'cs1' }, headers: {} });

            await cellService.createCellsetFromView('Sales & Revenue', 'Top 5 & Bottom', false);

            // tm1py's format_url runs cube/view names through build_url_friendly_object_name
            // which encodes & as %26, # as %23, ? as %3F, % as %25. Plain quote-doubling
            // would leave & unencoded and the URL would parse it as a query separator.
            const url = postSpy.mock.calls[0][0];
            expect(url).toBe("/Cubes('Sales %26 Revenue')/Views('Top 5 %26 Bottom')/tm1.Execute");
        });

        test('escapes single quotes via doubling (consistent with build_url_friendly_object_name)', async () => {
            const postSpy = jest.spyOn((cellService as any).rest, 'post')
                .mockResolvedValue({ data: { ID: 'cs1' }, headers: {} });

            await cellService.createCellsetFromView("Sam's Cube", "Sam's View", true);

            const url = postSpy.mock.calls[0][0];
            expect(url).toBe("/Cubes('Sam''s Cube')/PrivateViews('Sam''s View')/tm1.Execute");
        });

        test('selects PrivateViews vs Views path segment based on isPrivate (no $private query param)', async () => {
            const postSpy = jest.spyOn((cellService as any).rest, 'post')
                .mockResolvedValue({ data: { ID: 'cs1' }, headers: {} });

            await cellService.createCellsetFromView('Cube', 'View', true);
            await cellService.createCellsetFromView('Cube', 'View', false);

            expect(postSpy.mock.calls[0][0]).toContain("/PrivateViews('View')");
            expect(postSpy.mock.calls[1][0]).toContain("/Views('View')");
            expect(postSpy.mock.calls[0][0]).not.toContain('$private');
        });

        test('execute_view_async signature does not accept useCompactJson (tm1py parity)', async () => {
            // tm1py's execute_view_async (CellService.py:2278-2294) has no
            // use_compact_json parameter — only execute_mdx_async forwards it.
            // ExecuteViewAsyncOptions omits useCompactJson so TypeScript catches
            // the mismatch at compile time. The line below is intentionally a
            // ts-expect-error: removing it should make this test fail to compile.
            // @ts-expect-error - useCompactJson must not be a valid option on execute_view_async
            const callsWithRejected = () => cellService.execute_view_async('Cube', 'View', { useCompactJson: true });

            // Runtime check: even if a caller bypasses TS (e.g. `as any`), the
            // method does not pass useCompactJson through to extractCellset.
            jest.spyOn(cellService, 'createCellsetFromView').mockResolvedValue('cs1');
            const extractSpy = jest.spyOn(cellService, 'extractCellset')
                .mockResolvedValue(new CaseAndSpaceInsensitiveTuplesDict<any>());
            jest.spyOn(cellService, '_safeDeleteCellset').mockResolvedValue(undefined);

            await cellService.execute_view_async('Cube', 'View', { useCompactJson: true } as any);
            const forwarded = extractSpy.mock.calls[0][1]!;
            expect(forwarded).not.toHaveProperty('useCompactJson');

            // Reference the helper so it's not unused (the test value is the ts-expect-error above).
            expect(typeof callsWithRejected).toBe('function');
        });
    });

    // ── executeView ──────────────────────────────────────────────────────

    describe('executeView', () => {
        test('routes via createCellsetFromView with private + sandbox', async () => {
            const createViewSpy = jest.spyOn(cellService, 'createCellsetFromView')
                .mockResolvedValue('cs1');
            const extractSpy = jest.spyOn(cellService, 'extractCellset')
                .mockResolvedValue(new CaseAndSpaceInsensitiveTuplesDict<any>());

            await cellService.executeView('Cube', 'View', {
                private: true,
                sandboxName: 'sb',
                top: 5,
            });

            expect(createViewSpy).toHaveBeenCalledWith('Cube', 'View', true, 'sb');
            expect(extractSpy).toHaveBeenCalledWith('cs1', expect.objectContaining({
                top: 5,
                sandboxName: 'sb',
                deleteCellset: true,
            }));
        });

        test('maxWorkers > 1 forwards 11 options to execute_view_async; drops cell_properties and use_compact_json (tm1py quirk)', async () => {
            const asyncSpy = jest.spyOn(cellService, 'execute_view_async')
                .mockResolvedValue(new CaseAndSpaceInsensitiveTuplesDict<any>());
            const extractSpy = jest.spyOn(cellService, 'extractCellset');

            // tm1py's execute_view (CellService.py:2241-2257) DELIBERATELY omits
            // cell_properties and use_compact_json when forwarding to execute_view_async
            // (different from execute_mdx, which forwards both). Strict parity = replicate.
            await cellService.executeView('Cube', 'View', {
                maxWorkers: 8,
                private: true,
                sandboxName: 'sb',
                cellProperties: ['Value'],
                useCompactJson: true,
                top: 100,
                skipZeros: true,
            });

            expect(asyncSpy).toHaveBeenCalledWith('Cube', 'View', expect.objectContaining({
                maxWorkers: 8,
                private: true,
                sandboxName: 'sb',
                top: 100,
                skipZeros: true,
            }));
            const forwarded = asyncSpy.mock.calls[0][2]!;
            expect(forwarded).not.toHaveProperty('cellProperties');
            expect(forwarded).not.toHaveProperty('useCompactJson');
            expect(extractSpy).not.toHaveBeenCalled();
        });
    });

    // ── executeViewRaw ───────────────────────────────────────────────────

    describe('executeViewRaw', () => {
        test('forwards full param surface (excluding includeHierarchies — tm1py parity)', async () => {
            jest.spyOn(cellService, 'createCellsetFromView').mockResolvedValue('cs1');
            const extractSpy = jest.spyOn(cellService, 'extractCellsetRaw')
                .mockResolvedValue({ Axes: [], Cells: [] } as any);

            await cellService.executeViewRaw('Cube', 'View', {
                private: true,
                cellProperties: ['Value'],
                elemProperties: ['Name'],
                memberProperties: ['Name'],
                top: 5,
                skipContexts: true,
                skipZeros: true,
                sandboxName: 'sb',
                useCompactJson: true,
            });

            expect(extractSpy).toHaveBeenCalledWith('cs1', expect.objectContaining({
                cellProperties: ['Value'],
                elemProperties: ['Name'],
                memberProperties: ['Name'],
                top: 5,
                skipContexts: true,
                skipZeros: true,
                useCompactJson: true,
                deleteCellset: true,
            }));
            // tm1py's execute_view_raw does NOT forward include_hierarchies — strict parity.
            expect(extractSpy.mock.calls[0][1]).not.toHaveProperty('includeHierarchies');
        });
    });

    // ── executeMdxCsv ────────────────────────────────────────────────────

    describe('executeMdxCsv', () => {
        test('default skipZeros is true (tm1py CSV default — different from executeMdx)', async () => {
            jest.spyOn(cellService, 'createCellset').mockResolvedValue('cs1');
            const extractCsv = jest.spyOn(cellService, 'extractCellsetCsv').mockResolvedValue('');

            await cellService.executeMdxCsv('SELECT 1 ON 0 FROM [c]');

            expect(extractCsv).toHaveBeenCalledWith('cs1', expect.objectContaining({
                skipZeros: true,
            }));
        });

        test('explicit skipZeros=false is honored', async () => {
            jest.spyOn(cellService, 'createCellset').mockResolvedValue('cs1');
            const extractCsv = jest.spyOn(cellService, 'extractCellsetCsv').mockResolvedValue('');

            await cellService.executeMdxCsv('SELECT 1 ON 0 FROM [c]', { skipZeros: false });

            expect(extractCsv).toHaveBeenCalledWith('cs1', expect.objectContaining({
                skipZeros: false,
            }));
        });

        test('forwards csvDialect/lineSeparator/valueSeparator/mdxHeaders/includeAttributes', async () => {
            jest.spyOn(cellService, 'createCellset').mockResolvedValue('cs1');
            const extractCsv = jest.spyOn(cellService, 'extractCellsetCsv').mockResolvedValue('csv');

            await cellService.executeMdxCsv('SELECT 1 ON 0 FROM [c]', {
                csvDialect: { delimiter: ';', lineterminator: '\n' } as any,
                lineSeparator: '\n',
                valueSeparator: ';',
                includeAttributes: true,
                useCompactJson: true,
                mdxHeaders: true,
                top: 10,
                skip: 1,
            });

            expect(extractCsv).toHaveBeenCalledWith('cs1', expect.objectContaining({
                csvDialect: { delimiter: ';', lineterminator: '\n' },
                lineSeparator: '\n',
                valueSeparator: ';',
                includeAttributes: true,
                useCompactJson: true,
                mdxHeaders: true,
            }));
        });

        test('useIterativeJson routes to extractCellsetCsvIterJson, not extractCellsetCsv', async () => {
            jest.spyOn(cellService, 'createCellset').mockResolvedValue('cs1');
            const iterSpy = jest.spyOn(cellService, 'extractCellsetCsvIterJson').mockResolvedValue('iter');
            const csvSpy = jest.spyOn(cellService, 'extractCellsetCsv').mockResolvedValue('csv');
            jest.spyOn(cellService, '_safeDeleteCellset').mockResolvedValue(undefined);

            const result = await cellService.executeMdxCsv('SELECT 1 ON 0 FROM [c]', {
                useIterativeJson: true, sandboxName: 'sb',
            });

            expect(iterSpy).toHaveBeenCalledWith('cs1', expect.objectContaining({ sandboxName: 'sb' }));
            expect(csvSpy).not.toHaveBeenCalled();
            expect(result).toBe('iter');
        });

        test('useIterativeJson does NOT clean up the cellset (replicates tm1py bug)', async () => {
            // tm1py's extract_cellset_csv_iter_json is not @tidy_cellset-decorated
            // (CellService.py:4385) and leaks the cellset on the iter-json path.
            // Strict parity rule says replicate the bug — assert no cleanup occurs.
            jest.spyOn(cellService, 'createCellset').mockResolvedValue('cs1');
            jest.spyOn(cellService, 'extractCellsetCsvIterJson').mockResolvedValue('iter');
            const deleteSpy = jest.spyOn(cellService, '_safeDeleteCellset').mockResolvedValue(undefined);

            await cellService.executeMdxCsv('SELECT 1 ON 0 FROM [c]', {
                useIterativeJson: true, sandboxName: 'sb',
            });

            expect(deleteSpy).not.toHaveBeenCalled();
        });
    });

    // ── executeViewCsv ───────────────────────────────────────────────────

    describe('executeViewCsv', () => {
        test('routes via createCellsetFromView with private', async () => {
            const createViewSpy = jest.spyOn(cellService, 'createCellsetFromView')
                .mockResolvedValue('cs1');
            jest.spyOn(cellService, 'extractCellsetCsv').mockResolvedValue('csv');

            await cellService.executeViewCsv('Cube', 'View', { private: true, sandboxName: 'sb' });

            expect(createViewSpy).toHaveBeenCalledWith('Cube', 'View', true, 'sb');
        });

        test('default skipZeros is true', async () => {
            jest.spyOn(cellService, 'createCellsetFromView').mockResolvedValue('cs1');
            const extractCsv = jest.spyOn(cellService, 'extractCellsetCsv').mockResolvedValue('');

            await cellService.executeViewCsv('Cube', 'View');

            expect(extractCsv).toHaveBeenCalledWith('cs1', expect.objectContaining({ skipZeros: true }));
        });

        test('useIterativeJson routes to extractCellsetCsvIterJson', async () => {
            jest.spyOn(cellService, 'createCellsetFromView').mockResolvedValue('cs1');
            const iterSpy = jest.spyOn(cellService, 'extractCellsetCsvIterJson').mockResolvedValue('iter');
            const csvSpy = jest.spyOn(cellService, 'extractCellsetCsv').mockResolvedValue('csv');

            const result = await cellService.executeViewCsv('Cube', 'View', { useIterativeJson: true });

            expect(iterSpy).toHaveBeenCalled();
            expect(csvSpy).not.toHaveBeenCalled();
            expect(result).toBe('iter');
        });

        test('useIterativeJson does NOT clean up the cellset (replicates tm1py bug)', async () => {
            // Same parity rule as executeMdxCsv — tm1py's extract_cellset_csv_iter_json
            // is not @tidy_cellset-decorated and leaks the cellset on this path.
            jest.spyOn(cellService, 'createCellsetFromView').mockResolvedValue('cs1');
            jest.spyOn(cellService, 'extractCellsetCsvIterJson').mockResolvedValue('iter');
            const deleteSpy = jest.spyOn(cellService, '_safeDeleteCellset').mockResolvedValue(undefined);

            await cellService.executeViewCsv('Cube', 'View', { useIterativeJson: true, sandboxName: 'sb' });

            expect(deleteSpy).not.toHaveBeenCalled();
        });
    });
});
