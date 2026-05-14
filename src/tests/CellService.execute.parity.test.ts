/**
 * Behavioral parity tests for CellService execute methods (issue #65).
 *
 * Verifies that executeMdx, executeMdxRaw, executeView, executeViewRaw,
 * executeMdxCsv, executeViewCsv accept and forward the full tm1py
 * parameter surface to the underlying extract helpers, match tm1py's
 * default values, and reject useBlob combinations with tm1py's exact
 * error messages.
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

        test('maxWorkers > 1 with supported-only options dispatches to executeMdxAsync', async () => {
            const asyncSpy = jest.spyOn(cellService, 'executeMdxAsync')
                .mockResolvedValue(new Map<string, any>([['a', 1]]));
            const extractSpy = jest.spyOn(cellService, 'extractCellset');

            const result = await cellService.executeMdx('SELECT 1 ON 0 FROM [c]', {
                maxWorkers: 8, sandboxName: 'sb',
            });

            expect(asyncSpy).toHaveBeenCalledWith('SELECT 1 ON 0 FROM [c]', { sandbox_name: 'sb' });
            expect(extractSpy).not.toHaveBeenCalled();
            expect(result).toBeInstanceOf(CaseAndSpaceInsensitiveTuplesDict);
        });

        test('maxWorkers > 1 with unsupported options throws (no silent option drop)', async () => {
            // tm1npm's executeMdxAsync currently only accepts {sandbox_name, cubeName};
            // any other option set alongside maxWorkers>1 must fail loud.
            await expect(cellService.executeMdx('SELECT 1 ON 0 FROM [c]', {
                maxWorkers: 8,
                cellProperties: ['Value'],
            })).rejects.toThrow(/executeMdx maxWorkers>1 path does not yet forward/);
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

        test('maxWorkers > 1 with supported-only options dispatches to execute_view_async', async () => {
            const asyncSpy = jest.spyOn(cellService, 'execute_view_async')
                .mockResolvedValue(new Map());
            const extractSpy = jest.spyOn(cellService, 'extractCellset');

            await cellService.executeView('Cube', 'View', {
                maxWorkers: 8,
                private: true,
                sandboxName: 'sb',
            });

            expect(asyncSpy).toHaveBeenCalledWith('Cube', 'View', {
                private: true, sandbox_name: 'sb',
            });
            expect(extractSpy).not.toHaveBeenCalled();
        });

        test('maxWorkers > 1 with unsupported options throws (no silent option drop)', async () => {
            // tm1npm's execute_view_async currently only accepts {private, sandbox_name};
            // any other option set alongside maxWorkers>1 must fail loud.
            await expect(cellService.executeView('Cube', 'View', {
                maxWorkers: 8,
                cellProperties: ['Value'],
            })).rejects.toThrow(/executeView maxWorkers>1 path does not yet forward/);
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

            const result = await cellService.executeMdxCsv('SELECT 1 ON 0 FROM [c]', {
                useIterativeJson: true, sandboxName: 'sb',
            });

            expect(iterSpy).toHaveBeenCalledWith('cs1', expect.objectContaining({ sandboxName: 'sb' }));
            expect(csvSpy).not.toHaveBeenCalled();
            expect(result).toBe('iter');
        });

        describe('useBlob validation gates (tm1py CellService.py:2602-2612)', () => {
            test('include_attributes mutex', async () => {
                await expect(cellService.executeMdxCsv('q', { useBlob: true, includeAttributes: true }))
                    .rejects.toThrow("'include_attributes' must not be used in conjunction with 'use_blob'");
            });

            test('use_iterative_json mutex', async () => {
                await expect(cellService.executeMdxCsv('q', { useBlob: true, useIterativeJson: true }))
                    .rejects.toThrow("'use_iterative_json' must not be used in conjunction with 'use_blob'");
            });

            test('use_compact_json mutex', async () => {
                await expect(cellService.executeMdxCsv('q', { useBlob: true, useCompactJson: true }))
                    .rejects.toThrow("'use_compact_json' must not be used in conjunction with 'use_blob'");
            });

            test('csv_dialect mutex', async () => {
                await expect(cellService.executeMdxCsv('q', { useBlob: true, csvDialect: {} as any }))
                    .rejects.toThrow("'csv_dialect' must not be used in conjunction with 'use_blob'");
            });

            test('line_separator must be \\r\\n', async () => {
                await expect(cellService.executeMdxCsv('q', { useBlob: true, lineSeparator: '\n' }))
                    .rejects.toThrow("'line_separator' must be '\r\n' to leverage 'use_blob' feature");
            });

            test('all gates pass → throws not-yet-ported (documented parity gap)', async () => {
                await expect(cellService.executeMdxCsv('q', { useBlob: true }))
                    .rejects.toThrow('useBlob CSV path not yet ported to tm1npm');
            });
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

        describe('useBlob validation gates (tm1py CellService.py:2709-2719)', () => {
            test('use_iterative_json mutex', async () => {
                await expect(cellService.executeViewCsv('Cube', 'View', { useBlob: true, useIterativeJson: true }))
                    .rejects.toThrow("'use_iterative_json' must not be used in conjunction with 'use_blob'");
            });

            test('use_compact_json mutex', async () => {
                await expect(cellService.executeViewCsv('Cube', 'View', { useBlob: true, useCompactJson: true }))
                    .rejects.toThrow("'use_compact_json' must not be used in conjunction with 'use_blob'");
            });

            test('csv_dialect mutex', async () => {
                await expect(cellService.executeViewCsv('Cube', 'View', { useBlob: true, csvDialect: {} as any }))
                    .rejects.toThrow("'csv_dialect' must not be used in conjunction with 'use_blob'");
            });

            test('line_separator must be \\r\\n', async () => {
                await expect(cellService.executeViewCsv('Cube', 'View', { useBlob: true, lineSeparator: '\n' }))
                    .rejects.toThrow("'line_separator' must be '\r\n' to leverage 'use_blob' feature");
            });

            test('private must be false', async () => {
                await expect(cellService.executeViewCsv('Cube', 'View', { useBlob: true, private: true }))
                    .rejects.toThrow("'private' must be False to leverage 'use_blob' feature");
            });

            test('all gates pass → throws not-yet-ported', async () => {
                await expect(cellService.executeViewCsv('Cube', 'View', { useBlob: true }))
                    .rejects.toThrow('useBlob CSV path not yet ported to tm1npm');
            });
        });
    });
});
