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
npm run dev

# Run the built server
node dist/index.js
```

### Testing

```bash
# Run all tests
npm test

# Run specific test file
npm test tests/specific-test.test.ts

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

### Linting and Type Checking

```bash
# Run ESLint
npm run lint

# Run TypeScript type checking
npm run typecheck
```

## Testing Setup

### Local Testing

1. **Set up test Strapi instance:**
   ```bash
   ./scripts/setup-test-strapi.sh setup
   ```
   This creates a test Strapi app with admin user and starts it on port 1337.

2. **Run tests:**
   ```bash
   ./scripts/run-tests.sh        # Run all tests
   ./scripts/run-tests.sh unit    # Run unit tests only
   ./scripts/run-tests.sh integration  # Run integration tests only
   ./scripts/run-tests.sh coverage     # Run with coverage report
   ```

3. **Manage test Strapi:**
   ```bash
   ./scripts/setup-test-strapi.sh start    # Start existing instance
   ./scripts/setup-test-strapi.sh stop     # Stop instance
   ./scripts/setup-test-strapi.sh restart  # Restart instance
   ./scripts/setup-test-strapi.sh clean    # Remove test instance
   ./scripts/setup-test-strapi.sh status   # Check if running
   ```

### CI/CD Testing

Run the full CI pipeline locally:
```bash
./scripts/test-ci.sh
```

### GitHub Actions with Act

Test GitHub workflows locally using [act](https://github.com/nektos/act):

```bash
# Install act first
brew install act  # macOS
# or see: https://github.com/nektos/act#installation

# Run workflows
./scripts/test-with-act.sh test  # Run test workflow
./scripts/test-with-act.sh push  # Simulate push event
./scripts/test-with-act.sh pr    # Simulate PR event
```

## Project Structure

```
strapi-mcp/
├── src/                    # Source code
│   ├── index.ts           # Entry point
│   ├── strapi-client.ts   # Strapi API client
│   ├── auth-manager.ts    # Authentication handling
│   ├── token-manager.ts   # API token management
│   ├── types.ts           # TypeScript types
│   └── tools/             # MCP tools
│       ├── index.ts
│       ├── content-management.ts
│       ├── content-type-builder.ts
│       ├── media.ts
│       ├── relation.ts
│       ├── component.ts
│       ├── schema.ts
│       └── direct-api.ts
├── tests/                  # Test files
├── scripts/               # Build and test scripts
├── docs/                  # Documentation
└── dist/                  # Compiled output
```

## Debugging

Since MCP servers communicate over stdio, debugging can be challenging. We recommend using the [MCP Inspector](https://github.com/modelcontextprotocol/inspector):

```bash
npm run inspector
```

The Inspector will provide a URL to access debugging tools in your browser.

## Contributing Guidelines

### Code Style

- Follow the existing TypeScript patterns
- Use ESLint configuration (runs automatically with `npm run lint`)
- Ensure all tests pass before submitting PR

### Adding New Tools

1. Create a new file in `src/tools/` for your tool category
2. Define the tool with proper Zod schema validation
3. Add the tool to the exports in `src/tools/index.ts`
4. Write tests in `tests/tools/`
5. Update documentation in `docs/TOOLS-v2.md`

Example tool structure:
```typescript
import { z } from 'zod';
import { StrapiClient } from '../strapi-client.js';
import { Tool } from './types.js';

export function myNewTools(client: StrapiClient): Tool[] {
  return [
    {
      name: 'my_new_tool',
      description: 'Description of what the tool does',
      inputSchema: z.object({
        param1: z.string().describe('Parameter description'),
        param2: z.number().optional().describe('Optional parameter')
      }),
      execute: async (args) => {
        // Tool implementation
        return await client.someMethod(args);
      }
    }
  ];
}
```

### Testing Best Practices

- Write both unit and integration tests
- Mock external dependencies in unit tests
- Use the shared test client for integration tests
- Ensure tests are deterministic and don't depend on order
- Clean up test data after tests complete

### Commit Messages

Follow conventional commit format:
- `feat:` New features
- `fix:` Bug fixes
- `docs:` Documentation changes
- `test:` Test additions or changes
- `refactor:` Code refactoring
- `chore:` Maintenance tasks

## Environment Variables for Development

Create a `.env` file in the project root:

```env
STRAPI_URL=http://localhost:1337
STRAPI_ADMIN_EMAIL=admin@test.com
STRAPI_ADMIN_PASSWORD=Admin123!
STRAPI_DEV_MODE=true
```

## Troubleshooting Development Issues

### Common Issues

1. **Build errors**: Ensure you're using Node.js 18+ and have run `npm install`
2. **Test failures**: Make sure test Strapi is running with `./scripts/setup-test-strapi.sh status`
3. **Type errors**: Run `npm run typecheck` to see detailed TypeScript errors
4. **ESLint errors**: Run `npm run lint` to check code style issues

### Test Strapi Issues

If tests fail due to Strapi issues:
1. Check if Strapi is running: `./scripts/setup-test-strapi.sh status`
2. Check Strapi logs: `tail -f test-strapi-app/strapi.log`
3. Restart Strapi: `./scripts/setup-test-strapi.sh restart`
4. Clean and recreate: `./scripts/setup-test-strapi.sh clean && ./scripts/setup-test-strapi.sh setup`

## Release Process

1. Update version in `package.json`
2. Update `CHANGELOG.md` with changes
3. Commit changes: `git commit -am "chore: release v0.x.x"`
4. Tag release: `git tag v0.x.x`
5. Push with tags: `git push && git push --tags`
6. GitHub Actions will automatically publish to npm