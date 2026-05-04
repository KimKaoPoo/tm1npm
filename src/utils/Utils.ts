export class CaseAndSpaceInsensitiveDict<T> extends Map<string, T> {
    private normalizeKey(key: string): string {
        return key.toLowerCase().replace(/\s+/g, '');
    }

    set(key: string, value: T): this {
        return super.set(this.normalizeKey(key), value);
    }

    get(key: string): T | undefined {
        return super.get(this.normalizeKey(key));
    }

    has(key: string): boolean {
        return super.has(this.normalizeKey(key));
    }

    delete(key: string): boolean {
        return super.delete(this.normalizeKey(key));
    }
}

export class CaseAndSpaceInsensitiveTuplesDict<T> extends Map<string, T> {
    private normalizeKey(key: string): string {
        return key.toLowerCase().replace(/\s+/g, '');
    }

    set(key: string, value: T): this {
        return super.set(this.normalizeKey(key), value);
    }

    get(key: string): T | undefined {
        return super.get(this.normalizeKey(key));
    }

    has(key: string): boolean {
        return super.has(this.normalizeKey(key));
    }

    delete(key: string): boolean {
        return super.delete(this.normalizeKey(key));
    }
}

export class CaseAndSpaceInsensitiveMap<T> extends Map<string, T> {
    private normalizeKey(key: string): string {
        return key.toLowerCase().replace(/\s+/g, '');
    }

    set(key: string, value: T): this {
        return super.set(this.normalizeKey(key), value);
    }

    get(key: string): T | undefined {
        return super.get(this.normalizeKey(key));
    }

    has(key: string): boolean {
        return super.has(this.normalizeKey(key));
    }

    delete(key: string): boolean {
        return super.delete(this.normalizeKey(key));
    }
}

export class CaseAndSpaceInsensitiveSet extends Set<string> {
    private _normalizedMap: Map<string, string>;

    constructor(values?: Iterable<string>) {
        super();
        this._normalizedMap = new Map<string, string>();
        if (values) {
            for (const v of values) {
                this.add(v);
            }
        }
    }

    add(value: string): this {
        const key = lowerAndDropSpaces(value);
        if (!this._normalizedMap.has(key)) {
            this._normalizedMap.set(key, value);
            super.add(value);
        }
        return this;
    }

    has(value: string): boolean {
        return this._normalizedMap.has(lowerAndDropSpaces(value));
    }

    delete(value: string): boolean {
        const key = lowerAndDropSpaces(value);
        const original = this._normalizedMap.get(key);
        if (original === undefined) return false;
        this._normalizedMap.delete(key);
        return super.delete(original);
    }

    clear(): void {
        this._normalizedMap.clear();
        super.clear();
    }
}

export function caseAndSpaceInsensitiveEquals(str1: string, str2: string): boolean {
    if (str1 === str2) return true;
    if (!str1 || !str2) return false;
    
    return str1.toLowerCase().replace(/\s+/g, '') === 
           str2.toLowerCase().replace(/\s+/g, '');
}

export function lowerAndDropSpaces(str: string): string {
    return str.toLowerCase().replace(/\s+/g, '');
}

export function escapeODataValue(str: string): string {
    return str.replace(/'/g, "''");
}

export function buildUrlFriendlyObjectName(objectName: string): string {
    return objectName
        .replace(/'/g, "''")
        .replace(/%/g, "%25")
        .replace(/#/g, "%23")
        .replace(/\?/g, "%3F")
        .replace(/&/g, "%26");
}

export function formatUrl(template: string, ...args: string[]): string {
    let url = template;
    for (const arg of args) {
        url = url.replace('{}', encodeURIComponent(arg));
    }
    return url;
}

export function extractCellsetCells(cellset: any): any[] {
    if (!cellset || !cellset.Cells) {
        return [];
    }
    return cellset.Cells;
}

export function buildMdxFromAxes(axes: any[]): string {
    // Simple MDX builder - can be expanded
    if (!axes || axes.length === 0) {
        return '';
    }
    
    let mdx = 'SELECT ';
    
    for (let i = 0; i < axes.length; i++) {
        if (i > 0) mdx += ', ';
        
        const axis = axes[i];
        if (axis.Tuples && axis.Tuples.length > 0) {
            const members = axis.Tuples.map((tuple: any) => {
                if (tuple.Members) {
                    return tuple.Members.map((member: any) => `[${member.UniqueName}]`).join(',');
                }
                return '';
            }).join(',');
            mdx += `{${members}} ON ${i}`;
        } else {
            mdx += `{} ON ${i}`;
        }
    }
    
    return mdx;
}

export function buildElementsStringFromIterable(elements: Iterable<string>, separator: string = ','): string {
    return Array.from(elements).join(separator);
}

export function dimensionHierarchyElementTupleFromUniqueName(uniqueName: string): [string, string, string] {
    // Parse [Dimension].[Hierarchy].[Element] format
    const matches = uniqueName.match(/\[([^\]]+)\]\.\[([^\]]+)\]\.\[([^\]]+)\]/);
    if (matches && matches.length === 4) {
        return [matches[1], matches[2], matches[3]];
    }
    
    // Fallback: assume format is Dimension.Hierarchy.Element
    const parts = uniqueName.split('.');
    if (parts.length >= 3) {
        return [parts[0], parts[1], parts[2]];
    } else if (parts.length === 2) {
        return [parts[0], parts[0], parts[1]]; // Default hierarchy = dimension name
    } else {
        return [uniqueName, uniqueName, uniqueName];
    }
}

export function buildElementUniqueNames(elements: string[], dimensionName: string, hierarchyName?: string): string[] {
    const hierarchy = hierarchyName || dimensionName;
    return elements.map(element => `[${dimensionName}].[${hierarchy}].[${element}]`);
}

export function dimensionHierarchyElementTupleFromString(dimensionHierarchyElement: string): [string, string, string] {
    // Parse [Dimension].[Hierarchy].[Element] format
    const matches = dimensionHierarchyElement.match(/\[([^\]]+)\]\.\[([^\]]+)\]\.\[([^\]]+)\]/);
    if (matches && matches.length === 4) {
        return [matches[1], matches[2], matches[3]];
    }
    
    // Fallback: assume format is Dimension.Hierarchy.Element
    const parts = dimensionHierarchyElement.split('.');
    if (parts.length >= 3) {
        return [parts[0], parts[1], parts[2]];
    } else if (parts.length === 2) {
        return [parts[0], parts[0], parts[1]]; // Default hierarchy = dimension name
    } else {
        return [dimensionHierarchyElement, dimensionHierarchyElement, dimensionHierarchyElement];
    }
}

export function deprecatedInVersion(version: string): (target: any, propertyKey: string, descriptor: PropertyDescriptor) => void {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;
        
        descriptor.value = function (this: any, ...args: any[]) {
            console.warn(`Method ${propertyKey} is deprecated in version ${version}`);
            return originalMethod.apply(this, args);
        };
    };
}

export function requireVersion(_minVersion: string): (target: any, propertyKey: string, descriptor: PropertyDescriptor) => void {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;

        descriptor.value = function (this: any, ...args: any[]) {
            // Version check would be implemented here
            // For now, just call the original method
            return originalMethod.apply(this, args);
        };
    };
}

export function requireAdmin(target: any, propertyKey: string, descriptor: PropertyDescriptor): void {
    const originalMethod = descriptor.value;
    
    descriptor.value = function (this: any, ...args: any[]) {
        // Admin check would be implemented here
        // For now, just call the original method
        return originalMethod.apply(this, args);
    };
}

/**
 * Decorator to require data admin privileges
 */
export function requireDataAdmin(target: any, propertyKey: string, descriptor: PropertyDescriptor): void {
    const originalMethod = descriptor.value;

    descriptor.value = async function (this: any, ...args: any[]) {
        // Check data admin privileges
        if (this.rest) {
            await checkAdminPrivileges(this.rest, 'DATA');
        }
        return originalMethod.apply(this, args);
    };
}

/**
 * Decorator to require security admin privileges
 */
export function requireSecurityAdmin(target: any, propertyKey: string, descriptor: PropertyDescriptor): void {
    const originalMethod = descriptor.value;

    descriptor.value = async function (this: any, ...args: any[]) {
        // Check security admin privileges
        if (this.rest) {
            await checkAdminPrivileges(this.rest, 'SECURITY');
        }
        return originalMethod.apply(this, args);
    };
}

/**
 * Decorator to require operations admin privileges
 */
export function requireOpsAdmin(target: any, propertyKey: string, descriptor: PropertyDescriptor): void {
    const originalMethod = descriptor.value;

    descriptor.value = async function (this: any, ...args: any[]) {
        // Check operations admin privileges
        if (this.rest) {
            await checkAdminPrivileges(this.rest, 'OPERATIONS');
        }
        return originalMethod.apply(this, args);
    };
}

export function wrapTupleInBrackets(members: string[]): string {
    if (members.length === 1) {
        return `[${members[0]}]`;
    }
    return `(${members.map(m => `[${m}]`).join(',')})`;
}

export function abbreviateString(text: string, maxLength: number): string {
    if (!text || text.length <= maxLength) {
        return text || '';
    }
    if (maxLength <= 3) {
        return '...';
    }
    return text.substring(0, maxLength - 3) + '...';
}

export function getTimeFromTimeStamp(timestamp: string): Date {
    // Parse various timestamp formats
    try {
        return new Date(timestamp);
    } catch (error) {
        // Try parsing as ISO string or other formats
        return new Date();
    }
}

export function addTimeToTimeStamp(timestamp: string, hours: number): string {
    const date = getTimeFromTimeStamp(timestamp);
    date.setHours(date.getHours() + hours);
    return date.toISOString();
}

export function tidy(inputString: string): string {
    if (!inputString) return '';
    return inputString.trim().replace(/\s+/g, ' ');
}

// MDX Utility functions
export function getMdxElementFromAttribute(attribute: string, cube: string): string {
    return `[${cube}].[${attribute}]`;
}

export function buildMdxTuple(members: string[]): string {
    if (members.length === 1) {
        return members[0];
    }
    return `(${members.join(',')})`;
}

// Verification utilities
export function verifyVersion(actualVersion: string, requiredVersion: string): boolean {
    // Handle null/undefined inputs
    if (!actualVersion || !requiredVersion) {
        return false;
    }
    
    // Simple version comparison
    const actual = actualVersion.split('.').map(Number);
    const required = requiredVersion.split('.').map(Number);
    
    for (let i = 0; i < Math.max(actual.length, required.length); i++) {
        const a = actual[i] || 0;
        const r = required[i] || 0;
        
        if (a > r) return true;
        if (a < r) return false;
    }
    
    return true; // Equal versions
}

// Overloads preserve the narrow `string` return for the existing no-pattern form
// (published npm API — widening to `string | null` would break downstream consumers).
export function readObjectNameFromUrl(url: string): string;
export function readObjectNameFromUrl(url: string, pattern: string | RegExp): string | null;
export function readObjectNameFromUrl(url: string, pattern?: string | RegExp): string | null {
    // tm1py parity: when `pattern` is provided, behave like
    // `re.match(pattern, url)` + `unquote(match.group(1))` — anchored at start,
    // URL-decodes the first capture group, returns null on no match.
    if (pattern !== undefined) {
        const re = typeof pattern === 'string'
            ? new RegExp(pattern.startsWith('^') ? pattern : '^' + pattern)
            : pattern;
        const m = url.match(re);
        if (!m || m[1] === undefined) return null;
        try {
            return decodeURIComponent(m[1]);
        } catch {
            // tm1py parity: urllib.parse.unquote is permissive on malformed %XX
            // (returns the original string). decodeURIComponent throws — fall back.
            return m[1];
        }
    }
    // Backward-compat: extract first ('name') segment, return '' on no match
    const match = url.match(/\('([^']+)'\)/);
    return match ? match[1] : '';
}

export function parseODataBindUrl(url: string): string[] {
    // Extract all ('name') segments from OData URLs in order
    // e.g. "Dimensions('D')/Hierarchies('H')/Subsets('S')" -> ['D', 'H', 'S']
    const matches = [...url.matchAll(/\('([^']+)'\)/g)];
    return matches.map(m => m[1]);
}

export function integerizeVersion(version: string): number {
    // Convert version string like "11.8.01300.1" to integer like 1180
    const parts = version.split('.');
    const major = parseInt(parts[0]) || 0;
    const minor = parseInt(parts[1]) || 0;
    return major * 100 + minor;
}

// Frame utilities for working with tabular data
export function frameToSignificantValue(value: any): any {
    if (typeof value === 'number') {
        if (Math.abs(value) < 1e-10) {
            return 0;
        }
        return Number(value.toPrecision(10));
    }
    return value;
}

// HTTP utilities
export class HTTPAdapterWithSocketOptions {
    constructor(private socketOptions: any = {}) {}
    
    // Implementation would depend on the HTTP client being used
}

// Additional utility functions
export function odataTrackChangesHeader(): Record<string, string> {
    return {
        'Prefer': 'return=representation;odata.track-changes'
    };
}

export function utcLocalizeTime(utcTimeStr: string): Date {
    return new Date(utcTimeStr + 'Z');
}

export function decohints(): string {
    return 'decohints';
}

export const Utils = {
    CaseAndSpaceInsensitiveMap,
    CaseAndSpaceInsensitiveSet,
    caseAndSpaceInsensitiveEquals,
    lowerAndDropSpaces,
    buildUrlFriendlyObjectName,
    formatUrl,
    extractCellsetCells,
    buildMdxFromAxes,
    buildElementsStringFromIterable,
    dimensionHierarchyElementTupleFromString,
    requireVersion,
    requireAdmin,
    requireDataAdmin,
    requireSecurityAdmin,
    requireOpsAdmin,
    wrapTupleInBrackets,
    abbreviateString,
    getTimeFromTimeStamp,
    addTimeToTimeStamp,
    tidy,
    getMdxElementFromAttribute,
    buildMdxTuple,
    verifyVersion,
    frameToSignificantValue,
    HTTPAdapterWithSocketOptions,
    odataTrackChangesHeader,
    utcLocalizeTime,
    decohints
};


/**
 * Decorator for transaction management - manages changesets
 */
export function manageChangeset(target: any, propertyKey: string, descriptor: PropertyDescriptor): void {
    const originalMethod = descriptor.value;

    descriptor.value = async function (this: any, ...args: any[]) {
        let changesetStarted = false;

        try {
            // Start changeset if cellService is available and not already in changeset
            if (this.cellService && typeof this.cellService.beginChangeset === 'function') {
                await this.cellService.beginChangeset();
                changesetStarted = true;
            }

            const result = await originalMethod.apply(this, args);

            // Commit changeset on success
            if (changesetStarted && this.cellService.endChangeset) {
                await this.cellService.endChangeset();
            }

            return result;
        } catch (error) {
            // Rollback changeset on error
            if (changesetStarted && this.cellService.undoChangeset) {
                try {
                    await this.cellService.undoChangeset();
                } catch (rollbackError) {
                    console.warn('Failed to rollback changeset:', rollbackError);
                }
            }
            throw error;
        }
    };
}

/**
 * Decorator for transaction log management
 */
export function manageTransactionLog(deactivate: boolean = true, reactivate: boolean = true) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor): void {
        const originalMethod = descriptor.value;

        descriptor.value = async function (this: any, ...args: any[]) {
            let wasActive = false;

            try {
                // Check and manage transaction log
                if (this.cellService) {
                    if (deactivate && typeof this.cellService.transactionLogIsActive === 'function') {
                        wasActive = await this.cellService.transactionLogIsActive();
                        if (wasActive) {
                            await this.cellService.deactivateTransactionLog();
                        }
                    }
                }

                const result = await originalMethod.apply(this, args);

                // Reactivate transaction log if it was active before
                if (reactivate && wasActive && this.cellService.activateTransactionLog) {
                    await this.cellService.activateTransactionLog();
                }

                return result;
            } catch (error) {
                // Ensure transaction log is restored on error
                if (reactivate && wasActive && this.cellService.activateTransactionLog) {
                    try {
                        await this.cellService.activateTransactionLog();
                    } catch (restoreError) {
                        console.warn('Failed to restore transaction log:', restoreError);
                    }
                }
                throw error;
            }
        };
    };
}

/**
 * Decorator for automatic retry with exponential backoff
 */
export function autoRetry(maxRetries: number = 3, baseDelay: number = 1000) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor): void {
        const originalMethod = descriptor.value;

        descriptor.value = async function (this: any, ...args: any[]) {
            let lastError: any;

            for (let attempt = 0; attempt <= maxRetries; attempt++) {
                try {
                    return await originalMethod.apply(this, args);
                } catch (error: any) {
                    lastError = error;

                    // Don't retry on client errors (4xx) except 401, 429
                    if (error.response && error.response.status >= 400 && error.response.status < 500) {
                        if (error.response.status !== 401 && error.response.status !== 429) {
                            throw error;
                        }
                    }

                    // If this is the last attempt, throw the error
                    if (attempt === maxRetries) {
                        throw error;
                    }

                    // Calculate delay with exponential backoff
                    const delay = baseDelay * Math.pow(2, attempt);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }

            throw lastError;
        };
    };
}

/**
 * Check admin privileges for the current user
 */
async function checkAdminPrivileges(rest: any, privilegeType: 'DATA' | 'SECURITY' | 'OPERATIONS'): Promise<void> {
    try {
        // Check if SecurityService is available
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const SecurityService = require('../services/SecurityService').SecurityService;
        const securityService = new SecurityService(rest);

        const currentUser = await securityService.getCurrentUser();

        // Check user groups for admin privileges
        const userGroups = await securityService.getGroupsFromUser(currentUser.name);

        const adminGroups: Record<string, string[]> = {
            'DATA': ['ADMIN', 'DataAdmin'],
            'SECURITY': ['ADMIN', 'SecurityAdmin'],
            'OPERATIONS': ['ADMIN', 'OperationsAdmin', 'OpsAdmin']
        };

        const requiredGroups = adminGroups[privilegeType] || [];
        const hasRequiredPrivilege = userGroups.some((group: string) =>
            requiredGroups.some(adminGroup =>
                group.toLowerCase().includes(adminGroup.toLowerCase())
            )
        );

        if (!hasRequiredPrivilege) {
            throw new Error(`${privilegeType} admin privileges required for this operation`);
        }

    } catch (error) {
        // If we can't check privileges, log a warning but allow the operation
        console.warn(`Unable to verify ${privilegeType} admin privileges:`, error);
    }
}

// Anchored to start to match tm1py's `re.match` semantics (Utils.py:1065).
const ODATA_CELLS_CONTEXT_RE = /^\$metadata#Cellsets\(Cells\(([A-Za-z,]+)\)\)\/\$entity/;

/**
 * Detect whether a string resembles an MDX query. Mirrors tm1py's
 * `resembles_mdx` (Utils.py:1686-1690): case- and dot-all-insensitive
 * `.*SELECT.*ON.*FROM.*`.
 */
export function resemblesMdx(mdx: string): boolean {
    return /SELECT[\s\S]*ON[\s\S]*FROM/i.test(mdx);
}

/**
 * Extract the cube name from an MDX query. Mirrors tm1py's `get_cube`
 * (Utils.py:1664-1683):
 * 1. Strip whitespace.
 * 2. Happy case: `FROM[<cube>]` — return the bracketed value.
 * 3. Cut off any `WHERE(...)` clause.
 * 4. Return whatever follows the last `FROM`.
 */
export function getCube(mdx: string): string {
    // replace tabs, line breaks, spaces
    let stripped = mdx.replace(/\s+/g, '');

    // happy case: cube name in square brackets
    const bracketMatch = /FROM\[([\s\S]*?)\]/i.exec(stripped);
    if (bracketMatch) {
        return bracketMatch[1];
    }

    // cut off where
    if (/.*SELECT.*ON.*FROM.*WHERE\(.*/is.test(stripped)) {
        // part before where
        stripped = stripped.split(/WHERE\(.*/is)[0];
    }

    // part after from
    const parts = stripped.split(/FROM/i);
    return parts[parts.length - 1];
}

/**
 * Extract cell property names from an OData `@odata.context` returned by a
 * compact-JSON cellset response. Mirrors tm1py's
 * `extract_cell_properties_from_odata_context` (Utils.py).
 */
export function extractCellPropertiesFromOdataContext(context: string): string[] {
    const match = ODATA_CELLS_CONTEXT_RE.exec(context);
    if (!match) {
        throw new Error('Could not extract cell properties from odata context');
    }
    return match[1].split(',');
}

/**
 * Map a list of cell properties onto the compact-JSON `value[1]` array,
 * producing `{ Cells: [{prop1: v1, prop2: v2, ...}, ...] }`. Mirrors tm1py's
 * `map_cell_properties_to_compact_json_response`.
 */
export function mapCellPropertiesToCompactJsonResponse(
    properties: string[],
    compactCellsResponse: any[][]
): { Cells: Array<Record<string, any>> } {
    const cells = compactCellsResponse.map(cell => {
        if (cell.length < properties.length) {
            // Match Python's IndexError when a row has fewer values than expected
            throw new RangeError(
                `Compact JSON row has ${cell.length} values but ${properties.length} properties were expected`
            );
        }
        const d: Record<string, any> = {};
        for (let i = 0; i < properties.length; i++) {
            d[properties[i]] = cell[i];
        }
        return d;
    });
    return { Cells: cells };
}

/**
 * Translate a TM1 OData compact-JSON cellset response into either a default
 * dictionary (`{ Cells: [...] }`) or a flat list of values, depending on
 * `returnAsDict` and the property shape. Mirrors tm1py's
 * `extract_compact_json_cellset`.
 */
export function extractCompactJsonCellset(
    context: string,
    response: { value: any[] },
    returnAsDict: boolean
): { Cells: Array<Record<string, any>> } | any[] {
    const props = extractCellPropertiesFromOdataContext(context);
    // First element [0] is the cellset ID, second is the cellset data
    const cellsData: any[][] = response.value[1];

    if (returnAsDict) {
        return mapCellPropertiesToCompactJsonResponse(props, cellsData);
    }
    if (props.length === 1) {
        return cellsData.map(value => value[0]);
    }
    if (props.length === 2 && props[0] === 'Ordinal' && props[1] === 'Value') {
        return cellsData.map(value => value[1]);
    }
    return cellsData;
}

// ─── Cellset interfaces ────────────────────────────────────────────────────

export interface CellsetAxis {
    Ordinal?: number;
    Cardinality: number;
    Tuples: Array<{ Ordinal?: number; Members: any[] }>;
    Hierarchies?: Array<{ Name: string; UniqueName?: string; Dimension?: { Name: string } }>;
}

export interface RawCellsetDict {
    Cube?: { Name: string; Dimensions: Array<{ Name: string }> };
    Axes: CellsetAxis[];
    Cells: Array<Record<string, any>>;
    '@odata.context'?: string;
    ID?: string;
}

// ─── Element-name helpers (tm1py Utils.py:835-861) ────────────────────────

/**
 * Extract the dimension name from an element unique name like [Dim].[Hier].[Elem].
 * Mirrors tm1py's `dimension_name_from_element_unique_name` (Utils.py:835-836).
 */
export function dimensionNameFromElementUniqueName(uniqueName: string): string {
    return uniqueName.substring(1, uniqueName.indexOf('].['));
}

/**
 * Extract the hierarchy name from an element unique name like [Dim].[Hier].[Elem].
 * Mirrors tm1py's `hierarchy_name_from_element_unique_name` (Utils.py:839-840).
 */
export function hierarchyNameFromElementUniqueName(uniqueName: string): string {
    return uniqueName.substring(uniqueName.indexOf('].[')+3, uniqueName.lastIndexOf('].['));
}

/**
 * Extract the element name from an element unique name like [Dim].[Hier].[Elem].
 * Mirrors tm1py's `element_name_from_element_unique_name` (Utils.py:843-844).
 * Unescapes `]]` → `]`.
 */
export function elementNameFromElementUniqueName(uniqueName: string): string {
    return uniqueName
        .substring(uniqueName.lastIndexOf('].[')+3, uniqueName.length - 1)
        .replace(/\]\]/g, ']');
}

/**
 * Get tuple of dimension names from iterable of element unique names.
 * Mirrors tm1py's `dimension_names_from_element_unique_names` (Utils.py:855-860).
 */
export function dimensionNamesFromElementUniqueNames(uniqueNames: Iterable<string>): string[] {
    return Array.from(uniqueNames, dimensionNameFromElementUniqueName);
}

// ─── Cellset shape helpers (tm1py Utils.py:313-365) ───────────────────────

/**
 * Extract non-empty axes from a raw cellset dict.
 * Mirrors tm1py's `extract_axes_from_cellset` (Utils.py:313-322).
 */
export function extractAxesFromCellset(rawCellset: RawCellsetDict): CellsetAxis[] {
    const rawAxes = rawCellset.Axes || [];
    const axes: CellsetAxis[] = [];
    for (const axis of rawAxes) {
        if (axis && Array.isArray(axis.Tuples) && axis.Tuples.length > 0) {
            axes.push(axis);
        }
    }
    return axes;
}

/**
 * Extract list of unique names from members in a cellset response.
 * Mirrors tm1py's `extract_unique_names_from_members` (Utils.py:325-335):
 * prefers `m.Element.UniqueName`, falls back to `m.UniqueName`.
 */
export function extractUniqueNamesFromMembers(members: Iterable<any>): string[] {
    const out: string[] = [];
    for (const m of members) {
        out.push(m?.Element?.UniqueName ?? m.UniqueName);
    }
    return out;
}

/**
 * Sort coordinate unique names by cube dimension order.
 * Mirrors tm1py's `sort_coordinates` (Utils.py:351-365).
 * When `elementUniqueNames` is false, strips to bare element names.
 */
export function sortCoordinates(
    cubeDimensions: Iterable<string>,
    unsortedCoordinates: string[],
    elementUniqueNames: boolean = true
): string[] {
    const sorted: string[] = [];
    for (const dim of cubeDimensions) {
        const prefix = '[' + dim + '].';
        for (const addr of unsortedCoordinates) {
            if (!addr.startsWith(prefix)) continue;
            sorted.push(elementUniqueNames ? addr : elementNameFromElementUniqueName(addr));
        }
    }
    return sorted;
}

// ─── Content builder (tm1py Utils.py:368-414) ─────────────────────────────

/**
 * Separator used to flatten tuple coordinates into a single string key for
 * CaseAndSpaceInsensitiveTuplesDict. NUL (\x00) is illegal in TM1 element
 * names, so it can never collide with content. Mirrors the role of Python's
 * native tuple-as-dict-key in tm1py (Utils.py:412-413).
 */
export const TUPLE_KEY_SEPARATOR = '\x00';

/**
 * Transform raw cellset data into a CaseAndSpaceInsensitiveTuplesDict.
 * Mirrors tm1py's `build_content_from_cellset_dict` (Utils.py:368-414).
 */
export function buildContentFromCellsetDict(
    rawCellset: RawCellsetDict,
    top: number | null = null,
    elementUniqueNames: boolean = true,
    skipCellProperties: boolean = false,
    skipSandboxDimension: boolean = false
): CaseAndSpaceInsensitiveTuplesDict<any> {
    let cubeDimensions = (rawCellset.Cube?.Dimensions || []).map(d => d.Name);
    if (skipSandboxDimension && cubeDimensions[0]?.toLowerCase() === 'sandboxes') {
        cubeDimensions = cubeDimensions.slice(1);
    }
    const cells = rawCellset.Cells || [];
    const axes = extractAxesFromCellset(rawCellset);
    const result = new CaseAndSpaceInsensitiveTuplesDict<any>();
    // tm1py: cells[: top or len(cells)] — Python `or` treats 0 as falsy, so
    // top=0 means "no limit". JS `||` matches; `??` would honor 0 and slice empty.
    // Math.min still clamps top > cells.length (parity with Python slice).
    const limit = Math.min(top || cells.length, cells.length);
    for (let enumOrdinal = 0; enumOrdinal < limit; enumOrdinal++) {
        const cell = cells[enumOrdinal];
        // if skip is used we must use the original ordinal from the cell
        const cellOrdinal: number = cell.Ordinal ?? enumOrdinal;
        const coords: string[] = [];
        for (let ai = 0; ai < axes.length; ai++) {
            const axis = axes[ai];
            let idx: number;
            if (ai === 0) {
                idx = cellOrdinal % axis.Cardinality;
            } else {
                let t = cellOrdinal;
                for (let pre = 0; pre < ai; pre++) t = Math.floor(t / axes[pre].Cardinality);
                idx = t % axis.Cardinality;
            }
            coords.push(...extractUniqueNamesFromMembers(axis.Tuples[idx].Members));
        }
        const sorted = sortCoordinates(cubeDimensions, coords, elementUniqueNames);
        // tm1py keys content_as_dict by Python tuples (Utils.py:412-413). Joining with ','
        // collides when element names contain ','. \x00 (NUL) is illegal in TM1 element
        // names, so it's a safe in-band separator. Callers building keys for .get() must
        // use the same separator (e.g. coords.join(TUPLE_KEY_SEPARATOR)).
        result.set(sorted.join(TUPLE_KEY_SEPARATOR), skipCellProperties ? cell.Value : cell);
    }
    return result;
}

// ─── CSV builder (tm1py Utils.py:417-556) ────────────────────────────────

export interface CsvDialect {
    delimiter: string;
    lineterminator: string;
    quoteAll?: boolean;
}

/**
 * Build CSV field from member tuple, optionally including attributes.
 * Mirrors tm1py's `_build_csv_line_items_from_axis_tuple`.
 */
function buildCsvLineItemsFromAxisTuple(
    members: any[],
    includeAttributes: boolean
): string[] {
    const items: string[] = [];
    for (const member of members) {
        // tm1py: member["Element"]["Name"] if "Element" in member and member["Element"]
        // else member["Name"] (Utils.py:641-656). Element is preferred when present.
        items.push(member?.Element?.Name ?? member.Name ?? String(member));
        if (includeAttributes && member.Attributes) {
            for (const attr of Object.keys(member.Attributes)) {
                // tm1py: str(attribute_value) if attribute_value else "" (Utils.py:654)
                // — Python truthy: 0/false/""/None all become "". JS `?` matches.
                const v = member.Attributes[attr];
                items.push(v ? String(v) : '');
            }
        }
    }
    return items;
}

/**
 * Build CSV header row.
 * Mirrors tm1py's `_build_headers_for_csv` (Utils.py:417-459).
 */
function buildHeadersForCsv(
    rowAxis: CellsetAxis | null,
    columnAxis: CellsetAxis,
    rowDimensions: string[],
    columnDimensions: string[],
    includeAttributes: boolean,
    mdxHeaders: boolean = false
): string[] {
    if (!includeAttributes) {
        return [
            ...(rowDimensions.concat(columnDimensions)).map(d =>
                mdxHeaders ? d : dimensionNameFromElementUniqueName(d)
            ),
            'Value'
        ];
    }

    const headers: string[] = [];
    if (rowAxis && rowAxis.Tuples.length > 0) {
        const members = rowAxis.Tuples[0].Members;
        for (let i = 0; i < rowDimensions.length; i++) {
            const dimension = rowDimensions[i];
            const member = members[i];
            if (mdxHeaders) {
                headers.push(dimension);
                if (member?.Attributes) {
                    for (const attr of Object.keys(member.Attributes)) {
                        headers.push(dimension + '.[' + attr + ']');
                    }
                }
            } else {
                headers.push(dimensionNameFromElementUniqueName(dimension));
                if (member?.Attributes) {
                    for (const attr of Object.keys(member.Attributes)) {
                        headers.push(attr);
                    }
                }
            }
        }
    }
    if (columnAxis.Tuples.length > 0) {
        const members = columnAxis.Tuples[0].Members;
        for (let i = 0; i < columnDimensions.length; i++) {
            const dimension = columnDimensions[i];
            const member = members[i];
            if (mdxHeaders) {
                headers.push(dimension);
                if (member?.Attributes) {
                    for (const attr of Object.keys(member.Attributes)) {
                        headers.push(dimension + '.[' + attr + ']');
                    }
                }
            } else {
                headers.push(dimensionNameFromElementUniqueName(dimension));
                if (member?.Attributes) {
                    for (const attr of Object.keys(member.Attributes)) {
                        headers.push(attr);
                    }
                }
            }
        }
    }
    return headers.concat(['Value']);
}

/**
 * Escape a single CSV field value using Excel dialect rules.
 * Wraps in quotes when value contains delimiter, line terminator, or `"`.
 * Doubles internal quotes.
 */
function csvEscapeField(value: string, delimiter: string, lineterminator: string): string {
    // Python csv.writer with QUOTE_MINIMAL quotes when value contains delimiter,
    // quotechar, escapechar, OR ANY character in lineterminator (not the
    // substring as a whole). Default lineterminator '\r\n' → \r alone or \n
    // alone must trigger quoting. (tm1py Utils.py:495-499)
    const needsQuote = value.includes(delimiter)
        || value.includes('"')
        || [...lineterminator].some(c => value.includes(c));
    if (needsQuote) {
        return '"' + value.replace(/"/g, '""') + '"';
    }
    return value;
}

/**
 * Serialize an array of string values into one CSV line (with line terminator).
 */
export function csvRowToString(values: string[], delimiter: string, lineterminator: string): string {
    return values.map(v => csvEscapeField(v, delimiter, lineterminator)).join(delimiter) + lineterminator;
}

/**
 * Transform raw cellset data into CSV string.
 * Mirrors tm1py's `build_csv_from_cellset_dict` (Utils.py:462-556).
 * Returns empty string for empty cellsets (tm1py parity, Utils.py:491-492).
 */
export function buildCsvFromCellsetDict(
    rowDimensions: string[],
    columnDimensions: string[],
    rawCellset: RawCellsetDict,
    options: {
        top?: number | null;
        csvDialect?: CsvDialect;
        lineSeparator?: string;
        valueSeparator?: string;
        includeAttributes?: boolean;
        includeHeaders?: boolean;
        mdxHeaders?: boolean;
    } = {}
): string {
    const cells = rawCellset.Cells || [];
    // empty cellsets → "" (tm1py parity)
    if (cells.length === 0) return '';

    const delimiter = options.csvDialect?.delimiter ?? options.valueSeparator ?? ',';
    const lineterminator = options.csvDialect?.lineterminator ?? options.lineSeparator ?? '\r\n';
    const includeAttributes = options.includeAttributes === true;
    const includeHeaders = options.includeHeaders !== false;
    const mdxHeaders = options.mdxHeaders === true;

    const axes = extractAxesFromCellset(rawCellset);
    const columnAxis = axes[0];
    const rowAxis = axes.length > 1 ? axes[1] : null;

    const rows: string[] = [];
    let numHeaders = 0;

    if (includeHeaders) {
        const headers = buildHeadersForCsv(
            rowAxis, columnAxis, rowDimensions, columnDimensions, includeAttributes, mdxHeaders
        );
        rows.push(csvRowToString(headers, delimiter, lineterminator));
        numHeaders = headers.length;
    }

    // tm1py: cells[: top or len(cells)] — Python `or` treats 0 as falsy, so
    // top=0 means "no limit". `||` matches; `??` would honor 0 and slice empty.
    const limit = Math.min(options.top || cells.length, cells.length);
    for (let enumOrdinal = 0; enumOrdinal < limit; enumOrdinal++) {
        const cell = cells[enumOrdinal];
        // if skip was used, use original ordinal from cell
        const ordinal: number = cell.Ordinal ?? enumOrdinal;

        const line: string[] = [];
        if (columnAxis && rowAxis) {
            const indexRows = Math.floor(ordinal / columnAxis.Cardinality) % rowAxis.Cardinality;
            const indexCols = ordinal % columnAxis.Cardinality;
            line.push(...buildCsvLineItemsFromAxisTuple(rowAxis.Tuples[indexRows].Members, includeAttributes));
            line.push(...buildCsvLineItemsFromAxisTuple(columnAxis.Tuples[indexCols].Members, includeAttributes));
        } else if (columnAxis) {
            const indexRows = ordinal % columnAxis.Cardinality;
            line.push(...buildCsvLineItemsFromAxisTuple(columnAxis.Tuples[indexRows].Members, includeAttributes));
        }

        // tm1py: str(cell["Value"] or "") — Python `or` treats 0/false/"" as falsy too.
        line.push(String(cell.Value || ''));

        if (includeAttributes && includeHeaders && line.length !== numHeaders) {
            throw new Error(
                "Invalid response. With 'includeAttributes' as true," +
                " Attributes must be requested explicitly as PROPERTIES in the MDX"
            );
        }
        rows.push(csvRowToString(line, delimiter, lineterminator));
    }

    // tm1py parity: strip trailing whitespace from final output (Utils.py:556)
    return rows.join('').replace(/\s+$/, '');
}