#!/usr/bin/env node

/**
 * Run all tm1npm tests in sequence
 * This script executes all available test commands and provides a summary
 */

const { spawn } = require('child_process');
const path = require('path');

// ANSI color codes for better output
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    reset: '\x1b[0m',
    bold: '\x1b[1m'
};

// Test configurations
const tests = [
    {
        name: 'Jest Tests',
        command: 'npm',
        args: ['test', '--', '--testTimeout=10000'],
        description: 'Run all Jest unit tests',
        timeout: 120000
    },
    {
        name: 'Connection Test',
        command: 'npm',
        args: ['run', 'test:connection'],
        description: 'Test TM1 connection with comprehensive checks',
        timeout: 60000
    },
    {
        name: 'Simple Connection Test',
        command: 'npm',
        args: ['run', 'test:simple'],
        description: 'Basic TM1 connectivity test',
        timeout: 30000
    },
    {
        name: 'Minimal Connection Test',
        command: 'npm',
        args: ['run', 'test:minimal'],
        description: 'Minimal connection verification',
        timeout: 30000
    },
    {
        name: 'Working Test',
        command: 'npm',
        args: ['run', 'test:working'],
        description: 'Comprehensive TM1 functionality test',
        timeout: 90000
    },
    {
        name: 'Security Tests',
        command: 'npm',
        args: ['run', 'test:security'],
        description: 'Security, authentication, and vulnerability tests',
        timeout: 120000
    },
    {
        name: 'Performance Tests',
        command: 'npm',
        args: ['run', 'test:performance'],
        description: 'Response time, memory usage, and scalability tests',
        timeout: 120000
    },
    {
        name: 'Edge Cases Tests',
        command: 'npm',
        args: ['run', 'test:edge-cases'],
        description: 'Boundary conditions and unusual input tests',
        timeout: 90000
    },
    {
        name: 'Test Coverage',
        command: 'npm',
        args: ['run', 'test:coverage', '--', '--testTimeout=10000'],
        description: 'Run tests with coverage report',
        timeout: 180000
    }
];

// Results tracking
const results = [];
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function printHeader() {
    console.log(`${colors.bold}${colors.cyan}╔══════════════════════════════════════════════════════════════════╗${colors.reset}`);
    console.log(`${colors.bold}${colors.cyan}║                        TM1NPM Test Runner                       ║${colors.reset}`);
    console.log(`${colors.bold}${colors.cyan}║                     Running All Test Suites                     ║${colors.reset}`);
    console.log(`${colors.bold}${colors.cyan}╚══════════════════════════════════════════════════════════════════╝${colors.reset}`);
    console.log('');
}

function printTestStart(testName, description) {
    console.log(`${colors.blue}▶ ${colors.bold}${testName}${colors.reset}`);
    console.log(`  ${colors.cyan}${description}${colors.reset}`);
    console.log('  ' + '─'.repeat(60));
}

function printTestResult(testName, success, output, error) {
    const status = success 
        ? `${colors.green}✅ PASSED${colors.reset}` 
        : `${colors.red}❌ FAILED${colors.reset}`;
    
    console.log(`  ${status} ${colors.bold}${testName}${colors.reset}`);
    
    if (success && output) {
        // Show last few lines of successful output
        const lines = output.split('\n').filter(line => line.trim());
        const lastLines = lines.slice(-3).join('\n  ');
        if (lastLines) {
            console.log(`  ${colors.green}${lastLines}${colors.reset}`);
        }
    }
    
    if (!success && error) {
        // Show error details
        const errorLines = error.split('\n').slice(0, 5).join('\n  ');
        console.log(`  ${colors.red}${errorLines}${colors.reset}`);
    }
    
    console.log('');
}

function runTest(test) {
    return new Promise((resolve) => {
        totalTests++;
        printTestStart(test.name, test.description);
        
        const child = spawn(test.command, test.args, {
            stdio: 'pipe',
            shell: true,
            cwd: process.cwd()
        });
        
        let output = '';
        let error = '';
        
        child.stdout.on('data', (data) => {
            output += data.toString();
        });
        
        child.stderr.on('data', (data) => {
            error += data.toString();
        });
        
        // Set timeout
        const timeout = setTimeout(() => {
            child.kill('SIGTERM');
            error = `Test timed out after ${test.timeout}ms`;
        }, test.timeout);
        
        child.on('close', (code) => {
            clearTimeout(timeout);
            const success = code === 0;
            
            if (success) {
                passedTests++;
            } else {
                failedTests++;
            }
            
            results.push({
                name: test.name,
                success,
                output: success ? output : null,
                error: success ? null : (error || output),
                code
            });
            
            printTestResult(test.name, success, output, error || output);
            resolve();
        });
        
        child.on('error', (err) => {
            clearTimeout(timeout);
            failedTests++;
            results.push({
                name: test.name,
                success: false,
                error: err.message,
                code: -1
            });
            printTestResult(test.name, false, null, err.message);
            resolve();
        });
    });
}

function printSummary() {
    console.log(`${colors.bold}${colors.cyan}╔══════════════════════════════════════════════════════════════════╗${colors.reset}`);
    console.log(`${colors.bold}${colors.cyan}║                          Test Summary                            ║${colors.reset}`);
    console.log(`${colors.bold}${colors.cyan}╚══════════════════════════════════════════════════════════════════╝${colors.reset}`);
    console.log('');
    
    console.log(`${colors.bold}Total Tests:${colors.reset} ${totalTests}`);
    console.log(`${colors.green}${colors.bold}Passed:${colors.reset} ${passedTests}`);
    console.log(`${colors.red}${colors.bold}Failed:${colors.reset} ${failedTests}`);
    console.log(`${colors.bold}Success Rate:${colors.reset} ${totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0}%`);
    console.log('');
    
    // Detailed results
    console.log(`${colors.bold}Detailed Results:${colors.reset}`);
    console.log('─'.repeat(70));
    
    results.forEach((result) => {
        const status = result.success 
            ? `${colors.green}✅ PASS${colors.reset}` 
            : `${colors.red}❌ FAIL${colors.reset}`;
        console.log(`${status} ${result.name}`);
    });
    
    console.log('');
    
    // Failed tests details
    const failedResults = results.filter(r => !r.success);
    if (failedResults.length > 0) {
        console.log(`${colors.red}${colors.bold}Failed Test Details:${colors.reset}`);
        console.log('─'.repeat(70));
        failedResults.forEach((result) => {
            console.log(`${colors.red}${colors.bold}${result.name}:${colors.reset}`);
            if (result.error) {
                const errorPreview = result.error.split('\n').slice(0, 3).join('\n');
                console.log(`  ${colors.red}${errorPreview}${colors.reset}`);
            }
            console.log('');
        });
    }
    
    // Final status
    if (passedTests === totalTests) {
        console.log(`${colors.green}${colors.bold}🎉 All tests passed! tm1npm is working correctly.${colors.reset}`);
    } else {
        console.log(`${colors.yellow}${colors.bold}⚠️ Some tests failed. Check the details above.${colors.reset}`);
        
        // Provide helpful tips
        console.log('');
        console.log(`${colors.bold}Troubleshooting Tips:${colors.reset}`);
        console.log('• Ensure TM1 server is running at localhost:8879');
        console.log('• Check if TM1 REST API is enabled');
        console.log('• Make sure no firewall is blocking port 8879');
        console.log('• Run individual tests with: npm run test:<testname>');
    }
}

async function runAllTests() {
    printHeader();
    
    console.log(`${colors.bold}Starting test execution...${colors.reset}`);
    console.log(`${colors.bold}Total test suites: ${tests.length}${colors.reset}`);
    console.log('');
    console.log(`${colors.cyan}📋 Test Suite Overview:${colors.reset}`);
    console.log(`${colors.cyan}• Basic Tests: Jest, Connection, Simple, Minimal, Working${colors.reset}`);
    console.log(`${colors.cyan}• Security Tests: Authentication, Authorization, Vulnerability${colors.reset}`);
    console.log(`${colors.cyan}• Performance Tests: Response Time, Memory, Scalability${colors.reset}`);
    console.log(`${colors.cyan}• Edge Cases: Boundary Conditions, Error Handling${colors.reset}`);
    console.log(`${colors.cyan}• Service Tests: ProcessService, DimensionService, CubeService, RestService, SubsetService${colors.reset}`);
    console.log(`${colors.cyan}• Coverage: Code Coverage Analysis${colors.reset}`);
    console.log('');
    
    // Run tests sequentially to avoid conflicts
    for (const test of tests) {
        await runTest(test);
    }
    
    printSummary();
    
    // Exit with appropriate code
    process.exit(failedTests > 0 ? 1 : 0);
}

// Handle interruption
process.on('SIGINT', () => {
    console.log(`\n${colors.yellow}Test execution interrupted by user.${colors.reset}`);
    printSummary();
    process.exit(130);
});

// Run if called directly
if (require.main === module) {
    runAllTests().catch((error) => {
        console.error(`${colors.red}Fatal error:${colors.reset}`, error);
        process.exit(1);
    });
}

module.exports = { runAllTests };