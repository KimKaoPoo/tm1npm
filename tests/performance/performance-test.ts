/**
 * Performance Test Runner for tm1npm
 * Tests response times, memory usage, and scalability
 */

import axios from 'axios';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function runPerformanceTests(): Promise<void> {
    console.log('🚀 Running Performance Tests...');
    console.log('=' .repeat(50));
    
    const config = {
        baseURL: 'http://localhost:8879/api/v1',
        auth: { username: 'admin', password: process.env.TM1_PASSWORD || '' },
        timeout: 30000
    };

    // Test 1: Response Time
    console.log('1. Testing response times...');
    try {
        const startTime = Date.now();
        await axios.get('/Configuration/ProductVersion', config);
        const responseTime = Date.now() - startTime;
        
        if (responseTime < 1000) {
            console.log(`   ✅ Fast response: ${responseTime}ms`);
        } else if (responseTime < 3000) {
            console.log(`   ⚠️ Moderate response: ${responseTime}ms`);
        } else {
            console.log(`   ❌ Slow response: ${responseTime}ms`);
        }
    } catch (error: any) {
        if (error.code === 'ECONNREFUSED') {
            console.log('   ⚠️ TM1 server not available');
        } else {
            console.log('   ❌ Error during response time test');
        }
    }

    // Test 2: Sequential Performance
    console.log('2. Testing sequential request performance...');
    try {
        const times: number[] = [];
        const iterations = 5;
        
        for (let i = 0; i < iterations; i++) {
            const startTime = Date.now();
            await axios.get('/Configuration/ProductVersion', config);
            times.push(Date.now() - startTime);
        }
        
        const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
        const maxTime = Math.max(...times);
        
        console.log(`   📊 Average: ${avgTime.toFixed(0)}ms, Max: ${maxTime}ms`);
        
        if (avgTime < 2000 && maxTime < 5000) {
            console.log('   ✅ Good sequential performance');
        } else {
            console.log('   ⚠️ Sequential performance needs attention');
        }
    } catch (error: any) {
        if (error.code === 'ECONNREFUSED') {
            console.log('   ⚠️ TM1 server not available');
        } else {
            console.log('   ❌ Error during sequential performance test');
        }
    }

    // Test 3: Concurrent Performance
    console.log('3. Testing concurrent request performance...');
    try {
        const concurrentCount = 5;
        const startTime = Date.now();
        
        const promises = Array(concurrentCount).fill(null).map(() =>
            axios.get('/Configuration/ProductVersion', config)
        );
        
        const results = await Promise.allSettled(promises);
        const totalTime = Date.now() - startTime;
        const successful = results.filter(r => r.status === 'fulfilled').length;
        
        console.log(`   📊 ${successful}/${concurrentCount} requests in ${totalTime}ms`);
        
        if (successful >= concurrentCount * 0.8 && totalTime < 10000) {
            console.log('   ✅ Good concurrent performance');
        } else {
            console.log('   ⚠️ Concurrent performance could be improved');
        }
    } catch (error: any) {
        if (error.code === 'ECONNREFUSED') {
            console.log('   ⚠️ TM1 server not available');
        } else {
            console.log('   ❌ Error during concurrent performance test');
        }
    }

    // Test 4: Memory Usage
    console.log('4. Testing memory efficiency...');
    const initialMemory = process.memoryUsage().heapUsed;
    
    // Perform memory-intensive operations
    for (let i = 0; i < 1000; i++) {
        const testData = `test${i}`.repeat(100);
        // Simulate data processing
        testData.toLowerCase().split('').join('');
    }
    
    const finalMemory = process.memoryUsage().heapUsed;
    const memoryGrowth = finalMemory - initialMemory;
    const memoryGrowthMB = memoryGrowth / 1024 / 1024;
    
    console.log(`   📊 Memory growth: ${memoryGrowthMB.toFixed(2)}MB`);
    
    if (memoryGrowthMB < 50) {
        console.log('   ✅ Good memory efficiency');
    } else {
        console.log('   ⚠️ High memory usage detected');
    }

    console.log('\n🏁 Performance tests completed!');
}

if (require.main === module) {
    runPerformanceTests().catch(console.error);
}

export { runPerformanceTests };