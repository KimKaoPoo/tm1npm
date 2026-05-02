/**
 * Unit tests for CellService decorator-equivalent helpers and the OData
 * compact-JSON utilities they depend on. Mirrors tm1py's `@tidy_cellset`,
 * `@manage_transaction_log`, `@manage_changeset`, and `@odata_compact_json`
 * (CellService.py:80-200) and the helpers in tm1py Utils.py:1033-1095.
 */

import {
    CellService,
    withTidyCellset,
    withManagedTransactionLog,
    withManagedChangeset,
    withCompactJson,
} from '../services/CellService';
import { RestService } from '../services/RestService';
import { TM1RestException } from '../exceptions/TM1Exception';
import {
    extractCellPropertiesFromOdataContext,
    mapCellPropertiesToCompactJsonResponse,
    extractCompactJsonCellset,
} from '../utils/Utils';

type CellServiceMock = jest.Mocked<Pick<CellService,
    'deleteCellset' | '_safeDeleteCellset' | 'beginChangeset' | 'endChangeset'
    | 'activateTransactionlog' | 'deactivateTransactionlog'
>>;

function makeCellServiceMock(): CellServiceMock {
    const mock: CellServiceMock = {
        deleteCellset: jest.fn().mockResolvedValue(undefined),
        _safeDeleteCellset: jest.fn(),
        beginChangeset: jest.fn().mockResolvedValue('cs-1'),
        endChangeset: jest.fn().mockResolvedValue(undefined),
        activateTransactionlog: jest.fn().mockResolvedValue(undefined),
        deactivateTransactionlog: jest.fn().mockResolvedValue(undefined),
    };
    // Delegate _safeDeleteCellset to deleteCellset and replicate its 404 swallow,
    // so tests can drive behaviour through the deleteCellset mock.
    mock._safeDeleteCellset.mockImplementation(async (cellsetId: string, sandboxName?: string) => {
        try {
            await mock.deleteCellset(cellsetId, sandboxName);
        } catch (err: any) {
            const status = err?.statusCode ?? err?.status ?? err?.response?.status;
            if (status !== 404) throw err;
        }
    });
    return mock;
}

describe('withTidyCellset', () => {
    let svc: CellServiceMock;

    beforeEach(() => {
        svc = makeCellServiceMock();
    });

    it('returns the inner result and deletes the cellset on success', async () => {
        const result = await withTidyCellset(svc as unknown as CellService, 'cs1', async () => 'ok');

        expect(result).toBe('ok');
        expect(svc.deleteCellset).toHaveBeenCalledTimes(1);
        expect(svc.deleteCellset).toHaveBeenCalledWith('cs1', undefined);
    });

    it('still deletes the cellset when the inner function throws', async () => {
        const inner = jest.fn().mockRejectedValue(new Error('boom'));

        await expect(
            withTidyCellset(svc as unknown as CellService, 'cs1', inner)
        ).rejects.toThrow('boom');
        expect(svc.deleteCellset).toHaveBeenCalledTimes(1);
    });

    it('forwards sandbox_name to deleteCellset', async () => {
        await withTidyCellset(svc as unknown as CellService, 'cs1', async () => null, { sandbox_name: 'sb1' });

        expect(svc.deleteCellset).toHaveBeenCalledWith('cs1', 'sb1');
    });

    it('skips deleteCellset when delete_cellset is false', async () => {
        await withTidyCellset(svc as unknown as CellService, 'cs1', async () => null, { delete_cellset: false });

        expect(svc.deleteCellset).not.toHaveBeenCalled();
    });

    it('defaults delete_cellset to true when option object is empty', async () => {
        await withTidyCellset(svc as unknown as CellService, 'cs1', async () => null, {});

        expect(svc.deleteCellset).toHaveBeenCalledTimes(1);
    });

    it('silently swallows a 404 from deleteCellset (cellset already gone)', async () => {
        svc.deleteCellset.mockRejectedValue(new TM1RestException('Not Found', 404));

        await expect(
            withTidyCellset(svc as unknown as CellService, 'cs1', async () => 'inner-ok')
        ).resolves.toBe('inner-ok');
    });

    it('rethrows non-404 errors from deleteCellset', async () => {
        svc.deleteCellset.mockRejectedValue(new TM1RestException('Server Error', 500));

        await expect(
            withTidyCellset(svc as unknown as CellService, 'cs1', async () => 'inner-ok')
        ).rejects.toThrow('Server Error');
    });

    it('lets a non-404 delete error replace the inner error (Python finally semantics)', async () => {
        const inner = jest.fn().mockRejectedValue(new Error('inner-boom'));
        svc.deleteCellset.mockRejectedValue(new TM1RestException('delete-boom', 500));

        await expect(
            withTidyCellset(svc as unknown as CellService, 'cs1', inner)
        ).rejects.toThrow('delete-boom');
    });

    it('detects 404 via err.statusCode (parent TM1Exception field)', async () => {
        const err = new TM1RestException('gone', undefined, { status: 404 });
        svc.deleteCellset.mockRejectedValue(err);

        await expect(
            withTidyCellset(svc as unknown as CellService, 'cs1', async () => 'r')
        ).resolves.toBe('r');
    });
});

describe('withManagedTransactionLog', () => {
    let svc: CellServiceMock;

    beforeEach(() => {
        svc = makeCellServiceMock();
    });

    it('does not toggle the transaction log when both flags are false', async () => {
        await withManagedTransactionLog(svc as unknown as CellService, 'cube1', async () => null);

        expect(svc.deactivateTransactionlog).not.toHaveBeenCalled();
        expect(svc.activateTransactionlog).not.toHaveBeenCalled();
    });

    it('deactivates before fn when deactivate_transaction_log is true', async () => {
        const calls: string[] = [];
        svc.deactivateTransactionlog.mockImplementation(async () => { calls.push('deactivate'); });
        const inner = jest.fn().mockImplementation(async () => { calls.push('inner'); return 'r'; });

        await withManagedTransactionLog(svc as unknown as CellService, 'cube1', inner, {
            deactivate_transaction_log: true,
        });

        expect(svc.deactivateTransactionlog).toHaveBeenCalledWith('cube1');
        expect(calls).toEqual(['deactivate', 'inner']);
        expect(svc.activateTransactionlog).not.toHaveBeenCalled();
    });

    it('reactivates after fn when reactivate_transaction_log is true', async () => {
        const calls: string[] = [];
        const inner = jest.fn().mockImplementation(async () => { calls.push('inner'); });
        svc.activateTransactionlog.mockImplementation(async () => { calls.push('activate'); });

        await withManagedTransactionLog(svc as unknown as CellService, 'cube1', inner, {
            reactivate_transaction_log: true,
        });

        expect(svc.activateTransactionlog).toHaveBeenCalledWith('cube1');
        expect(calls).toEqual(['inner', 'activate']);
        expect(svc.deactivateTransactionlog).not.toHaveBeenCalled();
    });

    it('reactivates even when the inner function throws', async () => {
        const inner = jest.fn().mockRejectedValue(new Error('inner-boom'));

        await expect(
            withManagedTransactionLog(svc as unknown as CellService, 'cube1', inner, {
                deactivate_transaction_log: true,
                reactivate_transaction_log: true,
            })
        ).rejects.toThrow('inner-boom');
        expect(svc.activateTransactionlog).toHaveBeenCalledTimes(1);
    });

    it('reactivates even when deactivate throws', async () => {
        svc.deactivateTransactionlog.mockRejectedValue(new Error('deactivate-boom'));
        const inner = jest.fn();

        await expect(
            withManagedTransactionLog(svc as unknown as CellService, 'cube1', inner, {
                deactivate_transaction_log: true,
                reactivate_transaction_log: true,
            })
        ).rejects.toThrow('deactivate-boom');
        expect(inner).not.toHaveBeenCalled();
        expect(svc.activateTransactionlog).toHaveBeenCalledTimes(1);
    });
});

describe('withManagedChangeset', () => {
    let svc: CellServiceMock;

    beforeEach(() => {
        svc = makeCellServiceMock();
    });

    it('calls fn with no args and skips begin/end when useChangeset is false', async () => {
        const inner = jest.fn().mockResolvedValue('r');

        const result = await withManagedChangeset(svc as unknown as CellService, inner, false);

        expect(result).toBe('r');
        expect(inner).toHaveBeenCalledTimes(1);
        expect(inner.mock.calls[0]).toHaveLength(0);
        expect(svc.beginChangeset).not.toHaveBeenCalled();
        expect(svc.endChangeset).not.toHaveBeenCalled();
    });

    it('passes the changeset id to fn and ends the changeset on success', async () => {
        svc.beginChangeset.mockResolvedValue('cs-42');
        const inner = jest.fn().mockResolvedValue('r');

        const result = await withManagedChangeset(svc as unknown as CellService, inner, true);

        expect(result).toBe('r');
        expect(inner).toHaveBeenCalledWith('cs-42');
        expect(svc.endChangeset).toHaveBeenCalledWith('cs-42');
    });

    it('still calls endChangeset when fn throws', async () => {
        svc.beginChangeset.mockResolvedValue('cs-9');
        const inner = jest.fn().mockRejectedValue(new Error('boom'));

        await expect(
            withManagedChangeset(svc as unknown as CellService, inner, true)
        ).rejects.toThrow('boom');
        expect(svc.endChangeset).toHaveBeenCalledWith('cs-9');
    });

    it('does not call endChangeset when beginChangeset throws', async () => {
        svc.beginChangeset.mockRejectedValue(new Error('begin-boom'));
        const inner = jest.fn();

        await expect(
            withManagedChangeset(svc as unknown as CellService, inner, true)
        ).rejects.toThrow('begin-boom');
        expect(inner).not.toHaveBeenCalled();
        expect(svc.endChangeset).not.toHaveBeenCalled();
    });
});

describe('withCompactJson', () => {
    let rest: jest.Mocked<Pick<RestService, 'add_compact_json_header' | 'add_http_header'>>;

    beforeEach(() => {
        rest = {
            add_compact_json_header: jest.fn().mockReturnValue('application/json;odata.metadata=minimal'),
            add_http_header: jest.fn(),
        };
    });

    it('passes the inner result through unchanged when useCompactJson is false', async () => {
        const fn = jest.fn().mockResolvedValue({ '@odata.context': 'whatever', value: ['x'] });

        const result = await withCompactJson(rest as unknown as RestService, false, fn, true);

        expect(result).toEqual({ '@odata.context': 'whatever', value: ['x'] });
        expect(rest.add_compact_json_header).not.toHaveBeenCalled();
        expect(rest.add_http_header).not.toHaveBeenCalled();
    });

    it('toggles the Accept header for the request and restores it on success', async () => {
        const fn = jest.fn().mockResolvedValue({
            '@odata.context': '$metadata#Cellsets(Cells(Ordinal,Value))/$entity',
            value: ['cs-id', [[0, 100], [1, 200]]],
        });

        const result = await withCompactJson(rest as unknown as RestService, true, fn, false);

        expect(result).toEqual([100, 200]);
        expect(rest.add_compact_json_header).toHaveBeenCalledTimes(1);
        expect(rest.add_http_header).toHaveBeenCalledWith('Accept', 'application/json;odata.metadata=minimal');
    });

    it('calls the dict extractor when returnAsDict is true', async () => {
        const fn = jest.fn().mockResolvedValue({
            '@odata.context': '$metadata#Cellsets(Cells(Ordinal,Value,RuleDerived))/$entity',
            value: ['cs-id', [[0, 100, false], [1, 200, true]]],
        });

        const result = await withCompactJson(rest as unknown as RestService, true, fn, true);

        expect(result).toEqual({
            Cells: [
                { Ordinal: 0, Value: 100, RuleDerived: false },
                { Ordinal: 1, Value: 200, RuleDerived: true },
            ],
        });
    });

    it('restores the Accept header even when fn throws', async () => {
        const fn = jest.fn().mockRejectedValue(new Error('fn-boom'));

        await expect(
            withCompactJson(rest as unknown as RestService, true, fn, false)
        ).rejects.toThrow('fn-boom');
        expect(rest.add_http_header).toHaveBeenCalledWith('Accept', 'application/json;odata.metadata=minimal');
    });

    it('restores the Accept header even when the extractor throws', async () => {
        const fn = jest.fn().mockResolvedValue({
            '@odata.context': '$metadata#Cellsets(Cells(BadField!!!))/$entity',
            value: ['cs-id', [[1]]],
        });

        await expect(
            withCompactJson(rest as unknown as RestService, true, fn, false)
        ).rejects.toThrow('Could not extract cell properties from odata context');
        expect(rest.add_http_header).toHaveBeenCalledWith('Accept', 'application/json;odata.metadata=minimal');
    });

    it('throws when the response context is not a cellset context', async () => {
        const fn = jest.fn().mockResolvedValue({
            '@odata.context': '$metadata#Other(...)',
            value: ['cs-id', []],
        });

        await expect(
            withCompactJson(rest as unknown as RestService, true, fn, false)
        ).rejects.toThrow('odata_compact_json decorator must only be used on cellsets');
        expect(rest.add_http_header).toHaveBeenCalledWith('Accept', 'application/json;odata.metadata=minimal');
    });

    it('throws when the response is missing @odata.context', async () => {
        const fn = jest.fn().mockResolvedValue({ value: ['cs-id', []] });

        await expect(
            withCompactJson(rest as unknown as RestService, true, fn, false)
        ).rejects.toThrow('odata_compact_json decorator must only be used on cellsets');
    });
});

describe('extractCellPropertiesFromOdataContext', () => {
    it('returns the property list for a valid cellset context', () => {
        expect(
            extractCellPropertiesFromOdataContext('$metadata#Cellsets(Cells(Ordinal,Value))/$entity')
        ).toEqual(['Ordinal', 'Value']);
    });

    it('returns a single-element list for a single-property context', () => {
        expect(
            extractCellPropertiesFromOdataContext('$metadata#Cellsets(Cells(Value))/$entity')
        ).toEqual(['Value']);
    });

    it('throws when the context does not match the expected pattern', () => {
        expect(
            () => extractCellPropertiesFromOdataContext('$metadata#Other')
        ).toThrow('Could not extract cell properties from odata context');
    });
});

describe('mapCellPropertiesToCompactJsonResponse', () => {
    it('maps each row into a property→value object', () => {
        expect(
            mapCellPropertiesToCompactJsonResponse(
                ['Ordinal', 'Value', 'RuleDerived'],
                [[0, 100, false], [1, 200, true]]
            )
        ).toEqual({
            Cells: [
                { Ordinal: 0, Value: 100, RuleDerived: false },
                { Ordinal: 1, Value: 200, RuleDerived: true },
            ],
        });
    });

    it('returns { Cells: [] } when there are no rows', () => {
        expect(
            mapCellPropertiesToCompactJsonResponse(['Ordinal', 'Value'], [])
        ).toEqual({ Cells: [] });
    });

    it('throws when a row has fewer values than properties', () => {
        expect(
            () => mapCellPropertiesToCompactJsonResponse(['Ordinal', 'Value', 'RuleDerived'], [[0, 100]])
        ).toThrow(RangeError);
    });
});

describe('extractCompactJsonCellset', () => {
    const dictContext = '$metadata#Cellsets(Cells(Ordinal,Value,RuleDerived))/$entity';
    const dictResponse = { value: ['cs-id', [[0, 100, false], [1, 200, true]]] };

    it('returns the dict shape when returnAsDict is true', () => {
        expect(extractCompactJsonCellset(dictContext, dictResponse, true)).toEqual({
            Cells: [
                { Ordinal: 0, Value: 100, RuleDerived: false },
                { Ordinal: 1, Value: 200, RuleDerived: true },
            ],
        });
    });

    it('returns a flat list of values for a single-property context', () => {
        const ctx = '$metadata#Cellsets(Cells(Value))/$entity';
        const resp = { value: ['cs-id', [[100], [200], [300]]] };

        expect(extractCompactJsonCellset(ctx, resp, false)).toEqual([100, 200, 300]);
    });

    it('returns a flat list of values for the exact Ordinal,Value shortcut', () => {
        const ctx = '$metadata#Cellsets(Cells(Ordinal,Value))/$entity';
        const resp = { value: ['cs-id', [[0, 100], [1, 200]]] };

        expect(extractCompactJsonCellset(ctx, resp, false)).toEqual([100, 200]);
    });

    it('returns the raw rows when properties are reversed (Value,Ordinal)', () => {
        const ctx = '$metadata#Cellsets(Cells(Value,Ordinal))/$entity';
        const resp = { value: ['cs-id', [[100, 0], [200, 1]]] };

        expect(extractCompactJsonCellset(ctx, resp, false)).toEqual([[100, 0], [200, 1]]);
    });

    it('returns the raw rows for any shape that is not single-prop or Ordinal+Value', () => {
        expect(extractCompactJsonCellset(dictContext, dictResponse, false)).toEqual([
            [0, 100, false],
            [1, 200, true],
        ]);
    });
});
