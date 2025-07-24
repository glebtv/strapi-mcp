# Development Guide

This guide provides instructions for developing and contributing to the Strapi MCP server.

## Prerequisites

- Node.js 18.x, 20.x, or 22.x
- npm or yarn
- Git
- A Strapi v5 instance for testing

## Getting Started

### Clone the Repository

```bash
git clone https://github.com/glebtv/strapi-mcp.git
cd strapi-mcp
```

### Install Dependencies

```bash
npm install
```

## Development Commands

### Build and Run

```bash
# Build the server
npm run build

# Development mode with auto-rebuild
npm run watch

# Run the built server
node build/index.js
```

### Testing

```bash
# Run all tests
npm test

# Run tests with coverage
npm test -- --coverage

# Run a specific test file
npm test tests/specific-test.test.ts

# Run tests in watch mode
npm test -- --watch
```

### Code Quality

```bash
# Run linter
npm run lint

# Run linter with auto-fix
npm run lint:fix

# Type checking
npm run typecheck
```

### Scripts

```bash
# Run cleanup script to delete all test projects
npm run cleanup:projects

# Run cleanup script to delete all test technologies
npm run cleanup:technologies
```

## Project Structure

```
strapi-mcp/
├── src/
│   ├── api/           # Strapi API integration modules
│   │   ├── client.ts          # API client with authentication
│   │   ├── content-types.ts   # Content type operations
│   │   ├── entries.ts         # Entry CRUD operations
│   │   ├── media.ts           # Media upload handling
│   │   └── components.ts      # Component management
│   ├── server/        # MCP server implementation
│   │   ├── index.ts           # Server initialization
│   │   └── handlers/          # Request handlers
│   ├── config/        # Configuration management
│   │   └── index.ts           # Config validation
│   ├── types/         # TypeScript type definitions
│   │   ├── strapi.ts          # Strapi API types
│   │   └── mcp.ts             # MCP protocol types
│   ├── errors/        # Custom error classes
│   │   └── errors.ts          # Extended error codes
│   ├── utils/         # Utility functions
│   │   ├── formatting.ts      # Response formatting
│   │   └── validation.ts      # Input validation
│   └── index.ts       # Main entry point
├── tests/             # Test files
│   ├── setup.ts               # Test configuration
│   ├── server.test.ts         # Server tests
│   ├── api.test.ts            # API integration tests
│   └── utils.test.ts          # Utility tests
├── scripts/           # Utility scripts
│   ├── cleanup-projects.ts    # Delete test projects
│   └── cleanup-technologies.ts # Delete test technologies
└── build/             # Compiled output (gitignored)
```

## Architecture Overview

### Module System

The project uses ES modules (`"type": "module"` in package.json):
- All imports must use `.js` extensions when importing local files
- TypeScript compiles to ES2022 with Node16 module resolution
- Entry point: `src/index.ts` → `build/index.js`

### Key Components

1. **API Client** (`src/api/client.ts`)
   - Handles authentication (API token)
   - Manages HTTP requests to Strapi
   - Implements connection validation

2. **Server Implementation** (`src/server/index.ts`)
   - Implements MCP protocol
   - Routes requests to appropriate handlers
   - Manages resources and tools

3. **Error Handling** (`src/errors/errors.ts`)
   - Custom error classes with MCP error codes
   - User-friendly error messages
   - Troubleshooting guidance

4. **Configuration** (`src/config/index.ts`)
   - Environment variable validation
   - Placeholder detection
   - Default value management

## Debugging

### MCP Inspector

The easiest way to debug the MCP server is using the MCP Inspector:

```bash
npm run inspector
```

This will start the inspector and provide a URL to access debugging tools in your browser.

### Debug Logging

Enable debug logging by setting the DEBUG environment variable:

```bash
export DEBUG=strapi-mcp:*
npm run build && node build/index.js
```

### VS Code Debugging

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug MCP Server",
      "skipFiles": ["<node_internals>/**"],
      "program": "${workspaceFolder}/build/index.js",
      "env": {
        "STRAPI_URL": "http://localhost:1337",
        "STRAPI_API_TOKEN": "your-test-token",
        "DEBUG": "strapi-mcp:*"
      },
      "outFiles": ["${workspaceFolder}/build/**/*.js"]
    }
  ]
}
```

## Testing Guidelines

### Test Structure

- Unit tests for utilities and helpers
- Integration tests for API modules
- End-to-end tests for MCP server functionality

### Writing Tests

```typescript
import { describe, it, expect, beforeEach } from 'vitest';

describe('Feature Name', () => {
  beforeEach(() => {
    // Setup
  });

  it('should do something', async () => {
    // Test implementation
    expect(result).toBe(expected);
  });
});
```

### Test Data

- Use the cleanup scripts to reset test data
- Create minimal test fixtures
- Avoid hardcoding IDs - use dynamic lookups

## Contributing

### Development Workflow

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Make your changes
3. Add tests for new functionality
4. Run all checks: `npm test && npm run lint && npm run typecheck`
5. Commit with descriptive messages
6. Push and create a pull request

### Code Style

- Follow existing patterns in the codebase
- Use TypeScript strict mode
- Add JSDoc comments for public APIs
- Keep modules focused and single-purpose

### Commit Messages

Follow conventional commit format:
- `feat:` New features
- `fix:` Bug fixes
- `docs:` Documentation changes
- `test:` Test additions/changes
- `refactor:` Code refactoring
- `chore:` Build/tooling changes

## Release Process

1. Update version in `package.json`
2. Update CHANGELOG.md
3. Run all tests and checks
4. Build the project: `npm run build`
5. Tag the release: `git tag v0.x.x`
6. Push tags: `git push --tags`

## Common Development Tasks

### Adding a New Tool

1. Define the tool interface in `src/types/mcp.ts`
2. Implement the handler in `src/server/handlers/`
3. Register the tool in `src/server/index.ts`
4. Add tests in `tests/`
5. Update documentation in `docs/TOOLS.md`

### Updating Strapi API Integration

1. Update types in `src/types/strapi.ts`
2. Modify the relevant module in `src/api/`
3. Update tests to cover new functionality
4. Test against a real Strapi v5 instance

### Debugging Strapi API Issues

1. Enable Strapi request logging
2. Use the `strapi_rest` tool for direct API testing
3. Check Strapi server logs for errors
4. Verify API token permissions

## Performance Considerations

- Minimize API calls by using proper filtering
- Implement response caching where appropriate
- Use field selection to reduce payload size
- Handle pagination for large datasets

## Security Best Practices

- Never log sensitive data (API tokens, passwords)
- Validate all inputs before sending to Strapi
- Use TypeScript types for compile-time safety
- Keep dependencies updated

## Troubleshooting Development Issues

### Build Errors

- Ensure Node.js version is compatible (18.x, 20.x, or 22.x)
- Delete `node_modules` and reinstall: `rm -rf node_modules && npm install`
- Clear TypeScript cache: `rm -rf build`

### Test Failures

- Ensure Strapi test instance is running
- Check test environment variables are set
- Run cleanup scripts if test data is corrupted
- Use `--no-coverage` flag for faster test runs during development

### Type Errors

- Run `npm run typecheck` to see all type errors
- Update type definitions when Strapi API changes
- Use `// @ts-expect-error` sparingly with explanations