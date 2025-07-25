# Testing Admin Features

This document describes the test suite updates for admin credential support in strapi-mcp.

## Overview

The test suite has been updated to comprehensively test the new admin authentication features alongside the existing API token authentication.

## Test Files Added/Updated

### 1. `tests/admin-auth.test.ts`
Tests specific to admin authentication:
- Connection with admin credentials only
- Component operations with admin credentials
- Mixed authentication (both admin and API token)
- Error handling when admin credentials are required

### 2. `tests/component-operations.test.ts`
Comprehensive component management tests:
- List components
- Get component schema
- Create new components
- Update existing components
- Paginated component retrieval
- Error handling for component operations

### 3. `tests/media-admin.test.ts`
Media operations with different authentication methods:
- Upload via file path with admin credentials
- Upload via file path with API token
- Base64 upload with admin credentials
- Error handling for invalid uploads

### 4. `tests/config-validation.test.ts`
Configuration and authentication validation:
- Rejection of connections without authentication
- API token only authentication
- Admin credentials only authentication
- Priority testing when both methods are provided
- Placeholder token rejection

### 5. `tests/error-handling.test.ts` (Updated)
Added authentication error scenarios:
- Component operations without admin credentials
- Invalid admin credentials

### 6. `tests/setup.ts` (Updated)
Enhanced to support both authentication methods:
- Validates at least one authentication method is present
- Reports which authentication methods are configured
- Shows priority when both are available

### 7. `tests/helpers/admin-client.ts`
Helper utilities for creating test clients with specific authentication configurations.

## Running Tests

### Local Development

```bash
# Run all tests
npm test

# Run specific test file
npm test tests/admin-auth.test.ts

# Run with coverage
npm test:coverage

# Watch mode
npm test:watch
```

### Environment Variables

Create a `.env` file or set these environment variables:

```bash
# Required
STRAPI_URL=http://localhost:1337

# Option 1: API Token (for regular operations)
STRAPI_API_TOKEN=your_api_token_here

# Option 2: Admin Credentials (required for component management)
STRAPI_ADMIN_EMAIL=admin@example.com
STRAPI_ADMIN_PASSWORD=your_admin_password

# Both can be provided - admin credentials take priority
```

### CI/CD

The GitHub Actions workflow has been updated to:
1. Generate admin credentials during Strapi setup
2. Export both API token and admin credentials
3. Run all tests with both authentication methods available

## Test Coverage

The updated test suite covers:

1. **Authentication Methods**
   - API token only
   - Admin credentials only
   - Both methods (priority testing)
   - No authentication (error case)

2. **Component Operations**
   - All CRUD operations
   - Schema retrieval
   - Pagination support
   - Access control (admin-only)

3. **Media Operations**
   - File path uploads
   - Base64 uploads
   - Both authentication methods

4. **Error Scenarios**
   - Missing credentials
   - Invalid credentials
   - Insufficient permissions
   - Invalid operations

## Notes

- Component management operations require admin credentials
- When both authentication methods are provided, admin credentials take priority
- All other operations work with either authentication method
- Tests automatically skip admin-specific tests if admin credentials are not available

## Internationalization (i18n) Tests

### 8. `tests/i18n-content-type.test.ts`
Comprehensive i18n testing with admin credentials:
- Creates localized content type using admin auth
- Creates documents in multiple locales (en, ru, zh)
- Verifies locale-specific content retrieval
- Tests locale isolation on updates
- Validates i18n schema configuration

### 9. `tests/i18n-setup.test.ts`
i18n plugin verification:
- Checks if i18n plugin is installed
- Verifies default locale configuration
- Lists available locales
- Shows localized content types

See [I18N_TESTING.md](./I18N_TESTING.md) for detailed i18n testing documentation.