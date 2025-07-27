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
# Use static password from .env.test or default
export ADMIN_PASSWORD=${STRAPI_ADMIN_PASSWORD:-admin123456}
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

# Wait for token generation
echo "⏳ Waiting for Strapi to start and generate tokens..."
for i in {1..60}; do
  if grep -q "🔑 Access Key:" strapi_output.log; then
    echo "✅ Token generated!"
    break
  fi
  echo "Waiting... ($i/60)"
  sleep 1
done

# Extract the API token with proper pattern
FULL_ACCESS_TOKEN=$(grep -A1 "CI/CD Full Access" strapi_output.log | grep "🔑 Access Key:" | sed 's/.*🔑 Access Key: //')
READ_ONLY_TOKEN=$(grep -A1 "Testing Read Only" strapi_output.log | grep "🔑 Access Key:" | sed 's/.*🔑 Access Key: //')

if [ -z "$FULL_ACCESS_TOKEN" ]; then
  echo "❌ Failed to extract API token"
  echo "=== Strapi Output ==="
  cat strapi_output.log
  kill $STRAPI_PID 2>/dev/null || true
  exit 1
fi

echo "✅ API Tokens extracted successfully"
echo "📝 Full Access Token: $FULL_ACCESS_TOKEN"
echo "📝 Read Only Token: $READ_ONLY_TOKEN"

# Save tokens and all environment variables to file for later use
echo "💾 Saving tokens and environment to test-tokens.json..."
cat > ../test-tokens.json << EOF
{
  "fullAccessToken": "$FULL_ACCESS_TOKEN",
  "readOnlyToken": "$READ_ONLY_TOKEN",
  "strapiUrl": "http://localhost:1337",
  "adminEmail": "admin@ci.local",
  "adminPassword": "$ADMIN_PASSWORD",
  "env": {
    "APP_KEYS": "$APP_KEYS",
    "API_TOKEN_SALT": "$API_TOKEN_SALT",
    "ADMIN_JWT_SECRET": "$ADMIN_JWT_SECRET",
    "TRANSFER_TOKEN_SALT": "$TRANSFER_TOKEN_SALT",
    "JWT_SECRET": "$JWT_SECRET"
  }
}
EOF
echo "✅ Tokens and environment saved to test-tokens.json"

# Export variables for GitHub Actions
if [ ! -z "$GITHUB_ENV" ]; then
  echo "STRAPI_API_TOKEN=$FULL_ACCESS_TOKEN" >> $GITHUB_ENV
  echo "STRAPI_READ_ONLY_TOKEN=$READ_ONLY_TOKEN" >> $GITHUB_ENV
  echo "STRAPI_PID=$STRAPI_PID" >> $GITHUB_ENV
fi

# Test the token and wait for API to be ready
echo "🧪 Testing API token..."
for i in {1..30}; do
  if curl -s -f -H "Authorization: Bearer $FULL_ACCESS_TOKEN" http://localhost:1337/api/projects >/dev/null 2>&1; then
    echo "✅ Token validation successful!"
    break
  elif [ $i -eq 30 ]; then
    echo "❌ Token validation failed after 30 attempts"
    echo "=== Last curl attempt ==="
    curl -v -H "Authorization: Bearer $FULL_ACCESS_TOKEN" http://localhost:1337/api/projects
    echo ""
    echo "=== Strapi Output ==="
    tail -50 strapi_output.log
    kill $STRAPI_PID 2>/dev/null || true
    exit 1
  else
    echo "Waiting for API to be ready... ($i/30)"
    sleep 1
  fi
done

echo ""
# Setup i18n locales
echo "🌍 Setting up i18n locales..."
cd ..
if [ -f "scripts/setup-i18n-locales.ts" ]; then
  # First compile the TypeScript file
  npx tsc scripts/setup-i18n-locales.ts --module esnext --target es2022 --moduleResolution node --skipLibCheck
  # Then run it
  node scripts/setup-i18n-locales.js
  # Clean up
  rm -f scripts/setup-i18n-locales.js
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