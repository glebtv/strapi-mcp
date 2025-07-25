#!/bin/bash

# Exit on error
set -e

# Load nvm and use Node 22
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use 22

echo "Using Node version: $(node --version)"
echo "Setting up Strapi test instance..."

# Create a minimal Strapi 5 project for testing
npx create-strapi@latest strapi-test \
  --typescript \
  --no-run \
  --no-example \
  --no-git-init \
  --dbclient=sqlite \
  --skip-cloud \
  --install

cd strapi-test

# Copy content types and configuration from fixtures
echo "📝 Copying content types and configuration..."
cp -r ../fixtures/strapi-test/api/* src/api/
cp -r ../fixtures/strapi-test/config/* config/

# Build and start Strapi
echo "Building Strapi..."
npm run build

echo "Starting Strapi in background..."
npm run develop &
STRAPI_PID=$!
echo "Strapi PID: $STRAPI_PID"

# Wait for Strapi to be ready
echo "Waiting for Strapi to start..."
for i in {1..60}; do
  if curl -s -o /dev/null -w "%{http_code}" http://localhost:1337/_health | grep -q "204"; then
    echo "Strapi is ready!"
    break
  fi
  echo "Waiting... ($i/60)"
  sleep 2
done

# Create an API token using Strapi's admin API
# First, we need to create an admin user
ADMIN_EMAIL="test@example.com"
ADMIN_PASSWORD="Test1234!"

echo "Creating admin user..."
# Register the first admin user
ADMIN_JWT=$(curl -s -X POST http://localhost:1337/admin/register-admin \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$ADMIN_EMAIL\",
    \"password\": \"$ADMIN_PASSWORD\",
    \"firstname\": \"Test\",
    \"lastname\": \"Admin\"
  }" | jq -r '.data.token')

if [ -z "$ADMIN_JWT" ] || [ "$ADMIN_JWT" = "null" ]; then
  echo "Failed to create admin user"
  exit 1
fi

echo "Admin user created successfully"

# Create an API token
echo "Creating API token..."
API_TOKEN_RESPONSE=$(curl -s -X POST http://localhost:1337/admin/api-tokens \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -d '{
    "name": "CI Test Token",
    "description": "Token for CI tests",
    "type": "full-access",
    "lifespan": null
  }')

API_TOKEN=$(echo $API_TOKEN_RESPONSE | jq -r '.data.accessKey')

if [ -z "$API_TOKEN" ] || [ "$API_TOKEN" = "null" ]; then
  echo "Failed to create API token"
  echo "Response: $API_TOKEN_RESPONSE"
  exit 1
fi

echo "API token created successfully"

# Get public role ID
PUBLIC_ROLE_ID=$(curl -s http://localhost:1337/admin/roles \
  -H "Authorization: Bearer $ADMIN_JWT" | jq -r '.data[] | select(.type == "public") | .id')

echo "Updating public role permissions..."
# Enable all actions for public role (for testing)
curl -s -X PUT http://localhost:1337/admin/roles/$PUBLIC_ROLE_ID \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -d '{
    "permissions": {
      "api::project.project": {
        "controllers": {
          "project": {
            "find": { "enabled": true },
            "findOne": { "enabled": true },
            "create": { "enabled": true },
            "update": { "enabled": true },
            "delete": { "enabled": true }
          }
        }
      },
      "api::technology.technology": {
        "controllers": {
          "technology": {
            "find": { "enabled": true },
            "findOne": { "enabled": true },
            "create": { "enabled": true },
            "update": { "enabled": true },
            "delete": { "enabled": true }
          }
        }
      }
    }
  }'

echo ""
echo "========================================="
echo "Strapi test instance is ready!"
echo "========================================="
echo "Strapi URL: http://localhost:1337"
echo "Admin Email: $ADMIN_EMAIL"
echo "Admin Password: $ADMIN_PASSWORD"
echo "API Token: $API_TOKEN"
echo "Strapi PID: $STRAPI_PID"
echo ""
echo "To stop Strapi, run: kill $STRAPI_PID"
echo ""
echo "To run tests, use:"
echo "export STRAPI_URL=http://localhost:1337"
echo "export STRAPI_API_TOKEN=$API_TOKEN"
echo "npm test"