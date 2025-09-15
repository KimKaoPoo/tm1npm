#!/bin/bash

# TM1npm Test Runner - Simple bash version
# Run all test suites and provide summary

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Test results
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

print_header() {
    echo -e "${BOLD}${CYAN}╔══════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BOLD}${CYAN}║                        TM1NPM Test Runner                       ║${NC}"
    echo -e "${BOLD}${CYAN}║                     Running All Test Suites                     ║${NC}"
    echo -e "${BOLD}${CYAN}╚══════════════════════════════════════════════════════════════════╝${NC}"
    echo
}

run_test() {
    local test_name="$1"
    local test_cmd="$2"
    local description="$3"
    
    echo -e "${BLUE}▶ ${BOLD}${test_name}${NC}"
    echo -e "  ${CYAN}${description}${NC}"
    echo "  ────────────────────────────────────────────────────────────"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if eval "$test_cmd" > /dev/null 2>&1; then
        echo -e "  ${GREEN}✅ PASSED${NC} ${BOLD}${test_name}${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "  ${RED}❌ FAILED${NC} ${BOLD}${test_name}${NC}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    echo
}

print_summary() {
    echo -e "${BOLD}${CYAN}╔══════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BOLD}${CYAN}║                          Test Summary                            ║${NC}"
    echo -e "${BOLD}${CYAN}╚══════════════════════════════════════════════════════════════════╝${NC}"
    echo
    
    echo -e "${BOLD}Total Tests:${NC} $TOTAL_TESTS"
    echo -e "${GREEN}${BOLD}Passed:${NC} $PASSED_TESTS"
    echo -e "${RED}${BOLD}Failed:${NC} $FAILED_TESTS"
    
    if [ $TOTAL_TESTS -gt 0 ]; then
        SUCCESS_RATE=$(( (PASSED_TESTS * 100) / TOTAL_TESTS ))
        echo -e "${BOLD}Success Rate:${NC} ${SUCCESS_RATE}%"
    fi
    echo
    
    if [ $PASSED_TESTS -eq $TOTAL_TESTS ]; then
        echo -e "${GREEN}${BOLD}🎉 All tests passed! tm1npm is working correctly.${NC}"
    else
        echo -e "${YELLOW}${BOLD}⚠️ Some tests failed. Check individual test output.${NC}"
        echo
        echo -e "${BOLD}Troubleshooting Tips:${NC}"
        echo "• Ensure TM1 server is running at localhost:8879"
        echo "• Check if TM1 REST API is enabled"
        echo "• Make sure no firewall is blocking port 8879"
        echo "• Run individual tests with: npm run test:<testname>"
    fi
}

main() {
    print_header
    
    echo -e "${BOLD}Starting test execution...${NC}"
    echo
    
    # Run all test suites
    run_test "Jest Tests" "npm test" "Run all Jest unit tests"
    run_test "Connection Test" "npm run test:connection" "Test TM1 connection with comprehensive checks"
    run_test "Simple Connection Test" "npm run test:simple" "Basic TM1 connectivity test"
    run_test "Minimal Connection Test" "npm run test:minimal" "Minimal connection verification"
    run_test "Working Test" "npm run test:working" "Comprehensive TM1 functionality test"
    run_test "Test Coverage" "npm run test:coverage" "Run tests with coverage report"
    
    print_summary
    
    # Exit with appropriate code
    if [ $FAILED_TESTS -gt 0 ]; then
        exit 1
    else
        exit 0
    fi
}

# Handle interruption
trap 'echo -e "\n${YELLOW}Test execution interrupted by user.${NC}"; exit 130' INT

# Run main function
main