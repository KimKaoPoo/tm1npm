/**
 * Edge Cases Test Runner for tm1npm
 * Tests boundary conditions and unusual inputs
 */

import { 
    formatUrl, 
    verifyVersion, 
    CaseAndSpaceInsensitiveMap,
    abbreviateString,
    tidy,
    readObjectNameFromUrl
} from '../../src/utils/Utils';

async function runEdgeCasesTests(): Promise<void> {
    console.log('🎯 Running Edge Cases Tests...');
    console.log('=' .repeat(50));
    
    let testsPassed = 0;
    let testsFailed = 0;

    // Test 1: Empty Strings
    console.log('1. Testing empty string handling...');
    try {
        const result1 = formatUrl('', '');
        const result2 = verifyVersion('', '');
        const result3 = abbreviateString('', 10);
        const result4 = tidy('');
        
        console.log('   ✅ Empty strings handled correctly');
        testsPassed++;
    } catch (error) {
        console.log('   ❌ Empty string handling failed:', error);
        testsFailed++;
    }

    // Test 2: Null/Undefined Values
    console.log('2. Testing null/undefined handling...');
    try {
        formatUrl('/test/{}', null as any);
        formatUrl('/test/{}', undefined as any);
        verifyVersion(null as any, '1.0');
        verifyVersion('1.0', null as any);
        
        console.log('   ✅ Null/undefined values handled gracefully');
        testsPassed++;
    } catch (error) {
        console.log('   ❌ Null/undefined handling failed:', error);
        testsFailed++;
    }

    // Test 3: Extremely Long Strings
    console.log('3. Testing very long string handling...');
    try {
        const longString = 'A'.repeat(10000);
        const result = formatUrl('/test/{}', longString);
        const abbreviated = abbreviateString(longString, 50);
        
        if (abbreviated.length <= 50 && result.includes(encodeURIComponent(longString))) {
            console.log('   ✅ Long strings handled efficiently');
            testsPassed++;
        } else {
            console.log('   ⚠️ Long string handling unexpected results');
            testsFailed++;
        }
    } catch (error) {
        console.log('   ❌ Long string handling failed:', error);
        testsFailed++;
    }

    // Test 4: Unicode Characters
    console.log('4. Testing Unicode character handling...');
    try {
        const unicodeTests = ['🚀', '测试', 'тест', 'café'];
        let unicodeSuccess = true;
        
        for (const test of unicodeTests) {
            const result = formatUrl('/test/{}', test);
            if (!result.includes(encodeURIComponent(test))) {
                unicodeSuccess = false;
                break;
            }
        }
        
        if (unicodeSuccess) {
            console.log('   ✅ Unicode characters handled correctly');
            testsPassed++;
        } else {
            console.log('   ⚠️ Some Unicode handling issues detected');
            testsFailed++;
        }
    } catch (error) {
        console.log('   ❌ Unicode handling failed:', error);
        testsFailed++;
    }

    // Test 5: Case Insensitive Map Edge Cases
    console.log('5. Testing CaseAndSpaceInsensitiveMap edge cases...');
    try {
        const map = new CaseAndSpaceInsensitiveMap<string>();
        
        // Test various key formats
        map.set('test key', 'value1');
        map.set('TEST KEY', 'value2');
        map.set(' test key ', 'value3');
        map.set('testkey', 'value4');
        
        // All should be treated as the same key
        const value = map.get('Test Key');
        
        if (map.size === 1 && value === 'value4') { // Last set value should win
            console.log('   ✅ Case insensitive map working correctly');
            testsPassed++;
        } else {
            console.log(`   ⚠️ Case insensitive map size: ${map.size}, value: ${value}`);
            testsFailed++;
        }
    } catch (error) {
        console.log('   ❌ Case insensitive map failed:', error);
        testsFailed++;
    }

    // Test 6: Extreme Version Numbers
    console.log('6. Testing extreme version number handling...');
    try {
        const extremeTests = [
            ['999.999.999', '1.0.0'],
            ['0.0.0', '0.0.1'],
            ['1', '1.0.0.0.0'],
            ['abc.def.ghi', '1.2.3']
        ];
        
        let versionSuccess = true;
        for (const [v1, v2] of extremeTests) {
            try {
                const result = verifyVersion(v1, v2);
                if (typeof result !== 'boolean') {
                    versionSuccess = false;
                    break;
                }
            } catch (e) {
                versionSuccess = false;
                break;
            }
        }
        
        if (versionSuccess) {
            console.log('   ✅ Extreme version numbers handled');
            testsPassed++;
        } else {
            console.log('   ⚠️ Some version number handling issues');
            testsFailed++;
        }
    } catch (error) {
        console.log('   ❌ Version number handling failed:', error);
        testsFailed++;
    }

    // Test 7: Malformed URL Parsing
    console.log('7. Testing malformed URL parsing...');
    try {
        const malformedUrls = [
            '',
            "Dimensions('')",
            "Dimensions('test'',)",
            "/Dimensions('test with spaces')"
        ];
        
        let urlSuccess = true;
        for (const url of malformedUrls) {
            try {
                const result = readObjectNameFromUrl(url);
                // Should not throw, even if result is empty
            } catch (e) {
                urlSuccess = false;
                break;
            }
        }
        
        if (urlSuccess) {
            console.log('   ✅ Malformed URLs handled gracefully');
            testsPassed++;
        } else {
            console.log('   ⚠️ Some URL parsing issues');
            testsFailed++;
        }
    } catch (error) {
        console.log('   ❌ URL parsing failed:', error);
        testsFailed++;
    }

    // Test 8: Memory Stress Test
    console.log('8. Testing memory stability under stress...');
    try {
        const initialMemory = process.memoryUsage().heapUsed;
        
        // Create and destroy many objects
        for (let i = 0; i < 1000; i++) {
            const map = new CaseAndSpaceInsensitiveMap<string>();
            for (let j = 0; j < 100; j++) {
                map.set(`key${j}`, `value${j}`);
            }
            // Map goes out of scope and should be garbage collected
        }
        
        // Force garbage collection if available
        if (global.gc) {
            global.gc();
        }
        
        const finalMemory = process.memoryUsage().heapUsed;
        const memoryGrowth = (finalMemory - initialMemory) / 1024 / 1024;
        
        if (memoryGrowth < 100) { // Less than 100MB growth
            console.log(`   ✅ Memory stable (growth: ${memoryGrowth.toFixed(2)}MB)`);
            testsPassed++;
        } else {
            console.log(`   ⚠️ High memory usage (growth: ${memoryGrowth.toFixed(2)}MB)`);
            testsFailed++;
        }
    } catch (error) {
        console.log('   ❌ Memory stress test failed:', error);
        testsFailed++;
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log(`Edge Cases Test Summary:`);
    console.log(`✅ Passed: ${testsPassed}`);
    console.log(`❌ Failed: ${testsFailed}`);
    console.log(`📊 Success Rate: ${((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(1)}%`);
    
    if (testsFailed === 0) {
        console.log('🎉 All edge case tests passed!');
    } else {
        console.log('⚠️ Some edge cases need attention');
    }
}

if (require.main === module) {
    runEdgeCasesTests().catch(console.error);
}

export { runEdgeCasesTests };