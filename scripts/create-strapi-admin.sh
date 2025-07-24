#!/bin/bash

# Script to create admin user and API token for Strapi test instance

# Default credentials
ADMIN_EMAIL="test@example.com"
ADMIN_PASSWORD="Test1234!"

# First check if Strapi is running
if ! curl -s -o /dev/null -w "%{http_code}" http://localhost:1337/_health | grep -q "204"; then
  echo "Error: Strapi is not running. Start it first with: ./scripts/start-strapi-test.sh"
  exit 1
fi

echo "Creating admin user..."

# Try to register the first admin user
REGISTER_RESPONSE=$(curl -s -X POST http://localhost:1337/admin/register-admin \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$ADMIN_EMAIL\",
    \"password\": \"$ADMIN_PASSWORD\",
    \"firstname\": \"Test\",
    \"lastname\": \"Admin\"
  }")

# Check if registration was successful or if admin already exists
if echo "$REGISTER_RESPONSE" | jq -e '.data.token' > /dev/null 2>&1; then
  ADMIN_JWT=$(echo "$REGISTER_RESPONSE" | jq -r '.data.token')
  echo "Admin user created successfully!"
else
  echo "Admin user might already exist or registration failed."
  echo "Response: $REGISTER_RESPONSE"
  
  # For Strapi 5, we need to manually create the API token via the admin panel
  echo ""
  echo "========================================="
  echo "Manual API Token Creation Required"
  echo "========================================="
  echo "1. Open http://localhost:1337/admin in your browser"
  echo "2. Log in with:"
  echo "   Email: $ADMIN_EMAIL"
  echo "   Password: $ADMIN_PASSWORD"
  echo "3. Go to Settings > API Tokens"
  echo "4. Create a new token with 'Full access' permissions"
  echo "5. Copy the token and export it:"
  echo "   export STRAPI_API_TOKEN=<your-token>"
  echo ""
  exit 0
fi

# Try to create an API token programmatically
echo "Creating API token..."
API_TOKEN_RESPONSE=$(curl -s -X POST http://localhost:1337/admin/api-tokens \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -d '{
    "name": "Test Token",
    "description": "Token for MCP tests",
    "type": "full-access",
    "lifespan": null
  }')

if echo "$API_TOKEN_RESPONSE" | jq -e '.data.accessKey' > /dev/null 2>&1; then
  API_TOKEN=$(echo "$API_TOKEN_RESPONSE" | jq -r '.data.accessKey')
  echo "API token created successfully!"
  echo ""
  echo "========================================="
  echo "Strapi Admin & API Token Created"
  echo "========================================="
  echo "Admin Email: $ADMIN_EMAIL"
  echo "Admin Password: $ADMIN_PASSWORD"
  echo "API Token: $API_TOKEN"
  echo ""
  echo "To run tests, use:"
  echo "export STRAPI_URL=http://localhost:1337"
  echo "export STRAPI_API_TOKEN=$API_TOKEN"
  echo "npm test"
else
  echo "Failed to create API token programmatically."
  echo "Response: $API_TOKEN_RESPONSE"
  echo ""
  echo "Please create the token manually via the admin panel (see instructions above)."
fi