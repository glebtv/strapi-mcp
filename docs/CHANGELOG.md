# Changelog

All notable changes to this project will be documented in this file.

## [0.3.1] - 2025-01-30
- **STRAPI V5 COMPATIBILITY:** Full support for Strapi v5 document IDs and API changes
- **ENHANCED RELATION TOOLS:** Updated to use Strapi v5 document IDs instead of numeric IDs
- **IMPROVED I18N SUPPORT:** Added comprehensive i18n content type fixtures and tests
- **FIXED SCHEMA UPDATES:** Content type updates now properly handle i18n plugin options
- **CLEANER TEST OUTPUT:** Removed debug logging during test runs
- **GITHUB ACTIONS UPDATE:** Updated to use v4 of upload-artifact and codecov actions
- **ERROR HANDLING:** Improved error conversion from Strapi API to MCP protocol

## [0.3.0] - 2025-01-30
- **COMPLETE REWRITE:** Modular architecture with separate auth manager and API client
- **ENHANCED HEALTH CHECKS:** Graceful handling of Strapi reloads in development mode
- **IMPROVED ERROR HANDLING:** Better error messages and validation for all tools
- **COMPREHENSIVE TEST SUITE:** Full test coverage for all 20+ tools
- **CI/CD PIPELINE:** Automated testing with GitHub Actions
- **TELEMETRY DISABLED:** Automatic telemetry disabling in test environments
- **BETTER AUTH MANAGEMENT:** JWT token refresh and retry logic
- **FILTERED RESPONSES:** Automatic base64 filtering to prevent context overflow

## [0.2.3] - 2025-07-25
- **CRITICAL FIX:** Fixed timeout issue in relation tools - connect_relation and disconnect_relation now properly handle validation errors instead of timing out
- **IMPROVED ERROR HANDLING:** All validation errors now return proper error messages instead of causing tool timeouts

## [0.2.2] - 2025-07-25
- **ENHANCED RELATION TOOLS:** Improved error handling for `connect_relation` and `disconnect_relation` with detailed validation and troubleshooting messages
- **FIXED CREATE_COMPONENT:** Fixed parameter validation bug - now properly validates individual parameters instead of single object
- **BETTER ERROR DIAGNOSTICS:** Added specific error messages for invalid relation fields, non-existent entries, and malformed IDs
- All 20 tools now working at 100% with robust error handling and validation

## [0.2.0] - 2025-07-25
- **CRITICAL BUG FIX:** Fixed validateStrapiConnection causing "undefined response status" error
- **RESOLVED MCP CONNECTION ISSUE:** Fixed the "green light but doesn't work" problem with AI tools
- **IMPROVED ERROR HANDLING:** Better connection validation logic with proper admin auth handling
- Users should update to this version if experiencing MCP connection issues with AI tools

## [0.1.9] - 2025-07-02
- **CONTEXT WINDOW OVERFLOW FIX:** Added size limits and response filtering to prevent base64 files from overwhelming context window
- **NEW TOOL:** Added `upload_media_from_path` - Upload files from local file paths (max 10MB) to avoid base64 context issues
- **ENHANCED UPLOAD_MEDIA:** Added 1MB base64 size limit (~750KB file) with clear error messages about context overflow
- **IMPROVED LOGGING:** Truncated base64 data in logs to prevent log spam and context overflow
- **RESPONSE FILTERING:** Automatically filters large base64 strings from API responses to prevent echo overflow

## [0.1.8] - 2025-06-12
- **MAJOR BUG FIX:** Replaced silent failures with descriptive error messages when content types or entries cannot be fetched
- **Added Configuration Validation:** Detects placeholder API tokens and exits with helpful error messages
- **Added Connection Validation:** Tests Strapi connectivity before attempting operations with specific error diagnostics
- **Enhanced Error Handling:** Comprehensive error diagnostics that distinguish between legitimate empty collections vs actual errors
- **Improved Troubleshooting:** All error messages include specific steps to resolve common configuration issues

## [0.1.7] - 2025-05-17
- **Added `publish_entry` and `unpublish_entry` tools:** Complete content lifecycle management
- **Added Component Management:** `list_components`, `get_component_schema`, `create_component`, `update_component`
- **Added `delete_content_type` tool:** Delete existing content types via the Content-Type Builder API
- **Enhanced Admin Authentication:** Better error handling and token management for all API operations

## [0.1.6]
- **Added `create_content_type` tool:** Allows creating new content types via the Content-Type Builder API (requires admin credentials).
- **Prioritized Admin Credentials:** Updated logic to prefer admin email/password for fetching content types and schemas, improving reliability.
- **Updated Documentation:** Clarified authentication methods and recommended running procedures.

## [0.1.5]
- Improved content type discovery with multiple fallback methods
- Added more robust error handling and logging
- Enhanced schema inference for content types

## [0.1.4]
- Improved error handling with more specific error codes
- Added `ResourceNotFound` and `AccessDenied` error codes
- Better error messages for common API errors

## [0.1.3]
- Initial public release