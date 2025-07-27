#!/bin/bash

# Script to load test environment variables from test-tokens.json

if [ ! -f "test-tokens.json" ]; then
  echo "❌ test-tokens.json not found. Run setup-strapi-test.sh first."
  exit 1
fi

echo "📋 Loading environment from test-tokens.json..."

# Export API tokens
export STRAPI_URL=$(jq -r .strapiUrl test-tokens.json)
export STRAPI_API_TOKEN=$(jq -r .fullAccessToken test-tokens.json)
export STRAPI_READ_ONLY_TOKEN=$(jq -r .readOnlyToken test-tokens.json)
export STRAPI_ADMIN_EMAIL=$(jq -r .adminEmail test-tokens.json)
export STRAPI_ADMIN_PASSWORD=$(jq -r .adminPassword test-tokens.json)

# Export Strapi environment variables if they exist
if [ "$(jq -r '.env // empty' test-tokens.json)" != "" ]; then
  export APP_KEYS=$(jq -r .env.APP_KEYS test-tokens.json)
  export API_TOKEN_SALT=$(jq -r .env.API_TOKEN_SALT test-tokens.json)
  export ADMIN_JWT_SECRET=$(jq -r .env.ADMIN_JWT_SECRET test-tokens.json)
  export TRANSFER_TOKEN_SALT=$(jq -r .env.TRANSFER_TOKEN_SALT test-tokens.json)
  export JWT_SECRET=$(jq -r .env.JWT_SECRET test-tokens.json)
fi

echo "✅ Environment loaded. You can now run tests with:"
echo "   npm test"
echo ""
echo "📝 Exported variables:"
echo "   STRAPI_URL=$STRAPI_URL"
echo "   STRAPI_API_TOKEN=<token>"
echo "   STRAPI_ADMIN_EMAIL=$STRAPI_ADMIN_EMAIL"
echo "   STRAPI_ADMIN_PASSWORD=<hidden>"