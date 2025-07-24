# Changelog

All notable changes to this project will be documented in this file.

## [0.2.0] - 2025-07-24

### Added
- **GitHub Actions CI/CD Pipeline**: Comprehensive testing infrastructure
  - Tests on Node.js 18.x, 20.x, and 22.x
  - Automatic Strapi 5 instance setup with PostgreSQL
  - Full test suite execution with linting and type checking
- **Strapi 5 Support**: Updated from Strapi 4 to Strapi 5
  - Fixed `create-strapi` command with proper flags
  - Added `--no-git-init` flag to prevent hanging in CI
- **Test Infrastructure Improvements**:
  - Split tests into separate files for better organization
  - Added cleanup scripts with proper pagination handling
  - Integrated `qs` library for complex filter serialization
  - Fixed all failing tests

### Fixed
- **Multiple Connection Messages**: Added `hasValidated` flag to prevent duplicate Strapi connection messages
- **Pagination Issues**: Fixed cleanup script to always fetch page 1 when deleting entries
- **Complex Filters**: Properly serialize nested filter objects using `qs` library
- **CI Hanging**: Added `--no-git-init` flag to prevent create-strapi from waiting for user input

### Changed
- **Documentation**: Removed outdated admin email/password authentication references
- **Environment**: Removed .env file documentation, focusing only on environment variables
- **CI Matrix**: Updated to test on Node.js 18.x, 20.x, and 22.x (removed 24.x)

### Removed
- Unnecessary GitHub workflows (npm-token, release workflow)
- Admin authentication documentation from README

## [0.1.9] - 2025-01-02
- **CONTEXT WINDOW OVERFLOW FIX:** Added size limits and response filtering to prevent base64 files from overwhelming context window
- **NEW TOOL:** Added `upload_media_from_path` - Upload files from local file paths (max 10MB) to avoid base64 context issues
- **ENHANCED UPLOAD_MEDIA:** Added 1MB base64 size limit (~750KB file) with clear error messages about context overflow
- **IMPROVED LOGGING:** Truncated base64 data in logs to prevent log spam and context overflow
- **RESPONSE FILTERING:** Automatically filters large base64 strings from API responses to prevent echo overflow

## [0.1.8] - 2024-12-12
- **MAJOR BUG FIX:** Replaced silent failures with descriptive error messages when content types or entries cannot be fetched
- **Added Configuration Validation:** Detects placeholder API tokens and exits with helpful error messages
- **Added Connection Validation:** Tests Strapi connectivity before attempting operations with specific error diagnostics
- **Enhanced Error Handling:** Comprehensive error diagnostics that distinguish between legitimate empty collections vs actual errors
- **Improved Troubleshooting:** All error messages include specific steps to resolve common configuration issues

## [0.1.7] - 2024-11-17
- **Added `publish_entry` and `unpublish_entry` tools:** Complete content lifecycle management
- **Added Component Management:** `list_components`, `get_component_schema`, `create_component`, `update_component`
- **Added `delete_content_type` tool:** Delete existing content types via the Content-Type Builder API
- **Enhanced Admin Authentication:** Better error handling and token management for all API operations

## [0.1.6]
- **Added `create_content_type` tool:** Allows creating new content types via the Content-Type Builder API
- **Enhanced API token handling:** Improved authentication flow for better reliability
- **Updated Documentation:** Clarified authentication methods and recommended running procedures

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
