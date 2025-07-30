#!/bin/bash

# Setup script for local Strapi test instance
# Uses strapi-plugin-init-admin-user for reliable admin creation

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
STRAPI_PORT="${STRAPI_PORT:-1337}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@test.com}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-Admin123!}"

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

# Check if Strapi is already running
check_strapi_running() {
    if curl -s http://localhost:$STRAPI_PORT/_health > /dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Create test Strapi app
create_test_app() {
    log_info "Creating test Strapi app..."
    
    # Remove existing test app
    if [ -d "$TEST_DIR" ]; then
        log_warn "Removing existing test app"
        rm -rf "$TEST_DIR"
    fi
    
    # Create Strapi app with recommended flags
    npx create-strapi@latest "$TEST_DIR" \
        --typescript \
        --no-run \
        --no-example \
        --no-git-init \
        --dbclient=sqlite \
        --skip-cloud \
        --install
    
    cd "$TEST_DIR"
    
    # Install strapi-plugin-init-admin-user
    log_info "Installing strapi-plugin-init-admin-user..."
    npm install strapi-plugin-init-admin-user
    
    # Create .env file with proper configuration
    cat > .env << EOF
# Disable telemetry
STRAPI_TELEMETRY_DISABLED=true

# Admin user configuration
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

# Server configuration
HOST=0.0.0.0
PORT=$STRAPI_PORT
EOF

    # Copy fixtures for content types and configuration
    log_info "Copying test fixtures..."
    
    # Copy config files
    cp -r "$PROJECT_ROOT/fixtures/strapi-test/config/"* config/ 2>/dev/null || true
    
    # Copy API content types
    mkdir -p src/api
    if [ -d "$PROJECT_ROOT/fixtures/strapi-test/api" ]; then
        cp -r "$PROJECT_ROOT/fixtures/strapi-test/api/"* src/api/
        log_info "Copied content type fixtures"
    fi
    
    # Update config/admin.ts to disable rate limiting
    log_info "Configuring admin settings..."
    
    # Remove any JavaScript config files to avoid conflicts
    rm -f config/admin.js config/plugins.js
    
    # Update the TypeScript admin config to disable rate limiting
    cat > config/admin.ts << 'EOF'
export default ({ env }) => ({
  auth: {
    secret: env('ADMIN_JWT_SECRET'),
  },
  apiToken: {
    salt: env('API_TOKEN_SALT'),
  },
  transfer: {
    token: {
      salt: env('TRANSFER_TOKEN_SALT'),
    },
  },
  secrets: {
    encryptionKey: env('ENCRYPTION_KEY'),
  },
  flags: {
    nps: env.bool('FLAG_NPS', true),
    promoteEE: env.bool('FLAG_PROMOTE_EE', true),
  },
  // Disable rate limiting for tests to avoid 429 errors
  rateLimit: {
    enabled: false
  },
});
EOF

    # Build Strapi
    log_info "Building Strapi..."
    npm run build
}

# Start Strapi
start_strapi() {
    cd "$TEST_DIR"
    
    if check_strapi_running; then
        log_info "Strapi is already running on port $STRAPI_PORT"
        return 0
    fi
    
    log_info "Starting Strapi in development mode..."
    
    # Start Strapi in background
    nohup npm run develop > strapi.log 2>&1 &
    STRAPI_PID=$!
    
    log_info "Strapi starting with PID: $STRAPI_PID"
    echo $STRAPI_PID > strapi.pid
    
    # Wait for Strapi to be ready
    log_info "Waiting for Strapi to be ready..."
    local max_attempts=60
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if check_strapi_running; then
            log_info "Strapi is ready!"
            return 0
        fi
        
        attempt=$((attempt + 1))
        sleep 2
    done
    
    log_error "Strapi failed to start within timeout"
    if [ -f strapi.log ]; then
        log_error "Last 20 lines of Strapi log:"
        tail -20 strapi.log
    fi
    return 1
}

# Stop Strapi
stop_strapi() {
    if [ -f "$TEST_DIR/strapi.pid" ]; then
        PID=$(cat "$TEST_DIR/strapi.pid")
        if kill -0 $PID 2>/dev/null; then
            log_info "Stopping Strapi (PID: $PID)"
            kill $PID
            rm "$TEST_DIR/strapi.pid"
        fi
    fi
}

# Create test content types
create_test_content() {
    log_info "Creating test content types..."
    
    # Wait a bit for admin user to be created
    sleep 5
    
    # Get admin JWT token
    local token_response=$(curl -s -X POST http://localhost:$STRAPI_PORT/admin/login \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
    
    local jwt_token=$(echo $token_response | grep -o '"token":"[^"]*' | cut -d'"' -f4)
    
    if [ -z "$jwt_token" ]; then
        log_error "Failed to get admin JWT token"
        log_error "Response: $token_response"
        return 1
    fi
    
    log_info "Successfully logged in as admin"
}

# Main function
main() {
    case "${1:-setup}" in
        setup)
            log_info "Setting up test Strapi instance"
            create_test_app
            start_strapi
            create_test_content
            log_info "Test Strapi is ready at http://localhost:$STRAPI_PORT"
            log_info "Admin credentials: $ADMIN_EMAIL / $ADMIN_PASSWORD"
            ;;
        start)
            log_info "Starting existing test Strapi instance"
            if [ ! -d "$TEST_DIR" ]; then
                log_error "Test app not found. Run '$0 setup' first"
                exit 1
            fi
            start_strapi
            ;;
        stop)
            log_info "Stopping test Strapi instance"
            stop_strapi
            ;;
        restart)
            log_info "Restarting test Strapi instance"
            stop_strapi
            sleep 2
            start_strapi
            ;;
        clean)
            log_info "Cleaning up test Strapi instance"
            stop_strapi
            if [ -d "$TEST_DIR" ]; then
                rm -rf "$TEST_DIR"
            fi
            # test-tokens.json no longer used
            log_info "Cleanup complete"
            ;;
        status)
            if check_strapi_running; then
                log_info "Strapi is running on port $STRAPI_PORT"
            else
                log_info "Strapi is not running"
            fi
            ;;
        *)
            echo "Usage: $0 {setup|start|stop|restart|clean|status}"
            echo ""
            echo "Commands:"
            echo "  setup   - Create and start a new test Strapi instance"
            echo "  start   - Start existing test Strapi instance"
            echo "  stop    - Stop running test Strapi instance"
            echo "  restart - Restart test Strapi instance"
            echo "  clean   - Stop and remove test Strapi instance"
            echo "  status  - Check if Strapi is running"
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"