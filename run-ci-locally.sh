#!/bin/bash

# Exit on error
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Running CI workflow locally${NC}"
echo -e "${BLUE}==============================${NC}"

# Store the current directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Clean up any existing Strapi instance
echo -e "${YELLOW}🧹 Cleaning up existing Strapi instance...${NC}"
pkill -f "strapi" || true
pkill -f "node.*develop" || true
sleep 2
rm -rf strapi-test test-tokens.json

# Step 1: Setup Strapi test instance
echo -e "${BLUE}📦 Step 1: Setup Strapi test instance${NC}"
./scripts/setup-strapi-test.sh
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to setup Strapi test instance${NC}"
    exit 1
fi

# Step 2: Install dependencies
echo -e "${BLUE}📦 Step 2: Install dependencies${NC}"
npm ci
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to install dependencies${NC}"
    exit 1
fi

# Step 3: Build MCP server
echo -e "${BLUE}🔨 Step 3: Build MCP server${NC}"
npm run build
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to build MCP server${NC}"
    exit 1
fi

# Step 4: Run linter
echo -e "${BLUE}🔍 Step 4: Run linter${NC}"
npm run lint
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Linter failed${NC}"
    exit 1
fi

# Step 5: Run type check
echo -e "${BLUE}✅ Step 5: Run type check${NC}"
npm run typecheck
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Type check failed${NC}"
    exit 1
fi

# Step 6: Run tests
echo -e "${BLUE}🧪 Step 6: Run tests${NC}"

# Load test tokens which includes admin credentials
if [ -f test-tokens.json ]; then
    echo -e "${GREEN}✅ Loading test tokens...${NC}"
    export STRAPI_API_TOKEN=$(jq -r .fullAccessToken test-tokens.json)
    export STRAPI_ADMIN_EMAIL=$(jq -r .adminEmail test-tokens.json)
    export STRAPI_ADMIN_PASSWORD=$(jq -r .adminPassword test-tokens.json)
    echo "STRAPI_API_TOKEN=${STRAPI_API_TOKEN:0:20}..."
    echo "STRAPI_ADMIN_EMAIL=$STRAPI_ADMIN_EMAIL"
    echo "STRAPI_ADMIN_PASSWORD=****"
else
    echo -e "${RED}❌ test-tokens.json not found!${NC}"
    exit 1
fi

# Set STRAPI_URL
export STRAPI_URL=http://localhost:1337

# Run tests
npm test

TEST_RESULT=$?

# Step 7: Stop Strapi
echo -e "${BLUE}🛑 Step 7: Stopping Strapi...${NC}"
STRAPI_PID=$(ps aux | grep "npm run develop" | grep -v grep | awk '{print $2}' | head -1)
if [ ! -z "$STRAPI_PID" ]; then
    echo "Killing Strapi process: $STRAPI_PID"
    kill $STRAPI_PID || true
    # Also kill any child processes
    pkill -P $STRAPI_PID || true
fi

# Additional cleanup
pkill -f "strapi" || true

if [ $TEST_RESULT -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed!${NC}"
else
    echo -e "${RED}❌ Tests failed!${NC}"
    exit $TEST_RESULT
fi

echo -e "${GREEN}🎉 CI workflow completed successfully!${NC}"