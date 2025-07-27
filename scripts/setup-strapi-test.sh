#!/bin/bash

# Exit on error
set -e

# Node should already be set up in the environment

echo "Using Node version: $(node --version)"
echo "🚀 Setting up Strapi test instance..."

# Load test environment variables if they exist
if [ -f ../.env.test ]; then
  echo "📋 Loading test environment variables from .env.test"
  export $(grep -v '^#' ../.env.test | xargs)
fi

# Generate secure random values for Strapi configuration
export APP_KEYS=$(openssl rand -base64 32)
export API_TOKEN_SALT=$(openssl rand -base64 32)
export ADMIN_JWT_SECRET=$(openssl rand -base64 32)
export TRANSFER_TOKEN_SALT=$(openssl rand -base64 32)
# Use static password from .env.test or default (with uppercase to meet requirements)
export ADMIN_PASSWORD=${STRAPI_ADMIN_PASSWORD:-Admin123456}
export JWT_SECRET=$(openssl rand -base64 32)

# Create a minimal Strapi 5 project for testing
echo "📦 Creating Strapi project..."

# Set CI environment for non-interactive mode
if [ ! -z "$CI" ]; then
  export FORCE_COLOR=0
  npm config set fund false
  npm config set audit false
  npm config set update-notifier false
fi

npx -y create-strapi@latest strapi-test \
  --typescript \
  --no-run \
  --no-example \
  --no-git-init \
  --dbclient=sqlite \
  --skip-cloud \
  --install

cd strapi-test

# Create .env file with proper configuration
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

# Copy configuration and content types from fixtures
echo "🔧 Copying configuration and content types..."
cp -r ../fixtures/strapi-test/config/* config/
cp -r ../fixtures/strapi-test/api/* src/api/

# Copy bootstrap script to create tokens automatically
echo "📋 Copying bootstrap script..."
cp ../scripts/bootstrap-tokens.ts src/index.ts

# Build Strapi (first build)
echo "🔨 Building Strapi..."
npm run build

# Now rebuild to ensure content types are properly registered
echo "🔨 Rebuilding to register content types..."
npm run build

# Start Strapi in development mode for auto-reload functionality
echo "🚀 Starting Strapi in development mode..."
npm run develop > strapi_output.log 2>&1 &
STRAPI_PID=$!
echo "Strapi PID: $STRAPI_PID"

# Export variables for GitHub Actions early
if [ ! -z "$GITHUB_ENV" ]; then
  echo "STRAPI_PID=$STRAPI_PID" >> $GITHUB_ENV
fi

# Wait for Strapi and create tokens
echo "⏳ Waiting for Strapi to start and creating tokens..."
cd ..
STRAPI_URL=http://localhost:1337 ADMIN_EMAIL=admin@ci.local ADMIN_PASSWORD=$ADMIN_PASSWORD npm run wait-and-create-tokens

if [ $? -ne 0 ]; then
  echo "❌ Failed to create tokens"
  echo "=== Strapi Output ==="
  tail -50 strapi-test/strapi_output.log
  kill $STRAPI_PID 2>/dev/null || true
  exit 1
fi

# Load tokens from test-tokens.json
if [ -f test-tokens.json ]; then
  FULL_ACCESS_TOKEN=$(jq -r .fullAccessToken test-tokens.json)
  READ_ONLY_TOKEN=$(jq -r .readOnlyToken test-tokens.json)
  
  echo "✅ Tokens loaded from test-tokens.json"
  echo "📝 Full Access Token: ${FULL_ACCESS_TOKEN:0:20}..."
  echo "📝 Read Only Token: ${READ_ONLY_TOKEN:0:20}..."
  
  # Export variables for GitHub Actions
  if [ ! -z "$GITHUB_ENV" ]; then
    echo "STRAPI_API_TOKEN=$FULL_ACCESS_TOKEN" >> $GITHUB_ENV
    echo "STRAPI_READ_ONLY_TOKEN=$READ_ONLY_TOKEN" >> $GITHUB_ENV
  fi
else
  echo "❌ test-tokens.json not found"
  kill $STRAPI_PID 2>/dev/null || true
  exit 1
fi

cd strapi-test

echo ""
# Setup i18n locales
echo "🌍 Setting up i18n locales..."
cd ..
if [ -f "scripts/setup-i18n-locales.js" ]; then
  # Run the JS version directly with the required env vars
  STRAPI_ADMIN_EMAIL="admin@ci.local" STRAPI_ADMIN_PASSWORD="$ADMIN_PASSWORD" STRAPI_URL="http://localhost:1337" node scripts/setup-i18n-locales.js
else
  echo "⚠️  i18n setup script not found, skipping locale setup"
fi

echo ""
echo "🎉 Strapi test instance is ready!"
echo ""
echo "📋 Configuration:"
echo "  URL: http://localhost:1337"
echo "  Admin Email: admin@ci.local"
echo "  Admin Password: $ADMIN_PASSWORD"
echo "  Full Access Token: $FULL_ACCESS_TOKEN"
echo "  Read Only Token: $READ_ONLY_TOKEN"
echo ""
echo "💡 To stop Strapi, run: kill $STRAPI_PID"
echo ""
echo "🔧 For testing strapi-mcp, export these variables:"
echo "export STRAPI_URL=http://localhost:1337"
echo "export STRAPI_API_TOKEN=$FULL_ACCESS_TOKEN"
echo "export STRAPI_READ_ONLY_TOKEN=$READ_ONLY_TOKEN"
echo "export STRAPI_ADMIN_EMAIL=admin@ci.local"
echo "export STRAPI_ADMIN_PASSWORD=$ADMIN_PASSWORD"