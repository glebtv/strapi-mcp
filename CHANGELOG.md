# Changelog

All notable changes to this project will be documented in this file.

## [0.5.0] - Unreleased

### Added

- npm publishing workflow for GitHub releases
- Published package to npm registry as `@rocket-sensei/strapi-mcp`
- Automated testing and building before npm publish
- GitHub Actions workflow for release automation

### Changed

- Updated package name to use npm scope `@rocket-sensei/strapi-mcp`
- Added `publishConfig` to package.json for public npm access

## [0.4.1] - 2025-01-10

### Security & Safety Improvements

- **CRITICAL**: Fixed a major bug in `update_content_type` tool that was replacing ALL attributes instead of updating only the specified ones, causing potential data loss
- Added comprehensive tool call logging to `~/.mcp/strapi-mcp-logs/tool-calls.log` for debugging and audit purposes
- Schema modification tools (`create_content_type`, `update_content_type`, `delete_content_type`, and component tools) are now hidden by default unless `STRAPI_DEV_MODE=true` is set
- Added prominent warning in README about AI-assisted development and production use
- Updated tool documentation to clearly indicate that `update_content_type` does NOT support partial updates

### Added

- Tool call logging with arguments, results, errors, and execution time
- Console logging for all schema modification operations
- Clear warnings about schema modification risks

### Changed

- Schema modification tools are now opt-in via `STRAPI_DEV_MODE` for safety
- Enhanced error messages and validation warnings
- Updated documentation to recommend direct JSON schema file modification

### Documentation

- Added disclaimer about AI-assisted development
- Added warning about `update_content_type` behavior
- Documented that `STRAPI_DEV_MODE` now controls access to schema modification tools
- Added recommendation to modify Strapi JSON files directly

## [0.4.0] - Previous release

[Previous changelog entries...]