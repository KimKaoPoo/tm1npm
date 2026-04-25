/**
 * Object Model Parity Tests — Issue #35
 * Verifies fixes for 7 critical bugs found during tm1py v2.2.4 parity review.
 */

import { ViewAxisSelection, ViewTitleSelection } from '../objects/Axis';
import { AnonymousSubset, Subset } from '../objects/Subset';
import { NativeView } from '../objects/NativeView';
import { MDXView } from '../objects/MDXView';
import { Hierarchy } from '../objects/Hierarchy';
import { Element, ElementType } from '../objects/Element';
import { ElementAttribute, ElementAttributeType } from '../objects/ElementAttribute';

// ---------------------------------------------------------------------------
// Bug 1 & 2 (Axis.ts): ViewAxisSelection.fromDict and ViewTitleSelection.fromDict
// ---------------------------------------------------------------------------

describe('ViewAxisSelection.fromDict', () => {
    test('parses anonymous subset with Subset key (expression)', () => {
        const dict = {
            Subset: {
                'Hierarchy@odata.bind': "Dimensions('Region')/Hierarchies('Region')",
                Expression: '{[Region].[Region].Members}'
            }
        };
        const sel = ViewAxisSelection.fromDict(dict);
        expect(sel.dimensionName).toBe('Region');
        expect(sel.subset).toBeInstanceOf(AnonymousSubset);
        const anon = sel.subset as AnonymousSubset;
        expect(anon.expression).toBe('{[Region].[Region].Members}');
    });

    test('parses anonymous subset with Subset key (static elements)', () => {
        const dict = {
            Subset: {
                'Hierarchy@odata.bind': "Dimensions('Month')/Hierarchies('Month')",
                Elements: [{ Name: 'Jan' }, { Name: 'Feb' }]
            }
        };
        const sel = ViewAxisSelection.fromDict(dict);
        expect(sel.dimensionName).toBe('Month');
        const anon = sel.subset as AnonymousSubset;
        expect(anon.elements).toEqual(['Jan', 'Feb']);
    });

    test('parses registered subset with Subset@odata.bind key', () => {
        const dict = {
            'Subset@odata.bind': "Dimensions('Product')/Hierarchies('Product')/Subsets('AllProducts')"
        };
        const sel = ViewAxisSelection.fromDict(dict);
        expect(sel.dimensionName).toBe('Product');
        expect(sel.subset).toBeInstanceOf(Subset);
        expect(sel.subset.name).toBe('AllProducts');
        expect((sel.subset as Subset).hierarchyName).toBe('Product');
    });

    test('throws when neither Subset nor Subset@odata.bind present', () => {
        expect(() => ViewAxisSelection.fromDict({})).toThrow();
    });

    test('registered subset preserves non-default hierarchy name in constructBody', () => {
        const dict = {
            'Subset@odata.bind': "Dimensions('Product')/Hierarchies('Product_Alt')/Subsets('MySubset')"
        };
        const sel = ViewAxisSelection.fromDict(dict);
        expect(sel.dimensionName).toBe('Product');
        expect((sel.subset as Subset).hierarchyName).toBe('Product_Alt');
        // constructBody must use the actual hierarchy name
        const body = sel.bodyAsDict;
        expect(body['Subset@odata.bind']).toContain("Hierarchies('Product_Alt')");
    });
});

describe('ViewTitleSelection.fromDict', () => {
    test('parses anonymous subset with Selected@odata.bind', () => {
        const dict = {
            Subset: {
                'Hierarchy@odata.bind': "Dimensions('Region')/Hierarchies('Region')",
                Elements: [{ Name: 'North' }, { Name: 'South' }]
            },
            'Selected@odata.bind': "Dimensions('Region')/Hierarchies('Region')/Elements('North')"
        };
        const sel = ViewTitleSelection.fromDict(dict);
        expect(sel.dimensionName).toBe('Region');
        expect(sel.selected).toBe('North');
    });

    test('parses anonymous subset with Selected.Name (expanded)', () => {
        const dict = {
            Subset: {
                'Hierarchy@odata.bind': "Dimensions('Year')/Hierarchies('Year')",
                Elements: [{ Name: '2024' }]
            },
            Selected: { Name: '2024' }
        };
        const sel = ViewTitleSelection.fromDict(dict);
        expect(sel.selected).toBe('2024');
    });

    test('parses registered subset title', () => {
        const dict = {
            'Subset@odata.bind': "Dimensions('Scenario')/Hierarchies('Scenario')/Subsets('ActualOnly')",
            'Selected@odata.bind': "Dimensions('Scenario')/Hierarchies('Scenario')/Elements('Actual')"
        };
        const sel = ViewTitleSelection.fromDict(dict);
        expect(sel.dimensionName).toBe('Scenario');
        expect(sel.subset).toBeInstanceOf(Subset);
        expect(sel.subset.name).toBe('ActualOnly');
        expect(sel.selected).toBe('Actual');
    });

    test('selected setter updates value', () => {
        const subset = new AnonymousSubset('Region', 'Region', undefined, ['North']);
        const sel = new ViewTitleSelection('Region', subset, 'North');
        sel.selected = 'South';
        expect(sel.selected).toBe('South');
    });
});

// ---------------------------------------------------------------------------
// Bug 2 (NativeView.ts): NativeView.asMDX format
// ---------------------------------------------------------------------------

describe('NativeView.asMDX', () => {
    test('uses ON 0 and ON 1 instead of ON COLUMNS / ON ROWS', () => {
        const colSubset = new AnonymousSubset('Month', 'Month', undefined, ['Jan', 'Feb']);
        const rowSubset = new AnonymousSubset('Region', 'Region', undefined, ['North']);
        const view = new NativeView('SalesCube', 'TestView');
        view.addColumn(new ViewAxisSelection('Month', colSubset));
        view.addRow(new ViewAxisSelection('Region', rowSubset));
        const mdx = view.asMDX;
        expect(mdx).toContain('ON 0');
        expect(mdx).toContain('ON 1');
        expect(mdx).not.toContain('ON COLUMNS');
        expect(mdx).not.toContain('ON ROWS');
    });

    test('wraps axis sets in curly braces', () => {
        const colSubset = new AnonymousSubset('Month', 'Month', undefined, ['Jan']);
        const view = new NativeView('Cube', 'View');
        view.addColumn(new ViewAxisSelection('Month', colSubset));
        const mdx = view.asMDX;
        // Should have { ... } DIMENSION PROPERTIES MEMBER_NAME ON 0
        expect(mdx).toMatch(/\{.*\} DIMENSION PROPERTIES MEMBER_NAME ON 0/);
    });

    test('uses TM1SubsetToSet with hierarchy argument', () => {
        const subset = new Subset('AllProducts', 'Product', 'Product');
        const view = new NativeView('Cube', 'View');
        view.addColumn(new ViewAxisSelection('Product', subset));
        const mdx = view.asMDX;
        expect(mdx).toContain('TM1SubsetToSet([Product].[Product], "AllProducts")');
        expect(mdx).not.toMatch(/TM1SubsetToSet\(\[Product\], /);
    });

    test('includes DIMENSION PROPERTIES MEMBER_NAME', () => {
        const subset = new AnonymousSubset('Month', 'Month', undefined, ['Jan']);
        const view = new NativeView('Cube', 'View');
        view.addColumn(new ViewAxisSelection('Month', subset));
        expect(view.asMDX).toContain('DIMENSION PROPERTIES MEMBER_NAME');
    });

    test('WHERE clause uses triple-bracket format [dim].[hier].[element]', () => {
        const colSubset = new AnonymousSubset('Month', 'Month', undefined, ['Jan']);
        const titleSubset = new AnonymousSubset('Region', 'Region', undefined, ['North']);
        const view = new NativeView('Cube', 'View');
        view.addColumn(new ViewAxisSelection('Month', colSubset));
        view.addTitle(new ViewTitleSelection('Region', titleSubset, 'North'));
        const mdx = view.asMDX;
        expect(mdx).toContain('WHERE ([Region].[Region].[North])');
    });

    test('NON EMPTY prefix applied when suppress flags set', () => {
        const colSubset = new AnonymousSubset('Month', 'Month', undefined, ['Jan']);
        const view = new NativeView('Cube', 'View', true, true);
        view.addColumn(new ViewAxisSelection('Month', colSubset));
        expect(view.asMDX).toContain('NON EMPTY');
    });

    test('throws when columns are empty', () => {
        const view = new NativeView('Cube', 'View');
        expect(() => view.asMDX).toThrow('Column selection must not be empty');
    });

    test('uses expression verbatim for anonymous subset with expression', () => {
        const subset = new AnonymousSubset('Region', 'Region', '{[Region].[Region].Members}');
        const view = new NativeView('Cube', 'View');
        view.addColumn(new ViewAxisSelection('Region', subset));
        const mdx = view.asMDX;
        expect(mdx).toContain('{[Region].[Region].Members}');
    });
});

// ---------------------------------------------------------------------------
// Bug 3 (NativeView.ts): substituteTitle and suppressEmptyCells
// ---------------------------------------------------------------------------

describe('NativeView.substituteTitle', () => {
    test('updates the selected element for a title dimension', () => {
        const subset = new AnonymousSubset('Region', 'Region', undefined, ['North', 'South']);
        const view = new NativeView('Cube', 'View');
        view.addTitle(new ViewTitleSelection('Region', subset, 'North'));
        view.substituteTitle('Region', 'South');
        expect(view.titles[0].selected).toBe('South');
    });

    test('is case and space insensitive for dimension name lookup', () => {
        const subset = new AnonymousSubset('Region', 'Region', undefined, ['North']);
        const view = new NativeView('Cube', 'View');
        view.addTitle(new ViewTitleSelection('Region', subset, 'North'));
        view.substituteTitle(' region ', 'South');
        expect(view.titles[0].selected).toBe('South');
    });

    test('throws when dimension not found in titles', () => {
        const view = new NativeView('Cube', 'View');
        expect(() => view.substituteTitle('NonExistent', 'Value')).toThrow();
    });
});

describe('NativeView.suppressEmptyCells', () => {
    test('getter returns true only when both column and row suppress are true', () => {
        expect(new NativeView('C', 'V', true, true).suppressEmptyCells).toBe(true);
        expect(new NativeView('C', 'V', true, false).suppressEmptyCells).toBe(false);
        expect(new NativeView('C', 'V', false, true).suppressEmptyCells).toBe(false);
        expect(new NativeView('C', 'V', false, false).suppressEmptyCells).toBe(false);
    });

    test('setter sets both suppressEmptyColumns and suppressEmptyRows', () => {
        const view = new NativeView('C', 'V');
        view.suppressEmptyCells = true;
        expect(view.suppressEmptyColumns).toBe(true);
        expect(view.suppressEmptyRows).toBe(true);
        view.suppressEmptyCells = false;
        expect(view.suppressEmptyColumns).toBe(false);
        expect(view.suppressEmptyRows).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// NativeView.fromDict round-trip
// ---------------------------------------------------------------------------

describe('NativeView.fromDict', () => {
    test('reconstructs a NativeView with registered subsets and titles from API dict', () => {
        const dict = {
            Name: 'TestView',
            SuppressEmptyColumns: true,
            SuppressEmptyRows: false,
            FormatString: '0.##',
            Titles: [
                {
                    'Subset@odata.bind': "Dimensions('Scenario')/Hierarchies('Scenario')/Subsets('All')",
                    'Selected@odata.bind': "Dimensions('Scenario')/Hierarchies('Scenario')/Elements('Actual')"
                }
            ],
            Columns: [
                {
                    'Subset@odata.bind': "Dimensions('Month')/Hierarchies('Month')/Subsets('AllMonths')"
                }
            ],
            Rows: [
                {
                    Subset: {
                        'Hierarchy@odata.bind': "Dimensions('Region')/Hierarchies('Region')",
                        Elements: [{ Name: 'North' }, { Name: 'South' }]
                    }
                }
            ]
        };
        const view = NativeView.fromDict(dict, 'SalesCube');
        expect(view.name).toBe('TestView');
        expect(view.cube).toBe('SalesCube');
        expect(view.suppressEmptyColumns).toBe(true);
        expect(view.suppressEmptyRows).toBe(false);
        expect(view.titles).toHaveLength(1);
        expect(view.titles[0].selected).toBe('Actual');
        expect(view.columns).toHaveLength(1);
        expect(view.columns[0].subset.name).toBe('AllMonths');
        expect(view.rows).toHaveLength(1);
        const rowSubset = view.rows[0].subset as AnonymousSubset;
        expect(rowSubset.elements).toEqual(['North', 'South']);
    });
});

// ---------------------------------------------------------------------------
// Bug 4 & 5 (Hierarchy.ts): Edge key type + traversal methods
// ---------------------------------------------------------------------------

describe('Hierarchy edges (Map<string, Map<string, number>>)', () => {
    test('addEdge stores in nested map structure', () => {
        const h = new Hierarchy('H', 'D');
        h.addEdge('Total', 'North', 1);
        h.addEdge('Total', 'South', 1);
        const children = h.edges.get('Total');
        expect(children).toBeDefined();
        expect(children!.get('North')).toBe(1);
        expect(children!.get('South')).toBe(1);
    });

    test('removeEdge removes child and cleans up empty parent', () => {
        const h = new Hierarchy('H', 'D');
        h.addEdge('Total', 'North', 1);
        h.removeEdge('Total', 'North');
        expect(h.edges.has('Total')).toBe(false);
    });

    test('getEdgeWeight returns correct weight', () => {
        const h = new Hierarchy('H', 'D');
        h.addEdge('Total', 'North', 3);
        expect(h.getEdgeWeight('Total', 'North')).toBe(3);
        expect(h.getEdgeWeight('Total', 'Missing')).toBeUndefined();
    });

    test('fromDict parses edges into nested map', () => {
        const dict = {
            Name: 'H',
            Edges: [
                { ParentName: 'Total', ComponentName: 'North', Weight: 1 },
                { ParentName: 'Total', ComponentName: 'South', Weight: 1 }
            ]
        };
        const h = Hierarchy.fromDict(dict, 'D');
        expect(h.edges.get('Total')?.get('North')).toBe(1);
        expect(h.edges.get('Total')?.get('South')).toBe(1);
    });

    test('body serializes edges correctly', () => {
        const h = new Hierarchy('H', 'D');
        h.addEdge('Total', 'North', 1);
        const body = JSON.parse(h.body);
        expect(body.Edges).toEqual([{ ParentName: 'Total', ComponentName: 'North', Weight: 1 }]);
    });
});

describe('Hierarchy.getAncestors', () => {
    function buildHierarchy(): Hierarchy {
        const h = new Hierarchy('H', 'D');
        // Total -> Region -> North
        //                 -> South
        h.addEdge('Total', 'Region', 1);
        h.addEdge('Region', 'North', 1);
        h.addEdge('Region', 'South', 1);
        return h;
    }

    test('returns direct parents only (non-recursive)', () => {
        const h = buildHierarchy();
        expect(h.getAncestors('North')).toEqual(['Region']);
        expect(h.getAncestors('Region')).toEqual(['Total']);
    });

    test('returns all ancestors recursively', () => {
        const h = buildHierarchy();
        const ancestors = h.getAncestors('North', true);
        expect(ancestors).toContain('Region');
        expect(ancestors).toContain('Total');
    });

    test('returns empty array for root elements', () => {
        const h = buildHierarchy();
        expect(h.getAncestors('Total')).toEqual([]);
    });

    test('is case and space insensitive', () => {
        const h = buildHierarchy();
        expect(h.getAncestors(' NORTH ')).toEqual(['Region']);
    });
});

describe('Hierarchy.getDescendants', () => {
    function buildHierarchy(): Hierarchy {
        const h = new Hierarchy('H', 'D');
        h.addEdge('Total', 'Region', 1);
        h.addEdge('Region', 'North', 1);
        h.addEdge('Region', 'South', 1);
        return h;
    }

    test('returns direct children (non-recursive)', () => {
        const h = buildHierarchy();
        expect(h.getDescendants('Total')).toEqual(['Region']);
        const regionChildren = h.getDescendants('Region').sort();
        expect(regionChildren).toEqual(['North', 'South']);
    });

    test('returns all descendants recursively', () => {
        const h = buildHierarchy();
        const all = h.getDescendants('Total', true);
        expect(all).toContain('Region');
        expect(all).toContain('North');
        expect(all).toContain('South');
    });

    test('leavesOnly returns only leaf elements', () => {
        const h = buildHierarchy();
        const leaves = h.getDescendants('Total', true, true);
        expect(leaves).toContain('North');
        expect(leaves).toContain('South');
        expect(leaves).not.toContain('Region');
    });

    test('returns empty array for leaf elements', () => {
        const h = buildHierarchy();
        expect(h.getDescendants('North')).toEqual([]);
    });
});

describe('Hierarchy.getDescendantEdges and getAncestorEdges', () => {
    function buildHierarchy(): Hierarchy {
        const h = new Hierarchy('H', 'D');
        h.addEdge('Total', 'Region', 1);
        h.addEdge('Region', 'North', 1);
        h.addEdge('Region', 'South', 1);
        return h;
    }

    test('getDescendantEdges returns edges for direct descendants', () => {
        const h = buildHierarchy();
        const edges = h.getDescendantEdges('Total');
        expect(edges.has('Region')).toBe(true);
        expect(edges.get('Region')?.get('North')).toBe(1);
    });

    test('getDescendantEdges returns all descendant edges recursively', () => {
        const h = buildHierarchy();
        const edges = h.getDescendantEdges('Total', true);
        expect(edges.has('Region')).toBe(true);
        expect(edges.has('North')).toBe(false); // North has no children
        expect(edges.has('South')).toBe(false);
    });

    test('getAncestorEdges returns edges for direct ancestors', () => {
        const h = buildHierarchy();
        const edges = h.getAncestorEdges('North');
        expect(edges.has('Region')).toBe(true);
        expect(edges.get('Region')?.get('North')).toBe(1);
    });

    test('getAncestorEdges returns all ancestor edges recursively', () => {
        const h = buildHierarchy();
        const edges = h.getAncestorEdges('North', true);
        expect(edges.has('Region')).toBe(true);
        expect(edges.has('Total')).toBe(true);
    });
});

describe('Hierarchy.replaceElement', () => {
    test('renames element and updates all edge references', () => {
        const elem = new Element('North', 'Numeric');
        const h = new Hierarchy('H', 'D', [elem]);
        h.addEdge('Region', 'North', 1);
        h.addEdge('North', 'NorthEast', 1);

        h.replaceElement('North', 'NorthRegion');

        // Old name gone from edges
        expect(h.edges.has('North')).toBe(false);
        expect(h.edges.get('Region')?.has('North')).toBeFalsy();

        // New name present in edges
        expect(h.edges.has('NorthRegion')).toBe(true);
        expect(h.edges.get('Region')?.get('NorthRegion')).toBe(1);
        expect(h.edges.get('NorthRegion')?.get('NorthEast')).toBe(1);
    });
});

describe('Hierarchy.addComponent', () => {
    test('adds edge when parent exists and is not String type', () => {
        const parent = new Element('Total', 'Consolidated');
        const h = new Hierarchy('H', 'D', [parent]);
        h.addComponent('Total', 'Child1', 1);
        expect(h.getEdgeWeight('Total', 'Child1')).toBe(1);
    });

    test('throws when parent element not found', () => {
        const h = new Hierarchy('H', 'D');
        expect(() => h.addComponent('NonExistent', 'Child')).toThrow(/not found/);
    });

    test('throws when parent is of type String', () => {
        const stringElem = new Element('StringParent', 'String');
        const h = new Hierarchy('H', 'D', [stringElem]);
        expect(() => h.addComponent('StringParent', 'Child')).toThrow(/String/);
    });
});

// ---------------------------------------------------------------------------
// Bug 6 (MDXView.ts): dynamicProperties
// ---------------------------------------------------------------------------

describe('MDXView.dynamicProperties', () => {
    test('constructor sets dynamicProperties to empty object by default', () => {
        const view = new MDXView('Cube', 'View', 'SELECT ...');
        expect(view.dynamicProperties).toEqual({});
    });

    test('constructor accepts dynamicProperties argument', () => {
        const props = { Meta: { ExpandAboves: true } };
        const view = new MDXView('Cube', 'View', 'SELECT ...', props);
        expect(view.dynamicProperties).toEqual(props);
    });

    test('fromDict parses Properties key', () => {
        const dict = {
            Name: 'V',
            MDX: 'SELECT ...',
            Properties: { Aliases: ['Default'] }
        };
        const view = MDXView.fromDict(dict, 'Cube');
        expect(view.dynamicProperties).toEqual({ Aliases: ['Default'] });
    });

    test('fromDict handles missing Properties gracefully', () => {
        const view = MDXView.fromDict({ Name: 'V', MDX: 'SELECT ...' }, 'Cube');
        expect(view.dynamicProperties).toEqual({});
    });

    test('body includes Properties when dynamicProperties is non-empty', () => {
        const view = new MDXView('Cube', 'View', 'SELECT ...', { ContextSets: [] });
        const body = JSON.parse(view.body);
        expect(body.Properties).toEqual({ ContextSets: [] });
    });

    test('body omits Properties when dynamicProperties is empty', () => {
        const view = new MDXView('Cube', 'View', 'SELECT ...');
        const body = JSON.parse(view.body);
        expect(body).not.toHaveProperty('Properties');
    });

    test('dynamicProperties round-trips through body and fromDict', () => {
        const props = { Meta: true, Aliases: ['Default'] };
        const original = new MDXView('Cube', 'View', 'SELECT ...', props);
        const bodyStr = original.body;
        const restored = MDXView.fromDict(JSON.parse(bodyStr), 'Cube');
        expect(restored.dynamicProperties).toEqual(props);
    });
});

// ---------------------------------------------------------------------------
// Bug 7 (ElementAttribute.ts): equals() compares name AND type
// ---------------------------------------------------------------------------

describe('ElementAttribute.equals', () => {
    test('same name and same type returns true', () => {
        const a = new ElementAttribute('Revenue', ElementAttributeType.NUMERIC);
        const b = new ElementAttribute('Revenue', ElementAttributeType.NUMERIC);
        expect(a.equals(b)).toBe(true);
    });

    test('same name different type returns false', () => {
        const a = new ElementAttribute('Revenue', ElementAttributeType.NUMERIC);
        const b = new ElementAttribute('Revenue', ElementAttributeType.STRING);
        expect(a.equals(b)).toBe(false);
    });

    test('different name same type returns false', () => {
        const a = new ElementAttribute('Revenue', ElementAttributeType.NUMERIC);
        const b = new ElementAttribute('Cost', ElementAttributeType.NUMERIC);
        expect(a.equals(b)).toBe(false);
    });

    test('name comparison is case and space insensitive', () => {
        const a = new ElementAttribute('My Attr', ElementAttributeType.STRING);
        const b = new ElementAttribute('myattr', ElementAttributeType.STRING);
        expect(a.equals(b)).toBe(true);
    });

    test('returns false when compared to non-ElementAttribute', () => {
        const a = new ElementAttribute('Revenue', ElementAttributeType.NUMERIC);
        const b = new Element('Revenue', 'Numeric');
        expect(a.equals(b)).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// Issue #70 (Subset.ts): AnonymousSubset.fromDict URL parsing
//
// These tests lock in tm1py's literal behavior — INCLUDING the latent bug
// where read_object_name_from_url always returns match.group(1), causing both
// segments to resolve to the dimension name. Do NOT "fix" these tests to
// reflect more "correct" behavior — see CLAUDE.md "Strict tm1py Parity".
// ---------------------------------------------------------------------------

describe('AnonymousSubset.fromDict — Hierarchy@odata.bind parsing (#70)', () => {
    test('parses dimension and hierarchy when names match', () => {
        const sub = AnonymousSubset.fromDict({
            'Hierarchy@odata.bind': "Dimensions('Region')/Hierarchies('Region')",
            Elements: [{ Name: 'North' }]
        });
        expect(sub.dimensionName).toBe('Region');
        expect(sub.hierarchyName).toBe('Region');
    });

    test('non-default hierarchy resolves to dimension name (tm1py bug parity)', () => {
        // tm1py's read_object_name_from_url returns match.group(1) twice, both
        // capturing the dimension. Hierarchy name in the URL is silently lost.
        const sub = AnonymousSubset.fromDict({
            'Hierarchy@odata.bind': "Dimensions('Region')/Hierarchies('Region_Alt')",
            Expression: '{[Region].[Region_Alt].Members}'
        });
        expect(sub.dimensionName).toBe('Region');
        expect(sub.hierarchyName).toBe('Region');
    });

    test('parses Hierarchy entity form correctly', () => {
        const sub = AnonymousSubset.fromDict({
            Hierarchy: { Name: 'Region_Alt', Dimension: { Name: 'Region' } },
            Elements: [{ Name: 'North' }]
        });
        expect(sub.dimensionName).toBe('Region');
        expect(sub.hierarchyName).toBe('Region_Alt');
    });

    test('throws for URL missing Hierarchies segment', () => {
        expect(() => AnonymousSubset.fromDict({
            'Hierarchy@odata.bind': "Dimensions('Region')"
        })).toThrow(/Unexpected value for 'Hierarchy@odata.bind'/);
    });

    test('throws for non-Dimensions/Hierarchies URL shape (tm1py shape validation)', () => {
        // tm1py's regex anchors on Dimensions(...)/Hierarchies(...) — other shapes fail.
        expect(() => AnonymousSubset.fromDict({
            'Hierarchy@odata.bind': "Foo('A')/Bar('B')"
        })).toThrow(/Unexpected value for 'Hierarchy@odata.bind'/);
    });

    test('throws when neither Hierarchy nor Hierarchy@odata.bind present', () => {
        expect(() => AnonymousSubset.fromDict({})).toThrow(/must contain 'Hierarchy'/);
    });

    test('round-trip: alt hierarchy in URL is dropped via tm1py-equivalent parsing', () => {
        // Input has Hierarchies('Region_Alt') but tm1py's parsing collapses both
        // to the dimension name, so bodyAsDict reflects Hierarchies('Region').
        const sub = AnonymousSubset.fromDict({
            'Hierarchy@odata.bind': "Dimensions('Region')/Hierarchies('Region_Alt')",
            Elements: [{ Name: 'North' }]
        });
        const body = sub.bodyAsDict;
        expect(body['Hierarchy@odata.bind']).toBe(
            "Dimensions('Region')/Hierarchies('Region')"
        );
    });
});

describe('ViewAxisSelection.fromDict — anonymous subset with non-default hierarchy (#70)', () => {
    test('hierarchy in URL collapses to dimension name (tm1py bug parity)', () => {
        const dict = {
            Subset: {
                'Hierarchy@odata.bind': "Dimensions('Region')/Hierarchies('Region_Alt')",
                Elements: [{ Name: 'North' }]
            }
        };
        const sel = ViewAxisSelection.fromDict(dict);
        expect(sel.dimensionName).toBe('Region');
        const anon = sel.subset as AnonymousSubset;
        expect(anon.dimensionName).toBe('Region');
        expect(anon.hierarchyName).toBe('Region');
    });
});
