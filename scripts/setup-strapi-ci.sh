#!/bin/bash

# CI-specific Strapi setup script with better process management and logging
set -e

echo "🚀 CI-specific Strapi setup starting..."
echo "Environment: CI=${CI:-false}"
echo "Using Node version: $(node --version)"

# Set CI-specific environment variables
export FORCE_COLOR=0
export CI=true

# Function to check if Strapi is really running
check_strapi_process() {
    if [ ! -z "$1" ]; then
        if ps -p $1 > /dev/null 2>&1; then
            return 0
        fi
    fi
    return 1
}

# Clean up any existing Strapi processes
echo "🧹 Cleaning up any existing Strapi processes..."
# Be more specific to avoid killing the current script
pkill -f "strapi develop" || true
pkill -f "npm run develop" || true
# Kill any node processes running in strapi-test directory
pkill -f "node.*strapi-test" || true
sleep 2

# Remove any existing test instance
rm -rf strapi-test test-tokens.json

# Create Strapi test instance
echo "📦 Creating Strapi project..."
npx -y create-strapi@latest strapi-test \
  --typescript \
  --no-run \
  --no-example \
  --no-git-init \
  --dbclient=sqlite \
  --skip-cloud \
  --install

cd strapi-test

# Generate secure random values
export APP_KEYS=$(openssl rand -base64 32)
export API_TOKEN_SALT=$(openssl rand -base64 32)
export ADMIN_JWT_SECRET=$(openssl rand -base64 32)
export TRANSFER_TOKEN_SALT=$(openssl rand -base64 32)
export ADMIN_PASSWORD=${STRAPI_ADMIN_PASSWORD:-Admin123456}
export JWT_SECRET=$(openssl rand -base64 32)

# Create .env file
echo "🔧 Creating .env file..."
cat > .env << EOF
HOST=0.0.0.0
PORT=1337
APP_KEYS=$APP_KEYS
API_TOKEN_SALT=$API_TOKEN_SALT
ADMIN_JWT_SECRET=$ADMIN_JWT_SECRET
TRANSFER_TOKEN_SALT=$TRANSFER_TOKEN_SALT
JWT_SECRET=$JWT_SECRET
ADMIN_EMAIL=admin@ci.local
ADMIN_PASSWORD=$ADMIN_PASSWORD
DATABASE_CLIENT=sqlite
DATABASE_FILENAME=.tmp/data.db
NODE_ENV=test
EOF

# Copy configuration and content types
echo "🔧 Copying configuration and content types..."
cp -r ../fixtures/strapi-test/config/* config/
cp -r ../fixtures/strapi-test/api/* src/api/

# Copy bootstrap script
echo "📋 Copying bootstrap script..."
cp ../scripts/bootstrap-tokens.ts src/index.ts

# Start Strapi with better error handling
echo "🚀 Starting Strapi in development mode..."

# Create a wrapper script that will handle Strapi startup
cat > start-strapi.js << 'EOJS'
const { spawn } = require('child_process');
const fs = require('fs');

console.log('Starting Strapi process...');

// Create log file
const logStream = fs.createWriteStream('strapi_output.log', { flags: 'a' });

// Start Strapi
const strapi = spawn('npm', ['run', 'develop'], {
  detached: true,
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, FORCE_COLOR: '0' }
});

// Write PID file
fs.writeFileSync('strapi.pid', strapi.pid.toString());

// Handle output
strapi.stdout.on('data', (data) => {
  logStream.write(data);
  process.stdout.write(data);
});

strapi.stderr.on('data', (data) => {
  logStream.write(data);
  process.stderr.write(data);
});

strapi.on('error', (error) => {
  console.error('Failed to start Strapi:', error);
  process.exit(1);
});

// Detach and let it run
strapi.unref();

console.log(`Strapi started with PID: ${strapi.pid}`);
EOJS

# Start Strapi using the wrapper
node start-strapi.js &
WRAPPER_PID=$!

# Wait a moment for the process to start
sleep 5

# Get the actual Strapi PID from the file
if [ -f strapi.pid ]; then
    STRAPI_PID=$(cat strapi.pid)
    echo "Strapi PID from file: $STRAPI_PID"
else
    echo "❌ Failed to get Strapi PID"
    exit 1
fi

# Verify Strapi process is running
if ! check_strapi_process $STRAPI_PID; then
    echo "❌ Strapi process not found after startup"
    if [ -f strapi_output.log ]; then
        echo "=== Last 50 lines of Strapi output ==="
        tail -50 strapi_output.log
    fi
    exit 1
fi

# Export for GitHub Actions
if [ ! -z "$GITHUB_ENV" ]; then
    echo "STRAPI_PID=$STRAPI_PID" >> $GITHUB_ENV
fi

# Wait for Strapi and create tokens
echo "⏳ Waiting for Strapi to be ready and creating tokens..."
cd ..

# Run with extended timeout for CI
STRAPI_URL=http://localhost:1337 \
ADMIN_EMAIL=admin@ci.local \
ADMIN_PASSWORD=$ADMIN_PASSWORD \
CI=true \
npm run wait-and-create-tokens

if [ $? -ne 0 ]; then
    echo "❌ Failed to create tokens"
    echo "=== Strapi process status ==="
    ps aux | grep -E "(strapi|node.*develop)" | grep -v grep || echo "No Strapi processes found"
    echo "=== Last 50 lines of Strapi output ==="
    tail -50 strapi-test/strapi_output.log || echo "No log file found"
    
    # Try to kill the process
    if [ ! -z "$STRAPI_PID" ]; then
        kill $STRAPI_PID 2>/dev/null || true
    fi
    exit 1
fi

# Verify tokens were created
if [ -f test-tokens.json ]; then
    echo "✅ Tokens created successfully"
    
    # Export for GitHub Actions
    if [ ! -z "$GITHUB_ENV" ]; then
        FULL_ACCESS_TOKEN=$(jq -r .fullAccessToken test-tokens.json)
        READ_ONLY_TOKEN=$(jq -r .readOnlyToken test-tokens.json)
        echo "STRAPI_API_TOKEN=$FULL_ACCESS_TOKEN" >> $GITHUB_ENV
        echo "STRAPI_READ_ONLY_TOKEN=$READ_ONLY_TOKEN" >> $GITHUB_ENV
    fi
else
    echo "❌ test-tokens.json not found"
    exit 1
fi

echo "🎉 Strapi CI setup complete!"
echo "Strapi PID: $STRAPI_PID"