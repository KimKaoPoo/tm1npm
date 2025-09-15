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
    private normalizeValue(value: string): string {
        return value.toLowerCase().replace(/\s+/g, '');
    }

    add(value: string): this {
        return super.add(this.normalizeValue(value));
    }

    has(value: string): boolean {
        return super.has(this.normalizeValue(value));
    }

    delete(value: string): boolean {
        return super.delete(this.normalizeValue(value));
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

export function requireVersion(minVersion: string): (target: any, propertyKey: string, descriptor: PropertyDescriptor) => void {
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

export function requireDataAdmin(target: any, propertyKey: string, descriptor: PropertyDescriptor): void {
    const originalMethod = descriptor.value;
    
    descriptor.value = function (this: any, ...args: any[]) {
        // Data admin check would be implemented here
        // For now, just call the original method
        return originalMethod.apply(this, args);
    };
}

export function requireSecurityAdmin(target: any, propertyKey: string, descriptor: PropertyDescriptor): void {
    const originalMethod = descriptor.value;
    
    descriptor.value = function (this: any, ...args: any[]) {
        // Security admin check would be implemented here
        // For now, just call the original method
        return originalMethod.apply(this, args);
    };
}

export function requireOpsAdmin(target: any, propertyKey: string, descriptor: PropertyDescriptor): void {
    const originalMethod = descriptor.value;
    
    descriptor.value = function (this: any, ...args: any[]) {
        // Ops admin check would be implemented here
        // For now, just call the original method
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

export function readObjectNameFromUrl(url: string): string {
    // Extract object name from URL like "/Dimensions('DimName')" -> "DimName"
    const match = url.match(/\('([^']+)'\)/);
    return match ? match[1] : '';
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