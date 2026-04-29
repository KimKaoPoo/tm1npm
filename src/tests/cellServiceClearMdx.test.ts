/**
 * Tests for CellService.clear / clearWithMdx / clearCube (parity with tm1py).
 *
 * These tests cover the issue #69 reimplementation: temporary MDXView + ViewZeroOut
 * unbound TI process. They also include an audit ensuring no fabricated REST endpoint
 * literal remains in the source.
 */

import * as fs from 'fs';
import * as path from 'path';
import { CellService } from '../services/CellService';
import { TM1Exception } from '../exceptions/TM1Exception';

describe('CellService.clear / clearWithMdx (issue #69 parity)', () => {
    function makeCellService(overrides: Record<string, any> = {}) {
        const post = jest.fn().mockResolvedValue({ data: {}, status: 200, statusText: 'OK', headers: {}, config: {} });
        const get = jest.fn().mockResolvedValue({ data: {}, status: 200, statusText: 'OK', headers: {}, config: {} });
        const del = jest.fn().mockResolvedValue({ data: {}, status: 200, statusText: 'OK', headers: {}, config: {} });
        const rest: any = { post, get, delete: del, ...overrides };
        return { rest, cellService: new CellService(rest) };
    }

    test('clearWithMdx posts to /Cubes/Views (create), /ExecuteProcessWithReturn (TI), and deletes view', async () => {
        const { rest, cellService } = makeCellService();
        rest.post = jest.fn()
            .mockResolvedValueOnce({ data: {}, status: 200, statusText: 'OK', headers: {}, config: {} }) // view create
            .mockResolvedValueOnce({                                                                       // process exec
                data: { ProcessExecuteStatusCode: 'CompletedSuccessfully' },
                status: 200, statusText: 'OK', headers: {}, config: {},
            });
        // SandboxService.exists path for missing sandbox is irrelevant when no sandboxName.

        await cellService.clearWithMdx('SalesCube', 'SELECT {[Measure].[Revenue]} ON 0 FROM [SalesCube]');

        expect(rest.post).toHaveBeenCalledTimes(2);
        expect(rest.post.mock.calls[0][0]).toBe("/Cubes('SalesCube')/Views");
        const viewBody = JSON.parse(rest.post.mock.calls[0][1]);
        expect(viewBody.Name).toMatch(/^\}TM1py/);
        expect(viewBody.MDX).toBe('SELECT {[Measure].[Revenue]} ON 0 FROM [SalesCube]');

        expect(rest.post.mock.calls[1][0]).toBe('/ExecuteProcessWithReturn?$expand=*');
        const procBody = JSON.parse(rest.post.mock.calls[1][1]);
        expect(procBody.Process.PrologProcedure).toContain('ServerActiveSandboxSet');
        expect(procBody.Process.EpilogProcedure).toContain("ViewZeroOut('SalesCube',");

        // Cleanup: GET (exists) then DELETE
        expect(rest.delete).toHaveBeenCalled();
    });

    test('clearWithMdx throws TM1Exception with parity message on non-CompletedSuccessfully', async () => {
        const { rest, cellService } = makeCellService();
        rest.post = jest.fn()
            .mockResolvedValueOnce({ data: {}, status: 200, statusText: 'OK', headers: {}, config: {} })
            .mockResolvedValueOnce({
                data: { ProcessExecuteStatusCode: 'CompletedWithMessages' },
                status: 200, statusText: 'OK', headers: {}, config: {},
            });

        const longMdx = 'SELECT {' + 'a'.repeat(150) + '} ON 0 FROM [SalesCube]';
        try {
            await cellService.clearWithMdx('SalesCube', longMdx);
            fail('expected TM1Exception');
        } catch (err) {
            expect(err).toBeInstanceOf(TM1Exception);
            expect((err as Error).message).toMatch(/^Failed to clear cube: 'SalesCube' with mdx: '.*\.\.\.'$/);
        }
    });

    test('clear delegates to clearWithMdx with NON EMPTY column-axis MDX containing all dimensions', async () => {
        const { cellService } = makeCellService();
        jest.spyOn(cellService, 'getDimensionNamesForWriting').mockResolvedValue(['Year', 'Region', 'Product']);
        const clearWithMdxSpy = jest.spyOn(cellService, 'clearWithMdx').mockResolvedValue(undefined);

        await cellService.clear('SalesCube', { region: '{[Region].[Australia]}' });

        expect(clearWithMdxSpy).toHaveBeenCalledTimes(1);
        const [, mdx] = clearWithMdxSpy.mock.calls[0];
        expect(mdx).toContain('SELECT NON EMPTY');
        expect(mdx).toContain('FROM [SalesCube]');
        expect(mdx).toContain('{[Region].[Australia]}');
        expect(mdx).toContain('{TM1FILTERBYLEVEL({TM1SUBSETALL([Year])},0)}');
        expect(mdx).toContain('{TM1FILTERBYLEVEL({TM1SUBSETALL([Product])},0)}');
    });

    test('clear is case-and-space-insensitive when matching expression keys to dimension names', async () => {
        const { cellService } = makeCellService();
        jest.spyOn(cellService, 'getDimensionNamesForWriting').mockResolvedValue(['Sales Region']);
        const clearWithMdxSpy = jest.spyOn(cellService, 'clearWithMdx').mockResolvedValue(undefined);

        await cellService.clear('SalesCube', { salesregion: '{[Sales Region].[USA]}' });

        const [, mdx] = clearWithMdxSpy.mock.calls[0];
        expect(mdx).toContain('{[Sales Region].[USA]}');
    });

    test('clearCube delegates to clear with empty expressions', async () => {
        const { cellService } = makeCellService();
        const clearSpy = jest.spyOn(cellService, 'clear').mockResolvedValue(undefined);

        await cellService.clearCube('SalesCube', 'SB1');

        expect(clearSpy).toHaveBeenCalledWith('SalesCube', {}, 'SB1');
    });

    test('generateEnableSandboxTi returns disable-string when no sandbox provided', async () => {
        const { cellService } = makeCellService();
        const ti = await cellService.generateEnableSandboxTi();
        expect(ti).toBe(`ServerActiveSandboxSet('');SetUseActiveSandboxProperty(0);`);
    });

    test('generateEnableSandboxTi returns enable-string when sandbox exists (no escaping)', async () => {
        const { cellService } = makeCellService();
        jest.spyOn(cellService, 'sandboxExists').mockResolvedValue(true);

        const ti = await cellService.generateEnableSandboxTi('My Sandbox');

        expect(ti).toBe(`ServerActiveSandboxSet('My Sandbox');SetUseActiveSandboxProperty(1);`);
    });

    test('generateEnableSandboxTi throws with exact tm1py message when sandbox missing', async () => {
        const { cellService } = makeCellService();
        jest.spyOn(cellService, 'sandboxExists').mockResolvedValue(false);

        await expect(cellService.generateEnableSandboxTi('NoSuch'))
            .rejects.toThrow(`Sandbox 'NoSuch' does not exist`);
    });

    test('Audit: CellService.ts must not contain any fabricated endpoint literal', () => {
        const src = fs.readFileSync(path.join(__dirname, '..', 'services', 'CellService.ts'), 'utf-8');
        const fabricated = [
            '/tm1.Clear',
            '/ExecuteMDXAsync',
            '/ExecuteMDXCellCount',
            '/ExecuteMDXElementsValue',
            '/tm1.ExecuteAsync',
            '/tm1.UpdateAsync',
        ];
        for (const ep of fabricated) {
            // Match the exact literal in code (allow word boundary so /tm1.Clear* prefixes pass)
            const escaped = ep.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`['"\`]${escaped}(?:['"\`]|\\b)`);
            expect(src).not.toMatch(regex);
        }
    });
});
