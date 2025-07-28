#!/bin/bash

# Exit on error
set -e

# Store the current directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Create a log file for all CI output
CI_LOG="ci_runout.log"
rm -f "$CI_LOG"

# Redirect all output to both file and stdout (for CI visibility)
exec > >(tee -a "$CI_LOG")
exec 2>&1

# Colors for output (removed since they won't work well with file redirection)
echo "🚀 Running CI workflow locally"
echo "=============================="

# Clean up any existing Strapi instance
echo "🧹 Cleaning up existing Strapi instance..."
pkill -f "strapi" || true
pkill -f "node.*develop" || true
sleep 2
rm -rf strapi-test test-tokens.json

# Step 1: Setup Strapi test instance
echo "📦 Step 1: Setup Strapi test instance"
./scripts/setup-strapi-test.sh > ci_setup_strapi.log 2>&1
if [ $? -ne 0 ]; then
    echo "❌ Failed to setup Strapi test instance"
    cat ci_setup_strapi.log
    exit 1
fi

# Step 2: Install dependencies
echo "📦 Step 2: Install dependencies"
npm ci > ci_npm_install.log 2>&1
if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    cat ci_npm_install.log
    exit 1
fi

# Step 3: Build MCP server
echo "🔨 Step 3: Build MCP server"
npm run build > ci_build.log 2>&1
if [ $? -ne 0 ]; then
    echo "❌ Failed to build MCP server"
    cat ci_build.log
    exit 1
fi

# Step 4: Run tests
echo "🧪 Step 4: Run tests"

# Check if test-tokens.json exists
if [ ! -f test-tokens.json ]; then
    echo "❌ test-tokens.json not found!"
    exit 1
fi

echo "✅ test-tokens.json found - tests will load credentials automatically"

# Run tests in non-watch mode (setup.ts will load .env.test and test-tokens.json)
# Capture only to file
npm test -- --run > ci_test_output.log 2>&1
TEST_RESULT=$?

# Step 5: Run linter
echo "🔍 Step 5: Run linter"
npm run lint > ci_lint_output.log 2>&1
LINT_RESULT=$?

# Step 6: Run type check
echo "✅ Step 6: Run type check"
npm run typecheck > ci_typecheck_output.log 2>&1
TYPECHECK_RESULT=$?

# Step 7: Stop Strapi
echo "🛑 Step 7: Stopping Strapi..."

# Save Strapi logs before stopping
if [ -f strapi-test/strapi_output.log ]; then
    echo "📄 Saving Strapi logs..."
    cp strapi-test/strapi_output.log ci_strapi_last_run.log
    echo "Strapi logs saved to: ci_strapi_last_run.log"
fi

STRAPI_PID=$(ps aux | grep "npm run develop" | grep -v grep | awk '{print $2}' | head -1)
if [ ! -z "$STRAPI_PID" ]; then
    echo "Killing Strapi process: $STRAPI_PID"
    kill $STRAPI_PID || true
    # Also kill any child processes
    pkill -P $STRAPI_PID || true
fi

# Additional cleanup
pkill -f "strapi" || true

# Check all results and provide summary
echo ""
echo "=============================="
echo "CI Results Summary:"
echo "=============================="

# Display results without duplicating output
if [ $TEST_RESULT -ne 0 ]; then
    echo "❌ Tests failed! (exit code: $TEST_RESULT)"
    echo "   See ci_test_output.log for details"
else
    echo "✅ Tests passed!"
fi

if [ $LINT_RESULT -ne 0 ]; then
    echo "❌ Linter failed! (exit code: $LINT_RESULT)"
    echo "   See ci_lint_output.log for details"
else
    echo "✅ Linter passed!"
fi

if [ $TYPECHECK_RESULT -ne 0 ]; then
    echo "❌ Type check failed! (exit code: $TYPECHECK_RESULT)"
    echo "   See ci_typecheck_output.log for details"
else
    echo "✅ Type check passed!"
fi

echo ""
echo "=============================="
echo "📄 Log files created:"
echo "=============================="
echo "  - ci_runout.log (this run's console output)"
echo "  - ci_setup_strapi.log (Strapi setup output)"
echo "  - ci_npm_install.log (npm install output)"
echo "  - ci_build.log (build output)"
echo "  - ci_test_output.log (test output)"
echo "  - ci_lint_output.log (linter output)"
echo "  - ci_typecheck_output.log (typecheck output)"
echo "  - ci_strapi_last_run.log (Strapi server logs)"

# Exit with the first non-zero exit code
if [ $TEST_RESULT -ne 0 ]; then
    exit $TEST_RESULT
fi
if [ $LINT_RESULT -ne 0 ]; then
    exit $LINT_RESULT
fi
if [ $TYPECHECK_RESULT -ne 0 ]; then
    exit $TYPECHECK_RESULT
fi

echo ""
echo "🎉 All CI checks passed!"