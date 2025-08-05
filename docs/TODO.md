# Strapi MCP Server - Comprehensive Improvement Plan

## Overview

This document outlines a comprehensive plan for improving the Strapi MCP Server codebase. The current implementation works but has several areas for improvement in security, error handling, testing, and maintainability.

## Critical Issues (High Priority)

### 1. Authentication and Token Security

**Problem:**
- API tokens are stored in plaintext in `~/.mcp/strapi-mcp.tokens.json` with no security measures
- No token expiration or rotation mechanism
- JWT token expiration not properly checked

**Proposed Fixes:**
- [ ] **Secure Token Storage** - Use system keychain (Keytar) instead of plaintext files
  ```bash
  npm install keytar
  ```
  ```typescript
  // Replace token-manager.ts file storage with:
  import * as keytar from 'keytar';
  const SERVICE_NAME = 'strapi-mcp';
  
  async saveToken(token: string) {
    await keytar.setPassword(SERVICE_NAME, 'apiToken', token);
  }
  ```

- [ ] **Token Expiration Handling** - Add JWT expiration check in `auth-manager.ts`
  ```typescript
  // Add to AuthManager class
  private isJwtExpired(): boolean {
    if (!this.tokens.jwt) return true;
    try {
      const payload = JSON.parse(Buffer.from(this.tokens.jwt.split('.')[1], 'base64').toString());
      return payload.exp * 1000 < Date.now();
    } catch {
      return true;
    }
  }
  ```

- [ ] **Token Rotation** - Implement automatic token rotation before expiration

### 2. Error Handling and User Experience

**Problem:**
- Error messages are often too technical or lack actionable advice
- Inconsistent error formatting across tools
- Missing context in validation errors

**Proposed Fixes:**
- [ ] **Standardize Error Messages** - Create error codes and consistent format
  ```typescript
  // In types.ts
  export enum ErrorCode {
    AUTH_EXPIRED = 'AUTH_EXPIRED',
    MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
    INVALID_DYNAMIC_ZONE = 'INVALID_DYNAMIC_ZONE',
    // ...
  }
  ```

- [ ] **Improve Validation Errors** - In `content-management.ts`, enhance missing field errors:
  ```typescript
  // Current:
  throw new Error(`Missing required fields in data object: ${missingFields.join(', ')}`);
  
  // Improved:
  throw new Error(`Missing required fields: ${missingFields.join(', ')}\n\n` +
    `Required fields for ${contentType}: ${requiredFields.join(', ')}\n` +
    `Tip: Use get_content_type_schema to see all required fields`);
  ```

- [ ] **Add Error Documentation** - Create `docs/errors.md` with all error codes and solutions

### 3. Testing Coverage

**Problem:**
- Tests look like they pass but don't actually test edge cases
- Missing tests for critical failure scenarios
- No performance or stress tests

**Proposed Fixes:**
- [ ] **Add Edge Case Tests** - Create tests for:
  - Network failures (connection refused, timeouts)
  - Rate limiting scenarios (429 errors)
  - Invalid token scenarios
  - Schema validation with complex nested structures
  - Large media uploads (boundary cases)

- [ ] **Improve Test Validation** - In `documented-errors.test.ts`, add assertions for specific error codes:
  ```typescript
  expect(error.code).toBe(ErrorCode.MISSING_REQUIRED_FIELD);
  expect(error.details.missingFields).toContain('title');
  ```

- [ ] **Add Performance Tests** - Create tests that measure:
  - Time to create 100 entries
  - Memory usage during large operations
  - Health check recovery time

## Important Improvements (Medium Priority)

### 1. Performance Optimizations

**Problem:**
- `deleteAllEntries` method is inefficient (deletes one by one)
- No caching for frequently accessed data
- Health check polling could be optimized

**Proposed Fixes:**
- [ ] **Optimize Bulk Operations** - In `strapi-client.ts`, implement bulk delete:
  ```typescript
  async deleteAllEntries(pluralApiId: string): Promise<{ deletedCount: number }> {
    // Use Strapi's bulk delete API