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
NODE_ENV=${CI:+production}${CI:-development}
# Disable telemetry for faster performance and cleaner logs
STRAPI_TELEMETRY_DISABLED=true
# Add encryption keys to avoid warnings  
ENCRYPTION_KEY=$(openssl rand -base64 32)
EOF

# Copy configuration and content types from fixtures
echo "🔧 Copying configuration and content types..."
cp -r ../fixtures/strapi-test/config/* config/
cp -r ../fixtures/strapi-test/api/* src/api/

# Create admin.config.ts to fix Vite fs.allow error
echo "🔧 Creating admin.config.ts for Vite configuration..."
cat > admin.config.ts << 'EOF'
import { mergeConfig, type UserConfig } from "vite";

export default (config: UserConfig) => {
  // Important: always return the modified config
  return mergeConfig(config, {
    server: {
      fs: {
        allow: [
          // Allow access to node_modules outside project root
          process.cwd(),
          "../..", // parent directories
          "/opt/node_modules", // common Docker paths
          "/opt/app",
        ],
      },
    },
    resolve: {
      alias: {
        "@": "/src",
      },
    },
  });
};
EOF

# No need for bootstrap function anymore since we're not creating tokens

# Start Strapi
echo "🚀 Starting Strapi..."
# Always use development mode for faster startup in tests
echo "Starting Strapi in development mode for tests..."
NODE_ENV=development npm run develop > strapi_output.log 2>&1 &
STRAPI_PID=$!
echo "Strapi PID: $STRAPI_PID"

# Export variables for GitHub Actions early
if [ ! -z "$GITHUB_ENV" ]; then
  echo "STRAPI_PID=$STRAPI_PID" >> $GITHUB_ENV
fi

# Wait for Strapi to be ready
echo "⏳ Waiting for Strapi to start..."
cd ..
max_attempts=60
attempt=0

while [ $attempt -lt $max_attempts ]; do
  if curl -s -f http://localhost:1337/_health > /dev/null 2>&1; then
    echo "✅ Strapi is ready!"
    break
  fi
  
  # Check if process is still running
  if ! ps -p $STRAPI_PID > /dev/null 2>&1; then
    echo "❌ Strapi process crashed"
    echo "=== Strapi Output ==="
    tail -50 strapi-test/strapi_output.log
    exit 1
  fi
  
  attempt=$((attempt + 1))
  if [ $attempt -eq $max_attempts ]; then
    echo "❌ Timeout waiting for Strapi"
    echo "=== Strapi Output ==="
    tail -50 strapi-test/strapi_output.log
    kill $STRAPI_PID 2>/dev/null || true
    exit 1
  fi
  
  echo -n "."
  sleep 1
done

# Register admin user using MCP server
echo ""
echo "👤 Registering admin user..."
STRAPI_URL=http://localhost:1337 ADMIN_EMAIL=admin@ci.local ADMIN_PASSWORD=$ADMIN_PASSWORD node scripts/register-admin.js

if [ $? -ne 0 ]; then
  echo "❌ Failed to register admin user"
  echo "=== Strapi Output ==="
  tail -50 strapi-test/strapi_output.log
  kill $STRAPI_PID 2>/dev/null || true
  exit 1
fi

echo ""
echo "🔓 Configuring public permissions..."
node scripts/configure-permissions-simple.js

if [ $? -ne 0 ]; then
  echo "❌ Failed to configure permissions"
  echo "=== Strapi Output ==="
  tail -50 strapi-test/strapi_output.log
  kill $STRAPI_PID 2>/dev/null || true
  exit 1
fi

cd strapi-test

echo ""
echo "🎉 Strapi test instance is ready!"
echo ""
echo "📋 Configuration:"
echo "  URL: http://localhost:1337"
echo "  Admin Email: admin@ci.local"
echo "  Admin Password: $ADMIN_PASSWORD"
echo ""
echo "💡 To stop Strapi, run: kill $STRAPI_PID"
echo ""
echo "🔧 For testing strapi-mcp, export these variables:"
echo "export STRAPI_URL=http://localhost:1337"
echo "export STRAPI_ADMIN_EMAIL=admin@ci.local"
echo "export STRAPI_ADMIN_PASSWORD=$ADMIN_PASSWORD"