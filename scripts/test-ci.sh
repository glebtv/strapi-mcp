#!/bin/bash

# Strapi MCP CI Test Script
# This script sets up a test Strapi instance and runs all MCP server tests

set -e  # Exit on error
set -u  # Exit on undefined variable

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
TEST_DIR="${PROJECT_ROOT}/test-strapi-app"
STRAPI_PORT=1337
ADMIN_EMAIL="admin@test.com"
ADMIN_PASSWORD="Admin123!"
NODE_VERSION="20"

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Cleanup function
cleanup() {
    log_info "Cleaning up..."
    
    # Kill Strapi if running
    if [ -n "${STRAPI_PID:-}" ]; then
        log_info "Stopping Strapi (PID: $STRAPI_PID)"
        kill $STRAPI_PID 2>/dev/null || true
        wait $STRAPI_PID 2>/dev/null || true
    fi
    
    # Remove test app
    if [ -d "$TEST_DIR" ]; then
        log_info "Removing test Strapi app"
        rm -rf "$TEST_DIR"
    fi
}

# Set trap for cleanup
trap cleanup EXIT

# Check Node.js version
check_node_version() {
    log_info "Checking Node.js version..."
    
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed"
        exit 1
    fi
    
    NODE_VERSION_INSTALLED=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION_INSTALLED" -lt "$NODE_VERSION" ]; then
        log_error "Node.js version $NODE_VERSION or higher is required (found v$NODE_VERSION_INSTALLED)"
        exit 1
    fi
    
    log_info "Node.js version check passed (v$NODE_VERSION_INSTALLED)"
}

# Create test Strapi app
create_test_app() {
    log_info "Creating test Strapi app..."
    
    # Remove existing test app
    if [ -d "$TEST_DIR" ]; then
        rm -rf "$TEST_DIR"
    fi
    
    # Create Strapi app with specific configuration
    npx create-strapi@latest "$TEST_DIR" \
        --typescript \
        --no-run \
        --no-example \
        --no-git-init \
        --dbclient=sqlite \
        --skip-cloud \
        --install
    
    cd "$TEST_DIR"
    
    # Disable telemetry
    echo "STRAPI_TELEMETRY_DISABLED=true" >> .env
    
    # Install init-admin-user plugin for CI
    log_info "Installing strapi-plugin-init-admin-user..."
    npm install strapi-plugin-init-admin-user
    
    # Configure admin user creation and security keys
    cat >> .env << EOF

# Admin user for CI
INIT_ADMIN_USERNAME=admin
INIT_ADMIN_PASSWORD=$ADMIN_PASSWORD
INIT_ADMIN_FIRSTNAME=Test
INIT_ADMIN_LASTNAME=Admin
INIT_ADMIN_EMAIL=$ADMIN_EMAIL

# Security keys (generated for test environment)
ADMIN_JWT_SECRET=$(openssl rand -base64 32)
API_TOKEN_SALT=$(openssl rand -base64 16)
APP_KEYS=$(openssl rand -base64 32),$(openssl rand -base64 32)
TRANSFER_TOKEN_SALT=$(openssl rand -base64 16)
JWT_SECRET=$(openssl rand -base64 32)
EOF

    # Build Strapi
    log_info "Building Strapi..."
    npm run build
}

# Start Strapi in background
start_strapi() {
    log_info "Starting Strapi in development mode..."
    
    cd "$TEST_DIR"
    
    # Start Strapi and capture logs
    npm run develop > strapi.log 2>&1 &
    STRAPI_PID=$!
    
    log_info "Strapi started with PID: $STRAPI_PID"
    
    # Wait for Strapi to be ready
    log_info "Waiting for Strapi to be ready..."
    local max_attempts=60
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if curl -s http://localhost:$STRAPI_PORT/_health > /dev/null; then
            log_info "Strapi is ready!"
            return 0
        fi
        
        attempt=$((attempt + 1))
        sleep 2
    done
    
    log_error "Strapi failed to start within timeout"
    return 1
}

# Create test content types
create_test_content() {
    log_info "Creating test content types..."
    
    # Get admin JWT token
    local token_response=$(curl -s -X POST http://localhost:$STRAPI_PORT/admin/login \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
    
    local jwt_token=$(echo $token_response | grep -o '"token":"[^"]*' | cut -d'"' -f4)
    
    if [ -z "$jwt_token" ]; then
        log_error "Failed to get admin JWT token"
        return 1
    fi
    
    log_info "Got admin JWT token"
    
    # Create Article content type
    curl -s -X POST http://localhost:$STRAPI_PORT/admin/content-type-builder/content-types \
        -H "Authorization: Bearer $jwt_token" \
        -H "Content-Type: application/json" \
        -d '{
            "contentType": {
                "displayName": "Article",
                "singularName": "article",
                "pluralName": "articles",
                "kind": "collectionType",
                "draftAndPublish": true,
                "attributes": {
                    "title": {
                        "type": "string",
                        "required": true
                    },
                    "content": {
                        "type": "richtext"
                    },
                    "author": {
                        "type": "relation",
                        "relation": "manyToOne",
                        "target": "plugin::users-permissions.user"
                    }
                }
            }
        }' > /dev/null
    
    log_info "Created Article content type"
    
    # Wait for Strapi to reload
    sleep 5
    
    # Wait for health check
    local max_attempts=30
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if curl -s http://localhost:$STRAPI_PORT/_health > /dev/null; then
            log_info "Strapi reloaded successfully"
            break
        fi
        attempt=$((attempt + 1))
        sleep 2
    done
}

# Run MCP server tests
run_tests() {
    log_info "Running MCP server tests..."
    
    cd "$PROJECT_ROOT"
    
    # Set environment variables for tests
    export STRAPI_URL="http://localhost:$STRAPI_PORT"
    export STRAPI_ADMIN_EMAIL="$ADMIN_EMAIL"
    export STRAPI_ADMIN_PASSWORD="$ADMIN_PASSWORD"
    export STRAPI_DEV_MODE="true"
    
    # Build the MCP server
    log_info "Building MCP server..."
    npm run build
    
    # Run tests
    log_info "Running test suite..."
    npm test
    
    # Run coverage
    log_info "Running test coverage..."
    npm run test:coverage
}

# Check Strapi logs for errors
check_strapi_logs() {
    log_info "Checking Strapi logs for errors..."
    
    cd "$TEST_DIR"
    
    if [ -f strapi.log ]; then
        # Check for critical errors
        if grep -E "(FATAL|CRITICAL|ERROR.*database|ERROR.*plugin)" strapi.log > /dev/null; then
            log_error "Found critical errors in Strapi logs:"
            grep -E "(FATAL|CRITICAL|ERROR)" strapi.log | tail -20
            return 1
        else
            log_info "No critical errors found in Strapi logs"
        fi
    else
        log_warn "Strapi log file not found"
    fi
    
    return 0
}

# Main execution
main() {
    log_info "Starting Strapi MCP CI test pipeline"
    log_info "Project root: $PROJECT_ROOT"
    
    # Check prerequisites
    check_node_version
    
    # Install project dependencies
    log_info "Installing MCP server dependencies..."
    cd "$PROJECT_ROOT"
    npm install
    
    # Create and start test Strapi
    create_test_app
    start_strapi
    
    # Create test content
    create_test_content
    
    # Run tests
    run_tests
    TEST_RESULT=$?
    
    # Check Strapi logs
    check_strapi_logs
    LOG_CHECK_RESULT=$?
    
    # Determine overall result
    if [ $TEST_RESULT -eq 0 ] && [ $LOG_CHECK_RESULT -eq 0 ]; then
        log_info "All tests passed successfully!"
        exit 0
    else
        log_error "Tests failed!"
        exit 1
    fi
}

# Run main function
main