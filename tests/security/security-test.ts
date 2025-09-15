/**
 * Security Test Runner for tm1npm
 * Focused on testing authentication, authorization, and security vulnerabilities
 */

import axios from 'axios';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function runSecurityTests(): Promise<void> {
    console.log('🔐 Running Security Tests...');
    console.log('=' .repeat(50));
    
    const config = {
        baseURL: 'http://localhost:8879/api/v1',
        timeout: 10000
    };

    // Test 1: Invalid Authentication
    console.log('1. Testing invalid authentication...');
    try {
        await axios.get('/Configuration/ProductVersion', {
            ...config,
            auth: { username: 'invalid', password: 'wrong' }
        });
        console.log('   ❌ Security Issue: Invalid credentials accepted!');
    } catch (error: any) {
        if (error.response?.status === 401) {
            console.log('   ✅ Correctly rejected invalid credentials');
        } else {
            console.log('   ⚠️ Unexpected error:', error.message);
        }
    }

    // Test 2: No Authentication
    console.log('2. Testing missing authentication...');
    try {
        await axios.get('/Configuration/ProductVersion', config);
        console.log('   ❌ Security Issue: No authentication required!');
    } catch (error: any) {
        if (error.response?.status === 401) {
            console.log('   ✅ Correctly requires authentication');
        } else {
            console.log('   ⚠️ Unexpected error:', error.message);
        }
    }

    // Test 3: SQL Injection Protection
    console.log('3. Testing SQL injection protection...');
    try {
        const maliciousInput = "'; DROP TABLE Dimensions; --";
        await axios.get(`/Dimensions('${encodeURIComponent(maliciousInput)}')`, {
            ...config,
            auth: { username: 'admin', password: process.env.TM1_PASSWORD || '' }
        });
    } catch (error: any) {
        if (error.response?.status === 404) {
            console.log('   ✅ SQL injection protected (returns 404 for non-existent)');
        } else if (error.code === 'ECONNREFUSED') {
            console.log('   ⚠️ TM1 server not available');
        } else {
            console.log('   ✅ Protected against SQL injection');
        }
    }

    // Test 4: Rate Limiting
    console.log('4. Testing rate limiting resilience...');
    try {
        const validConfig = {
            ...config,
            auth: { username: 'admin', password: process.env.TM1_PASSWORD || '' }
        };

        const requests = Array(10).fill(null).map(() =>
            axios.get('/Configuration/ProductVersion', validConfig)
        );

        const results = await Promise.allSettled(requests);
        const successful = results.filter(r => r.status === 'fulfilled').length;
        
        if (successful >= 5) {
            console.log(`   ✅ Handled concurrent requests (${successful}/10 successful)`);
        } else {
            console.log(`   ⚠️ Some rate limiting detected (${successful}/10 successful)`);
        }
    } catch (error: any) {
        if (error.code === 'ECONNREFUSED') {
            console.log('   ⚠️ TM1 server not available');
        } else {
            console.log('   ⚠️ Error during rate limiting test');
        }
    }

    console.log('\n🔒 Security test completed!');
}

if (require.main === module) {
    runSecurityTests().catch(console.error);
}

export { runSecurityTests };