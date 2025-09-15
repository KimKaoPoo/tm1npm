/**
 * Simple connection test using axios directly
 */

import axios from 'axios';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function simpleConnectionTest(): Promise<void> {
    const address = process.env.TM1_ADDRESS || 'localhost';
    const port = process.env.TM1_PORT || '8879';
    const user = process.env.TM1_USER || 'admin';
    const password = process.env.TM1_PASSWORD;

    if (!password) {
        console.log('❌ TM1_PASSWORD environment variable is required');
        console.log('Please set TM1_PASSWORD in your .env file');
        process.exit(1);
    }

    console.log('🔍 Simple TM1 Connection Test');
    console.log(`Server: ${address}:${port}`);
    console.log(`User: ${user}`);
    console.log('=' .repeat(40));

    const config = {
        baseURL: `http://${address}:${port}/api/v1`,
        auth: {
            username: user,
            password: password
        },
        timeout: 30000
    };

    try {
        console.log('⏳ Testing basic server connectivity...');
        
        // Test basic server connection
        const response = await axios.get('/Configuration/ProductVersion', config);
        console.log('✅ Server responded successfully!');
        console.log(`📈 TM1 Version: ${response.data.value}`);

        // Test server name
        const nameResponse = await axios.get('/Configuration/ServerName', config);
        console.log(`🏷️ Server Name: ${nameResponse.data.value}`);

        // Test basic endpoints
        console.log('⏳ Testing basic endpoints...');
        const cubesResponse = await axios.get('/Cubes?$top=1&$select=Name', config);
        const dimsResponse = await axios.get('/Dimensions?$top=1&$select=Name', config);
        
        console.log(`📊 Found cubes: ${cubesResponse.data.value.length > 0 ? 'Yes' : 'None'}`);
        console.log(`📁 Found dimensions: ${dimsResponse.data.value.length > 0 ? 'Yes' : 'None'}`);

        console.log('\n🎉 Simple connection test PASSED!');
        console.log('✅ TM1 server is accessible and responding correctly');

    } catch (error: any) {
        console.log('\n❌ Connection test FAILED!');
        console.log(`Error: ${error.message || error}`);
        
        if (error.code === 'ECONNREFUSED') {
            console.log('   Connection refused - server may not be running');
        } else if (error.response?.status === 401) {
            console.log('   Authentication failed - check username/password');
        }
        
        console.log('\n🔧 Troubleshooting checklist:');
        console.log('   □ TM1 server is running at localhost:8879');
        console.log('   □ Username: admin');
        console.log('   □ TM1 REST API is enabled');
        console.log('   □ No firewall blocking port 8879');
    }
}

// Run the test
if (require.main === module) {
    simpleConnectionTest().catch((error) => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

export { simpleConnectionTest };