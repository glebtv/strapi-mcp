# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is **strapi-mcp**, a Model Context Protocol (MCP) server that provides integration with Strapi CMS instances. It's a TypeScript-based ES module that enables programmatic access to Strapi content types and entries through the MCP protocol.

## Development Commands

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Development mode with auto-rebuild
npm run watch

# Run tests
npm test

# Debug with MCP Inspector
npm run inspector

# Run a specific test file
npm test tests/specific-test.test.ts
```

## Architecture

The codebase is organized into modular components:

- `/src/api/` - Strapi API integration modules (client, content-types, entries, media, components)
- `/src/server/` - MCP server implementation and request handlers
- `/src/config/` - Configuration management and validation
- `/src/types/` - TypeScript type definitions for Strapi and MCP
- `/src/errors/` - Custom error classes with extended error codes
- `/src/utils/` - Utility functions (formatting, validation)

Key architectural decisions:
- Uses ES modules (`"type": "module"`)
- Compiles to ES2022 with Node16 module resolution
- Entry point: `/src/index.ts` → `/build/index.js`
- Executable via `npx strapi-mcp`

## Testing

- Framework: Vitest
- Test files: `/tests/*.test.ts`
- Setup file: `/tests/setup.ts`
- Run with coverage: `npm test -- --coverage`

## Important Context

1. **Strapi 5 Only**: This server only supports Strapi v5. The codebase uses Strapi 5 patterns:
   - `documentId` instead of numeric IDs
   - API routes: `/api/{pluralName}` (not `/api/{pluralName}/{id}`)
   - Draft & Publish via `status` parameter

2. **Context Window Management**: To prevent MCP context overflow:
   - Base64 uploads limited to ~750KB
   - File path uploads supported up to 10MB
   - Large base64 strings filtered from responses

3. **Authentication**: Supports two modes:
   - Admin credentials (full functionality)
   - API token (limited by Strapi permissions)

4. **Error Handling**: Custom error types in `/src/errors/errors.ts` with:
   - Extended error codes for MCP
   - User-friendly messages
   - Troubleshooting guidance

## When Making Changes

1. Follow existing module patterns - each API feature has its own module in `/src/api/`
2. Add tests for new functionality in `/tests/`
3. Update types in `/src/types/` when modifying Strapi interactions
4. Use the existing error classes for consistent error handling
5. Maintain ES module syntax throughout
6. Run `npm run build` before testing changes to the compiled output

## Coding Guidelines

- No 'simplifying' any tests