#!/bin/bash

# Run tests with a real Strapi instance
# This script ensures Strapi is running before executing tests

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Strapi is running
check_strapi() {
    if curl -s http://localhost:1337/_health > /dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Main execution
cd "$PROJECT_ROOT"

# Check if Strapi is running
if ! check_strapi; then
    log_info "Strapi is not running. Starting test instance..."
    ./scripts/setup-test-strapi.sh start
    
    # Wait for Strapi to be ready
    max_attempts=30
    attempt=0
    while [ $attempt -lt $max_attempts ]; do
        if check_strapi; then
            break
        fi
        attempt=$((attempt + 1))
        sleep 2
    done
    
    if ! check_strapi; then
        log_error "Failed to start Strapi"
        exit 1
    fi
fi

log_info "Strapi is running. Starting tests..."

# Set environment variables
export STRAPI_URL="http://localhost:1337"
export STRAPI_ADMIN_EMAIL="admin@test.com"
export STRAPI_ADMIN_PASSWORD="Admin123!"
export STRAPI_DEV_MODE="true"

# Build the project
log_info "Building MCP server..."
npm run build

# Run tests based on argument
# If the first argument looks like a test file path, run it directly
if [[ "$1" == *.test.ts ]] || [[ "$1" == *tests/* ]]; then
    log_info "Running specific test file: $1"
    npm test -- --detectOpenHandles "$@"
else
    # Otherwise use the named test modes
    case "${1:-all}" in
        unit)
            log_info "Running unit tests..."
            npm test -- tests/tools/
            ;;
        integration)
            log_info "Running integration tests..."
            npm test -- tests/*.test.ts --testPathIgnorePatterns="tests/tools/"
            ;;
        coverage)
            log_info "Running tests with coverage..."
            npm run test:coverage
            ;;
        watch)
            log_info "Running tests in watch mode..."
            npm run test:watch
            ;;
        all)
            log_info "Running all tests..."
            npm test
            ;;
        *)
            log_error "Unknown test mode: $1"
            echo "Usage: $0 [mode|test-file]"
            echo "Modes: all, unit, integration, coverage, watch"
            echo "Or provide a test file path directly"
            exit 1
            ;;
    esac
fi

TEST_RESULT=$?

if [ $TEST_RESULT -eq 0 ]; then
    log_info "All tests passed!"
else
    log_error "Some tests failed!"
fi

exit $TEST_RESULT
