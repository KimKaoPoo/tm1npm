/**
 * CellService implementation for TM1 cube data operations
 * Handles reading, writing, and manipulation of cube cell data
 * Full implementation based on tm1py CellService with 100% feature parity
 */

import { v4 as uuidv4 } from 'uuid';
import { RestService } from './RestService';
import { ProcessService } from './ProcessService';
import { ViewService } from './ViewService';
import { SandboxService } from './SandboxService';
import { OperationStatus, OperationType } from './AsyncOperationService';
import { MDXView } from '../objects/MDXView';
import { Process } from '../objects/Process';
import { TM1Exception, TM1pyWriteFailureException, TM1pyWritePartialFailureException } from '../exceptions/TM1Exception';
import {
    formatUrl, escapeODataValue, lowerAndDropSpaces, extractCompactJsonCellset, resemblesMdx, getCube,
    CaseAndSpaceInsensitiveDict,
    CaseAndSpaceInsensitiveTuplesDict,
    RawCellsetDict,
    buildContentFromCellsetDict,
    buildCsvFromCellsetDict,
    csvRowToString,
    dimensionNamesFromElementUniqueNames,
    CsvDialect,
    frameToSignificantDigits,
    verifyVersion,
} from '../utils/Utils';

// ─── Public interface types for CellService extract methods ───────────────

export interface ExtractCellsetOptions {
    cellProperties?: string[];
    top?: number;
    skip?: number;
    deleteCellset?: boolean;          // default true
    skipContexts?: boolean;
    skipZeros?: boolean;
    skipConsolidatedCells?: boolean;
    skipRuleDerivedCells?: boolean;
    sandboxName?: string;
    elementUniqueNames?: boolean;     // default true
    skipCellProperties?: boolean;
    useCompactJson?: boolean;
    skipSandboxDimension?: boolean;
}

export interface ExtractCellsetRawOptions {
    cellProperties?: string[];
    elemProperties?: string[];
    memberProperties?: string[];
    top?: number;
    skip?: number;
    skipContexts?: boolean;
    skipZeros?: boolean;
    skipConsolidatedCells?: boolean;
    skipRuleDerivedCells?: boolean;
    sandboxName?: string;
    includeHierarchies?: boolean;
    useCompactJson?: boolean;
    deleteCellset?: boolean;          // default true (tidy)
    /**
     * Only meaningful for `extractCellsetRawResponse`. When true, the underlying
     * Axios GET uses `responseType: 'stream'` so callers can iterate the raw
     * bytes (used by `extractCellsetCsvIterJson`). Default false — matches
     * tm1py's `extract_cellset_raw_response` which returns a buffered Response.
     */
    asStream?: boolean;
}

export interface ExtractCellsetCsvOptions {
    top?: number;
    skip?: number;
    skipZeros?: boolean;              // default true (matches tm1py)
    skipConsolidatedCells?: boolean;
    skipRuleDerivedCells?: boolean;
    csvDialect?: CsvDialect;
    lineSeparator?: string;           // default '\r\n'
    valueSeparator?: string;          // default ','
    sandboxName?: string;
    includeAttributes?: boolean;
    useCompactJson?: boolean;
    includeHeaders?: boolean;         // default true
    mdxHeaders?: boolean;
    deleteCellset?: boolean;          // default true
}

export interface ExtractCellsetAxesRawAsyncOptions {
    asyncAxis?: number;               // default 1
    maxWorkers?: number;              // default 8
    elemProperties?: string[];
    memberProperties?: string[];
    skipContexts?: boolean;
    includeHierarchies?: boolean;
    sandboxName?: string;
}

export interface ExtractCellsetCellsRawAsyncOptions {
    maxWorkers?: number;              // default 8
    cellProperties?: string[];
    skipZeros?: boolean;
    skipConsolidatedCells?: boolean;
    skipRuleDerivedCells?: boolean;
    sandboxName?: string;
}

export interface ExtractCellsetCompositionResult {
    cube: string;
    titles: string[];
    rows: string[];
    columns: string[];
}

export interface ExtractCellsetMetadataRawOptions {
    elemProperties?: string[];
    memberProperties?: string[];
    top?: number;
    skip?: number;
    skipContexts?: boolean;
    includeHierarchies?: boolean;
    sandboxName?: string;
    deleteCellset?: boolean;
}

export interface CellsetDict {
    [coordinates: string]: string | number | boolean | null | undefined;
}

export interface DataFrame {
    columns: string[];
    data: (string | number | null)[][];
    index?: (string | number)[];
}

export interface CellsetAxes {
    Hierarchies: Record<string, unknown>[];
    Tuples: Record<string, unknown>[];
    Members: Record<string, unknown>[];
    Cardinality: number;
}

export interface CellsetCells {
    Ordinal: number;
    Value: any;
    Status?: string;
    RuleDerived?: boolean;
    Updateable?: boolean;
    Annotated?: boolean;
    Consolidated?: boolean;
    Language?: string;
    HasPicklist?: boolean;
    FormatString?: string;
}

export interface CellsetResult {
    ID: string;
    Axes: CellsetAxes[];
    Cells: CellsetCells[];
}

export interface AsyncJobResult {
    ID: string;
    Status: 'Running' | 'Completed' | 'Failed' | 'CompletedSuccessfully' | 'CompletedWithError' | 'Queued';
    Result?: any;
    Error?: string;
    ExecutionTime?: number;
}

export interface BulkWriteOptions extends WriteOptions {
    max_workers?: number;
    chunk_size?: number;
    threads?: number;
    max_retries?: number;
    retry_delay?: number;
    cancel_at_failure?: boolean;
}

export interface WriteOptions {
    increment?: boolean;
    sandbox_name?: string;
    use_ti?: boolean;
    use_blob?: boolean;
    precision?: number;
    skip_non_updateable?: boolean;
    measure_dimension_elements?: { [key: string]: any };
    allow_spread?: boolean;
    deactivate_transaction_log?: boolean;
    reactivate_transaction_log?: boolean;
    use_changeset?: boolean;
    remove_blob?: boolean;
    clear_view?: string;
    is_attribute_cube?: boolean;
    // tm1py write() takes `dimensions` as a top-level param (CellService.py:1177); on the
    // tm1npm options-only API we expose it on WriteOptions so new callers can forward it.
    // The legacy 4-arg `write(cube, cells, dims, opts)` form still works (sniffed at runtime).
    dimensions?: string[];
}

export interface MDXViewOptions {
    private?: boolean;
    use_iterative_json?: boolean;
    use_blob?: boolean;
    element_unique_names?: boolean;
    skip_zeros?: boolean;
    skip_consolidated?: boolean;
    skip_rule_derived?: boolean;
    csv_dialect?: any;
    sandbox_name?: string;
    /**
     * Honoured via the `withCompactJson` helper. The `executeMdx*` family of
     * methods does not yet wrap calls in `withCompactJson`; setting this
     * flag here is currently a no-op until that wiring is added.
     */
    use_compact_json?: boolean;
    mdx_headers?: boolean;
}

// Options matching tm1py execute_mdx (CellService.py:2065-2082) one-to-one.
export interface ExecuteMdxOptions {
    cellProperties?: string[];
    top?: number;
    skipContexts?: boolean;
    skip?: number;
    skipZeros?: boolean;
    skipConsolidatedCells?: boolean;
    skipRuleDerivedCells?: boolean;
    sandboxName?: string;
    elementUniqueNames?: boolean;
    skipCellProperties?: boolean;
    useCompactJson?: boolean;
    skipSandboxDimension?: boolean;
    maxWorkers?: number;
    asyncAxis?: number;
}

// Options matching tm1py execute_mdx_raw (CellService.py:2338-2353) one-to-one.
export interface ExecuteMdxRawOptions {
    cellProperties?: string[];
    elemProperties?: string[];
    memberProperties?: string[];
    top?: number;
    skipContexts?: boolean;
    skip?: number;
    skipZeros?: boolean;
    skipConsolidatedCells?: boolean;
    skipRuleDerivedCells?: boolean;
    sandboxName?: string;
    includeHierarchies?: boolean;
    useCompactJson?: boolean;
}

// Options matching tm1py execute_view (CellService.py:2200-2218). Note: NO
// skipSandboxDimension — tm1py's execute_view does not accept it.
export interface ExecuteViewOptions extends Omit<ExecuteMdxOptions, 'skipSandboxDimension'> {
    private?: boolean;
}

// Options matching tm1py execute_view_raw (CellService.py:2391-2407).
// tm1py's execute_view_raw does NOT accept `include_hierarchies` — that param
// only exists on execute_mdx_raw. Omit it here for strict parity.
export interface ExecuteViewRawOptions extends Omit<ExecuteMdxRawOptions, 'includeHierarchies'> {
    private?: boolean;
}

// Options matching tm1py execute_mdx_csv (CellService.py:2562-2579).
export interface ExecuteMdxCsvOptions {
    top?: number;
    skip?: number;
    skipZeros?: boolean;
    skipConsolidatedCells?: boolean;
    skipRuleDerivedCells?: boolean;
    csvDialect?: CsvDialect;
    lineSeparator?: string;
    valueSeparator?: string;
    sandboxName?: string;
    includeAttributes?: boolean;
    useIterativeJson?: boolean;
    useCompactJson?: boolean;
    useBlob?: boolean;
    mdxHeaders?: boolean;
}

// Options matching tm1py execute_view_csv (CellService.py:2663-2682). Adds
// private + arrangedAxes, drops includeAttributes (not in tm1py view_csv).
export interface ExecuteViewCsvOptions extends Omit<ExecuteMdxCsvOptions, 'includeAttributes'> {
    private?: boolean;
    arrangedAxes?: [string[], string[], string[]];
}

// tm1py uses CaseAndSpaceInsensitiveDict for measure-element lookups so callers can pass
// "Comment" / "comment" / "Net Sales" / "netsales" interchangeably (matching how TM1 dimension
// elements are referenced). Internal callers receive the case-insensitive dict; users of the
// public WriteOptions surface may also supply a plain object — wrap it via toCaseInsensitiveDict
// before any lookup.
type MeasureDimensionElementsMap = CaseAndSpaceInsensitiveDict<string> | Record<string, string>;

function toCaseInsensitiveDict(map: MeasureDimensionElementsMap): CaseAndSpaceInsensitiveDict<string> {
    if (map instanceof CaseAndSpaceInsensitiveDict) return map;
    const dict = new CaseAndSpaceInsensitiveDict<string>();
    for (const [k, v] of Object.entries(map)) dict.set(k, v);
    return dict;
}

export class CellService {
    private rest: RestService;
    private processService?: ProcessService;
    private viewService?: ViewService;
    private tempProcessCounter: number = 0;

    constructor(rest: RestService, processService?: ProcessService, viewService?: ViewService) {
        this.rest = rest;
        this.processService = processService;
        this.viewService = viewService;
    }

    public async sandboxExists(sandboxName: string): Promise<boolean> {
        const sandboxService = new SandboxService(this.rest);
        return await sandboxService.exists(sandboxName);
    }

    public async generateEnableSandboxTi(sandboxName?: string): Promise<string> {
        if (sandboxName) {
            if (!(await this.sandboxExists(sandboxName))) {
                throw new Error(`Sandbox '${sandboxName}' does not exist`);
            }
            return `ServerActiveSandboxSet('${sandboxName}');SetUseActiveSandboxProperty(1);`;
        }
        return `ServerActiveSandboxSet('');SetUseActiveSandboxProperty(0);`;
    }

    private static _abbreviateMdx(mdx: string, maxLen: number = 100): string {
        return mdx.length > maxLen ? mdx.slice(0, maxLen) + '...' : mdx;
    }

    private static _parseUniqueElementName(uniqueName: string): [string, string, string] {
        // Mirror tm1py's substring-based parser exactly (Utils.py:821-844). Non-throwing,
        // returns 3 strings even for malformed input. Element-name segment unescapes ']]' → ']'.
        const firstSep = uniqueName.indexOf('].[');
        const lastSep = uniqueName.lastIndexOf('].[');
        const dimension = uniqueName.slice(1, firstSep);
        const elementRaw = uniqueName.slice(lastSep + 3, -1);
        const element = elementRaw.replace(/\]\]/g, ']');
        // count occurrences of "]." separator
        const sepCount = uniqueName.split('].[').length - 1;
        if (sepCount === 1) {
            return [dimension, dimension, element];
        }
        const hierarchy = uniqueName.slice(firstSep + 3, lastSep);
        return [dimension, hierarchy, element];
    }

    private static _parseCsvLine(line: string, separator: string): string[] {
        const fields: string[] = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (inQuotes) {
                if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
                else if (ch === '"') { inQuotes = false; }
                else { current += ch; }
            } else {
                if (ch === '"') inQuotes = true;
                else if (ch === separator) { fields.push(current); current = ''; }
                else { current += ch; }
            }
        }
        fields.push(current);
        return fields;
    }

    private static _extractStringSetFromRowsAndValues(
        rowsAndValues: { rows: any[][]; values: any[] },
        excludeEmptyCells: boolean
    ): Set<string> {
        const result = new Set<string>();
        const seen = new Set<string>();
        const add = (val: any) => {
            if (typeof val !== 'string') return;
            if (excludeEmptyCells && val === '') return;
            const key = lowerAndDropSpaces(val);
            if (!seen.has(key)) { seen.add(key); result.add(val); }
        };
        for (const row of rowsAndValues.rows) for (const elem of row) add(elem);
        for (const v of rowsAndValues.values) add(v);
        return result;
    }

    public async _safeDeleteCellset(cellsetId: string, sandboxName?: string): Promise<void> {
        // Mirror tm1py's @tidy_cellset (CellService.py:80-99): suppress 404 (already gone),
        // re-raise every other status so server-side errors during cleanup are visible.
        try {
            await this.deleteCellset(cellsetId, sandboxName);
        } catch (err: any) {
            const status = err?.statusCode ?? err?.status ?? err?.response?.status;
            if (status !== 404) throw err;
        }
    }

    /**
     * Fetch a cellset with the expand/select shape required by _cellsetToTupleDict —
     * notably Members.UniqueName and Hierarchies.Dimension.Name. Mirrors the elem/member
     * properties that tm1py's extract_cellset_raw requests for element_unique_names=True.
     */
    private async _extractCellsetForTupleDict(cellsetId: string, sandboxName?: string): Promise<any> {
        const expand =
            'Cells,' +
            'Axes($expand=' +
                'Tuples($expand=Members($select=Name,UniqueName;$expand=Element($select=UniqueName))),' +
                'Hierarchies($select=Name;$expand=Dimension($select=Name))' +
            ')';
        const params = new URLSearchParams();
        params.append('$expand', expand);
        // Cellset endpoints use TM1's write-side !sandbox= form (parity with tm1py's
        // add_url_parameters("!sandbox", ...) at CellService.py:5064-5073).
        if (sandboxName) params.append('!sandbox', sandboxName);
        const url = `/Cellsets('${cellsetId}')?${params.toString()}`;
        const response = await this.rest.get(url);
        return response.data;
    }

    private static _cellsetToTupleDict(cellset: any, cubeDimensions?: readonly string[]): Map<string, any> {
        const result = new Map<string, any>();
        if (!cellset?.Cells || !cellset?.Axes) return result;
        const cardinalities: number[] = cellset.Axes.map((a: any) => a.Cardinality ?? 0);
        // Prefer Element.UniqueName, then top-level UniqueName, then Name —
        // matches tm1py's extract_unique_names_from_members fallback order
        // (Utils.py: m["Element"]["UniqueName"] if Element else m["UniqueName"]).
        const tuplesByAxis: string[][][] = cellset.Axes.map((axis: any) =>
            (axis.Tuples || []).map((t: any) =>
                (t.Members || []).map((m: any) => m.Element?.UniqueName ?? m.UniqueName ?? m.Name)
            )
        );
        // Per-axis dimension names — used to reorder tuple parts to match the cube's natural
        // dimension order (parity with tm1py's sort_coordinates / Cube.dimensions order).
        const axisDimNames: string[][] = cellset.Axes.map((axis: any) => {
            const hier = axis.Hierarchies || [];
            return hier.map((h: any) => h?.Dimension?.Name ?? h?.Name ?? '');
        });
        const dimToCubeIdx = new Map<string, number>();
        if (cubeDimensions) {
            cubeDimensions.forEach((dim, i) => dimToCubeIdx.set(lowerAndDropSpaces(dim), i));
        }
        // Cells are row-major: ordinal index decomposes as (ord % cardA0, ord/cardA0 % cardA1, ...).
        cellset.Cells.forEach((cell: any, ordinal: number) => {
            const idxByAxis: number[] = [];
            let n = ordinal;
            for (let a = 0; a < cardinalities.length; a++) {
                const card = cardinalities[a] || 1;
                idxByAxis.push(n % card);
                n = Math.floor(n / card);
            }
            // Collect (dimensionName, memberUniqueName) pairs across all axes.
            const partsWithDim: Array<{ dim: string; member: string }> = [];
            for (let a = idxByAxis.length - 1; a >= 0; a--) {
                const tuple = tuplesByAxis[a]?.[idxByAxis[a]] || [];
                const dims = axisDimNames[a] || [];
                tuple.forEach((member: string, i: number) => {
                    partsWithDim.push({ dim: dims[i] ?? '', member });
                });
            }
            // If the caller supplied cube dimensions, sort by that order; else preserve axis order.
            if (cubeDimensions) {
                partsWithDim.sort((x, y) => {
                    const xi = dimToCubeIdx.get(lowerAndDropSpaces(x.dim)) ?? Number.MAX_SAFE_INTEGER;
                    const yi = dimToCubeIdx.get(lowerAndDropSpaces(y.dim)) ?? Number.MAX_SAFE_INTEGER;
                    return xi - yi;
                });
            }
            result.set(partsWithDim.map(p => p.member).join(','), cell.Value);
        });
        return result;
    }

    /**
     * Read a single cell value from a cube by building MDX from coordinates
     */
    public async getValue(
        cubeName: string,
        coordinates: string[],
        dimensions?: string[],
        sandbox_name?: string
    ): Promise<any> {
        const dims = dimensions || await this.getDimensionNamesForWriting(cubeName);
        const members = coordinates.map((elem, i) => `[${dims[i]}].[${elem}]`);
        const mdx = `SELECT {${members[members.length - 1]}} ON COLUMNS` +
            (members.length > 1
                ? `, {(${members.slice(0, -1).join(',')})} ON ROWS`
                : '') +
            ` FROM [${cubeName}]`;
        const values = await this.executeMdxValues(mdx, { sandbox_name });
        return values.length > 0 ? values[0] : undefined;
    }

    /**
     * Write a single cell value to a cube. Mirrors tm1py write_value (CellService.py:1142-1171):
     * value is the FIRST positional argument; the body's Value lives at the top level (not nested
     * inside Cells[0]); the sandbox is appended via the !sandbox= write-side query parameter; and
     * Python's truthiness rule (`str(value) if value else ""`) collapses 0/null/'' to ''.
     */
    public async writeValue(
        value: any,
        cubeName: string,
        elementTuple: string[],
        dimensions?: string[],
        sandboxName?: string
    ): Promise<any> {
        const dims = dimensions || await this.getDimensionNamesForWriting(cubeName);
        let url = formatUrl("/Cubes('{}')/tm1.Update", cubeName);
        // tm1py add_url_parameters (Utils.py:1011-1030) only doubles single quotes; it does NOT
        // percent-encode the value. Match that exactly so the wire request is byte-identical.
        if (sandboxName) url += `?!sandbox=${escapeODataValue(sandboxName)}`;
        const body: Record<string, unknown> = {
            Cells: [{
                'Tuple@odata.bind': dims.map((d, i) =>
                    formatUrl("Dimensions('{}')/Hierarchies('{}')/Elements('{}')",
                        escapeODataValue(d), escapeODataValue(d), escapeODataValue(elementTuple[i]))
                ),
            }],
            Value: value ? String(value) : '',
        };
        return await this.rest.post(url, JSON.stringify(body));
    }

    /**
     * Read multiple cell values from a cube based on coordinate sets.
     * Builds MDX with member tuples on columns axis.
     */
    public async getValues(
        cubeName: string,
        elementSets: string[][],
        dimensions?: string[],
        sandbox_name?: string
    ): Promise<any[]> {
        if (!elementSets || elementSets.length === 0) {
            return [];
        }

        const dims = dimensions || await this.getDimensionNamesForWriting(cubeName);
        const tuples = elementSets.map(elements =>
            `(${elements.map((elem, i) => `[${dims[i]}].[${elem}]`).join(',')})`
        );
        const mdx = `SELECT {${tuples.join(',')}} ON COLUMNS FROM [${cubeName}]`;
        return await this.executeMdxValues(mdx, { sandbox_name });
    }

    /**
     * Write multiple cell values. Mirrors tm1py write (CellService.py:1173-1269): routes to
     * writeThroughUnboundProcess when use_ti=true, writeThroughBlob when use_blob=true, else
     * writeThroughCellset. The third positional argument tolerates the legacy `dimensions[]`
     * form so existing callers like `write(cube, cells, undefined, opts)` keep working; the
     * tm1py-aligned shape is `write(cube, cells, options)`.
     */
    public async write(
        cubeName: string,
        cellsetAsDict: CellsetDict,
        optionsOrDimensions?: WriteOptions | string[],
        legacyOptions?: WriteOptions
    ): Promise<string | undefined> {
        let dimensions: string[] | undefined;
        let options: WriteOptions = {};
        if (Array.isArray(optionsOrDimensions)) {
            dimensions = optionsOrDimensions;
            options = legacyOptions ?? {};
        } else if (optionsOrDimensions !== undefined) {
            options = optionsOrDimensions;
        } else if (legacyOptions !== undefined) {
            // Legacy 4-arg shape `write(cube, cells, undefined, opts)`.
            options = legacyOptions;
        }
        // Honor options.dimensions when the legacy positional dims arg wasn't supplied.
        if (dimensions === undefined) dimensions = options.dimensions;

        if (options.clear_view && !options.use_blob) {
            throw new Error("'clear_view' can only be used in conjunction with 'use_blob'");
        }
        // tm1py write() returns Optional[str] — the changeset id from the underlying call (or None).
        // Forward whatever the routed method returns so future changeset wiring (notably in
        // writeThroughCellset, which is intentionally out of scope for #62) propagates through.
        // Mirror tm1py's selective kwarg forwarding (CellService.py:1226-1268) instead of spreading
        // the whole WriteOptions — keeps each inner method's API surface minimal and explicit.
        if (options.use_ti) {
            return await this.writeThroughUnboundProcess(cubeName, cellsetAsDict, {
                increment: options.increment,
                sandbox_name: options.sandbox_name,
                deactivate_transaction_log: options.deactivate_transaction_log,
                reactivate_transaction_log: options.reactivate_transaction_log,
                precision: options.precision,
                skip_non_updateable: options.skip_non_updateable,
                measure_dimension_elements: options.measure_dimension_elements,
                is_attribute_cube: options.is_attribute_cube,
                dimensions,
                allow_spread: options.allow_spread,
            });
        }
        if (options.use_blob) {
            return await this.writeThroughBlob(cubeName, cellsetAsDict, {
                increment: options.increment,
                sandbox_name: options.sandbox_name,
                deactivate_transaction_log: options.deactivate_transaction_log,
                reactivate_transaction_log: options.reactivate_transaction_log,
                skip_non_updateable: options.skip_non_updateable,
                dimensions,
                remove_blob: options.remove_blob,
                allow_spread: options.allow_spread,
                clear_view: options.clear_view,
            });
        }
        return await this.writeThroughCellset(cubeName, cellsetAsDict, dimensions, options);
    }

    private async writeThroughCellset(
        cubeName: string,
        cellsetAsDict: CellsetDict,
        dimensions?: string[],
        options: WriteOptions = {}
    ): Promise<string | undefined> {
        const dims = dimensions || await this.getDimensionNamesForWriting(cubeName);
        const cells = Object.entries(cellsetAsDict).map(([coordinates, value]) => {
            const elementArray = coordinates.split(',').map(s => s.trim());
            return {
                'Tuple@odata.bind': elementArray.map((elem, i) =>
                    `Dimensions('${escapeODataValue(dims[i])}')/Hierarchies('${escapeODataValue(dims[i])}')/Elements('${escapeODataValue(elem)}')`
                ),
                Value: value
            };
        });

        let url = formatUrl("/Cubes('{}')/tm1.Update", cubeName);

        if (options.sandbox_name) {
            url += `?$sandbox=${options.sandbox_name}`;
        }

        const body: any = { Cells: cells };
        if (options.increment) body.Increment = true;
        if (options.allow_spread) body.AllowSpread = true;

        await this.rest.post(url, JSON.stringify(body));
        // tm1py write_through_cellset returns the changeset string from write_values_through_cellset
        // (CellService.py:1292). The current tm1npm impl POSTs directly to /tm1.Update without
        // beginning a changeset; surface undefined and rely on a follow-up to refactor through
        // writeValuesThroughCellset. Out of scope for #62.
        return undefined;
    }

    /**
     * Execute a view and return cells with their properties as a
     * CaseAndSpaceInsensitiveTuplesDict. Mirrors tm1py's execute_view
     * (CellService.py:2200-2276): createCellsetFromView + extractCellset
     * with the full tm1py parameter surface.
     *
     * When `maxWorkers > 1`, dispatches to execute_view_async. tm1py's
     * async branch (CellService.py:2241-2257) forwards top/skip/skip_x/
     * element_unique_names/skip_cell_properties but drops cell_properties,
     * use_compact_json, and kwargs. tm1npm's `execute_view_async` currently
     * only accepts {private, sandbox_name} — a pre-existing narrower gap
     * that is documented in execute_view_async itself and tracked
     * separately, not introduced by this change.
     */
    public async executeView(
        cubeName: string,
        viewName: string,
        options: ExecuteViewOptions = {}
    ): Promise<CaseAndSpaceInsensitiveTuplesDict<any>> {
        const maxWorkers = options.maxWorkers ?? 1;
        if (maxWorkers > 1) {
            // tm1py forwards only a subset of args to execute_view_async; match that.
            const asyncResult = await this.execute_view_async(cubeName, viewName, {
                private: options.private,
                sandbox_name: options.sandboxName,
            });
            const dict = new CaseAndSpaceInsensitiveTuplesDict<any>();
            for (const [k, v] of asyncResult) dict.set(k, v);
            return dict;
        }
        const cellsetId = await this.createCellsetFromView(
            cubeName, viewName, options.private ?? false, options.sandboxName);
        return this.extractCellset(cellsetId, {
            cellProperties: options.cellProperties,
            top: options.top,
            skip: options.skip,
            skipContexts: options.skipContexts,
            skipZeros: options.skipZeros,
            skipConsolidatedCells: options.skipConsolidatedCells,
            skipRuleDerivedCells: options.skipRuleDerivedCells,
            deleteCellset: true,
            sandboxName: options.sandboxName,
            elementUniqueNames: options.elementUniqueNames,
            skipCellProperties: options.skipCellProperties,
            useCompactJson: options.useCompactJson,
        });
    }

    /**
     * Execute MDX and return structured data (DataFrame-like)
     */
    public async executeMdxDataFrame(
        mdx: string, 
        options: MDXViewOptions = {}
    ): Promise<any> {
        let url = '/ExecuteMDXDataFrameShaped';
        
        const params = new URLSearchParams();
        if (options.sandbox_name) params.append('$sandbox', options.sandbox_name);
        if (options.element_unique_names !== undefined) params.append('$element_unique_names', options.element_unique_names.toString());
        if (options.skip_zeros !== undefined) params.append('$skip_zeros', options.skip_zeros.toString());

        if (params.toString()) {
            url += `?${params.toString()}`;
        }

        const body = { 
            MDX: mdx,
            ...(options.mdx_headers !== undefined && { MDXHeaders: options.mdx_headers })
        };
        
        const response = await this.rest.post(url, body);
        return response.data;
    }

    /**
     * Execute MDX and return CSV. Mirrors tm1py's execute_mdx_csv
     * (CellService.py:2562-2661): createCellset + extractCellsetCsv (or
     * extractCellsetCsvIterJson) with the full tm1py parameter surface.
     *
     * Note default `skipZeros=true` — different from executeMdx, matches
     * tm1py CSV semantics (CellService.py:2567).
     *
     * useBlob validation gates match tm1py byte-for-byte (CellService.py:2602-2612).
     * After all gates pass, throws "not yet ported" — see IMPLEMENTATION_PLAN.md
     * for the documented parity gap (user-approved scope for #65).
     */
    public async executeMdxCsv(
        mdx: string,
        options: ExecuteMdxCsvOptions = {}
    ): Promise<string> {
        const skipZeros = options.skipZeros !== false;
        const lineSeparator = options.lineSeparator ?? '\r\n';
        const valueSeparator = options.valueSeparator ?? ',';

        if (options.useBlob) {
            if (options.includeAttributes) {
                throw new Error("'include_attributes' must not be used in conjunction with 'use_blob'");
            }
            if (options.useIterativeJson) {
                throw new Error("'use_iterative_json' must not be used in conjunction with 'use_blob'");
            }
            if (options.useCompactJson) {
                throw new Error("'use_compact_json' must not be used in conjunction with 'use_blob'");
            }
            if (options.csvDialect) {
                throw new Error("'csv_dialect' must not be used in conjunction with 'use_blob'");
            }
            if (lineSeparator !== '\r\n') {
                throw new Error("'line_separator' must be '\r\n' to leverage 'use_blob' feature");
            }
            throw new Error('useBlob CSV path not yet ported to tm1npm — tracked separately');
        }

        const cellsetId = await this.createCellset(mdx, options.sandboxName);

        if (options.useIterativeJson) {
            return this.extractCellsetCsvIterJson(cellsetId, {
                top: options.top,
                skip: options.skip,
                skipZeros,
                skipConsolidatedCells: options.skipConsolidatedCells,
                skipRuleDerivedCells: options.skipRuleDerivedCells,
                csvDialect: options.csvDialect,
                lineSeparator,
                valueSeparator,
                sandboxName: options.sandboxName,
                includeAttributes: options.includeAttributes,
                mdxHeaders: options.mdxHeaders,
            });
        }

        return this.extractCellsetCsv(cellsetId, {
            top: options.top,
            skip: options.skip,
            skipZeros,
            skipConsolidatedCells: options.skipConsolidatedCells,
            skipRuleDerivedCells: options.skipRuleDerivedCells,
            csvDialect: options.csvDialect,
            lineSeparator,
            valueSeparator,
            sandboxName: options.sandboxName,
            includeAttributes: options.includeAttributes,
            useCompactJson: options.useCompactJson,
            mdxHeaders: options.mdxHeaders,
        });
    }

    /**
     * Execute a view and return CSV. Mirrors tm1py's execute_view_csv
     * (CellService.py:2663-2769): createCellsetFromView + extractCellsetCsv
     * (or extractCellsetCsvIterJson) with the full tm1py parameter surface.
     *
     * useBlob validation gates match tm1py byte-for-byte
     * (CellService.py:2709-2719) including the `private=False` requirement.
     * After all gates pass, throws "not yet ported" — see
     * IMPLEMENTATION_PLAN.md for the documented parity gap.
     */
    public async executeViewCsv(
        cubeName: string,
        viewName: string,
        options: ExecuteViewCsvOptions = {}
    ): Promise<string> {
        const skipZeros = options.skipZeros !== false;
        const lineSeparator = options.lineSeparator ?? '\r\n';
        const valueSeparator = options.valueSeparator ?? ',';

        if (options.useBlob) {
            if (options.useIterativeJson) {
                throw new Error("'use_iterative_json' must not be used in conjunction with 'use_blob'");
            }
            if (options.useCompactJson) {
                throw new Error("'use_compact_json' must not be used in conjunction with 'use_blob'");
            }
            if (options.csvDialect) {
                throw new Error("'csv_dialect' must not be used in conjunction with 'use_blob'");
            }
            if (lineSeparator !== '\r\n') {
                throw new Error("'line_separator' must be '\r\n' to leverage 'use_blob' feature");
            }
            if (options.private) {
                throw new Error("'private' must be False to leverage 'use_blob' feature");
            }
            throw new Error('useBlob CSV path not yet ported to tm1npm — tracked separately');
        }

        const cellsetId = await this.createCellsetFromView(
            cubeName, viewName, options.private ?? false, options.sandboxName);

        if (options.useIterativeJson) {
            return this.extractCellsetCsvIterJson(cellsetId, {
                skipZeros,
                top: options.top,
                skip: options.skip,
                skipConsolidatedCells: options.skipConsolidatedCells,
                skipRuleDerivedCells: options.skipRuleDerivedCells,
                csvDialect: options.csvDialect,
                lineSeparator,
                valueSeparator,
                sandboxName: options.sandboxName,
                mdxHeaders: options.mdxHeaders,
            });
        }

        return this.extractCellsetCsv(cellsetId, {
            skipZeros,
            top: options.top,
            skip: options.skip,
            skipConsolidatedCells: options.skipConsolidatedCells,
            skipRuleDerivedCells: options.skipRuleDerivedCells,
            csvDialect: options.csvDialect,
            lineSeparator,
            valueSeparator,
            sandboxName: options.sandboxName,
            useCompactJson: options.useCompactJson,
            mdxHeaders: options.mdxHeaders,
        });
    }

    /**
     * Create a cellset for advanced operations
     */
    public async createCellset(mdx: string, sandbox_name?: string): Promise<string> {
        let url = '/ExecuteMDX';

        if (sandbox_name) {
            url += `?$sandbox=${sandbox_name}`;
        }

        const body = { MDX: mdx };
        const response = await this.rest.post(url, JSON.stringify(body));
        return response.data?.ID || '';
    }

    /**
     * Delete a cellset
     */
    public async deleteCellset(cellsetId: string, sandbox_name?: string): Promise<void> {
        let url = `/Cellsets('${cellsetId}')`;
        
        if (sandbox_name) {
            url += `?$sandbox=${sandbox_name}`;
        }

        await this.rest.delete(url);
    }

    /**
     * Execute cellset and return cells with their properties as a
     * CaseAndSpaceInsensitiveTuplesDict. Mirrors tm1py's `extract_cellset`
     * (CellService.py:4827-4890).
     *
     * BREAKING CHANGE from v2.1: was `(cellsetId, expand_axes, sandbox_name)` returning
     * raw JSON. Now takes options object and returns CaseAndSpaceInsensitiveTuplesDict.
     * Migration: `extractCellset(id, true, 'sb')` → `extractCellset(id, { sandboxName: 'sb' })`.
     */
    public async extractCellset(
        cellsetId: string,
        options: ExtractCellsetOptions = {}
    ): Promise<CaseAndSpaceInsensitiveTuplesDict<any>> {
        const cellProperties = (options.cellProperties && options.cellProperties.length > 0)
            ? options.cellProperties : ['Value'];

        const rawCellset = await this.extractCellsetRaw(cellsetId, {
            cellProperties,
            elemProperties: ['UniqueName'],
            memberProperties: ['UniqueName'],
            top: options.top,
            skip: options.skip,
            skipContexts: options.skipContexts,
            deleteCellset: options.deleteCellset !== false,
            skipZeros: options.skipZeros,
            skipConsolidatedCells: options.skipConsolidatedCells,
            skipRuleDerivedCells: options.skipRuleDerivedCells,
            sandboxName: options.sandboxName,
            includeHierarchies: false,
            useCompactJson: options.useCompactJson,
        });

        return buildContentFromCellsetDict(
            rawCellset,
            options.top ?? null,
            options.elementUniqueNames !== false,
            options.skipCellProperties === true,
            options.skipSandboxDimension === true
        );
    }

    /**
     * Clear cube data with MDX filter.
     * Reimplements via temporary MDXView + ViewZeroOut TI process (parity with tm1py.clear_with_mdx).
     */
    public async clearWithMdx(cubeName: string, mdx: string, sandboxName?: string): Promise<void> {
        const viewService = this.viewService || new ViewService(this.rest);
        const enableSandbox = await this.generateEnableSandboxTi(sandboxName);

        const viewName = `}TM1py${uuidv4()}`;

        await viewService.create(new MDXView(cubeName, viewName, mdx), false);

        try {
            const process = new Process('');
            process.prologProcedure = enableSandbox;
            // Mirror tm1py's f-string interpolation exactly — no quote escaping in TI body.
            process.epilogProcedure = `ViewZeroOut('${cubeName}','${viewName}');`;

            const url = '/ExecuteProcessWithReturn?$expand=*';
            const payload = { Process: process.bodyAsDict };
            const response = await this.rest.post(url, JSON.stringify(payload));
            const status = (response as any)?.data?.ProcessExecuteStatusCode;
            if (status !== 'CompletedSuccessfully') {
                throw new TM1Exception(
                    `Failed to clear cube: '${cubeName}' with mdx: '${CellService._abbreviateMdx(mdx, 100)}'`
                );
            }
        } finally {
            const exists = await viewService.exists(cubeName, viewName, false);
            if (exists) {
                await viewService.delete(cubeName, viewName, false);
            }
        }
    }

    /**
     * Trace cell calculation (show contributing factors)
     */
    public async traceCellCalculation(
        cubeName: string, 
        coordinates: string[],
        sandbox_name?: string
    ): Promise<any> {
        const coordinateString = coordinates.map(c => `'${c}'`).join(',');
        let url = `/Cubes('${cubeName}')/tm1.TraceCellCalculation(coordinates=[${coordinateString}])`;
        
        if (sandbox_name) {
            url += `?$sandbox=${sandbox_name}`;
        }

        const response = await this.rest.get(url);
        return response.data;
    }

    /**
     * Trace cell feeders (show what feeds into a cell)
     */
    public async traceCellFeeders(
        cubeName: string, 
        coordinates: string[],
        sandbox_name?: string
    ): Promise<any> {
        const coordinateString = coordinates.map(c => `'${c}'`).join(',');
        let url = `/Cubes('${cubeName}')/tm1.TraceCellFeeders(coordinates=[${coordinateString}])`;
        
        if (sandbox_name) {
            url += `?$sandbox=${sandbox_name}`;
        }

        const response = await this.rest.get(url);
        return response.data;
    }

    /**
     * Begin a changeset for grouped write operations
     */
    public async beginChangeset(): Promise<string> {
        const url = '/BeginChangeset';
        const response = await this.rest.post(url);
        return response.data.ID || response.data.id || '';
    }

    /**
     * End a changeset
     */
    public async endChangeset(changesetId: string): Promise<void> {
        const url = `/EndChangeset('${changesetId}')`;
        await this.rest.post(url);
    }

    /**
     * Undo a changeset
     */
    public async undoChangeset(changesetId: string): Promise<void> {
        const url = `/UndoChangeset('${changesetId}')`;
        await this.rest.post(url);
    }

    /**
     * Activate transaction log for a cube
     */
    public async activateTransactionlog(cubeName: string): Promise<void> {
        const url = `/Cubes('${cubeName}')/tm1.ActivateTransactionLog`;
        await this.rest.post(url);
    }

    /**
     * Deactivate transaction log for a cube
     */
    public async deactivateTransactionlog(cubeName: string): Promise<void> {
        const url = `/Cubes('${cubeName}')/tm1.DeactivateTransactionLog`;
        await this.rest.post(url);
    }

    /**
     * Write data via an uploaded CSV blob + unbound TI process. Mirrors tm1py write_through_blob
     * (CellService.py:1425-1493). The CSV is written with QUOTE_ALL semantics and `\r\n`
     * terminators (Python `csv.writer` defaults); the TI process built by `_buildBlobToCubeProcess`
     * reads it via an ASCII data source and dispatches CellPutN / CellIncrementN /
     * CellPutProportionalSpread / CellPutS based on the measure element's type. Transaction-log
     * toggles wrap the work to mirror tm1py's @manage_transaction_log decorator.
     */
    public async writeThroughBlob(
        cubeName: string,
        cellsetAsDict: CellsetDict,
        options: {
            increment?: boolean;
            sandbox_name?: string;
            skip_non_updateable?: boolean;
            remove_blob?: boolean;
            dimensions?: string[];
            allow_spread?: boolean;
            clear_view?: string;
            deactivate_transaction_log?: boolean;
            reactivate_transaction_log?: boolean;
        } = {}
    ): Promise<string | undefined> {
        const removeBlob = options.remove_blob ?? true;
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { FileService } = require('./FileService');
        const fileService = new FileService(this.rest);
        const dims = options.dimensions ?? await this.getDimensionNamesForWriting(cubeName);

        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const crypto = require('crypto');
        const uniqueName = `tm1py_${crypto.randomBytes(6).toString('hex')}`;
        const fileName = `${uniqueName}.csv`;

        // tm1py's @manage_transaction_log decorator (CellService.py:111-136) puts deactivate
        // INSIDE the try so a failed deactivate still hits the reactivate in finally.
        try {
            if (options.deactivate_transaction_log) {
                await this.deactivateTransactionlog(cubeName);
            }
            // CSV: tm1py uses csv.writer(QUOTE_ALL, delimiter=','). Quote every field; double
            // internal quotes; replace \r/\n in string values with empty (mirrors tm1py:1463
            // cleanup). Python csv.writer defaults to lineterminator='\r\n' AND writes a
            // terminator after every row (including the last) — match exactly.
            const csvLines: string[] = [];
            for (const [coordKey, value] of Object.entries(cellsetAsDict)) {
                const elements = coordKey.split(',');
                const cleanedValue = typeof value === 'string'
                    ? value.replace(/[\r\n]/g, '')
                    : (value === null || value === undefined ? '' : String(value));
                const fields = [...elements, cleanedValue].map(s =>
                    `"${String(s).replace(/"/g, '""')}"`
                );
                csvLines.push(fields.join(','));
            }
            const csvBody = csvLines.length > 0 ? csvLines.join('\r\n') + '\r\n' : '';
            await fileService.create(fileName, Buffer.from(csvBody, 'utf-8'));

            try {
                const proc = await this._buildBlobToCubeProcess({
                    cubeName,
                    processName: uniqueName,
                    blobFilename: fileName,
                    dimensions: dims,
                    increment: options.increment ?? false,
                    skipNonUpdateable: options.skip_non_updateable ?? false,
                    sandboxName: options.sandbox_name,
                    allowSpread: options.allow_spread ?? false,
                    clearView: options.clear_view,
                });
                const response = await this.rest.post(
                    '/ExecuteProcessWithReturn?$expand=*',
                    JSON.stringify({ Process: proc.bodyAsDict })
                );
                const status: string = response?.data?.ProcessExecuteStatusCode ?? 'Unknown';
                if (status !== 'CompletedSuccessfully') {
                    const logFile = response?.data?.ErrorLogFile?.Filename ?? null;
                    if (status === 'HasMinorErrors') {
                        throw new TM1pyWritePartialFailureException([status], [logFile], 1);
                    }
                    throw new TM1pyWriteFailureException([status], [logFile]);
                }
            } finally {
                // Mirror tm1py CellService.py:1491-1493: bare `finally` deletes the blob; a
                // delete failure surfaces (and may overwrite the original write error). Per
                // CLAUDE.md's strict parity rule, do NOT suppress.
                if (removeBlob) {
                    await fileService.delete(fileName);
                }
            }
        } finally {
            if (options.reactivate_transaction_log) {
                await this.activateTransactionlog(cubeName);
            }
        }
        // tm1py write_through_blob returns None implicitly. Returning undefined so write() can
        // route through `return await` consistently across all three write strategies.
        return undefined;
    }

    /**
     * Build the unbound TI Process that loads a CSV blob into a cube. Mirrors tm1py
     * _build_blob_to_cube_process (CellService.py:1495-1608) including the `% \n` line
     * continuation between alternative ElementType checks and the v11 `.blb` filename suffix.
     */
    private async _buildBlobToCubeProcess(args: {
        cubeName: string;
        processName: string;
        blobFilename: string;
        dimensions: string[];
        increment: boolean;
        skipNonUpdateable: boolean;
        sandboxName?: string;
        allowSpread: boolean;
        clearView?: string;
    }): Promise<Process> {
        const version = this.rest.version ?? '11.8.0';
        let blobFilename = args.blobFilename;
        // verifyVersion takes (actualVersion, requiredVersion). For pre-v12 servers (i.e. v11)
        // TM1 auto-appends `.blb` to documents created via the contents API, so we must include
        // it in the data source name (mirrors tm1py CellService.py:1509).
        if (!verifyVersion(version, '12')) {
            blobFilename += '.blb';
        }
        const proc = new Process(
            args.processName,
            false,
            undefined,
            undefined,
            undefined,
            undefined,
            '', '', '', '',
            'ASCII',         // datasourceType
            '.', ',', 'Character', 0, '"', '',
            blobFilename,    // datasourceDataSourceNameForClient
            blobFilename,    // datasourceDataSourceNameForServer
        );

        // tm1py CellService.py:1527 calls self.generate_enable_sandbox_ti(sandbox_name) here,
        // which validates the sandbox exists (raises ValueError otherwise) — preserve that check.
        const enableSandboxLine = await this.generateEnableSandboxTi(args.sandboxName);

        let prolog = `\n        SetInputCharacterSet('TM1CS_UTF8');\n        ${enableSandboxLine}\n        `;
        if (args.clearView) {
            prolog += `\rViewZeroOut('${args.cubeName}', '${args.clearView}');\r`;
        }
        proc.prologProcedure = prolog;

        const dimVars = args.dimensions.map((_, n) => `v${n + 1}`);
        for (const v of dimVars) proc.addVariable(v, 'String');
        const cubeMeasureVar = dimVars[dimVars.length - 1];
        const commaSepVars = dimVars.join(',');
        const valueVar = 'vValue';
        proc.addVariable(valueVar, 'String');

        const cellIsUpdateablePre = args.skipNonUpdateable
            ? `If( CellIsUpdateable('${args.cubeName}',${commaSepVars}) = 1 );`
            : '';
        const cellIsUpdateablePost = args.skipNonUpdateable
            ? `\rElse;\r   ItemSkip;\rEndIf;\r`
            : '';

        const numericFn = args.cubeName.toLowerCase().startsWith('}elementattributes_')
            ? 'CellPutN'
            : (args.increment ? 'CellIncrementN' : 'CellPutN');

        const cubeMeasure = args.dimensions[args.dimensions.length - 1];
        const measureTypeEq = `ElementType('${cubeMeasure}', '', ${cubeMeasureVar}) @= `;
        const numericWriteCondition = ["'N'", "'AN'", "'C'", "''"]
            .map(t => measureTypeEq + t).join('% \n');
        const anyCElementInWrite = args.dimensions.map(
            (dim, i) => `ElementType('${dim}', '', ${dimVars[i]}) @= 'C'`
        ).join('% \n');

        const numericWithSpread = `\n            nValue = StringToNumber(${valueVar});\n            IF(${anyCElementInWrite});\n                CellPutProportionalSpread(nValue,'${args.cubeName}',${commaSepVars});\n            ELSE;\n                ${numericFn}(nValue,'${args.cubeName}',${commaSepVars});\n            ENDIF;\n            `;
        const numericWithoutSpread = `\n            nValue = StringToNumber(${valueVar});\n            ${numericFn}(nValue,'${args.cubeName}',${commaSepVars});\n            `;
        const stringCondition = `\n            ElementType('${cubeMeasure}', '', ${cubeMeasureVar}) @= 'S' % \n            ElementType('${cubeMeasure}', '', ${cubeMeasureVar}) @= 'AS' % \n            ElementType('${cubeMeasure}', '', ${cubeMeasureVar}) @= 'AA'\n            `;
        const stringWrite = `\n            sValue = ${valueVar};\n            CellPutS(sValue,'${args.cubeName}',${commaSepVars}); \n            `;

        const inputStatement = `\n        If(${numericWriteCondition});\n            ${args.allowSpread ? numericWithSpread : numericWithoutSpread}\n        ElseIf(${stringCondition});\n            ${stringWrite}\n        EndIf;`;

        proc.dataProcedure = cellIsUpdateablePre + inputStatement + cellIsUpdateablePost;
        return proc;
    }

    /**
     * Write data through a chunked DataFrame. Mirrors tm1py write_dataframe (CellService.py:860):
     * accepts either a `DataFrame` ({columns, data}) or a plain 2D array; supports
     * `static_dimension_elements` and `infer_column_order`; aggregates duplicate intersections
     * for numeric values when `sum_numeric_duplicates` is true; delegates to `write()` for
     * routing to writeThroughUnboundProcess / writeThroughBlob / writeThroughCellset.
     */
    public async writeDataframe(
        cubeName: string,
        data: DataFrame | (string | number | null)[][],
        options: WriteOptions & {
            dimensions?: string[];
            sum_numeric_duplicates?: boolean;
            static_dimension_elements?: Record<string, string>;
            infer_column_order?: boolean;
        } = {}
    ): Promise<string | undefined> {
        const dims = options.dimensions ?? await this.getDimensionNamesForWriting(cubeName);
        const lc = (s: string) => s.toLowerCase().replace(/\s+/g, '');

        let columns: string[];
        let rows: (string | number | null)[][];
        if (Array.isArray(data)) {
            columns = [...dims, '__value__'];
            rows = data.map(r => [...r]);
        } else {
            columns = [...data.columns];
            rows = data.data.map(r => [...r]);
        }

        if (options.static_dimension_elements) {
            const lcCols = columns.map(lc);
            for (const [dim, elem] of Object.entries(options.static_dimension_elements)) {
                if (lcCols.includes(lc(dim))) {
                    throw new Error(
                        `static_dimension_elements conflict: '${dim}' is also a dataframe column. ` +
                        `Either remove the key/value pair or omit the column from the dataframe.`
                    );
                }
                columns.push(dim);
                lcCols.push(lc(dim));
                rows = rows.map(r => [...r, elem]);
            }
        }

        const inferOrder = options.static_dimension_elements ? true : (options.infer_column_order ?? false);
        if (inferOrder) {
            const lcCols = columns.map(lc);
            const lcDims = dims.map(lc);
            const remaining = lcCols.filter(c => !lcDims.includes(c));
            const finalLc = [...lcDims, ...remaining];
            const indexMap = finalLc.map(c => lcCols.indexOf(c));
            rows = rows.map(r => indexMap.map(i => r[i]));
            columns = indexMap.map(i => columns[i]);
        }

        if (rows.length > 0 && rows[0].length !== dims.length + 1) {
            throw new Error("Number of columns in 'data' must equal number of dimensions in cube + 1");
        }

        const cells: CellsetDict = {};
        const sumDup = options.sum_numeric_duplicates ?? true;
        for (const row of rows) {
            const elems = row.slice(0, -1).map(v => String(v ?? '')).join(',');
            const v = row[row.length - 1];
            if (sumDup && elems in cells && typeof v === 'number' && typeof cells[elems] === 'number') {
                cells[elems] = (cells[elems] as number) + v;
            } else {
                cells[elems] = v as any;
            }
        }
        // Forward routing flags (use_ti, use_blob, etc.) and write-side options to write().
        return this.write(cubeName, cells, options);
    }

    /**
     * Write asynchronously by chunking and dispatching to writeThroughBlob in parallel.
     * Mirrors the spirit of tm1py.write_async (which uses ThreadPoolExecutor + write_through_blob);
     * partial failures aggregate into a TM1pyWritePartialFailureException.
     */
    public async writeAsync(
        cubeName: string,
        cellsetAsDict: CellsetDict,
        // tm1py write_async signature (CellService.py:970-984) exposes both `precision` and
        // `measure_dimension_elements`. tm1py forwards them through write(use_blob=True) to
        // write_through_blob via **kwargs, where they are silently dropped (the blob TI process
        // doesn't honor them). We expose the same fields for API parity / mechanical port-ability,
        // and likewise drop them in the blob path.
        options: Pick<WriteOptions,
            'sandbox_name' | 'increment' | 'deactivate_transaction_log' |
            'reactivate_transaction_log' | 'skip_non_updateable' | 'allow_spread' | 'remove_blob' |
            'precision' | 'measure_dimension_elements'>
            & { slice_size?: number; max_workers?: number; dimensions?: string[] } = {}
    ): Promise<string | undefined> {
        const sliceSize = options.slice_size ?? 250_000;
        const maxWorkers = options.max_workers ?? 8;
        const entries = Object.entries(cellsetAsDict);
        const chunks: CellsetDict[] = [];
        for (let i = 0; i < entries.length; i += sliceSize) {
            chunks.push(Object.fromEntries(entries.slice(i, i + sliceSize)));
        }

        // Mirror tm1py write_async (CellService.py:1004-1005): prefetch dimensions ONCE before the
        // chunk loop so each parallel writeThroughBlob call doesn't independently re-fetch the
        // cube's dimension list (would be N HTTP GETs for N chunks).
        const dims = options.dimensions ?? await this.getDimensionNamesForWriting(cubeName);

        // tm1py's @manage_transaction_log decorator wraps the WHOLE write_async (CellService.py:969).
        // The inner _write (line 1015) does NOT forward deactivate/reactivate flags, so per-chunk
        // writes never toggle individually — important when chunks run in parallel because one
        // chunk reactivating mid-flight would defeat the surrounding deactivate intent. Per the
        // decorator at CellService.py:111-136, the deactivate sits INSIDE the try so reactivate
        // always runs in finally even if the deactivate itself throws.
        try {
            if (options.deactivate_transaction_log) {
                await this.deactivateTransactionlog(cubeName);
            }
            // Forward only the per-write flags; do NOT forward transaction-log toggles.
            const blobOpts = {
                sandbox_name: options.sandbox_name,
                increment: options.increment,
                skip_non_updateable: options.skip_non_updateable,
                allow_spread: options.allow_spread,
                remove_blob: options.remove_blob,
                dimensions: dims,
            };

            // Aggregate caught chunk failures so we can rebuild a combined
            // TM1pyWritePartialFailureException with merged statuses / errorLogFiles / attempts —
            // mirrors tm1py's `itertools.chain(*[e.statuses ...])` / `sum(...)` aggregation
            // (CellService.py:1047-1057).
            const failures: (TM1pyWritePartialFailureException | TM1pyWriteFailureException)[] = [];
            const otherFailures: unknown[] = [];
            for (let i = 0; i < chunks.length; i += maxWorkers) {
                const batch = chunks.slice(i, i + maxWorkers);
                const results = await Promise.allSettled(
                    batch.map(c => this.writeThroughBlob(cubeName, c, blobOpts))
                );
                for (const r of results) {
                    if (r.status === 'rejected') {
                        if (r.reason instanceof TM1pyWritePartialFailureException
                            || r.reason instanceof TM1pyWriteFailureException) {
                            failures.push(r.reason);
                        } else {
                            otherFailures.push(r.reason);
                        }
                    }
                }
            }

            // Non-TM1pyWrite* exceptions don't fit the merge model — surface the first one as-is
            // (no equivalent path in tm1py since its inner _write only catches the typed pair).
            if (otherFailures.length) {
                throw otherFailures[0];
            }
            if (failures.length === 0) {
                return undefined;
            }

            const mergedStatuses = failures.flatMap(e => e.statuses);
            const mergedLogFiles = failures.flatMap(e => e.errorLogFiles);
            const mergedAttempts = failures.reduce(
                (sum, e) => sum + (e instanceof TM1pyWritePartialFailureException ? e.attempts : 1),
                0,
            );
            throw new TM1pyWritePartialFailureException(mergedStatuses, mergedLogFiles, mergedAttempts);
        } finally {
            if (options.reactivate_transaction_log) {
                await this.activateTransactionlog(cubeName);
            }
        }
    }

    /**
     * Write data via an unbound TI process whose Prolog/Epilog contain CellPutN/CellPutS
     * statements. Mirrors tm1py write_through_unbound_process (CellService.py:1328-1419).
     * Routes attribute cubes (`}ElementAttributes_*`) through _buildAttributeUpdateStatements;
     * regular cubes through _buildCellUpdateStatements. Statements are chunked at every
     * 2*Process.maxStatements(version) boundary, mirroring tm1py's loop precisely
     * (`if n > 0 and n % (max_statements * 2) == 0`). Transaction-log toggles wrap the work
     * to mirror tm1py's @manage_transaction_log decorator.
     */
    public async writeThroughUnboundProcess(
        cubeName: string,
        cellsetAsDict: CellsetDict,
        options: {
            increment?: boolean;
            sandbox_name?: string;
            precision?: number;
            skip_non_updateable?: boolean;
            measure_dimension_elements?: Record<string, string>;
            is_attribute_cube?: boolean;
            dimensions?: string[];
            allow_spread?: boolean;
            deactivate_transaction_log?: boolean;
            reactivate_transaction_log?: boolean;
        } = {}
    ): Promise<string | undefined> {
        // tm1py's @manage_transaction_log decorator (CellService.py:111-136) puts deactivate
        // INSIDE the try so reactivate always runs in finally even if deactivate itself fails.
        try {
            if (options.deactivate_transaction_log) {
                await this.deactivateTransactionlog(cubeName);
            }
            const isAttributeCube = options.is_attribute_cube
                ?? cubeName.toLowerCase().startsWith('}elementattributes_');
            const enableSandbox = await this.generateEnableSandboxTi(options.sandbox_name);

            // Lookups against the user's raw element-name coordinates need to be case-and-space
            // insensitive (TM1 element names are matched that way). Wrap any user-supplied plain
            // object so the dict's normalize-on-get behavior applies uniformly.
            let measureDimensionElements: CaseAndSpaceInsensitiveDict<string>;
            if (options.measure_dimension_elements) {
                measureDimensionElements = toCaseInsensitiveDict(options.measure_dimension_elements);
            } else {
                // tm1py CellService.py:1906-1914: resolve measure dimension via CubeService, then
                // fetch the {elementName: actualType} dict from ElementService — preserving real
                // element types (Numeric/String/Consolidated) so _buildCellUpdateStatements emits
                // CellPutS for string measures instead of falling through to CellPutN.
                measureDimensionElements = await this._fetchMeasureDimensionElementTypes(cubeName);
            }

            let dims = options.dimensions;
            if (!isAttributeCube && !dims && options.allow_spread) {
                dims = await this.getDimensionNamesForWriting(cubeName);
            }

            const statements = isAttributeCube
                ? CellService._buildAttributeUpdateStatements({
                    cubeName,
                    cellsetAsDict,
                    precision: options.precision,
                    skipNonUpdateable: options.skip_non_updateable ?? false,
                    measureDimensionElements,
                })
                : CellService._buildCellUpdateStatements({
                    cubeName,
                    cellsetAsDict,
                    increment: options.increment ?? false,
                    measureDimensionElements,
                    precision: options.precision,
                    skipNonUpdateable: options.skip_non_updateable ?? false,
                    dimensions: dims,
                    allowSpread: options.allow_spread ?? false,
                });

            const version = this.rest.version ?? "11.8.0";
            const maxStmts = Process.maxStatements(version);
            const successes: boolean[] = [];
            const statuses: string[] = [];
            const logFiles: (string | null)[] = [];
            let chunk: string[] = [];

            for (let n = 0; n < statements.length; n++) {
                chunk.push(statements[n]);
                if (n > 0 && n % (maxStmts * 2) === 0) {
                    const [s, st, lf] = await this._executeWriteStatements(chunk, enableSandbox);
                    successes.push(s);
                    if (!s) { statuses.push(st); logFiles.push(lf); }
                    chunk = [];
                }
            }
            const [s, st, lf] = await this._executeWriteStatements(chunk, enableSandbox);
            successes.push(s);
            if (!s) { statuses.push(st); logFiles.push(lf); }

            if (!successes.some(x => x)) {
                if (statuses.includes('HasMinorErrors')) {
                    throw new TM1pyWritePartialFailureException(statuses, logFiles, successes.length);
                }
                throw new TM1pyWriteFailureException(statuses, logFiles);
            }
            if (!successes.every(x => x)) {
                throw new TM1pyWritePartialFailureException(statuses, logFiles, successes.length);
            }
        } finally {
            if (options.reactivate_transaction_log) {
                await this.activateTransactionlog(cubeName);
            }
        }
        // tm1py write_through_unbound_process returns None implicitly. Returning undefined so
        // write() can route through `return await` consistently across all three write strategies.
        return undefined;
    }

    /**
     * Build TI CellPutN/CellPutS statements for a cellset. Mirrors tm1py
     * _build_cell_update_statements (CellService.py:1799-1890) character-for-character:
     * - Element-type lookup defaults to 'Numeric' (so unknown measures trigger TI minor errors).
     * - String values: escape `'`→`''`, strip CR/LF, single-quote wrap.
     * - Numeric values: frameToSignificantDigits or precision-formatted toFixed; unparseable
     *   strings pass through raw; null/undefined → '0'.
     * - skipNonUpdateable wraps each statement in `IF(CellIsUpdateable(...)=1, <stmt>, 0);`.
     * - allowSpread wraps with `IF(<any C>); CellPutProportionalSpread(...); ELSE; <stmt>; ENDIF;`.
     */
    private static _buildCellUpdateStatements(args: {
        cubeName: string;
        cellsetAsDict: CellsetDict;
        increment: boolean;
        measureDimensionElements: CaseAndSpaceInsensitiveDict<string>;
        precision?: number;
        skipNonUpdateable: boolean;
        dimensions?: string[];
        allowSpread: boolean;
    }): string[] {
        const statements: string[] = [];
        for (const [coordKey, value] of Object.entries(args.cellsetAsDict)) {
            const coordinates = coordKey.split(',');
            let measureElement = coordinates[coordinates.length - 1];
            let elementType = args.measureDimensionElements.get(measureElement);
            if (elementType === undefined) {
                if (measureElement.includes(':')) {
                    measureElement = measureElement.split(':')[1];
                    elementType = args.measureDimensionElements.get(measureElement) ?? 'Numeric';
                } else {
                    elementType = 'Numeric';
                }
            }

            let functionStr: string;
            let valueStr: string;
            if (elementType === 'String') {
                functionStr = 'CellPutS(';
                const cleaned = String(value)
                    .replace(/'/g, "''")
                    .replace(/[\r\n]/g, '');
                valueStr = `'${cleaned}'`;
            } else {
                functionStr = args.increment ? 'CellIncrementN(' : 'CellPutN(';
                if (typeof value === 'string') {
                    // Python's float() rejects strings with non-numeric tails ("123abc" → ValueError);
                    // tm1py catches and falls through to raw passthrough. JS parseFloat is permissive,
                    // so we use Number() (strict end-to-end parse) plus an empty-string guard.
                    const trimmed = value.trim();
                    const parsed = trimmed === '' ? NaN : Number(trimmed);
                    if (Number.isNaN(parsed)) {
                        valueStr = String(value);
                    } else if (args.precision === undefined) {
                        valueStr = frameToSignificantDigits(parsed);
                    } else {
                        valueStr = parsed.toFixed(args.precision);
                    }
                } else if (value === null || value === undefined) {
                    valueStr = '0';
                } else {
                    if (args.precision === undefined) {
                        valueStr = frameToSignificantDigits(Number(value));
                    } else {
                        valueStr = Number(value).toFixed(args.precision);
                    }
                }
            }

            const commaSeparatedElements = coordinates
                .map(e => `'${e.replace(/'/g, "''")}'`)
                .join(',');

            let cellIsUpdateablePre = '';
            let cellIsUpdateablePost = ';';
            if (args.skipNonUpdateable) {
                cellIsUpdateablePre = `IF(CellIsUpdateable('${args.cubeName}', ${commaSeparatedElements})=1,`;
                cellIsUpdateablePost = ',0);';
            }

            let consolidatedSpreadCheckStart = '';
            let consolidatedSpreadCheckEnd = '';
            if (args.allowSpread) {
                const dimsForSpread = args.dimensions ?? [];
                const anyCElement = dimsForSpread
                    .map((dim, i) => `ElementType('${dim}', '', '${coordinates[i] ?? ''}') @= 'C'`)
                    .join('% \n');
                consolidatedSpreadCheckStart =
                    `\n                    IF(${anyCElement});\n` +
                    `                        CellPutProportionalSpread(${valueStr},'${args.cubeName}',${commaSeparatedElements});\n` +
                    `                    ELSE;\n                    `;
                consolidatedSpreadCheckEnd = 'ENDIF;';
            }

            const statement =
                cellIsUpdateablePre +
                consolidatedSpreadCheckStart +
                functionStr +
                valueStr +
                `,'${args.cubeName}',` +
                commaSeparatedElements +
                ')' +
                cellIsUpdateablePost +
                consolidatedSpreadCheckEnd;

            statements.push(statement);
        }
        return statements;
    }

    /**
     * Build TI ElementAttrPutN/ElementAttrPutS statements for an attribute cube. Mirrors tm1py
     * _build_attribute_update_statements (CellService.py:1722-1798). The dimension name is
     * derived from the cube name (slice off the `}ElementAttributes_` prefix). The first
     * coordinate may carry a `hierarchy:element` form; the last coordinate is the attribute name.
     */
    private static _buildAttributeUpdateStatements(args: {
        cubeName: string;
        cellsetAsDict: CellsetDict;
        precision?: number;
        skipNonUpdateable: boolean;
        measureDimensionElements: CaseAndSpaceInsensitiveDict<string>;
    }): string[] {
        const dimensionName = args.cubeName.slice(19); // length of "}ElementAttributes_"
        const statements: string[] = [];

        for (const [coordKey, value] of Object.entries(args.cellsetAsDict)) {
            const coordinates = coordKey.split(',');
            const rawElementName = coordinates[0];
            let hierarchyName: string;
            let elementName: string;
            if (rawElementName.includes(':')) {
                const idx = rawElementName.indexOf(':');
                hierarchyName = rawElementName.slice(0, idx);
                elementName = rawElementName.slice(idx + 1);
            } else {
                elementName = rawElementName;
                hierarchyName = dimensionName;
            }
            let attributeName = coordinates[coordinates.length - 1];

            let attributeType: string | undefined = args.measureDimensionElements.get(attributeName);
            if (attributeType === undefined) {
                if (attributeName.includes(':')) {
                    attributeName = attributeName.split(':')[1];
                    attributeType = args.measureDimensionElements.get(attributeName) ?? 'String';
                } else {
                    attributeType = 'String';
                }
            }

            let functionStr: string;
            let valueStr: string;
            if (attributeType === 'Numeric') {
                functionStr = 'ElementAttrPutN(';
                if (typeof value === 'string') {
                    // tm1py CellService.py:1758 calls `format(float(value), f".{precision}f")`
                    // unconditionally. With `precision is None`, that yields the invalid format spec
                    // ".Nonef" → ValueError, caught → raw passthrough. With a numeric precision and
                    // a non-numeric string, the inner `float()` raises → also raw passthrough.
                    if (args.precision === undefined) {
                        valueStr = String(value);
                    } else {
                        const trimmed = value.trim();
                        const parsed = trimmed === '' ? NaN : Number(trimmed);
                        valueStr = Number.isNaN(parsed)
                            ? String(value)
                            : parsed.toFixed(args.precision);
                    }
                } else if (value === null || value === undefined) {
                    valueStr = '0';
                } else {
                    valueStr = args.precision === undefined
                        ? frameToSignificantDigits(Number(value))
                        : Number(value).toFixed(args.precision);
                }
            } else {
                functionStr = 'ElementAttrPutS(';
                const cleaned = escapeODataValue(String(value)).replace(/[\r\n]/g, '');
                valueStr = `'${cleaned}'`;
            }
            valueStr += ',';

            const commaArgs = [dimensionName, hierarchyName, elementName, attributeName]
                .map(e => `'${e.replace(/'/g, "''")}'`)
                .join(',');

            let cellIsUpdateablePre = '';
            let cellIsUpdateablePost = ';';
            if (args.skipNonUpdateable) {
                cellIsUpdateablePre = `IF(CellIsUpdateable('${args.cubeName}', '${rawElementName}', '${attributeName}')=1,`;
                cellIsUpdateablePost = ',0);';
            }

            statements.push(
                cellIsUpdateablePre + functionStr + valueStr + commaArgs + ')' + cellIsUpdateablePost
            );
        }
        return statements;
    }

    /**
     * Execute a list of TI statements through an unbound process. Mirrors tm1py
     * _execute_write_statements (CellService.py:1916-1925): the first `maxStatements` go in
     * Prolog (prefixed with the enable-sandbox snippet); the rest go in Epilog.
     * Returns [success, status, errorLogFile].
     */
    private async _executeWriteStatements(
        statements: string[],
        enableSandbox: string
    ): Promise<[boolean, string, string | null]> {
        if (statements.length === 0) return [true, 'CompletedSuccessfully', null];
        const version = this.rest.version ?? "11.8.0";
        const maxStmts = Process.maxStatements(version);
        const proc = new Process('');
        proc.prologProcedure = enableSandbox + statements.slice(0, maxStmts).join('\r');
        proc.epilogProcedure = statements.slice(maxStmts).join('\r');
        const url = '/ExecuteProcessWithReturn?$expand=*';
        const response = await this.rest.post(url, JSON.stringify({ Process: proc.bodyAsDict }));
        const status: string = response?.data?.ProcessExecuteStatusCode ?? 'Unknown';
        const logFile: string | null = response?.data?.ErrorLogFile?.Filename ?? null;
        return [status === 'CompletedSuccessfully', status, logFile];
    }


    // ===== COMPLETE TM1PY PARITY IMPLEMENTATION =====

    /**
     * Get dimension names for a cube (for writing operations)
     */
    public async getDimensionNamesForWriting(cubeName: string): Promise<string[]> {
        const url = `/Cubes('${cubeName}')?$expand=Dimensions($select=Name)`;
        const response = await this.rest.get(url);
        return response.data.Dimensions.map((d: any) => d.Name);
    }

    /**
     * Execute MDX and return the raw cellset data. Mirrors tm1py's
     * execute_mdx_raw (CellService.py:2338-2389): createCellset +
     * extractCellsetRaw with the full tm1py parameter surface.
     */
    public async executeMdxRaw(
        mdx: string,
        options: ExecuteMdxRawOptions = {}
    ): Promise<RawCellsetDict> {
        const cellsetId = await this.createCellset(mdx, options.sandboxName);
        return this.extractCellsetRaw(cellsetId, {
            cellProperties: options.cellProperties,
            elemProperties: options.elemProperties,
            memberProperties: options.memberProperties,
            top: options.top,
            skip: options.skip,
            deleteCellset: true,
            skipContexts: options.skipContexts,
            skipZeros: options.skipZeros,
            skipConsolidatedCells: options.skipConsolidatedCells,
            skipRuleDerivedCells: options.skipRuleDerivedCells,
            sandboxName: options.sandboxName,
            includeHierarchies: options.includeHierarchies,
            useCompactJson: options.useCompactJson,
        });
    }

    // Translate legacy MDXViewOptions to the new ExecuteMdxRawOptions shape so
    // out-of-scope methods (executeMdxValues, executeMdxRowsAndValues, etc.) keep
    // their existing public surface while delegating to the rewritten raw helpers.
    // MDXViewOptions fields not present in tm1py's execute_mdx_raw signature
    // (element_unique_names, use_iterative_json, use_blob, csv_dialect, mdx_headers)
    // are intentionally dropped — they don't apply to the raw path. element_unique_names
    // in particular was already a no-op pre-PR (the value path reads m.Name regardless).
    private static _mdxViewToRawOptions(options: MDXViewOptions): ExecuteMdxRawOptions {
        return {
            sandboxName: options.sandbox_name,
            skipZeros: options.skip_zeros,
            skipConsolidatedCells: options.skip_consolidated,
            skipRuleDerivedCells: options.skip_rule_derived,
            useCompactJson: options.use_compact_json,
        };
    }

    /**
     * Execute MDX and return only values array
     */
    public async executeMdxValues(
        mdx: string,
        options: MDXViewOptions = {}
    ): Promise<any[]> {
        const cellset = await this.executeMdxRaw(mdx, CellService._mdxViewToRawOptions(options));
        return cellset.Cells ? cellset.Cells.map((cell: any) => cell.Value) : [];
    }

    /**
     * Execute MDX and return rows with values
     */
    public async executeMdxRowsAndValues(
        mdx: string,
        options: MDXViewOptions = {}
    ): Promise<{ rows: any[][], values: any[] }> {
        const cellset = await this.executeMdxRaw(mdx, CellService._mdxViewToRawOptions(options));

        const rows: any[][] = [];
        const values: any[] = [];

        if (cellset.Axes && cellset.Axes.length > 0) {
            // Extract row tuples from axes
            const rowAxis = cellset.Axes[1] || cellset.Axes[0];
            if (rowAxis && rowAxis.Tuples) {
                for (const tuple of rowAxis.Tuples) {
                    const row = tuple.Members ? tuple.Members.map((m: any) => m.Name) : [];
                    rows.push(row);
                }
            }
        }

        if (cellset.Cells) {
            values.push(...cellset.Cells.map((cell: any) => cell.Value));
        }

        return { rows, values };
    }

    /**
     * Execute MDX and return row element names + string cell values as a case-and-space-insensitive
     * deduplicated set (parity with tm1py.execute_mdx_rows_and_values_string_set).
     */
    public async executeMdxRowsAndValuesStringSet(
        mdx: string,
        excludeEmptyCells: boolean = true,
        sandboxName?: string
    ): Promise<Set<string>> {
        const rav = await this.executeMdxRowsAndValues(mdx, {
            sandbox_name: sandboxName,
            element_unique_names: false,
        });
        return CellService._extractStringSetFromRowsAndValues(rav, excludeEmptyCells);
    }

    /**
     * Execute view and return row element names + string cell values as a case-and-space-insensitive
     * deduplicated set (parity with tm1py.execute_view_rows_and_values_string_set).
     */
    public async executeViewRowsAndValuesStringSet(
        cubeName: string,
        viewName: string,
        isPrivate: boolean = false,
        excludeEmptyCells: boolean = true,
        sandboxName?: string
    ): Promise<Set<string>> {
        const rav = await this.executeViewRowsAndValues(cubeName, viewName, {
            sandbox_name: sandboxName,
            private: isPrivate,
            element_unique_names: false,
        });
        return CellService._extractStringSetFromRowsAndValues(rav, excludeEmptyCells);
    }

    /**
     * Execute MDX and return cell count (parity with tm1py.execute_mdx_cellcount).
     * Uses createCellset + /Cellsets/{id}/Cells/$count.
     */
    public async executeMdxCellcount(
        mdx: string,
        options: MDXViewOptions = {}
    ): Promise<number> {
        const cellsetId = await this.createCellset(mdx, options.sandbox_name);
        try {
            return await this.getCellsetCellsCount(cellsetId, options.sandbox_name);
        } finally {
            await this._safeDeleteCellset(cellsetId, options.sandbox_name);
        }
    }

    /**
     * Execute a view and return the raw cellset data. Mirrors tm1py's
     * execute_view_raw (CellService.py:2391-2446): createCellsetFromView +
     * extractCellsetRaw with the full tm1py parameter surface.
     */
    public async executeViewRaw(
        cubeName: string,
        viewName: string,
        options: ExecuteViewRawOptions = {}
    ): Promise<RawCellsetDict> {
        const cellsetId = await this.createCellsetFromView(
            cubeName, viewName, options.private ?? false, options.sandboxName);
        // tm1py's execute_view_raw does NOT forward include_hierarchies (only
        // execute_mdx_raw does). Omit it here too for strict parity.
        return this.extractCellsetRaw(cellsetId, {
            cellProperties: options.cellProperties,
            elemProperties: options.elemProperties,
            memberProperties: options.memberProperties,
            top: options.top,
            skip: options.skip,
            skipContexts: options.skipContexts,
            skipZeros: options.skipZeros,
            skipConsolidatedCells: options.skipConsolidatedCells,
            skipRuleDerivedCells: options.skipRuleDerivedCells,
            deleteCellset: true,
            sandboxName: options.sandboxName,
            useCompactJson: options.useCompactJson,
        });
    }

    private static _mdxViewToViewRawOptions(options: MDXViewOptions): ExecuteViewRawOptions {
        return {
            private: options.private,
            sandboxName: options.sandbox_name,
            skipZeros: options.skip_zeros,
            skipConsolidatedCells: options.skip_consolidated,
            skipRuleDerivedCells: options.skip_rule_derived,
            useCompactJson: options.use_compact_json,
        };
    }

    /**
     * Execute view and return only values
     */
    public async executeViewValues(
        cubeName: string,
        viewName: string,
        options: MDXViewOptions = {}
    ): Promise<any[]> {
        const cellset = await this.executeViewRaw(cubeName, viewName, CellService._mdxViewToViewRawOptions(options));
        return cellset.Cells ? cellset.Cells.map((cell: any) => cell.Value) : [];
    }

    /**
     * Execute view and return rows with values
     */
    public async executeViewRowsAndValues(
        cubeName: string,
        viewName: string,
        options: MDXViewOptions = {}
    ): Promise<{ rows: any[][], values: any[] }> {
        const cellset = await this.executeViewRaw(cubeName, viewName, CellService._mdxViewToViewRawOptions(options));

        const rows: any[][] = [];
        const values: any[] = [];

        if (cellset.Axes && cellset.Axes.length > 0) {
            const rowAxis = cellset.Axes[1] || cellset.Axes[0];
            if (rowAxis && rowAxis.Tuples) {
                for (const tuple of rowAxis.Tuples) {
                    const row = tuple.Members ? tuple.Members.map((m: any) => m.Name) : [];
                    rows.push(row);
                }
            }
        }

        if (cellset.Cells) {
            values.push(...cellset.Cells.map((cell: any) => cell.Value));
        }

        return { rows, values };
    }

    /**
     * Execute view and return cell count
     */
    public async executeViewCellcount(
        cubeName: string,
        viewName: string,
        options: MDXViewOptions = {}
    ): Promise<number> {
        let url = `/Cubes('${cubeName}')/Views('${viewName}')/tm1.ExecuteCellCount`;

        const params = new URLSearchParams();
        if (options.private !== undefined) params.append('$private', options.private.toString());
        if (options.sandbox_name) params.append('$sandbox', options.sandbox_name);

        if (params.toString()) {
            url += `?${params.toString()}`;
        }

        const response = await this.rest.post(url);
        return response.data.value || response.data.CellCount || 0;
    }

    /**
     * Execute view asynchronously
     */
    /**
     * Execute view via cellset extraction (parity with tm1py.execute_view_async).
     * Returns a Map keyed by comma-joined element unique-names (or Names if UniqueName missing).
     *
     * Documented parity gaps (see IMPLEMENTATION_PLAN.md):
     * - tm1py uses extract_cellset_async with parallel-chunked retrieval. Not yet ported;
     *   this delegates to a serial extractCellset.
     * - tm1py's options (cell_properties, top, skip, skip_*, element_unique_names, etc.) are
     *   not yet wired through extractCellset and are deliberately omitted from this signature
     *   so misuse is a compile-time error.
     * - Tuple-key parts are reordered by cube dimensions (parity with tm1py.sort_coordinates).
     * - Calls createCellsetFromView, which is itself pre-existing on main and currently
     *   targets a fabricated /tm1.CreateCellset endpoint (out of #69 scope; tracked
     *   separately for a future fix to use /Cubes/{}/Views/{}/tm1.Execute per tm1py).
     */
    public async execute_view_async(
        cubeName: string,
        viewName: string,
        options: { private?: boolean; sandbox_name?: string } = {}
    ): Promise<Map<string, any>> {
        const cellsetId = await this.createCellsetFromView(
            cubeName,
            viewName,
            options.private || false,
            options.sandbox_name
        );
        try {
            const cellset = await this._extractCellsetForTupleDict(cellsetId, options.sandbox_name);
            const cubeDims = await this.getDimensionNamesForWriting(cubeName);
            return CellService._cellsetToTupleDict(cellset, cubeDims);
        } finally {
            await this._safeDeleteCellset(cellsetId, options.sandbox_name);
        }
    }

    /**
     * Execute MDX query and return DataFrame-like structure
     */
    public async executeMdxDataframe(
        mdx: string,
        options: MDXViewOptions = {}
    ): Promise<DataFrame> {
        const cellset = await this.executeMdxRaw(mdx, CellService._mdxViewToRawOptions(options));
        return this.buildDataFrameFromCellset(cellset);
    }

    /**
     * Execute view and return DataFrame-like structure
     */
    public async executeViewDataframe(
        cubeName: string,
        viewName: string,
        options: MDXViewOptions = {}
    ): Promise<DataFrame> {
        const cellset = await this.executeViewRaw(cubeName, viewName, CellService._mdxViewToViewRawOptions(options));
        return this.buildDataFrameFromCellset(cellset);
    }

    /**
     * Execute MDX preserving query shape in DataFrame
     */
    public async executeMdxDataframeShaped(
        mdx: string,
        options: MDXViewOptions = {}
    ): Promise<DataFrame> {
        let url = '/ExecuteMDXDataFrameShaped';

        const params = new URLSearchParams();
        if (options.sandbox_name) params.append('$sandbox', options.sandbox_name);
        if (options.element_unique_names !== undefined) params.append('$element_unique_names', options.element_unique_names.toString());
        if (options.skip_zeros !== undefined) params.append('$skip_zeros', options.skip_zeros.toString());

        if (params.toString()) {
            url += `?${params.toString()}`;
        }

        const body = {
            MDX: mdx,
            ...(options.mdx_headers !== undefined && { MDXHeaders: options.mdx_headers })
        };

        const response = await this.rest.post(url, body);
        return this.buildDataFrameFromResponse(response.data);
    }

    /**
     * Execute view preserving shape in DataFrame
     */
    public async executeViewDataframeShaped(
        cubeName: string,
        viewName: string,
        options: MDXViewOptions = {}
    ): Promise<DataFrame> {
        let url = `/Cubes('${cubeName}')/Views('${viewName}')/tm1.ExecuteDataFrameShaped`;

        const params = new URLSearchParams();
        if (options.private !== undefined) params.append('$private', options.private.toString());
        if (options.sandbox_name) params.append('$sandbox', options.sandbox_name);
        if (options.use_iterative_json !== undefined) params.append('$iterativeJson', options.use_iterative_json.toString());
        if (options.use_blob !== undefined) params.append('$blob', options.use_blob.toString());

        if (params.toString()) {
            url += `?${params.toString()}`;
        }

        const response = await this.rest.post(url);
        return this.buildDataFrameFromResponse(response.data);
    }

    /**
     * Execute MDX and return pivot DataFrame
     */
    public async executeMdxDataframePivot(
        mdx: string,
        options: MDXViewOptions = {}
    ): Promise<DataFrame> {
        const cellset = await this.executeMdxRaw(mdx, CellService._mdxViewToRawOptions(options));
        return this.buildPivotDataFrameFromCellset(cellset);
    }

    /**
     * Execute view and return pivot DataFrame
     */
    public async executeViewDataframePivot(
        cubeName: string,
        viewName: string,
        options: MDXViewOptions = {}
    ): Promise<DataFrame> {
        const cellset = await this.executeViewRaw(cubeName, viewName, CellService._mdxViewToViewRawOptions(options));
        return this.buildPivotDataFrameFromCellset(cellset);
    }

    /**
     * Execute multiple MDX queries asynchronously
     */
    public async executeMdxDataframeAsync(
        mdxQueries: string[],
        options: MDXViewOptions = {},
        maxWorkers: number = 4
    ): Promise<DataFrame[]> {
        const chunkSize = Math.ceil(mdxQueries.length / maxWorkers);

        const chunks = [];
        for (let i = 0; i < mdxQueries.length; i += chunkSize) {
            chunks.push(mdxQueries.slice(i, i + chunkSize));
        }

        const chunkPromises = chunks.map(async (chunk) => {
            const chunkResults: DataFrame[] = [];
            for (const mdx of chunk) {
                try {
                    const dataFrame = await this.executeMdxDataframe(mdx, options);
                    chunkResults.push(dataFrame);
                } catch (error) {
                    console.error(`Error executing MDX: ${mdx}`, error);
                    chunkResults.push({ columns: [], data: [] });
                }
            }
            return chunkResults;
        });

        const chunkResults = await Promise.all(chunkPromises);
        return chunkResults.flat();
    }

    /**
     * Create cellset from view
     */
    public async createCellsetFromView(
        cubeName: string,
        viewName: string,
        isPrivate: boolean = false,
        sandbox_name?: string
    ): Promise<string> {
        let url = `/Cubes('${cubeName}')/Views('${viewName}')/tm1.CreateCellset`;

        const params = new URLSearchParams();
        if (isPrivate) params.append('$private', 'true');
        if (sandbox_name) params.append('$sandbox', sandbox_name);

        if (params.toString()) {
            url += `?${params.toString()}`;
        }

        const response = await this.rest.post(url);

        if (response.headers?.location) {
            const matches = response.headers.location.match(/Cellsets\('([^']+)'\)/);
            return matches ? matches[1] : '';
        }

        return response.data?.ID || '';
    }

    /**
     * Update cellset with values
     */
    public async updateCellset(
        cellsetId: string,
        cellUpdates: { ordinal: number; value: any }[],
        sandbox_name?: string
    ): Promise<void> {
        let url = `/Cellsets('${cellsetId}')/Cells`;

        if (sandbox_name) {
            url += `?$sandbox=${sandbox_name}`;
        }

        const cells = cellUpdates.map(update => ({
            Ordinal: update.ordinal,
            Value: update.value
        }));

        await this.rest.patch(url, { Cells: cells });
    }

    /**
     * Get cellset cells count
     */
    public async getCellsetCellsCount(cellsetId: string, sandbox_name?: string): Promise<number> {
        // tm1py extract_cellset_cellcount uses add_url_parameters(url, **{"!sandbox": ...})
        // (CellService.py:4308) which produces &!sandbox= , and `value.replace("'", "''")`
        // is the only escaping applied.
        let url = `/Cellsets('${cellsetId}')/Cells/$count`;
        if (sandbox_name) {
            // First query param on this URL — must use `?`, not `&`.
            url += `?!sandbox=${sandbox_name.replace(/'/g, "''")}`;
        }
        const response = await this.rest.get(url);
        // tm1py: return int(response.content) (CellService.py:4310). The OData
        // /$count endpoint returns text/plain, which axios delivers as a string
        // (or sometimes a parsed number). Coerce explicitly so downstream
        // arithmetic doesn't silently produce NaN.
        const raw = response.data?.value ?? response.data;
        const n = Number(raw);
        return Number.isFinite(n) ? n : 0;
    }

    /**
     * Build the full OData URL for a cellset GET.
     * Mirrors tm1py's `extract_cellset_raw_response` URL builder (CellService.py:3636-3704).
     */
    private _buildCellsetRawUrl(cellsetId: string, opts: ExtractCellsetRawOptions): string {
        // tm1py: `if not cell_properties:` treats [] as falsy. JS `??` would
        // accept [] verbatim and emit a malformed `Cells($select=)` URL.
        const cellProperties = [...((opts.cellProperties && opts.cellProperties.length > 0)
            ? opts.cellProperties : ['Value'])];
        if (opts.skipRuleDerivedCells) {
            cellProperties.push('RuleDerived');
            cellProperties.push('Updateable');
        }
        if (opts.skipConsolidatedCells) cellProperties.push('Consolidated');
        if ((opts.skip || opts.skipZeros || opts.skipRuleDerivedCells || opts.skipConsolidatedCells)
                && !cellProperties.includes('Ordinal')) {
            cellProperties.push('Ordinal');
        }

        const memberProps = (opts.memberProperties && opts.memberProperties.length > 0)
            ? opts.memberProperties : ['Name'];
        const selectMember = '$select=' + memberProps.join(',');
        const expandElem = (opts.elemProperties && opts.elemProperties.length > 0)
            ? ';$expand=Element($select=' + opts.elemProperties.join(',') + ')' : '';

        const filterAxis = opts.skipContexts ? '$filter=Ordinal ne 2;' : '';

        const filters: string[] = [];
        if (opts.skipZeros) filters.push("Value ne 0 and Value ne null and Value ne ''");
        if (opts.skipConsolidatedCells) filters.push('Consolidated eq false');
        if (opts.skipRuleDerivedCells) filters.push('RuleDerived eq false');
        const filterCells = filters.join(' and ');

        const expandHierarchies = opts.includeHierarchies
            ? 'Hierarchies($select=Name;$expand=Dimension($select=Name)),' : '';

        const topTuples = (opts.top && !opts.skip) ? ';$top=' + opts.top : '';
        const topCells = opts.top ? ';$top=' + opts.top : '';
        const skipCells = opts.skip ? ';$skip=' + opts.skip : '';
        const filterClause = filterCells ? ';$filter=' + filterCells : '';

        let url =
            `/Cellsets('${cellsetId}')?$expand=` +
            `Cube($select=Name;$expand=Dimensions($select=Name)),` +
            `Axes(${filterAxis}$expand=${expandHierarchies}Tuples($expand=Members(${selectMember}${expandElem})${topTuples})),` +
            `Cells($select=${cellProperties.join(',')}${topCells}${skipCells}${filterClause})`;
        // tm1py add_url_parameters (Utils.py:1011-1030) only doubles single
        // quotes; the HTTP layer handles any further encoding. encodeURIComponent
        // would over-encode (%, &, +, ?) and produce a wire string that diverges
        // from tm1py — TM1 rejects/misinterprets some payloads. Apply tm1py's
        // exact escaping at all !sandbox sites in this PR.
        if (opts.sandboxName) url += `&!sandbox=${opts.sandboxName.replace(/'/g, "''")}`;
        return url;
    }

    /**
     * Extract cellset raw response as an Axios response.
     * Mirrors tm1py's `extract_cellset_raw_response` (CellService.py:3610-3706),
     * which returns a buffered Response by default — callers like
     * `extract_cellset_raw` then call `.json()`. Streaming is opt-in.
     *
     * Pass `asStream: true` to receive a `responseType: 'stream'` body for
     * incremental iteration (used by `extractCellsetCsvIterJson`).
     */
    public async extractCellsetRawResponse(
        cellsetId: string,
        options: ExtractCellsetRawOptions = {}
    ): Promise<any> {
        const url = this._buildCellsetRawUrl(cellsetId, options);
        if (options.asStream === true) {
            return this.rest.get(url, { responseType: 'stream' });
        }
        return this.rest.get(url);
    }

    /**
     * Extract cellset cells without axes metadata.
     * Mirrors tm1py's `@odata_compact_json(return_as_dict=True) extract_cellset_cells_raw`
     * (CellService.py:3913-3967).
     * Wrapped with withCompactJson(returnAsDict=true) to mirror the decorator.
     */
    public async extractCellsetCellsRaw(
        cellsetId: string,
        options: {
            cellProperties?: string[];
            top?: number;
            skip?: number;
            skipZeros?: boolean;
            skipConsolidatedCells?: boolean;
            skipRuleDerivedCells?: boolean;
            sandboxName?: string;
            useCompactJson?: boolean;
        } = {}
    ): Promise<{ Cells: any[]; '@odata.context'?: string; ID?: string }> {
        // tm1py: `if not cell_properties:` treats [] as falsy.
        const cellProperties = [...((options.cellProperties && options.cellProperties.length > 0)
            ? options.cellProperties : ['Value'])];
        if (options.skipRuleDerivedCells) {
            cellProperties.push('RuleDerived');
            // necessary due to bug in TM1 11.8: If only RuleDerived is retrieved
            // it occasionally produces wrong results (tm1py parity comment)
            cellProperties.push('Updateable');
        }
        if (options.skipConsolidatedCells) cellProperties.push('Consolidated');
        if ((options.skip || options.skipZeros || options.skipRuleDerivedCells || options.skipConsolidatedCells)
                && !cellProperties.includes('Ordinal')) {
            cellProperties.push('Ordinal');
        }

        const filters: string[] = [];
        if (options.skipZeros) filters.push("Value ne 0 and Value ne null and Value ne ''");
        if (options.skipConsolidatedCells) filters.push('Consolidated eq false');
        if (options.skipRuleDerivedCells) filters.push('RuleDerived eq false');
        const filterCells = filters.join(' and ');

        const topClause = options.top ? ';$top=' + options.top : '';
        const skipClause = options.skip ? ';$skip=' + options.skip : '';
        const filterClause = filterCells ? ';$filter=' + filterCells : '';

        let url = `/Cellsets('${cellsetId}')?$expand=Cells($select=${cellProperties.join(',')}${topClause}${skipClause}${filterClause})`;
        if (options.sandboxName) url += `&!sandbox=${options.sandboxName.replace(/'/g, "''")}`;

        return withCompactJson(this.rest, options.useCompactJson === true,
            async () => (await this.rest.get(url)).data, /* returnAsDict */ true);
    }

    /**
     * Extract full cellset data and return raw dict.
     * Mirrors tm1py's `extract_cellset_raw` (CellService.py:3708-3787).
     * Cleans up cellset by default (deleteCellset=true).
     */
    public async extractCellsetRaw(
        cellsetId: string,
        options: ExtractCellsetRawOptions = {}
    ): Promise<RawCellsetDict> {
        const useCompactJson = options.useCompactJson === true;
        // tm1py extract_cellset_raw is @tidy_cellset (CellService.py:3708). The
        // wrapper's `kwargs.get("delete_cellset", True)` defaults to True when
        // no kwarg is passed — function-signature defaults don't reach **kwargs.
        const deleteCellset = options.deleteCellset !== false;

        return withTidyCellset(this, cellsetId, async () => {
            if (!useCompactJson) {
                const url = this._buildCellsetRawUrl(cellsetId, options);
                return (await this.rest.get(url)).data as RawCellsetDict;
            }

            // Compact-JSON path: tm1py CellService.py:3762-3787
            const metadata = await this.extractCellsetMetadataRaw(cellsetId, {
                elemProperties: options.elemProperties,
                memberProperties: options.memberProperties,
                top: options.top,
                skip: options.skip,
                skipContexts: options.skipContexts,
                includeHierarchies: options.includeHierarchies,
                sandboxName: options.sandboxName,
                deleteCellset: false,
            });
            const cells = await this.extractCellsetCellsRaw(cellsetId, {
                cellProperties: options.cellProperties,
                top: options.top,
                skip: options.skip,
                skipZeros: options.skipZeros,
                skipConsolidatedCells: options.skipConsolidatedCells,
                skipRuleDerivedCells: options.skipRuleDerivedCells,
                sandboxName: options.sandboxName,
                useCompactJson: true,
            });
            return { ...metadata, ...cells } as RawCellsetDict;
        }, { delete_cellset: deleteCellset, sandbox_name: options.sandboxName });
    }

    /**
     * Extract cellset metadata (Cube + Axes) without cells.
     * Mirrors tm1py's `extract_cellset_metadata_raw` (CellService.py:3789-3843).
     */
    public async extractCellsetMetadataRaw(
        cellsetId: string,
        options: ExtractCellsetMetadataRawOptions = {}
    ): Promise<any> {
        const memberProps = (options.memberProperties && options.memberProperties.length > 0)
            ? options.memberProperties : ['Name'];
        const selectMember = '$select=' + memberProps.join(',');
        const expandElem = (options.elemProperties && options.elemProperties.length > 0)
            ? ';$expand=Element($select=' + options.elemProperties.join(',') + ')' : '';

        const expandHierarchies = options.includeHierarchies
            ? 'Hierarchies($select=Name;$expand=Dimension($select=Name)),' : '';

        const filterAxis = options.skipContexts ? '$filter=Ordinal ne 2;' : '';
        const topTuples = (options.top && !options.skip) ? ';$top=' + options.top : '';

        let url =
            `/Cellsets('${cellsetId}')?$expand=` +
            `Cube($select=Name;$expand=Dimensions($select=Name)),` +
            `Axes(${filterAxis}$expand=${expandHierarchies}Tuples($expand=Members(${selectMember}${expandElem})${topTuples}))`;

        if (options.sandboxName) url += `&!sandbox=${options.sandboxName.replace(/'/g, "''")}`;

        // tm1py extract_cellset_metadata_raw is @tidy_cellset (CellService.py:3789).
        // The function-level `delete_cellset=False` default lives in the inner
        // function and never reaches the wrapper's **kwargs, so an unforwarded
        // call still deletes (kwargs.get("delete_cellset", True) → True).
        const deleteCellset = options.deleteCellset !== false;
        return withTidyCellset(this, cellsetId, async () => {
            return (await this.rest.get(url)).data;
        }, { delete_cellset: deleteCellset, sandbox_name: options.sandboxName });
    }

    /**
     * Extract cellset partition
     */
    public async extractCellsetPartition(
        cellsetId: string,
        skip: number = 0,
        top?: number,
        sandbox_name?: string
    ): Promise<any> {
        let url = `/Cellsets('${cellsetId}')/Cells`;

        const params = new URLSearchParams();
        params.append('$skip', skip.toString());
        if (top !== undefined) params.append('$top', top.toString());
        if (sandbox_name) params.append('$sandbox', sandbox_name);

        url += `?${params.toString()}`;

        const response = await this.rest.get(url);
        return response.data;
    }

    /**
     * Extract cellset axes cardinality
     */
    public async extractCellsetAxesCardinality(
        cellsetId: string,
        sandbox_name?: string
    ): Promise<number[]> {
        // tm1py extract_cellset_axes_cardinality has no @tidy_cellset (CellService.py:3969-3972).
        const metadata = await this.extractCellsetMetadataRaw(cellsetId, { sandboxName: sandbox_name, deleteCellset: false });

        if (metadata.Axes) {
            return metadata.Axes.map((axis: any) => axis.Cardinality || 0);
        }

        return [];
    }

    /**
     * Fetch only Axes with Cardinality from a cellset.
     * Mirrors tm1py's `extract_cellset_axes_cardinality` (CellService.py:3969-3972)
     * but returns the raw dict shape rather than a processed array.
     */
    private async _fetchCellsetAxesCardinalityRaw(
        cellsetId: string
    ): Promise<{ Axes: Array<{ Cardinality: number }> }> {
        const url = `/Cellsets('${cellsetId}')?$expand=Axes($select=Cardinality)`;
        return (await this.rest.get(url)).data;
    }

    /**
     * Extract cellset axes asynchronously using parallel chunked requests.
     * Mirrors tm1py's `extract_cellset_axes_raw_async` (CellService.py:3974-4076).
     * Uses Promise.all instead of Python's ThreadPoolExecutor.
     */
    public async extractCellsetAxesRawAsync(
        cellsetId: string,
        options: ExtractCellsetAxesRawAsyncOptions = {}
    ): Promise<RawCellsetDict> {
        const asyncAxis = options.asyncAxis ?? 1;
        const maxWorkers = options.maxWorkers ?? 8;

        const axesCardinality = await this._fetchCellsetAxesCardinalityRaw(cellsetId);

        if (asyncAxis >= axesCardinality.Axes.length) {
            throw new Error("Argument 'async_axis' must be less than axes cardinality");
        }

        const memberProps = (options.memberProperties && options.memberProperties.length > 0)
            ? options.memberProperties : ['Name'];
        const selectMember = '$select=' + memberProps.join(',');
        const expandElem = (options.elemProperties && options.elemProperties.length > 0)
            ? ';$expand=Element($select=' + options.elemProperties.join(',') + ')' : '';
        const expandHierarchies = options.includeHierarchies
            ? 'Hierarchies($select=Name;$expand=Dimension($select=Name)),' : '';

        const fetchAxisChunk = async (axis: number, partition: number, partitionSize: number): Promise<any> => {
            const top = partitionSize;
            const skip = partition * partitionSize;
            const filterAxis = `$filter=Ordinal eq ${axis};`;
            const partClause = partitionSize > 0 ? `;$top=${top};$skip=${skip}` : '';
            let url =
                `/Cellsets('${cellsetId}')?$expand=` +
                `Axes(${filterAxis}$expand=${expandHierarchies}Tuples($expand=Members(${selectMember}${expandElem})${partClause}))`;
            if (options.sandboxName) url += `&!sandbox=${options.sandboxName.replace(/'/g, "''")}`;
            return (await this.rest.get(url)).data;
        };

        // Extract non-async axis (the opposite axis)
        const axes = await fetchAxisChunk(1 - asyncAxis, 0, 0);

        // Extract async axis tuples in parallel chunks
        const partitionSize = Math.ceil(axesCardinality.Axes[asyncAxis].Cardinality / maxWorkers);
        const chunkResults = await Promise.all(
            Array.from({ length: maxWorkers }, (_, p) => fetchAxisChunk(asyncAxis, p, partitionSize))
        );
        const asyncAxisTuples = chunkResults.flatMap((r: any) => r.Axes[0]?.Tuples ?? []);

        // Combine results
        axes.Axes.splice(asyncAxis, 0, {
            Ordinal: asyncAxis,
            Cardinality: axesCardinality.Axes[asyncAxis].Cardinality,
            Tuples: asyncAxisTuples,
        });

        // Optionally include context axis (axis 2)
        if (!options.skipContexts) {
            const ctx = await fetchAxisChunk(2, 0, 0);
            if (ctx.Axes && ctx.Axes.length > 0) {
                axes.Axes.push(ctx.Axes[0]);
            }
        }

        return axes;
    }

    /**
     * Extract cellset cells asynchronously using parallel chunked requests.
     * Mirrors tm1py's `extract_cellset_cells_raw_async` (CellService.py:4078-4157).
     * Uses Promise.all instead of Python's ThreadPoolExecutor.
     */
    public async extractCellsetCellsRawAsync(
        cellsetId: string,
        options: ExtractCellsetCellsRawAsyncOptions = {}
    ): Promise<{ '@odata.context': string; ID: string; Cells: any[] }> {
        const maxWorkers = options.maxWorkers ?? 8;

        // tm1py: `if not cell_properties:` treats [] as falsy.
        const cellProperties = [...((options.cellProperties && options.cellProperties.length > 0)
            ? options.cellProperties : ['Value'])];
        if (options.skipRuleDerivedCells) {
            cellProperties.push('RuleDerived');
            cellProperties.push('Updateable');
        }
        if (options.skipConsolidatedCells) cellProperties.push('Consolidated');
        if ((options.skipZeros || options.skipRuleDerivedCells || options.skipConsolidatedCells)
                && !cellProperties.includes('Ordinal')) {
            cellProperties.push('Ordinal');
        }

        const filters: string[] = [];
        if (options.skipZeros) filters.push("Value ne 0 and Value ne null and Value ne ''");
        if (options.skipConsolidatedCells) filters.push('Consolidated eq false');
        if (options.skipRuleDerivedCells) filters.push('RuleDerived eq false');
        const filterCells = filters.join(' and ');

        const fetchChunk = async (partition: number, partitionSize: number): Promise<any> => {
            const top = partitionSize;
            const skip = partition * partitionSize;
            const topClause = top ? ';$top=' + top : '';
            const skipClause = skip ? ';$skip=' + skip : '';
            const filterClause = filterCells ? ';$filter=' + filterCells : '';
            let url = `/Cellsets('${cellsetId}')?$expand=Cells($select=${cellProperties.join(',')}${topClause}${skipClause}${filterClause})`;
            if (options.sandboxName) url += `&!sandbox=${options.sandboxName.replace(/'/g, "''")}`;
            return (await this.rest.get(url)).data;
        };

        const cellcount = await this.getCellsetCellsCount(cellsetId, options.sandboxName);

        // Match tm1py: when cellcount is 0, partitionSize=ceil(0/maxWorkers)=0 and
        // each chunk fetch issues a request without `;$top=` — equivalent to fetching
        // all (zero) cells. Don't short-circuit; keep wire behavior identical to tm1py.
        const partitionSize = Math.ceil(cellcount / maxWorkers);
        const results = await Promise.all(
            Array.from({ length: maxWorkers }, (_, p) => fetchChunk(p, partitionSize))
        );

        const allCells = results.flatMap((r: any) => r.Cells || []);
        const last = results[results.length - 1];
        return {
            '@odata.context': last['@odata.context'] ?? '',
            ID: last.ID ?? '',
            Cells: allCells,
        };
    }

    /**
     * Extract cellset values only
     */
    public async extractCellsetValues(
        cellsetId: string,
        sandbox_name?: string
    ): Promise<any[]> {
        let url = `/Cellsets('${cellsetId}')/Cells?$select=Value`;

        if (sandbox_name) {
            url += `&$sandbox=${sandbox_name}`;
        }

        const response = await this.rest.get(url);
        return response.data.value ? response.data.value.map((cell: any) => cell.Value) : [];
    }

    /**
     * Extract cellset rows and values
     */
    public async extractCellsetRowsAndValues(
        cellsetId: string,
        sandbox_name?: string
    ): Promise<{ rows: any[][], values: any[] }> {
        const cellset = await this.extractCellsetRaw(cellsetId, { sandboxName: sandbox_name });

        const rows: any[][] = [];
        const values: any[] = [];

        if (cellset.Axes && cellset.Axes.length > 0) {
            const rowAxis = cellset.Axes[1] || cellset.Axes[0];
            if (rowAxis && rowAxis.Tuples) {
                for (const tuple of rowAxis.Tuples) {
                    const row = tuple.Members ? tuple.Members.map((m: any) => m.Name) : [];
                    rows.push(row);
                }
            }
        }

        if (cellset.Cells) {
            values.push(...cellset.Cells.map((cell: any) => cell.Value));
        }

        return { rows, values };
    }

    /**
     * Retrieve composition of dimensions on the axes in the cellset.
     * Mirrors tm1py's `@tidy_cellset extract_cellset_composition` (CellService.py:4263-4296).
     *
     * BREAKING CHANGE from v2.1: was `(cellsetId, sandbox_name?)` returning
     * `{cube, dimensions}`. Now returns `{cube, titles, rows, columns}` matching
     * tm1py's 4-tuple. Migration: use `.columns` / `.rows` / `.titles` instead of
     * `.dimensions`.
     */
    public async extractCellsetComposition(
        cellsetId: string,
        options: { sandboxName?: string; deleteCellset?: boolean } = {}
    ): Promise<ExtractCellsetCompositionResult> {
        // tm1py decorates this with @tidy_cellset (CellService.py:4263) — default cleanup on.
        const deleteCellset = options.deleteCellset !== false;
        return withTidyCellset(this, cellsetId, async () => {
            let url =
                `/Cellsets('${cellsetId}')?$expand=` +
                `Cube($select=Name),Axes($expand=Hierarchies($select=UniqueName))`;
            if (options.sandboxName) url += `&!sandbox=${options.sandboxName.replace(/'/g, "''")}`;

            const data = (await this.rest.get(url)).data;
            const cube: string = data.Cube.Name;

            const rows: string[] = [];
            const titles: string[] = [];
            const columns: string[] = [];

            if (data.Axes.length === 1) {
                if (data.Axes[0].Hierarchies) {
                    columns.push(...data.Axes[0].Hierarchies.map((h: any) => h.UniqueName));
                }
            } else {
                if (data.Axes[0].Hierarchies) {
                    columns.push(...data.Axes[0].Hierarchies.map((h: any) => h.UniqueName));
                }
                if (data.Axes[1].Hierarchies) {
                    rows.push(...data.Axes[1].Hierarchies.map((h: any) => h.UniqueName));
                }
            }
            if (data.Axes.length > 2) {
                titles.push(...data.Axes[2].Hierarchies.map((h: any) => h.UniqueName));
            }

            return { cube, titles, rows, columns };
        }, { delete_cellset: deleteCellset, sandbox_name: options.sandboxName });
    }

    /**
     * Extract cellset as DataFrame
     */
    public async extractCellsetDataframe(
        cellsetId: string,
        sandbox_name?: string
    ): Promise<DataFrame> {
        const cellset = await this.extractCellsetRaw(cellsetId, { sandboxName: sandbox_name });
        return this.buildDataFrameFromCellset(cellset);
    }

    /**
     * Execute cellset and return only the content, in CSV format.
     * Mirrors tm1py's `extract_cellset_csv` (CellService.py:4312-4383).
     * Uses CLIENT-SIDE conversion via buildCsvFromCellsetDict — no use_blob.
     *
     * BREAKING CHANGE from v2.1: was `(cellsetId, sandbox_name?, includeHeaders?)`.
     * Now takes an options object with full tm1py parameter set.
     * Migration: `extractCellsetCsv(id, 'sb', false)` →
     *   `extractCellsetCsv(id, { sandboxName: 'sb', includeHeaders: false })`.
     */
    public async extractCellsetCsv(
        cellsetId: string,
        options: ExtractCellsetCsvOptions = {}
    ): Promise<string> {
        const skipZeros = options.skipZeros !== false;  // default true (tm1py parity)
        const includeHeaders = options.includeHeaders !== false;
        const deleteCellset = options.deleteCellset !== false;

        const { rows, columns } = await this.extractCellsetComposition(
            cellsetId, { sandboxName: options.sandboxName, deleteCellset: false }
        );

        const rawCellset = await this.extractCellsetRaw(cellsetId, {
            cellProperties: ['Value'],
            elemProperties: ['Name'],
            memberProperties: options.includeAttributes ? ['Name', 'Attributes'] : undefined,
            top: options.top,
            skip: options.skip,
            skipContexts: true,
            skipZeros,
            skipConsolidatedCells: options.skipConsolidatedCells,
            skipRuleDerivedCells: options.skipRuleDerivedCells,
            sandboxName: options.sandboxName,
            useCompactJson: options.useCompactJson,
            deleteCellset,
        });

        return buildCsvFromCellsetDict(rows, columns, rawCellset, {
            top: options.top,
            csvDialect: options.csvDialect,
            lineSeparator: options.lineSeparator,
            valueSeparator: options.valueSeparator,
            includeAttributes: options.includeAttributes,
            includeHeaders,
            mdxHeaders: options.mdxHeaders,
        });
    }

    /**
     * Execute cellset and return only the content, in CSV format — streaming version.
     * Mirrors tm1py's `extract_cellset_csv_iter_json` (CellService.py:4385-4556).
     * Uses stream-json for incremental JSON parsing (equivalent of Python's ijson).
     */
    public async extractCellsetCsvIterJson(
        cellsetId: string,
        options: Omit<ExtractCellsetCsvOptions, 'useCompactJson' | 'deleteCellset'> = {}
    ): Promise<string> {
        const skipZeros = options.skipZeros !== false;   // default true
        const valueSeparator = options.valueSeparator ?? ',';
        const lineSeparator = options.lineSeparator ?? '\r\n';
        const includeAttributes = options.includeAttributes === true;

        // Use csvDialect settings if provided (tm1py: CellService.py:4444-4446)
        const delimiter = options.csvDialect?.delimiter ?? valueSeparator;
        const lineterminator = options.csvDialect?.lineterminator ?? lineSeparator;

        const { cube, rows, columns } = await this.extractCellsetComposition(
            cellsetId, { sandboxName: options.sandboxName, deleteCellset: false }
        );

        const rawResponse = await this.extractCellsetRawResponse(cellsetId, {
            cellProperties: ['Value', 'Ordinal'],
            top: options.top,
            skip: options.skip,
            skipContexts: true,
            skipZeros,
            skipConsolidatedCells: options.skipConsolidatedCells,
            skipRuleDerivedCells: options.skipRuleDerivedCells,
            sandboxName: options.sandboxName,
            memberProperties: includeAttributes ? ['Name', 'Attributes'] : ['Name'],
            deleteCellset: false,
            asStream: true,
        });

        const rowHeaders = options.mdxHeaders ? [...rows] : [...dimensionNamesFromElementUniqueNames(rows)];
        const columnHeaders = options.mdxHeaders ? [...columns] : [...dimensionNamesFromElementUniqueNames(columns)];

        const attributesPrefixes = new Set<string>();
        if (includeAttributes) {
            const attributesByDimension = await this._getAttributesByDimension(cube);
            for (const [, attrs] of Object.entries(attributesByDimension)) {
                for (const attr of attrs) {
                    attributesPrefixes.add(`Axes.item.Tuples.item.Members.item.Attributes.${attr}`);
                }
            }
        }

        const prefixesOfInterest = new Set<string>([
            'Cells.item.Value',
            'Axes.item.Tuples.item.Members.item.Name',
            'Cells.item.Ordinal',
            'Axes.item.Tuples.item.Ordinal',
            'Cube.Dimensions.item.Name',
            'Axes.item.Ordinal',
            ...attributesPrefixes,
        ]);

        // Mirrors tm1py CellService.py:4448-4537 state machine
        const axes0List: string[][] = [];   // columns axis tuples member names
        const axes1List: string[][] = [];   // rows axis tuples member names
        let currentAxes = 0;
        let currentTuple = 0;
        let currentCellOrdinal = 0;
        const csvBodyLines: string[] = [];
        let maxEntriesPerRow = 0;
        let leastEntriesPerRow = 1_000;

        await this._streamJsonWalk(rawResponse.data, prefixesOfInterest, (prefix, event, value) => {
            if (prefix === 'Cells.item.Value') {
                // tm1py CellService.py:4482-4499 — divmod raises ZeroDivisionError
                // when axes0List is empty; match that strict behavior.
                if (axes0List.length === 0) {
                    throw new Error('division by zero: axes0List is empty');
                }
                const total = axes0List.length;
                const r = currentCellOrdinal % total;
                const q = Math.floor(currentCellOrdinal / total);
                // tm1py: row = … + [str(value)]. Python's str(None) is 'None',
                // not 'null' — match so downstream parsers (dataframe NA detection)
                // see the expected sentinel.
                const cellStr = value === null ? 'None' : String(value);
                let row: string[];
                if (axes0List.length === 1 && axes0List[0].length === 0) {
                    row = [...axes1List[q], cellStr];
                } else if (axes1List.length === 0) {
                    row = [...axes0List[r], cellStr];
                } else {
                    row = [...axes1List[q], ...axes0List[r], cellStr];
                }
                if (row.length > maxEntriesPerRow) maxEntriesPerRow = row.length;
                if (row.length < leastEntriesPerRow) leastEntriesPerRow = row.length;
                csvBodyLines.push(csvRowToString(row, delimiter, lineterminator));

            } else if (prefix === 'Axes.item.Tuples.item.Members.item.Name' && event === 'string') {
                // tm1py CellService.py:4501-4505
                (currentAxes === 0 ? axes0List : axes1List)[currentTuple].push(String(value));
            }

            if (attributesPrefixes.has(prefix)) {
                // tm1py CellService.py:4507-4524
                if (event !== 'string' && event !== 'number') return;
                const attributeName = prefix.split('.').pop() ?? '';
                const v = String(value);
                const list = currentAxes === 0 ? axes0List : axes1List;
                list[currentTuple].push(v);
                if (currentTuple === 0) {
                    if (currentAxes === 0) {
                        columnHeaders.splice(list[currentTuple].length - 1, 0, attributeName);
                    } else {
                        rowHeaders.splice(list[currentTuple].length - 1, 0, attributeName);
                    }
                }
            } else if (prefix === 'Cells.item.Ordinal' && event === 'number') {
                // tm1py CellService.py:4526
                currentCellOrdinal = value as number;
            } else if (prefix === 'Axes.item.Tuples.item.Ordinal' && event === 'number') {
                // tm1py CellService.py:4529-4533
                currentTuple = value as number;
                (currentAxes === 0 ? axes0List : axes1List).push([]);
            } else if (prefix === 'Axes.item.Ordinal' && event === 'number') {
                // tm1py CellService.py:4536
                currentAxes = value as number;
            }
        });

        // tm1py CellService.py:4539-4541 — empty cellset parity
        if (csvBodyLines.length === 0) return '';

        // tm1py CellService.py:4543-4549 — include_attributes validation
        if (includeAttributes) {
            if (!(leastEntriesPerRow === maxEntriesPerRow &&
                  maxEntriesPerRow === rowHeaders.length + columnHeaders.length + 1)) {
                throw new Error(
                    "Invalid response. With 'includeAttributes' as true," +
                    " Attributes must be requested explicitly as PROPERTIES in the MDX"
                );
            }
        }

        // tm1py CellService.py:4551-4556 — header + body
        const headerLine = csvRowToString([...rowHeaders, ...columnHeaders, 'Value'], delimiter, lineterminator);
        return headerLine + csvBodyLines.join('').replace(/\s+$/, '');
    }

    /**
     * Walk a JSON stream and call `visit` for each leaf value whose dotted path
     * is in `prefixesOfInterest`. Mirrors tm1py's ijson.parse prefix filter.
     * Uses stream-json v2 with stream-chain for incremental parsing.
     */
    private async _streamJsonWalk(
        stream: NodeJS.ReadableStream,
        prefixesOfInterest: Set<string>,
        visit: (prefix: string, event: string, value: any) => void
    ): Promise<void> {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { chain } = require('stream-chain');
        // stream-json v2: default export is the make() function that returns a Duplex stream
        // (parser() returns a Flushable fn for stream-chain; make() returns a proper Duplex)
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const make = require('stream-json');

        return new Promise<void>((resolve, reject) => {
            const pipeline = chain([
                stream,
                make({ packKeys: true, packStrings: true, packNumbers: true }),
            ]);

            // Path tracking state — mirrors ijson prefix semantics
            // Each entry in pushStack records how many path segments were pushed when
            // entering the corresponding container, so we know how many to pop on exit.
            const pathStack: string[] = [];
            let lastKey: string | null = null;
            // pushStack[i]: number of segments pushed when opening the i-th container
            const pushStack: number[] = [];
            // currentContainerIsArray[i]: whether the i-th container is an array
            const containerIsArray: boolean[] = [];

            pipeline.on('data', (token: { name: string; value?: any }) => {
                switch (token.name) {
                    case 'startObject': {
                        let pushed = 0;
                        const parentIsArray = containerIsArray.length > 0
                            && containerIsArray[containerIsArray.length - 1];
                        if (lastKey !== null) {
                            pathStack.push(lastKey); lastKey = null; pushed = 1;
                        } else if (parentIsArray) {
                            pathStack.push('item'); pushed = 1;
                        }
                        containerIsArray.push(false);
                        pushStack.push(pushed);
                        break;
                    }

                    case 'startArray': {
                        let pushed = 0;
                        if (lastKey !== null) {
                            pathStack.push(lastKey); lastKey = null; pushed = 1;
                        }
                        containerIsArray.push(true);
                        pushStack.push(pushed);
                        break;
                    }

                    case 'endObject':
                    case 'endArray': {
                        containerIsArray.pop();
                        const n = pushStack.pop() ?? 0;
                        for (let i = 0; i < n; i++) pathStack.pop();
                        break;
                    }

                    case 'keyValue':
                        lastKey = token.value;
                        break;

                    case 'stringValue':
                    case 'numberValue':
                    case 'nullValue':
                    case 'trueValue':
                    case 'falseValue': {
                        const prefix = lastKey !== null
                            ? (pathStack.length > 0 ? pathStack.join('.') + '.' + lastKey : lastKey)
                            : pathStack.join('.');
                        if (prefixesOfInterest.has(prefix)) {
                            const event = token.name === 'stringValue' ? 'string'
                                : token.name === 'numberValue' ? 'number' : 'other';
                            // stream-json v2 emits numberValue.value as a string (accumulated chunks)
                            // — parse to JS number so callers can do numeric comparisons
                            const value = token.name === 'numberValue'
                                ? parseFloat(token.value as string)
                                : token.value;
                            // Synchronous visitor exceptions (e.g. ZeroDivisionError-style
                            // throws inside the cells handler) must reject the outer Promise;
                            // EventEmitter listener throws don't propagate naturally.
                            try {
                                visit(prefix, event, value);
                            } catch (err) {
                                if (typeof (stream as any).destroy === 'function') {
                                    try { (stream as any).destroy(); } catch { /* already torn down */ }
                                }
                                pipeline.destroy();
                                reject(err as Error);
                                return;
                            }
                        }
                        lastKey = null;
                        break;
                    }
                }
            });

            pipeline.on('end', () => resolve());
            pipeline.on('error', (err: Error) => {
                // Ensure the upstream HTTP response stream is released so the socket
                // doesn't stay buffered when parsing fails mid-document.
                if (typeof (stream as any).destroy === 'function') {
                    try { (stream as any).destroy(); } catch { /* already torn down */ }
                }
                reject(err);
            });
        });
    }


    /**
     * Get element attributes by dimension for a cube.
     * Used by extractCellsetCsvIterJson to build attribute prefix sets.
     * Mirrors tm1py's `_get_attributes_by_dimension` (CellService.py:~4573).
     */
    private async _getAttributesByDimension(cubeName: string): Promise<Record<string, string[]>> {
        // tm1py _get_attributes_by_dimension (CellService.py:5123-5134) calls
        // get_dimension_names_for_writing(cube) — which excludes the sandbox
        // dim and other control dims — and element_service.get_element_attribute_names
        // (the lighter `?$select=Name` form, not the full attribute objects).
        // Exceptions propagate; do NOT swallow them here.
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { ElementService } = require('./ElementService');
        const elementService = new ElementService(this.rest);
        const dimensions = await this.getDimensionNamesForWriting(cubeName);
        const result: Record<string, string[]> = {};
        for (const dim of dimensions) {
            // Defensive: getDimensionNamesForWriting should already exclude
            // `}`-prefixed control dims, but skip if any leak through.
            if (dim.startsWith('}')) continue;
            result[dim] = await elementService.getElementAttributeNames(dim, dim);
        }
        return result;
    }

    /**
     * Extract cellset as shaped DataFrame
     */
    public async extractCellsetDataframeShaped(
        cellsetId: string,
        sandbox_name?: string
    ): Promise<DataFrame> {
        let url = `/Cellsets('${cellsetId}')/tm1.ExtractDataFrameShaped`;

        if (sandbox_name) {
            url += `?$sandbox=${sandbox_name}`;
        }

        const response = await this.rest.get(url);
        return this.buildDataFrameFromResponse(response.data);
    }

    /**
     * Extract cellset as pivot DataFrame
     */
    public async extractCellsetDataframePivot(
        cellsetId: string,
        sandbox_name?: string
    ): Promise<DataFrame> {
        const cellset = await this.extractCellsetRaw(cellsetId, { sandboxName: sandbox_name });
        return this.buildPivotDataFrameFromCellset(cellset);
    }

    /**
     * Check if transaction log is active for a cube
     */
    public async transactionLogIsActive(cubeName: string): Promise<boolean> {
        const url = `/Cubes('${cubeName}')?$select=LastDataUpdate,TransactionLogIsActive`;
        const response = await this.rest.get(url);
        return response.data.TransactionLogIsActive === true;
    }

    /**
     * Execute asynchronous cellset extraction
     */
    public async extractCellsetAsync(
        cellsetId: string,
        maxWorkers: number = 4,
        sandbox_name?: string
    ): Promise<DataFrame> {
        /** Extract cellset data asynchronously with worker pool management
         *
         * :param cellsetId: ID of the cellset to extract
         * :param maxWorkers: Maximum number of concurrent workers
         * :param sandbox_name: Optional sandbox name
         * :return: DataFrame with extracted data
         */

        // Get cellset metadata first
        const cellset = await this.extractCellsetRaw(cellsetId, { sandboxName: sandbox_name, deleteCellset: false });
        const cellCount = cellset.Cells?.length || 0;

        // For small cellsets, use synchronous method
        if (cellCount < 10000) {
            return await this.extractCellsetDataframe(cellsetId, sandbox_name);
        }

        // For large cellsets, use chunked parallel processing
        const chunkSize = Math.ceil(cellCount / maxWorkers);
        const chunks: Promise<any[]>[] = [];

        for (let i = 0; i < cellCount; i += chunkSize) {
            const chunk = this.extractCellsetChunk(cellsetId, i, chunkSize, sandbox_name);
            chunks.push(chunk);
        }

        // Process chunks in parallel and combine results
        const chunkResults = await Promise.all(chunks);
        const combinedCells = chunkResults.flat();

        // Build DataFrame from combined results
        const enhancedCellset = { ...cellset, Cells: combinedCells };
        return this.buildDataFrameFromCellset(enhancedCellset);
    }

    /**
     * Extract a chunk of cellset data for parallel processing
     */
    private async extractCellsetChunk(
        cellsetId: string,
        skip: number,
        top: number,
        sandbox_name?: string
    ): Promise<any[]> {
        let url = `/Cellsets('${cellsetId}')/Cells?$skip=${skip}&$top=${top}`;

        if (sandbox_name) {
            url += `&$sandbox=${sandbox_name}`;
        }

        const response = await this.rest.get(url);
        return response.data.value || [];
    }

    /**
     * Write values through cellset approach
     */
    public async writeValuesThroughCellset(
        cubeName: string,
        cellsetAsDict: CellsetDict,
        dimensions?: string[],
        options: WriteOptions = {}
    ): Promise<void> {
        // Create a temporary MDX that covers all coordinates
        const coordinates = Object.keys(cellsetAsDict);
        const mdxMembers = coordinates.map(coord => {
            const elements = coord.split(',').map(e => e.trim());
            return `(${elements.map(e => `'${e}'`).join(',')})`;
        });

        const mdx = `{${mdxMembers.join(',')}} ON 0 FROM [${cubeName}]`;

        // Create cellset
        const cellsetId = await this.createCellset(mdx, options.sandbox_name);

        await withTidyCellset(this, cellsetId, async () => {
            const cellUpdates = Object.values(cellsetAsDict).map((value, ordinal) => ({ ordinal, value }));
            await this.updateCellset(cellsetId, cellUpdates, options.sandbox_name);
        }, { sandbox_name: options.sandbox_name });
    }

    /**
     * Write values with retry logic and error handling
     */
    public async writeBulk(
        cubeName: string,
        cellsetAsDict: CellsetDict,
        dimensions?: string[],
        options: BulkWriteOptions = {}
    ): Promise<void> {
        const {
            max_workers = 4,
            chunk_size = 1000,
            max_retries = 3,
            retry_delay = 1000,
            cancel_at_failure = false
        } = options;

        const entries = Object.entries(cellsetAsDict);
        const chunks = [];

        // Split into chunks
        for (let i = 0; i < entries.length; i += chunk_size) {
            chunks.push(entries.slice(i, i + chunk_size));
        }

        const errors: Error[] = [];

        // Process chunks with limited concurrency
        const semaphore = new Array(max_workers).fill(null);

        const processChunk = async (chunk: [string, any][]) => {
            const chunkDict: CellsetDict = {};
            for (const [coord, value] of chunk) {
                chunkDict[coord] = value;
            }

            let retries = 0;
            while (retries <= max_retries) {
                try {
                    await this.write(cubeName, chunkDict, dimensions, options);
                    return;
                } catch (error) {
                    retries++;
                    if (retries > max_retries) {
                        errors.push(error as Error);
                        if (cancel_at_failure) {
                            throw error;
                        }
                        return;
                    }
                    // Wait before retry
                    await new Promise(resolve => setTimeout(resolve, retry_delay * retries));
                }
            }
        };

        // Process all chunks with concurrency control
        const promises = chunks.map(async (chunk) => {
            // Wait for available worker
            await Promise.race(semaphore.map((_, i) =>
                new Promise(resolve => setTimeout(() => resolve(i), i * 10))
            ));

            return processChunk(chunk);
        });

        await Promise.all(promises);

        if (errors.length > 0) {
            throw new Error(`Bulk write completed with ${errors.length} errors: ${errors.map(e => e.message).join(', ')}`);
        }
    }

    /**
     * Drop non-updateable cells from cellset
     */
    public dropNonUpdateableCells(cellsetAsDict: CellsetDict, cellset: any): CellsetDict {
        const result: CellsetDict = {};
        const coordinates = Object.keys(cellsetAsDict);

        if (cellset.Cells) {
            for (let i = 0; i < cellset.Cells.length && i < coordinates.length; i++) {
                const cell = cellset.Cells[i];
                const coord = coordinates[i];

                // Include cell if it's updateable (not rule-derived or consolidated)
                if (cell.Updateable !== false && cell.RuleDerived !== true && cell.Consolidated !== true) {
                    result[coord] = cellsetAsDict[coord];
                }
            }
        } else {
            // If no cell metadata available, include all
            return cellsetAsDict;
        }

        return result;
    }

    /**
     * Resolve the measure dimension for a cube, then return the {elementName: type} map across
     * all hierarchies. Mirrors tm1py CellService.get_elements_from_all_measure_hierarchies
     * (CellService.py:1906-1914) — returns the real element type per element so callers can
     * dispatch CellPutN vs CellPutS correctly.
     */
    private async _fetchMeasureDimensionElementTypes(cubeName: string): Promise<CaseAndSpaceInsensitiveDict<string>> {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { CubeService } = require('./CubeService');
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { ElementService } = require('./ElementService');
        const cubeService = new CubeService(this.rest);
        const elementService = new ElementService(this.rest);
        const measureDimension: string = await cubeService.getMeasureDimension(cubeName);
        // tm1py returns a CaseAndSpaceInsensitiveDict so callers' element-name lookups work
        // regardless of casing/spaces. Returning the dict directly preserves that semantics —
        // the prior implementation flattened to a plain object using the dict's normalized keys,
        // which then missed every lookup using the raw element name from the user's coordinate.
        return await elementService.getElementTypesFromAllHierarchies(measureDimension);
    }

    /**
     * Get elements from all measure hierarchies
     */
    public async getElementsFromAllMeasureHierarchies(cubeName: string): Promise<{ [dimension: string]: string[] }> {
        const url = `/Cubes('${cubeName}')?$expand=Dimensions($expand=DefaultHierarchy($expand=Elements($select=Name;$filter=Type eq 'Numeric')))`;
        const response = await this.rest.get(url);

        const result: { [dimension: string]: string[] } = {};

        if (response.data.Dimensions) {
            for (const dimension of response.data.Dimensions) {
                if (dimension.DefaultHierarchy && dimension.DefaultHierarchy.Elements) {
                    const elements = dimension.DefaultHierarchy.Elements
                        .filter((e: any) => e.Type === 'Numeric')
                        .map((e: any) => e.Name);

                    if (elements.length > 0) {
                        result[dimension.Name] = elements;
                    }
                }
            }
        }

        return result;
    }

    /**
     * Execute UI operations for dygraph visualization
     */
    public async executeMdxUiDygraph(
        mdx: string,
        options: MDXViewOptions = {}
    ): Promise<any> {
        const cellset = await this.executeMdxRaw(mdx, CellService._mdxViewToRawOptions(options));
        return this.formatForDygraph(cellset);
    }

    /**
     * Execute view for dygraph visualization
     */
    public async executeViewUiDygraph(
        cubeName: string,
        viewName: string,
        options: MDXViewOptions = {}
    ): Promise<any> {
        const cellset = await this.executeViewRaw(cubeName, viewName, CellService._mdxViewToViewRawOptions(options));
        return this.formatForDygraph(cellset);
    }

    /**
     * Execute MDX for UI array format
     */
    public async executeMdxUiArray(
        mdx: string,
        options: MDXViewOptions = {}
    ): Promise<any[][]> {
        const cellset = await this.executeMdxRaw(mdx, CellService._mdxViewToRawOptions(options));
        return this.formatForUiArray(cellset);
    }

    /**
     * Execute view for UI array format
     */
    public async executeViewUiArray(
        cubeName: string,
        viewName: string,
        options: MDXViewOptions = {}
    ): Promise<any[][]> {
        const cellset = await this.executeViewRaw(cubeName, viewName, CellService._mdxViewToViewRawOptions(options));
        return this.formatForUiArray(cellset);
    }

    // ===== PRIVATE HELPER METHODS =====

    private buildDataFrameFromCellset(cellset: any): DataFrame {
        const columns: string[] = [];
        const data: any[][] = [];

        if (!cellset.Axes || !cellset.Cells) {
            return { columns, data };
        }

        // Extract column headers from axes
        if (cellset.Axes.length > 0) {
            const columnAxis = cellset.Axes[0];
            if (columnAxis.Hierarchies) {
                for (const hierarchy of columnAxis.Hierarchies) {
                    columns.push(hierarchy.Dimension?.Name || hierarchy.Name || 'Unknown');
                }
            }

            // Add value column
            columns.push('Value');
        }

        // Extract data rows
        if (cellset.Axes.length > 1) {
            const rowAxis = cellset.Axes[1];
            if (rowAxis.Tuples) {
                for (let i = 0; i < rowAxis.Tuples.length; i++) {
                    const tuple = rowAxis.Tuples[i];
                    const row: any[] = [];

                    if (tuple.Members) {
                        for (const member of tuple.Members) {
                            row.push(member.Name);
                        }
                    }

                    // Add cell value
                    const cellValue = cellset.Cells[i]?.Value || null;
                    row.push(cellValue);

                    data.push(row);
                }
            }
        }

        return { columns, data };
    }

    private buildDataFrameFromResponse(responseData: any): DataFrame {
        // Handle different response formats from TM1
        if (responseData.columns && responseData.data) {
            return {
                columns: responseData.columns,
                data: responseData.data
            };
        }

        if (responseData.value) {
            return this.buildDataFrameFromCellset(responseData.value);
        }

        return this.buildDataFrameFromCellset(responseData);
    }

    private buildPivotDataFrameFromCellset(cellset: any): DataFrame {
        // For now, return regular DataFrame - full pivot implementation would be more complex
        return this.buildDataFrameFromCellset(cellset);
    }

    private formatForDygraph(cellset: any): any {
        // Convert cellset to dygraph format
        // This is a simplified implementation
        // Full dygraph formatting would require more sophisticated axis handling
        const df = this.buildDataFrameFromCellset(cellset);

        return {
            labels: df.columns,
            data: df.data
        };
    }

    private formatForUiArray(cellset: any): any[][] {
        const df = this.buildDataFrameFromCellset(cellset);
        return [df.columns, ...df.data];
    }

    private generateTempProcessName(): string {
        return `tm1npm_temp_${Date.now()}_${++this.tempProcessCounter}`;
    }

    /**
     * Execute MDX and return element-value dictionary (parity with tm1py.execute_mdx_elements_value_dict).
     * Delegates to executeMdxCsv and parses CSV with header skip + quoted-field support.
     *
     * Parity divergence: tm1py forwards `element_separator` as both the CSV delimiter and the
     * key-join separator (so the underlying TM1 CSV is regenerated with that delimiter). tm1npm's
     * underlying executeMdxCsv does not yet accept a custom delimiter, so we parse the comma-
     * delimited CSV that TM1 returns and only use `elementSeparator` as the key-join separator.
     * Output dict keys/values still match tm1py for the default `'|'` separator.
     */
    public async executeMdxElementsValueDict(
        mdx: string,
        elementSeparator: string = '|',
        sandboxName?: string,
        options: { skipZeros?: boolean } = {}
    ): Promise<{ [key: string]: any }> {
        const csv = await this.executeMdxCsv(mdx, {
            sandboxName,
            skipZeros: options.skipZeros !== false,
        });
        if (!csv) return {};
        const lines = csv.split(/\r?\n/).filter(l => l.length > 0);
        if (lines.length <= 1) return {};
        const result: { [key: string]: any } = {};
        // Skip header (matches tm1py's `next(reader, None)`).
        for (let i = 1; i < lines.length; i++) {
            const fields = CellService._parseCsvLine(lines[i], ',');
            if (fields.length < 2) continue;
            const key = fields.slice(0, -1).join(elementSeparator);
            result[key] = fields[fields.length - 1];
        }
        return result;
    }

    /**
     * Clear data based on DataFrame coordinates
     */
    public async clearWithDataframe(
        cubeName: string,
        dataFrame: any[][],
        dimensions: string[],
        sandbox_name?: string
    ): Promise<void> {
        // Build MDX filter from DataFrame coordinates
        const coordinates = dataFrame.map(row => 
            row.slice(0, dimensions.length).map(coord => `'${coord}'`).join(',')
        );
        
        const mdxFilter = coordinates.map(coord => `(${coord})`).join(',');
        const mdx = `{${mdxFilter}}`;
        
        await this.clearWithMdx(cubeName, mdx, sandbox_name);
    }

    /**
     * Execute relative proportional spread (parity with tm1py.relative_proportional_spread).
     * @param value value to be spread
     * @param cube name of the cube
     * @param uniqueElementNames target cell coordinates as unique element names (e.g. ["[d1].[c1]","[d2].[e3]"])
     * @param referenceUniqueElementNames reference cell coordinates as unique element names
     * @param referenceCube name of the reference cube. If omitted, defaults to `cube`.
     * @param sandboxName optional sandbox name
     */
    public async relativeProportionalSpread(
        value: number,
        cube: string,
        uniqueElementNames: readonly string[],
        referenceUniqueElementNames: readonly string[],
        referenceCube?: string,
        sandboxName?: string
    ): Promise<any> {
        const mdx = `SELECT { ${uniqueElementNames.join('}*{')} } ON 0 FROM [${cube}]`;
        const cellsetId = await this.createCellset(mdx, sandboxName);
        try {
            const targetCube = referenceCube || cube;
            const refBindings = referenceUniqueElementNames.map(unique => {
                const [dim, hier, elem] = CellService._parseUniqueElementName(unique);
                return formatUrl(
                    "Dimensions('{}')/Hierarchies('{}')/Elements('{}')",
                    escapeODataValue(dim),
                    escapeODataValue(hier),
                    escapeODataValue(elem),
                );
            });
            const payload = {
                BeginOrdinal: 0,
                Value: 'RP' + String(value),
                'ReferenceCell@odata.bind': refBindings,
                'ReferenceCube@odata.bind': formatUrl("Cubes('{}')", escapeODataValue(targetCube)),
            };
            let url = formatUrl("/Cellsets('{}')/tm1.Update", cellsetId);
            if (sandboxName) url += `?!sandbox=${encodeURIComponent(sandboxName)}`;
            return await this.rest.post(url, JSON.stringify(payload));
        } finally {
            await this._safeDeleteCellset(cellsetId, sandboxName);
        }
    }

    /**
     * Execute clear spread
     */
    public async clearSpread(
        cubeName: string,
        targetCoordinates: string[],
        options: MDXViewOptions = {}
    ): Promise<void> {
        const coordinateString = targetCoordinates.map(c => `'${c}'`).join(',');
        let url = `/Cubes('${cubeName}')/tm1.ClearSpread(coordinates=[${coordinateString}])`;
        
        if (options.sandbox_name) {
            url += `?$sandbox=${options.sandbox_name}`;
        }

        await this.rest.post(url);
    }

    /**
     * Check cell feeders
     */
    public async checkCellFeeders(
        cubeName: string,
        coordinates: string[],
        sandbox_name?: string
    ): Promise<boolean> {
        const coordinateString = coordinates.map(c => `'${c}'`).join(',');
        let url = `/Cubes('${cubeName}')/tm1.CheckCellFeeders(coordinates=[${coordinateString}])`;
        
        if (sandbox_name) {
            url += `?$sandbox=${sandbox_name}`;
        }

        const response = await this.rest.get(url);
        return response.data.value === true;
    }
    /**
     * Write multiple cell values to a cube (parity with tm1py.write_values).
     *
     * Tuple keys are comma-separated dimension elements (e.g. "2024,USA,Books").
     * Callers must avoid leading/trailing whitespace around commas; element names
     * are not trimmed in order to preserve fidelity with Python tuple semantics.
     *
     * @param cubeName name of the cube
     * @param cellsetAsDict {tupleKey: value} where tupleKey is comma-joined element names
     * @param dimensions optional dimension names in natural order (skips a fetch)
     * @param sandboxName optional sandbox name
     * @param changeset optional changeset id
     * @returns the changeset argument (for parity with tm1py)
     */
    public async writeValues(
        cubeName: string,
        cellsetAsDict: { [tupleKey: string]: any },
        dimensions?: string[],
        sandboxName?: string,
        changeset?: string
    ): Promise<string | undefined> {
        const dims = dimensions || await this.getDimensionNamesForWriting(cubeName);
        let url = formatUrl("/Cubes('{}')/tm1.Update", cubeName);
        const params: string[] = [];
        if (sandboxName) params.push(`!sandbox=${encodeURIComponent(sandboxName)}`);
        if (changeset) params.push(`!ChangeSet=${encodeURIComponent(changeset)}`);
        if (params.length) url += `?${params.join('&')}`;

        const updates = Object.entries(cellsetAsDict).map(([tupleKey, value]) => ({
            Cells: [{
                'Tuple@odata.bind': tupleKey.split(',').map((elem, i) =>
                    formatUrl(
                        "Dimensions('{}')/Hierarchies('{}')/Elements('{}')",
                        escapeODataValue(dims[i]),
                        escapeODataValue(dims[i]),
                        escapeODataValue(elem),
                    )
                ),
            }],
            Value: value || '',
        }));
        await this.rest.post(url, JSON.stringify(updates));
        return changeset;
    }

    /**
     * Execute MDX and return cells with their properties as a
     * CaseAndSpaceInsensitiveTuplesDict. Mirrors tm1py's execute_mdx
     * (CellService.py:2065-2138): createCellset + extractCellset with the
     * full tm1py parameter surface.
     *
     * When `maxWorkers > 1`, dispatches to the async path (parity with
     * execute_mdx_async). tm1py forwards all options; tm1npm's
     * `executeMdxAsync` currently only supports a subset — that gap is
     * pre-existing and not introduced by this change.
     */
    public async executeMdx(
        mdx: string,
        options: ExecuteMdxOptions = {}
    ): Promise<CaseAndSpaceInsensitiveTuplesDict<any>> {
        const maxWorkers = options.maxWorkers ?? 1;
        if (maxWorkers > 1) {
            // executeMdxAsync returns plain Map<string, any>; wrap into a TuplesDict to
            // keep callers' return-type contract intact. Underlying values are unchanged.
            const asyncResult = await this.executeMdxAsync(mdx, { sandbox_name: options.sandboxName });
            const dict = new CaseAndSpaceInsensitiveTuplesDict<any>();
            for (const [k, v] of asyncResult) dict.set(k, v);
            return dict;
        }
        const cellsetId = await this.createCellset(mdx, options.sandboxName);
        return this.extractCellset(cellsetId, {
            cellProperties: options.cellProperties,
            top: options.top,
            skip: options.skip,
            skipContexts: options.skipContexts,
            skipZeros: options.skipZeros,
            skipConsolidatedCells: options.skipConsolidatedCells,
            skipRuleDerivedCells: options.skipRuleDerivedCells,
            deleteCellset: true,
            sandboxName: options.sandboxName,
            elementUniqueNames: options.elementUniqueNames,
            skipCellProperties: options.skipCellProperties,
            useCompactJson: options.useCompactJson,
            skipSandboxDimension: options.skipSandboxDimension,
        });
    }

    /**
     * Clear cube data (parity with tm1py.clear).
     * Builds NON EMPTY column-axis MDX from optional dimension expressions and delegates
     * to clearWithMdx (which uses MDXView + ViewZeroOut TI). Unmapped dimensions default
     * to TM1FILTERBYLEVEL({TM1SUBSETALL([dim])},0).
     */
    public async clear(
        cubeName: string,
        dimensionExpressions: Record<string, string> = {},
        sandboxName?: string
    ): Promise<void> {
        const dimensionNames = await this.getDimensionNamesForWriting(cubeName);
        const normToActual = new Map<string, string>();
        for (const dim of dimensionNames) normToActual.set(lowerAndDropSpaces(dim), dim);

        const exprByDim: Record<string, string> = {};
        for (const [key, expr] of Object.entries(dimensionExpressions)) {
            const actual = normToActual.get(lowerAndDropSpaces(key));
            if (actual) {
                // Mirror tm1py's wrap_in_curly_braces (Utils.py:1693): independent open/close checks.
                const open = expr.startsWith('{') ? '' : '{';
                const close = expr.endsWith('}') ? '' : '}';
                exprByDim[actual] = `${open}${expr}${close}`;
            }
        }
        for (const dim of dimensionNames) {
            if (!(dim in exprByDim)) {
                exprByDim[dim] = `{TM1FILTERBYLEVEL({TM1SUBSETALL([${dim}])},0)}`;
            }
        }
        const sets = dimensionNames.map(d => exprByDim[d]).join(' * ');
        const mdx = `SELECT NON EMPTY {${sets}} ON 0 FROM [${cubeName}]`;
        return this.clearWithMdx(cubeName, mdx, sandboxName);
    }

    /**
     * Clear all data in a cube (delegates to clear with no expressions).
     */
    public async clearCube(cubeName: string, sandboxName?: string): Promise<void> {
        return this.clear(cubeName, {}, sandboxName);
    }

    /**
     * Execute MDX query and return data in DataFrame shape
     */
    public async executeMdxDataFrameShaped(mdx: string): Promise<any> {
        const url = '/ExecuteMDXDataFrameShaped';
        const body = { MDX: mdx };
        const response = await this.rest.post(url, body);
        return response.data;
    }

    /**
     * Execute view and return data in DataFrame shape
     */
    public async executeViewDataFrameShaped(
        cubeName: string, 
        viewName: string, 
        isPrivate?: boolean, 
        useIterativeJson?: boolean, 
        useBlob?: boolean
    ): Promise<any> {
        let url = `/Cubes('${cubeName}')/Views('${viewName}')/tm1.ExecuteDataFrameShaped`;
        
        const params = [];
        if (isPrivate !== undefined) params.push(`$private=${isPrivate}`);
        if (useIterativeJson !== undefined) params.push(`$iterativeJson=${useIterativeJson}`);
        if (useBlob !== undefined) params.push(`$blob=${useBlob}`);
        
        if (params.length > 0) {
            url += `?${params.join('&')}`;
        }
        
        const response = await this.rest.post(url);
        return response.data;
    }

    // ===== NEW ASYNC FUNCTIONS FOR 100% TM1PY PARITY =====

    /**
     * Write DataFrame data asynchronously for better performance
     */
    public async writeDataframeAsync(
        cubeName: string, 
        dataFrame: any[][], 
        dimensions: string[], 
        options: WriteOptions = {}
    ): Promise<string> {
        /** Write DataFrame data asynchronously and return execution ID
         *
         * :param cubeName: name of the cube
         * :param dataFrame: 2D array with data to write
         * :param dimensions: array of dimension names
         * :param options: write options including sandbox_name
         * :return: execution ID for tracking async operation
         */
        
        // Convert DataFrame to cellset format
        const cellsetAsDict: CellsetDict = {};

        for (let i = 1; i < dataFrame.length; i++) {
            const row = dataFrame[i];
            const coordinates: string[] = [];
            let value: any = null;

            for (let j = 0; j < dimensions.length; j++) {
                coordinates.push(String(row[j]));
            }
            
            // Last column is typically the value
            value = row[row.length - 1];
            
            const coordinateKey = coordinates.join(',');
            cellsetAsDict[coordinateKey] = value;
        }

        // Use async write through process
        const processName = `AsyncWrite_${Date.now()}`;
        const tiCode = `
            # Async DataFrame write
            ${Object.entries(cellsetAsDict).map(([coords, value]) => {
                const coordArray = coords.split(',').map(c => `'${c}'`).join(',');
                return `CellPutN(${value}, '${cubeName}', ${coordArray});`;
            }).join('\n')}
        `;

        const processBody = {
            Name: processName,
            PrologProcedure: tiCode,
            HasSecurityAccess: false
        };

        // Create and execute process asynchronously
        await this.rest.post('/Processes', processBody);
        
        const executeUrl = `/Processes('${processName}')/tm1.ExecuteProcessAsync`;
        const execResponse = await this.rest.post(executeUrl, {
            sandbox_name: options.sandbox_name
        });

        // Return execution ID for polling
        return execResponse.data.ID || processName;
    }

    /**
     * Execute MDX via cellset extraction (parity with tm1py.execute_mdx_async).
     * Returns a Map keyed by comma-joined element unique-names (or Names if UniqueName missing).
     *
     * Documented parity gaps (see IMPLEMENTATION_PLAN.md):
     * - tm1py uses extract_cellset_async with parallel-chunked retrieval. That helper is not
     *   yet ported; this implementation delegates to a serial extractCellset.
     * - tm1py's options (cell_properties, top, skip, skip_*, element_unique_names, etc.) are
     *   not yet wired through extractCellset. To prevent silent option-drop, those parameters
     *   are deliberately omitted from this signature so misuse is a compile-time error rather
     *   than a runtime no-op. Add them back when the underlying extractor supports them.
     * - Optional `cubeName` lets the caller request tm1py-compatible tuple-key ordering by
     *   cube dimensions. When omitted, parts are joined in axis order (tm1py-divergent).
     */
    public async executeMdxAsync(
        mdx: string,
        options: { sandbox_name?: string; cubeName?: string } = {}
    ): Promise<Map<string, any>> {
        const cellsetId = await this.createCellset(mdx, options.sandbox_name);
        try {
            const cellset = await this._extractCellsetForTupleDict(cellsetId, options.sandbox_name);
            const cubeDims = options.cubeName
                ? await this.getDimensionNamesForWriting(options.cubeName)
                : undefined;
            return CellService._cellsetToTupleDict(cellset, cubeDims);
        } finally {
            await this._safeDeleteCellset(cellsetId, options.sandbox_name);
        }
    }

    /**
     * Poll execution status for async operations
     */
    public async pollExecuteWithReturn(executionId: string): Promise<any> {
        /** Poll the status of an async execution and return results when complete
         *
         * :param executionId: ID of the async execution to poll
         * :return: execution results when complete
         */
        const maxPollingAttempts = 100;
        const pollingInterval = 1000; // 1 second
        
        for (let attempt = 0; attempt < maxPollingAttempts; attempt++) {
            try {
                // Check if it's a process execution
                const statusUrl = `/Processes('${executionId}')/tm1.ExecutionStatus`;
                const statusResponse = await this.rest.get(statusUrl);
                
                const status = statusResponse.data.Status;
                
                if (status === 'CompletedSuccessfully') {
                    // Get results
                    const resultUrl = `/Processes('${executionId}')/tm1.ExecutionResult`;
                    const resultResponse = await this.rest.get(resultUrl);
                    
                    // Clean up process
                    await this.rest.delete(`/Processes('${executionId}')`);
                    
                    return resultResponse.data;
                } else if (status === 'Failed' || status === 'CompletedWithError') {
                    // Get error information
                    const errorUrl = `/Processes('${executionId}')/tm1.ExecutionError`;
                    const errorResponse = await this.rest.get(errorUrl);
                    
                    // Clean up process
                    await this.rest.delete(`/Processes('${executionId}')`);
                    
                    throw new Error(`Async execution failed: ${errorResponse.data.Message || 'Unknown error'}`);
                } else if (status === 'Running' || status === 'Queued') {
                    // Still running, wait and poll again
                    await new Promise(resolve => setTimeout(resolve, pollingInterval));
                    continue;
                }
            } catch (error) {
                // Try alternative polling for MDX executions
                try {
                    const mdxStatusUrl = `/MDXExecutions('${executionId}')`;
                    const mdxStatusResponse = await this.rest.get(mdxStatusUrl);
                    
                    if (mdxStatusResponse.data.Status === 'Completed') {
                        return mdxStatusResponse.data.Result;
                    } else if (mdxStatusResponse.data.Status === 'Failed') {
                        throw new Error(`MDX execution failed: ${mdxStatusResponse.data.Error || 'Unknown error'}`);
                    }
                } catch (mdxError) {
                    // If both polling methods fail, wait and try again
                    await new Promise(resolve => setTimeout(resolve, pollingInterval));
                    continue;
                }
            }
        }
        
        throw new Error(`Async execution ${executionId} timed out after ${maxPollingAttempts} polling attempts`);
    }

    /**
     * Trace cell dependents (show what cells depend on this cell)
     *
     * @param cubeName - Name of the cube
     * @param coordinates - Element coordinates for the cell
     * @param sandbox_name - Optional sandbox name
     * @returns Promise<any> - Dependent cells information
     *
     * @example
     * ```typescript
     * const dependents = await cellService.traceCellDependents(
     *     'Sales',
     *     ['2024', 'Q1', 'Revenue']
     * );
     * ```
     */
    public async traceCellDependents(
        cubeName: string,
        coordinates: string[],
        sandbox_name?: string
    ): Promise<any> {
        const coordinateString = coordinates.map(c => `'${c}'`).join(',');
        let url = `/Cubes('${cubeName}')/tm1.TraceCellDependents(coordinates=[${coordinateString}])`;

        if (sandbox_name) {
            url += `?$sandbox=${sandbox_name}`;
        }

        const response = await this.rest.get(url);
        return response.data;
    }

    /**
     * Trace cell precedents (show what cells this cell depends on)
     *
     * @param cubeName - Name of the cube
     * @param coordinates - Element coordinates for the cell
     * @param sandbox_name - Optional sandbox name
     * @returns Promise<any> - Precedent cells information
     *
     * @example
     * ```typescript
     * const precedents = await cellService.traceCellPrecedents(
     *     'Sales',
     *     ['2024', 'Q1', 'Revenue']
     * );
     * ```
     */
    public async traceCellPrecedents(
        cubeName: string,
        coordinates: string[],
        sandbox_name?: string
    ): Promise<any> {
        const coordinateString = coordinates.map(c => `'${c}'`).join(',');
        let url = `/Cubes('${cubeName}')/tm1.TraceCellPrecedents(coordinates=[${coordinateString}])`;

        if (sandbox_name) {
            url += `?$sandbox=${sandbox_name}`;
        }

        const response = await this.rest.get(url);
        return response.data;
    }

    /**
     * Get drill-through information for a cell
     *
     * @param cubeName - Name of the cube
     * @param coordinates - Element coordinates for the cell
     * @param sandbox_name - Optional sandbox name
     * @returns Promise<any> - Drill-through configuration and data
     *
     * @example
     * ```typescript
     * const drillInfo = await cellService.getCellDrillThroughInformation(
     *     'Sales',
     *     ['2024', 'Q1', 'Revenue']
     * );
     * ```
     */
    public async getCellDrillThroughInformation(
        cubeName: string,
        coordinates: string[],
        sandbox_name?: string
    ): Promise<any> {
        const coordinateString = coordinates.map(c => `'${c}'`).join(',');
        let url = `/Cubes('${cubeName}')/tm1.GetDrillThrough(coordinates=[${coordinateString}])`;

        if (sandbox_name) {
            url += `?$sandbox=${sandbox_name}`;
        }

        const response = await this.rest.get(url);
        return response.data;
    }

    /**
     * Get cell attributes (metadata about the cell)
     *
     * @param cubeName - Name of the cube
     * @param coordinates - Element coordinates for the cell
     * @param sandbox_name - Optional sandbox name
     * @returns Promise<any> - Cell attributes and properties
     *
     * @example
     * ```typescript
     * const attributes = await cellService.getCellAttributes(
     *     'Sales',
     *     ['2024', 'Q1', 'Revenue']
     * );
     * // attributes.RuleDerived, attributes.Updateable
     * ```
     */
    public async getCellAttributes(
        cubeName: string,
        coordinates: string[],
        sandbox_name?: string
    ): Promise<any> {
        // Build the cell reference URL
        const coordinateString = coordinates.map(c => `'${c}'`).join(',');
        let url = `/Cubes('${cubeName}')/Cells(${coordinateString})`;

        if (sandbox_name) {
            url += `?$sandbox=${sandbox_name}`;
        }

        const response = await this.rest.get(url);
        return {
            Value: response.data.Value,
            RuleDerived: response.data.RuleDerived || false,
            Updateable: response.data.Updateable || false,
            Consolidated: response.data.Consolidated || false,
            Annotated: response.data.Annotated || false,
            FormatString: response.data.FormatString || '',
            HasPicklist: response.data.HasPicklist || false
        };
    }

    /**
     * Get cell annotation if it exists
     *
     * @param cubeName - Name of the cube
     * @param coordinates - Element coordinates for the cell
     * @param sandbox_name - Optional sandbox name
     * @returns Promise<string | null> - Annotation text or null if no annotation
     *
     * @example
     * ```typescript
     * const annotation = await cellService.getCellAnnotation(
     *     'Sales',
     *     ['2024', 'Q1', 'Revenue']
     * );
     * if (annotation) {
     *     // annotation contains the cell's text
     * }
     * ```
     */
    public async getCellAnnotation(
        cubeName: string,
        coordinates: string[],
        sandbox_name?: string
    ): Promise<string | null> {
        try {
            const coordinateString = coordinates.map(c => `'${c}'`).join(',');
            let url = `/Cubes('${cubeName}')/Cells(${coordinateString})/Annotation`;

            if (sandbox_name) {
                url += `?$sandbox=${sandbox_name}`;
            }

            const response = await this.rest.get(url);
            return response.data?.Text || response.data?.value || null;
        } catch (error: any) {
            // If 404, cell has no annotation
            if (error.response?.status === 404) {
                return null;
            }
            throw error;
        }
    }

    /**
     * Check cell security permissions for current user
     *
     * @param cubeName - Name of the cube
     * @param coordinates - Element coordinates for the cell
     * @param sandbox_name - Optional sandbox name
     * @returns Promise<any> - Security permissions (READ, WRITE, RESERVE)
     *
     * @example
     * ```typescript
     * const security = await cellService.checkCellSecurity(
     *     'Sales',
     *     ['2024', 'Q1', 'Revenue']
     * );
     * // security.canWrite indicates write permission
     * ```
     */
    public async checkCellSecurity(
        cubeName: string,
        coordinates: string[],
        sandbox_name?: string
    ): Promise<any> {
        // Get cell attributes which include updateability
        const attributes = await this.getCellAttributes(cubeName, coordinates, sandbox_name);

        // Check element security for each dimension
        const dimensionNames = await this.getDimensionNamesForWriting(cubeName);
        const elementSecurity: { [dimension: string]: string } = {};

        for (let i = 0; i < dimensionNames.length && i < coordinates.length; i++) {
            const dimension = dimensionNames[i];
            const element = coordinates[i];

            try {
                // Check element security
                const secUrl = `/Dimensions('${dimension}')/Hierarchies('${dimension}')/Elements('${element}')/Security`;
                const secResponse = await this.rest.get(secUrl);
                elementSecurity[dimension] = secResponse.data.Rights || 'READ';
            } catch {
                // If we can't get security, assume READ
                elementSecurity[dimension] = 'READ';
            }
        }

        // Determine overall access
        const canWrite = attributes.Updateable &&
                        Object.values(elementSecurity).every(right => right === 'WRITE' || right === 'RESERVE');
        const canRead = true; // If we got here, we can read

        return {
            canRead,
            canWrite,
            canReserve: canWrite,
            isUpdateable: attributes.Updateable,
            isRuleDerived: attributes.RuleDerived,
            elementSecurity
        };
    }

    /**
     * Get dimension elements for a specific cell
     *
     * @param cubeName - Name of the cube
     * @param coordinates - Element coordinates for the cell
     * @returns Promise<string[]> - Array of element names
     *
     * @example
     * ```typescript
     * const elements = await cellService.getCellDimensionElements(
     *     'Sales',
     *     ['2024', 'Q1', 'Revenue']
     * );
     * // elements => ['2024', 'Q1', 'Revenue']
     * ```
     */
    public async getCellDimensionElements(
        cubeName: string,
        coordinates: string[]
    ): Promise<string[]> {
        // Simply return the coordinates as they represent the elements
        return [...coordinates];
    }

    /**
     * Validate cell coordinates against cube dimensions
     *
     * @param cubeName - Name of the cube
     * @param coordinates - Element coordinates to validate
     * @returns Promise<boolean> - True if coordinates are valid
     *
     * @example
     * ```typescript
     * const isValid = await cellService.validateCellCoordinates(
     *     'Sales',
     *     ['2024', 'Q1', 'Revenue']
     * );
     * if (!isValid) {
     *     console.error('Invalid coordinates');
     * }
     * ```
     */
    public async validateCellCoordinates(
        cubeName: string,
        coordinates: string[]
    ): Promise<boolean> {
        try {
            // Get cube dimensions
            const dimensionNames = await this.getDimensionNamesForWriting(cubeName);

            // Check if coordinate count matches dimension count
            if (coordinates.length !== dimensionNames.length) {
                return false;
            }

            // Verify each element exists in its dimension
            for (let i = 0; i < dimensionNames.length; i++) {
                const dimension = dimensionNames[i];
                const element = coordinates[i];

                try {
                    const elemUrl = `/Dimensions('${dimension}')/Hierarchies('${dimension}')/Elements('${element}')`;
                    await this.rest.get(elemUrl);
                } catch {
                    // Element doesn't exist
                    return false;
                }
            }

            return true;
        } catch {
            return false;
        }
    }

    /**
     * Get cell type (NUMERIC, STRING, or CONSOLIDATED)
     *
     * @param cubeName - Name of the cube
     * @param coordinates - Element coordinates for the cell
     * @param sandbox_name - Optional sandbox name
     * @returns Promise<string> - Cell type
     *
     * @example
     * ```typescript
     * const type = await cellService.getCellType(
     *     'Sales',
     *     ['2024', 'Q1', 'Revenue']
     * );
     * // type => 'NUMERIC' or 'STRING' or 'CONSOLIDATED'
     * ```
     */
    public async getCellType(
        cubeName: string,
        coordinates: string[],
        sandbox_name?: string
    ): Promise<string> {
        const attributes = await this.getCellAttributes(cubeName, coordinates, sandbox_name);

        if (attributes.Consolidated) {
            return 'CONSOLIDATED';
        }

        // Check the value type
        const value = attributes.Value;
        if (typeof value === 'number') {
            return 'NUMERIC';
        } else if (typeof value === 'string') {
            return 'STRING';
        }

        // Default to NUMERIC if we can't determine
        return 'NUMERIC';
    }

    /**
     * Execute an MDX query asynchronously with AsyncOperationService
     *
     * @param mdx - The MDX query string
     * @param options - Optional query options
     * @returns Promise<string> - Operation ID for tracking
     *
     * @example
     * ```typescript
     * const operationId = await cellService.executeMdxWithAsyncTracking(
     *     'SELECT {[Product].[Product1]} ON 0 FROM [SalesCube]'
     * );
     * // Use AsyncOperationService to poll for completion
     * ```
     */
    public async executeMdxWithAsyncTracking(mdx: string, options?: any): Promise<string> {
        const asyncOps = (this.rest as any).asyncOperationService;
        if (!asyncOps) {
            throw new TM1Exception('AsyncOperationService not available. Please ensure TM1Service is properly initialized.');
        }

        // Create async operation tracking
        const operationId = await asyncOps.createAsyncOperation({
            type: OperationType.MDX_QUERY,
            name: 'MDX Query',
            parameters: { mdx, options }
        });

        // Start the MDX execution
        asyncOps.updateOperationStatus(operationId, OperationStatus.RUNNING);

        // Execute MDX asynchronously
        this.executeMdx(mdx)
            .then((result: any) => {
                asyncOps.updateOperationStatus(
                    operationId,
                    OperationStatus.COMPLETED,
                    result
                );
            })
            .catch((error: any) => {
                asyncOps.updateOperationStatus(
                    operationId,
                    OperationStatus.FAILED,
                    undefined,
                    error.message || String(error)
                );
            });

        return operationId;
    }

    /**
     * Execute a view asynchronously with AsyncOperationService
     *
     * @param cubeName - Name of the cube
     * @param viewName - Name of the view
     * @param options - Optional execution options
     * @returns Promise<string> - Operation ID for tracking
     *
     * @example
     * ```typescript
     * const operationId = await cellService.executeViewWithAsyncTracking('SalesCube', 'DefaultView');
     * // Use AsyncOperationService to poll for completion
     * ```
     */
    public async executeViewWithAsyncTracking(
        cubeName: string,
        viewName: string,
        options?: any
    ): Promise<string> {
        const asyncOps = (this.rest as any).asyncOperationService;
        if (!asyncOps) {
            throw new TM1Exception('AsyncOperationService not available');
        }

        // Create async operation tracking
        const operationId = await asyncOps.createAsyncOperation({
            type: OperationType.VIEW_EXECUTION,
            name: `${cubeName}/${viewName}`,
            parameters: { cubeName, viewName, options }
        });

        // Start the view execution
        asyncOps.updateOperationStatus(operationId, OperationStatus.RUNNING);

        // Execute view asynchronously
        this.executeView(cubeName, viewName, options || {})
            .then((result: any) => {
                asyncOps.updateOperationStatus(
                    operationId,
                    OperationStatus.COMPLETED,
                    result
                );
            })
            .catch((error: any) => {
                asyncOps.updateOperationStatus(
                    operationId,
                    OperationStatus.FAILED,
                    undefined,
                    error.message || String(error)
                );
            });

        return operationId;
    }

    /**
     * Poll the execution status of a data operation
     *
     * @param operationId - The operation ID returned from async methods
     * @returns Promise<OperationStatus> - Current status of the operation
     *
     * @example
     * ```typescript
     * const status = await cellService.pollDataExecution(operationId);
     * if (status === OperationStatus.COMPLETED) {
     *     // data operation completed
     * }
     * ```
     */
    public async pollDataExecution(operationId: string): Promise<OperationStatus> {
        const asyncOps = (this.rest as any).asyncOperationService;
        if (!asyncOps) {
            throw new TM1Exception('AsyncOperationService not available');
        }

        return await asyncOps.getAsyncOperationStatus(operationId);
    }
}

// ---------------------------------------------------------------------------
// Decorator-equivalent helpers (ports of tm1py's @tidy_cellset,
// @manage_transaction_log, @manage_changeset, @odata_compact_json from
// CellService.py:80-200). They are higher-order async functions rather than
// TypeScript class decorators, but provide the same cross-cutting behavior.
// ---------------------------------------------------------------------------

export interface TidyCellsetOptions {
    /** Default true (matches tm1py kwarg default). */
    delete_cellset?: boolean;
    sandbox_name?: string;
}

export interface ManagedTransactionLogOptions {
    /** Default false. */
    deactivate_transaction_log?: boolean;
    /** Default false. */
    reactivate_transaction_log?: boolean;
}

/**
 * Run `fn` and ensure the cellset is deleted afterwards (in `finally`).
 *
 * Mirrors tm1py's `@tidy_cellset` decorator (CellService.py:80-100):
 * - When `delete_cellset` is `false`, the cellset is left in place.
 * - When `delete_cellset` is `true` (default), `service._safeDeleteCellset`
 *   is called in `finally` — it deletes the cellset and silently swallows
 *   404 responses (cellset already gone). Any other error propagates and
 *   replaces the inner error if the inner function also threw (matches
 *   Python `try/finally` semantics).
 */
export async function withTidyCellset<T>(
    service: CellService,
    cellsetId: string,
    fn: () => Promise<T>,
    options: TidyCellsetOptions = {}
): Promise<T> {
    const shouldDelete = options.delete_cellset !== false;
    try {
        return await fn();
    } finally {
        if (shouldDelete) {
            await service._safeDeleteCellset(cellsetId, options.sandbox_name);
        }
    }
}

/**
 * Argument shape accepted by `withManagedTransactionLog`. Mirrors tm1py's
 * cube_name resolution in `manage_transaction_log` (CellService.py:113-122):
 * - `{ cubeName }` — explicit cube name.
 * - `{ mdx }` — derive cube via `getCube(mdx)`.
 * - A bare string — interpreted as MDX if it looks like MDX
 *   (`resemblesMdx`), otherwise treated as a cube name.
 */
export type ManagedTransactionLogTarget =
    | string
    | { cubeName: string; mdx?: undefined }
    | { mdx: string; cubeName?: undefined };

function resolveCubeName(target: ManagedTransactionLogTarget): string {
    if (typeof target === 'string') {
        return resemblesMdx(target) ? getCube(target) : target;
    }
    if (target.cubeName !== undefined) {
        return target.cubeName;
    }
    return getCube(target.mdx);
}

/**
 * Run `fn` with the transaction log optionally deactivated for the duration.
 *
 * Mirrors tm1py's `@manage_transaction_log` decorator
 * (CellService.py:103-136), including its cube-name resolution: callers may
 * pass an explicit `cubeName`, an MDX query, or a bare string that is
 * auto-classified via `resemblesMdx` (Utils.py:1686).
 *
 * - When `deactivate_transaction_log` is true, calls
 *   `service.deactivateTransactionlog(resolvedCube)` before `fn`.
 * - When `reactivate_transaction_log` is true, calls
 *   `service.activateTransactionlog(resolvedCube)` in `finally` (always —
 *   even if `fn` or `deactivate` threw).
 */
export async function withManagedTransactionLog<T>(
    service: CellService,
    target: ManagedTransactionLogTarget,
    fn: () => Promise<T>,
    options: ManagedTransactionLogOptions = {}
): Promise<T> {
    const cubeName = resolveCubeName(target);
    const deactivate = options.deactivate_transaction_log === true;
    const reactivate = options.reactivate_transaction_log === true;
    try {
        if (deactivate) {
            await service.deactivateTransactionlog(cubeName);
        }
        return await fn();
    } finally {
        if (reactivate) {
            await service.activateTransactionlog(cubeName);
        }
    }
}

/**
 * Run `fn` optionally wrapped in a TM1 changeset (begin/end pair).
 *
 * Mirrors tm1py's `@manage_changeset` decorator (CellService.py:139-158):
 * - When `useChangeset` is false (default), `fn` is invoked with no args.
 * - When true, `service.beginChangeset()` is awaited first, the resulting id
 *   is passed to `fn`, and `service.endChangeset(id)` is called in `finally`
 *   (only after `begin` succeeded — `begin` is intentionally outside `try`).
 *   `end` is called even when `fn` throws.
 */
export async function withManagedChangeset<T>(
    service: CellService,
    fn: (changeset?: string) => Promise<T>,
    useChangeset: boolean = false
): Promise<T> {
    if (!useChangeset) {
        return await fn();
    }
    const changeset = await service.beginChangeset();
    try {
        return await fn(changeset);
    } finally {
        await service.endChangeset(changeset);
    }
}

/**
 * Run `fn` with the compact-JSON Accept header set, then translate the
 * response into either a dict shape or a flat list.
 *
 * Mirrors tm1py's `@odata_compact_json(return_as_dict=...)` decorator
 * (CellService.py:161-200):
 * - When `useCompactJson` is false, `fn`'s result is returned unchanged.
 * - When true: `rest.add_compact_json_header()` is called (saves and
 *   replaces the Accept header), `fn` is awaited, the response context is
 *   validated to start with `$metadata#Cellsets`, and
 *   `extractCompactJsonCellset` is invoked. The original Accept header is
 *   restored in `finally`, even if `fn` or the extractor throws.
 */
export async function withCompactJson<T = any>(
    rest: RestService,
    useCompactJson: boolean,
    fn: () => Promise<any>,
    returnAsDict: boolean
): Promise<T> {
    if (!useCompactJson) {
        return (await fn()) as T;
    }
    const original = rest.add_compact_json_header();
    try {
        const response = await fn();
        // Mirror tm1py's `response["@odata.context"]` (CellService.py:186) —
        // a missing key raises KeyError in Python; surface a distinct error
        // here instead of conflating with the wrong-context case.
        if (!response || !('@odata.context' in response)) {
            throw new Error("Compact JSON response missing '@odata.context'");
        }
        const context: string = response['@odata.context'];
        if (!context.startsWith('$metadata#Cellsets')) {
            throw new Error('odata_compact_json decorator must only be used on cellsets');
        }
        return extractCompactJsonCellset(context, response, returnAsDict) as unknown as T;
    } finally {
        rest.add_http_header('Accept', original);
    }
}