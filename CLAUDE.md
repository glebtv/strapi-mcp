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
```bash
# Run all tests
npm test

# Run specific test file
npm test -- tests/admin-auth.test.ts

# Run tests with proper environment setup (recommended)
./scripts/run-tests.sh                           # Run all tests
./scripts/run-tests.sh unit                      # Run unit tests only
./scripts/run-tests.sh integration               # Run integration tests only
./scripts/run-tests.sh tests/admin-auth.test.ts  # Run specific test file
./scripts/run-tests.sh tests/component-operations.test.ts tests/admin-auth.test.ts  # Run multiple test files

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Set up local test Strapi instance (required for integration tests)
./scripts/setup-test-strapi.sh setup

# Create test content types in Strapi
./scripts/create-test-content-types.sh

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
   - `media.ts`: File upload tools with size limits
   - `relation.ts`: Relation management with **Strapi v5 document IDs**
   - `content-type-builder.ts`: Schema management tools with proper i18n support
   - `component.ts`: Component CRUD operations
   - `direct-api.ts`: Direct REST API access
   - `schema.ts`: Content type schema retrieval

### Key Design Decisions

1. **Modular Architecture**: Separate files for auth, API client, and tool categories for maintainability

2. **Health Check System**: When `STRAPI_DEV_MODE=true`, the client waits for Strapi to be healthy after structure-modifying operations

3. **Response Filtering**: Automatically strips base64 data from responses to prevent context window overflow

4. **Error Handling**: All tools return structured errors with helpful troubleshooting messages

5. **Test Structure**: 
   - Unit tests mock the StrapiClient
   - Integration tests run against a real Strapi instance
   - Tests run sequentially (`maxWorkers: 1`) to avoid API conflicts

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

- Always run `./scripts/setup-test-strapi.sh setup` before running integration tests
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
- Use `@scripts/run-tests.sh` to run tests

### Strapi Specific Memories
- In the SETUP SCRIPT @scripts/setup-test-strapi.sh WE DO ALL CHANGES TO STRAPI IN THE SETUP SCRIPT
```

</invoke>