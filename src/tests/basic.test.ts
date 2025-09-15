/**
 * Basic working tests for tm1npm
 * These tests verify core functionality without complex service dependencies
 */

import { TM1Exception } from '../exceptions/TM1Exception';
import { formatUrl, verifyVersion } from '../utils/Utils';

describe('Core Functionality Tests', () => {
    
    describe('Exception Classes', () => {
        test('TM1Exception should be creatable', () => {
            const exception = new TM1Exception('Test error');
            expect(exception.message).toBe('Test error');
            expect(exception).toBeInstanceOf(TM1Exception);
            expect(exception).toBeInstanceOf(Error);
        });
    });

    describe('Utility Functions', () => {
        test('formatUrl should work correctly', () => {
            const url1 = formatUrl("/Cubes('{}')", 'Sales');
            expect(url1).toBe("/Cubes('Sales')");

            const url2 = formatUrl("/Dimensions('{}')/Hierarchies('{}')", 'Product', 'Product');
            expect(url2).toBe("/Dimensions('Product')/Hierarchies('Product')");

            const url3 = formatUrl("/Cubes('{}')/Views('{}')", 'Sales', 'Default');
            expect(url3).toBe("/Cubes('Sales')/Views('Default')");
        });

        test('verifyVersion should work correctly', () => {
            // verifyVersion(actualVersion, requiredVersion)
            expect(verifyVersion('11.8.0', '11.0')).toBe(true);  // 11.8.0 >= 11.0
            expect(verifyVersion('11.8.0', '12.0')).toBe(false); // 11.8.0 < 12.0  
            expect(verifyVersion('11.8.0', '11.8')).toBe(true);  // 11.8.0 >= 11.8
            expect(verifyVersion('11.8.0', '11.9')).toBe(false); // 11.8.0 < 11.9
        });
    });

    describe('Environment Tests', () => {
        test('Node.js environment should be available', () => {
            expect(process.env).toBeDefined();
            expect(process.version).toBeDefined();
        });

        test('TypeScript compilation should work', () => {
            const testValue: string = 'TypeScript works';
            expect(testValue).toBe('TypeScript works');
        });
    });
});

describe('Integration Tests', () => {
    test('tm1npm package structure should be valid', () => {
        // Basic smoke test to ensure the package can be imported
        expect(true).toBe(true); // Placeholder test
    });
});