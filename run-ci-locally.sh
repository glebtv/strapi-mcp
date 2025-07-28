#!/bin/bash

# Exit on error
set -e

# Store the current directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Create a log file for all CI output
CI_LOG="ci_runout.log"
rm -f "$CI_LOG"

# Keep output visible while also logging to file
echo "🚀 Running CI workflow locally" | tee "$CI_LOG"
echo "==============================" | tee -a "$CI_LOG"

# Clean up any existing Strapi instance
echo "🧹 Cleaning up existing Strapi instance..." | tee -a "$CI_LOG"
pkill -f "strapi" || true
pkill -f "node.*develop" || true
sleep 2
rm -rf strapi-test test-tokens.json

# Step 1: Setup Strapi test instance
echo "📦 Step 1: Setup Strapi test instance" | tee -a "$CI_LOG"
./scripts/setup-strapi-test.sh 2>&1 | tee ci_setup_strapi.log
if [ ${PIPESTATUS[0]} -ne 0 ]; then
    echo "❌ Failed to setup Strapi test instance" | tee -a "$CI_LOG"
    exit 1
fi

# Step 2: Install dependencies
echo "📦 Step 2: Install dependencies" | tee -a "$CI_LOG"
npm ci 2>&1 | tee ci_npm_install.log
if [ ${PIPESTATUS[0]} -ne 0 ]; then
    echo "❌ Failed to install dependencies" | tee -a "$CI_LOG"
    exit 1
fi

# Step 3: Build MCP server
echo "🔨 Step 3: Build MCP server" | tee -a "$CI_LOG"
npm run build 2>&1 | tee ci_build.log
if [ ${PIPESTATUS[0]} -ne 0 ]; then
    echo "❌ Failed to build MCP server" | tee -a "$CI_LOG"
    exit 1
fi

# Step 4: Run tests
echo "🧪 Step 4: Run tests" | tee -a "$CI_LOG"

# Check if test-tokens.json exists
if [ ! -f test-tokens.json ]; then
    echo "❌ test-tokens.json not found!" | tee -a "$CI_LOG"
    exit 1
fi

echo "✅ test-tokens.json found - tests will load credentials automatically" | tee -a "$CI_LOG"

# Run tests in non-watch mode (setup.ts will load .env.test and test-tokens.json)
echo "Running tests..." | tee -a "$CI_LOG"
npm test -- --run 2>&1 | tee ci_test_output.log
TEST_RESULT=${PIPESTATUS[0]}

# Step 5: Run linter
echo "🔍 Step 5: Run linter" | tee -a "$CI_LOG"
npm run lint 2>&1 | tee ci_lint_output.log
LINT_RESULT=${PIPESTATUS[0]}

# Step 6: Run type check
echo "✅ Step 6: Run type check" | tee -a "$CI_LOG"
npm run typecheck 2>&1 | tee ci_typecheck_output.log
TYPECHECK_RESULT=${PIPESTATUS[0]}

# Step 7: Stop Strapi
echo "🛑 Step 7: Stopping Strapi..." | tee -a "$CI_LOG"

# Save Strapi logs before stopping
if [ -f strapi-test/strapi_output.log ]; then
    echo "📄 Saving Strapi logs..." | tee -a "$CI_LOG"
    cp strapi-test/strapi_output.log ci_strapi_last_run.log
    echo "Strapi logs saved to: ci_strapi_last_run.log" | tee -a "$CI_LOG"
fi

STRAPI_PID=$(ps aux | grep "npm run develop" | grep -v grep | awk '{print $2}' | head -1)
if [ ! -z "$STRAPI_PID" ]; then
    echo "Killing Strapi process: $STRAPI_PID" | tee -a "$CI_LOG"
    kill $STRAPI_PID || true
    # Also kill any child processes
    pkill -P $STRAPI_PID || true
fi

# Additional cleanup
pkill -f "strapi" || true
sleep 1

# Check all results and provide summary
echo "" | tee -a "$CI_LOG"
echo "==============================" | tee -a "$CI_LOG"
echo "CI Results Summary:" | tee -a "$CI_LOG"
echo "==============================" | tee -a "$CI_LOG"

# Display results without duplicating output
if [ $TEST_RESULT -ne 0 ]; then
    echo "❌ Tests failed! (exit code: $TEST_RESULT)" | tee -a "$CI_LOG"
    echo "   See ci_test_output.log for details" | tee -a "$CI_LOG"
else
    echo "✅ Tests passed!" | tee -a "$CI_LOG"
fi

if [ $LINT_RESULT -ne 0 ]; then
    echo "❌ Linter failed! (exit code: $LINT_RESULT)" | tee -a "$CI_LOG"
    echo "   See ci_lint_output.log for details" | tee -a "$CI_LOG"
else
    echo "✅ Linter passed!" | tee -a "$CI_LOG"
fi

if [ $TYPECHECK_RESULT -ne 0 ]; then
    echo "❌ Type check failed! (exit code: $TYPECHECK_RESULT)" | tee -a "$CI_LOG"
    echo "   See ci_typecheck_output.log for details" | tee -a "$CI_LOG"
else
    echo "✅ Type check passed!" | tee -a "$CI_LOG"
fi

echo "" | tee -a "$CI_LOG"
echo "==============================" | tee -a "$CI_LOG"
echo "📄 Log files created:" | tee -a "$CI_LOG"
echo "==============================" | tee -a "$CI_LOG"
echo "  - ci_runout.log (this run's console output)" | tee -a "$CI_LOG"
echo "  - ci_setup_strapi.log (Strapi setup output)" | tee -a "$CI_LOG"
echo "  - ci_npm_install.log (npm install output)" | tee -a "$CI_LOG"
echo "  - ci_build.log (build output)" | tee -a "$CI_LOG"
echo "  - ci_test_output.log (test output)" | tee -a "$CI_LOG"
echo "  - ci_lint_output.log (linter output)" | tee -a "$CI_LOG"
echo "  - ci_typecheck_output.log (typecheck output)" | tee -a "$CI_LOG"
echo "  - ci_strapi_last_run.log (Strapi server logs)" | tee -a "$CI_LOG"

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

echo "" | tee -a "$CI_LOG"
echo "🎉 All CI checks passed!" | tee -a "$CI_LOG"