# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Building and Development
```bash
# Install dependencies
npm install

# Build the TypeScript project
npm run build

# Development mode with auto-rebuild
npm run dev

# Type checking
npm run typecheck

# Linting
npm run lint
```

### Testing

**⚠️ IMPORTANT: You MUST use `./scripts/run-tests.sh` to run tests locally! ⚠️**

The test helper script is REQUIRED because it:
- Ensures Strapi test instance is running
- Sets proper environment variables (STRAPI_URL, STRAPI_ADMIN_EMAIL, etc.)
- Builds the TypeScript project before running tests
- Handles test instance startup if needed

```bash
# REQUIRED: Use the test helper script for ALL test runs
./scripts/run-tests.sh                           # Run all tests
./scripts/run-tests.sh unit                      # Run unit tests only
./scripts/run-tests.sh integration               # Run integration tests only
./scripts/run-tests.sh tests/admin-auth.test.ts  # Run specific test file
./scripts/run-tests.sh tests/component-operations.test.ts tests/admin-auth.test.ts  # Run multiple test files

# DO NOT use npm test directly - it will fail without proper environment setup!
# ❌ WRONG: npm test
# ❌ WRONG: npm test -- tests/admin-auth.test.ts
# ✅ CORRECT: ./scripts/run-tests.sh tests/admin-auth.test.ts

# Run tests with coverage (through the helper)
./scripts/run-tests.sh coverage

# Run tests in watch mode (through the helper)
./scripts/run-tests.sh watch

# Set up local test Strapi instance (required before first test run)
./scripts/setup-test-strapi.sh setup

# Start/stop/check test Strapi instance
./scripts/setup-test-strapi.sh start    # Start test instance
./scripts/setup-test-strapi.sh stop     # Stop test instance
./scripts/setup-test-strapi.sh status   # Check if running

# Run full CI pipeline locally
./scripts/test-ci.sh
```

## Architecture

### Core Components

1. **MCP Server (`src/index.ts`)**
   - Entry point that sets up the MCP server
   - Handles resource listing and tool execution
   - Validates environment configuration on startup
   - Removed debug logging for cleaner test output (v0.3.1)
   - Enhanced error reporting for validation errors (v0.3.1)

2. **Authentication Manager (`src/auth-manager.ts`)**
   - Manages JWT token lifecycle with automatic refresh
   - Handles admin login with email/password
   - Falls back to API token if admin credentials unavailable
   - Caches tokens to avoid rate limiting
   - Silent login attempts for cleaner output (v0.3.1)
   - Automatic retry with random suffix for API token name conflicts (v0.3.1)

3. **Strapi Client (`src/strapi-client.ts`)**
   - Core API client for all Strapi operations
   - Implements health check and graceful reload handling for dev mode
   - Filters base64 data from responses to prevent context overflow
   - Handles both admin and public API endpoints
   - **STRAPI V5 SUPPORT**: Uses document IDs instead of numeric IDs
   - **SCHEMA UPDATES**: Uses update-schema endpoint for all content type operations

4. **Tool Organization (`src/tools/`)**
   - `content-management.ts`: CRUD operations for entries
     - `list_content_types`: Lists content types with optional filter
     - `list_components`: Lists components with optional filter  
     - Helper functions for i18n locale handling and content type config
   - `media.ts`: File upload tools with size limits
   - `relation.ts`: Relation management with **Strapi v5 document IDs**
   - `api-token.ts`: API token management
   - `i18n.ts`: Locale management tools
   - `direct-api.ts`: Direct REST API access

### Key Design Decisions

1. **Modular Architecture**: Separate files for auth, API client, and tool categories for maintainability

2. **Health Check System**: When `STRAPI_DEV_MODE=true`, the client waits for Strapi to be healthy after structure-modifying operations

3. **Response Filtering**: Automatically strips base64 data from responses to prevent context window overflow

4. **Error Handling**: All tools return structured errors with helpful troubleshooting messages

5. **Test Structure**: 
   - Unit tests mock the StrapiClient using Jest
   - Integration tests run against a real Strapi instance
   - Tests run sequentially (`maxWorkers: 1`) to avoid API conflicts
   - **IMPORTANT**: Only use Jest for testing, never vitest

### Authentication Flow

1. Check for admin credentials (email/password)
2. If available, login to `/admin/login` and store JWT
3. If not, fall back to API token
4. JWT tokens are automatically refreshed on 401 errors
5. All requests include appropriate auth headers

### Tool Response Format

All tools return JSON responses. Content type operations typically return:
```json
{
  "data": [...],  // For list operations
  "meta": {       // Pagination metadata
    "pagination": { "page": 1, "pageSize": 25, "total": 100 }
  }
}
```

Single item operations return the item directly without a `data` wrapper.

### Development Mode Features

When `STRAPI_DEV_MODE=true`:
- Graceful handling of Strapi reloads after schema changes
- Health check polling with exponential backoff
- Extended wait times for structure operations

### Testing Considerations

- **IMPORTANT**: Always ensure the proper test Strapi instance is running before tests:
  - Run `./scripts/setup-test-strapi.sh start` to start the test instance
  - Run `./scripts/setup-test-strapi.sh status` to check if it's running
  - The test instance runs on port 1337 with admin credentials: admin@test.com / Admin123!
- Always run `./scripts/setup-test-strapi.sh setup` before running integration tests for the first time
- The test Strapi instance uses `strapi-plugin-init-admin-user` for reliable admin creation
- Tests use a shared MCP server instance to avoid multiple logins and rate limiting
- Content types must be created before running integration tests that depend on them
- Use `./scripts/run-tests.sh` to run tests with proper environment setup
- **I18N TESTING**: Uses pre-existing i18n-doc content type from fixtures because Strapi v5 doesn't create REST routes for dynamically created content types

### Common Issues

1. **Rate Limiting (429 errors)**: Tests use a shared MCP server instance and JWT token to avoid excessive login attempts
2. **Missing Content Types**: Run `./scripts/create-test-content-types.sh` to create test data
3. **Module Not Found**: The output is in `dist/` not `build/`
4. **Context Overflow**: Media upload tools have size limits to prevent base64 overflow
5. **Health Check 204**: Strapi returns 204 (No Content) for `/_health` endpoint when healthy
6. **Strapi v5 Document IDs**: Relation tools now expect string document IDs, not numeric IDs
7. **Content Type Updates**: All content type operations use the `update-schema` endpoint in Strapi v5

### Test Execution Notes
- **ALWAYS** use `./scripts/run-tests.sh` to run tests - never use `npm test` directly
- The test helper script sets required environment variables and ensures Strapi is running
- Example: `./scripts/run-tests.sh tests/admin-auth.test.ts`

### Strapi Specific Memories
- In the SETUP SCRIPT @scripts/setup-test-strapi.sh WE DO ALL CHANGES TO STRAPI IN THE SETUP SCRIPT
- **COMPONENTS ARE JSON FILES**: Strapi components are simple JSON schema files located at `src/components/{category}/{component}.json`. Edit them directly - no special tools needed!
  - Example: `test-strapi-app/src/components/sections/hero.json`
  - Structure: Each has `collectionName`, `info`, and `attributes` fields
  - Strapi auto-reloads in dev mode after JSON changes

