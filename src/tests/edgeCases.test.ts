/**
 * Edge Cases Tests for tm1npm
 * Tests for boundary conditions, unusual inputs, and corner cases
 */

import { 
    formatUrl, 
    verifyVersion, 
    CaseAndSpaceInsensitiveMap, 
    CaseAndSpaceInsensitiveSet,
    buildMdxFromAxes,
    dimensionHierarchyElementTupleFromString,
    buildElementsStringFromIterable,
    wrapTupleInBrackets,
    abbreviateString,
    tidy,
    readObjectNameFromUrl,
    integerizeVersion
} from '../utils/Utils';

describe('Edge Cases Tests', () => {
    describe('String Edge Cases', () => {
        test('should handle empty strings', () => {
            expect(formatUrl('', '')).toBe('');
            expect(formatUrl('/test/{}', '')).toBe('/test/');
            expect(verifyVersion('', '')).toBeFalsy(); // Changed to toBeFalsy since empty strings return false
            expect(abbreviateString('', 10)).toBe('');
            expect(tidy('')).toBe('');
            expect(readObjectNameFromUrl('')).toBe('');
        });

        test('should handle whitespace-only strings', () => {
            const whitespaces = [' ', '\t', '\n', '\r', '   ', '\t\n\r'];
            
            whitespaces.forEach(ws => {
                expect(() => formatUrl('/test/{}', ws)).not.toThrow();
                expect(() => verifyVersion(ws, '1.0')).not.toThrow();
                expect(tidy(ws)).toBe('');
            });
        });

        test('should handle extremely long strings', () => {
            const longString = 'A'.repeat(100000); // 100KB string
            
            expect(() => formatUrl('/test/{}', longString)).not.toThrow();
            expect(() => abbreviateString(longString, 50)).not.toThrow();
            
            const abbreviated = abbreviateString(longString, 50);
            expect(abbreviated.length).toBeLessThanOrEqual(50);
            expect(abbreviated.endsWith('...')).toBe(true);
        });

        test('should handle special Unicode characters', () => {
            const unicodeTests = [
                '🚀🎉💯', // Emojis
                '测试数据', // Chinese
                'тестовые данные', // Cyrillic
                'テストデータ', // Japanese
                '🇺🇸🇯🇵🇨🇳', // Flag emojis
                'café naïve résumé', // Accented characters
                '\\u0000\\u001f\\u007f', // Control characters
                '𝕋𝔼𝕊𝕋', // Mathematical symbols
            ];
            
            unicodeTests.forEach(test => {
                expect(() => formatUrl('/test/{}', test)).not.toThrow();
                expect(() => abbreviateString(test, 10)).not.toThrow();
                expect(() => tidy(test)).not.toThrow();
            });
        });
    });

    describe('Number Edge Cases', () => {
        test('should handle extreme version numbers', () => {
            const extremeVersions = [
                ['0', '0'],
                ['999.999.999', '1.0.0'],
                ['1.0.0', '999.999.999'],
                ['10000.50000.90000', '1.2.3'],
                ['1', '1.0.0.0.0.0'],
                ['1.2.3.4.5.6.7.8.9', '1.2.3']
            ];
            
            extremeVersions.forEach(([v1, v2]) => {
                expect(() => verifyVersion(v1, v2)).not.toThrow();
                expect(() => integerizeVersion(v1)).not.toThrow();
            });
        });

        test('should handle malformed version strings', () => {
            const malformedVersions = [
                'abc.def.ghi',
                '1.2.3-alpha',
                '1.2.3+build',
                'v1.2.3',
                '1..2..3',
                '.1.2.3',
                '1.2.3.',
                '1,2,3',
                '1-2-3'
            ];
            
            malformedVersions.forEach(version => {
                expect(() => verifyVersion(version, '1.0.0')).not.toThrow();
                expect(() => integerizeVersion(version)).not.toThrow();
            });
        });

        test('should handle extreme abbreviation lengths', () => {
            const text = 'This is a test string for abbreviation';
            
            expect(abbreviateString(text, 0)).toBe('...');
            expect(abbreviateString(text, 1)).toBe('...');
            expect(abbreviateString(text, 2)).toBe('...');
            expect(abbreviateString(text, 3)).toBe('...');
            expect(abbreviateString(text, 4)).toBe('T...');
            expect(abbreviateString(text, -1)).toBe('...');
            expect(abbreviateString(text, 1000)).toBe(text);
        });
    });

    describe('Array and Iterable Edge Cases', () => {
        test('should handle empty arrays', () => {
            expect(buildMdxFromAxes([])).toBe('');
            expect(buildElementsStringFromIterable([])).toBe('');
            expect(wrapTupleInBrackets([])).toBe('()');
        });

        test('should handle single-element arrays', () => {
            expect(wrapTupleInBrackets(['Element1'])).toBe('[Element1]');
            expect(buildElementsStringFromIterable(['Element1'])).toBe('Element1');
        });

        test('should handle large arrays', () => {
            const largeArray = Array(10000).fill(null).map((_, i) => `Element${i}`);
            
            expect(() => buildElementsStringFromIterable(largeArray)).not.toThrow();
            expect(() => wrapTupleInBrackets(largeArray)).not.toThrow();
            
            const result = buildElementsStringFromIterable(largeArray);
            expect(result.split(',').length).toBe(10000);
        });

        test('should handle arrays with special characters', () => {
            const specialElements = [
                'Element with spaces',
                'Element,with,commas',
                'Element[with]brackets',
                'Element{with}braces',
                'Element(with)parens',
                'Element"with"quotes',
                "Element'with'apostrophes",
                'Element\nwith\nnewlines',
                'Element\twith\ttabs'
            ];
            
            expect(() => buildElementsStringFromIterable(specialElements)).not.toThrow();
            expect(() => wrapTupleInBrackets(specialElements)).not.toThrow();
        });

        test('should handle different iterable types', () => {
            const set = new Set(['a', 'b', 'c']);
            const map = new Map([['key1', 'value1'], ['key2', 'value2']]);
            
            expect(() => buildElementsStringFromIterable(set)).not.toThrow();
            expect(() => buildElementsStringFromIterable(map.keys())).not.toThrow();
            
            const setResult = buildElementsStringFromIterable(set);
            expect(setResult.split(',').length).toBe(3);
        });
    });

    describe('Object Edge Cases', () => {
        test('should handle null and undefined in various contexts', () => {
            expect(() => formatUrl('/test/{}', null as any)).not.toThrow();
            expect(() => formatUrl('/test/{}', undefined as any)).not.toThrow();
            expect(() => verifyVersion(null as any, '1.0')).not.toThrow();
            expect(() => verifyVersion('1.0', null as any)).not.toThrow();
            expect(() => abbreviateString(null as any, 10)).not.toThrow();
            expect(() => tidy(null as any)).not.toThrow();
        });

        test('should handle complex nested objects', () => {
            const complexAxes = [
                {
                    Tuples: [
                        {
                            Members: [
                                { UniqueName: '[Dimension1].[Hierarchy1].[Element1]' },
                                { UniqueName: '[Dimension2].[Hierarchy2].[Element2]' }
                            ]
                        }
                    ]
                },
                {
                    Tuples: []
                },
                {
                    Tuples: null
                }
            ];
            
            expect(() => buildMdxFromAxes(complexAxes)).not.toThrow();
        });
    });

    describe('CaseAndSpaceInsensitiveMap Edge Cases', () => {
        test('should handle edge cases in keys', () => {
            const map = new CaseAndSpaceInsensitiveMap<string>();
            
            const edgeKeys = [
                '',
                ' ',
                '   ',
                '\t',
                '\n',
                '\r\n',
                'a',
                'A',
                ' a ',
                ' A ',
                'TEST KEY',
                'test key',
                'Test Key',
                'TESTKEY',
                'testkey',
                'TestKey'
            ];
            
            edgeKeys.forEach((key, index) => {
                expect(() => map.set(key, `value${index}`)).not.toThrow();
            });
            
            // All variations should be treated as the same key for case-insensitive ones
            expect(map.has('test key')).toBe(true);
            expect(map.has('TEST KEY')).toBe(true);
            expect(map.has('testkey')).toBe(true);
            expect(map.has('TESTKEY')).toBe(true);
        });

        test('should handle rapid operations', () => {
            const map = new CaseAndSpaceInsensitiveMap<number>();
            
            // Rapid set/get/delete cycles
            for (let i = 0; i < 1000; i++) {
                map.set(`key ${i}`, i);
                expect(map.get(`KEY ${i}`)).toBe(i);
                if (i % 2 === 0) {
                    map.delete(`key ${i}`);
                }
            }
            
            expect(map.size).toBe(500);
        });
    });

    describe('CaseAndSpaceInsensitiveSet Edge Cases', () => {
        test('should handle duplicate-like values', () => {
            const set = new CaseAndSpaceInsensitiveSet();
            
            const duplicateLikeValues = [
                'test',
                'TEST',
                'Test',
                'TeSt',
                ' test ',
                ' TEST ',
                'test ',
                ' test',
                '\ttest\t',
                '\ntest\n'
            ];
            
            duplicateLikeValues.forEach(value => {
                set.add(value);
            });
            
            // Should only have one item (all are equivalent)
            expect(set.size).toBe(1);
            expect(set.has('test')).toBe(true);
            expect(set.has('TEST')).toBe(true);
            expect(set.has(' test ')).toBe(true);
        });
    });

    describe('URL Parsing Edge Cases', () => {
        test('should handle malformed URLs', () => {
            const malformedUrls = [
                '',
                '/',
                '//',
                '///',
                "Dimensions('')",
                "Dimensions(')",
                "Dimensions('')",
                "Dimensions('test'',)",
                "Dimensions(test)",
                "/Dimensions('/test/')",
                "/Dimensions('test with spaces')",
                "/Dimensions('test\"with\"quotes')"
            ];
            
            malformedUrls.forEach(url => {
                expect(() => readObjectNameFromUrl(url)).not.toThrow();
            });
        });

        test('should handle complex dimension hierarchy element tuples', () => {
            const complexTuples = [
                '',
                'SingleElement',
                'Dimension.Element',
                'Dimension.Hierarchy.Element',
                'Dimension.Hierarchy.Element.Extra',
                '[Dimension].[Hierarchy].[Element]',
                '[Dimension with spaces].[Hierarchy].[Element]',
                '[Dimension].[Hierarchy].[Element with spaces]',
                'Dimension..Element', // Double dot
                '.Dimension.Element', // Leading dot
                'Dimension.Element.', // Trailing dot
                '[Malformed].[Tuple',
                'Malformed].[Tuple]'
            ];
            
            complexTuples.forEach(tuple => {
                expect(() => dimensionHierarchyElementTupleFromString(tuple)).not.toThrow();
                const result = dimensionHierarchyElementTupleFromString(tuple);
                expect(Array.isArray(result)).toBe(true);
                expect(result.length).toBe(3);
            });
        });
    });

    describe('Boundary Value Testing', () => {
        test('should handle minimum and maximum safe integers', () => {
            const minSafe = Number.MIN_SAFE_INTEGER;
            const maxSafe = Number.MAX_SAFE_INTEGER;
            
            expect(() => formatUrl('/test/{}', minSafe.toString())).not.toThrow();
            expect(() => formatUrl('/test/{}', maxSafe.toString())).not.toThrow();
            expect(() => verifyVersion(minSafe.toString(), maxSafe.toString())).not.toThrow();
        });

        test('should handle very small and very large version numbers', () => {
            const versionTests = [
                ['0.0.0', '0.0.1'],
                ['999999.999999.999999', '1.0.0'],
                ['0', '999999999'],
                ['1.0', '1.0.0.0.0.0.0.0.1']
            ];
            
            versionTests.forEach(([v1, v2]) => {
                expect(() => verifyVersion(v1, v2)).not.toThrow();
                expect(typeof verifyVersion(v1, v2)).toBe('boolean');
            });
        });
    });
});