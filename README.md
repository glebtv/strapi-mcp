# Strapi MCP

This was mostly a vibe-coding experiment. I needed a tool but didn't want to build it myself - so I vibe coded the tool.

The experiment ended badly and all the new code here is now human-reviewed.

You can read more about it here: https://www.reddit.com/r/vibecoding/comments/1mirhhk/vibe_coding_is_a_lie/

The tool itself is working but I would not trust it to connect to production server until all the code is reviewed, and do backups on your dev enviromnent including strapi db.

The mcp for structure management itself is not really needed, so it's gone now, if you look at strapi v5 you can ⚠️**just ask claude to edit the json schema files**⚠️..

simple package.json strapi backup example:
```
  "scripts": {
    "export": "strapi export --no-encrypt --no-compress --verbose --file ../backups/dev-$(date +%Y%m%d-%H%M%S)"
  }
```

⚠️ **IMPORTANT DISCLAIMER**: This software has been developed with the assistance of AI technology. It is provided as-is and should NOT be used in production environments without thorough testing and validation. The code may contain errors, security vulnerabilities, or unexpected behavior. Use at your own risk for research, learning, or development purposes only.


An MCP (Model Context Protocol) server for Strapi v5 CMS, providing seamless access to content types and entries through standardized tools and resources.

**Requirements**: This server supports Strapi v5. Strapi v4 is not officially supported.

## Overview

This TypeScript-based MCP server integrates with Strapi v5 instances to provide:

- Access to Strapi content types as resources via `strapi://content-type/{pluralApiId}` URIs
- Tools to create, read, update, and delete content entries
- Content type and component management
- Media upload capabilities
- Relation management between content types
- Support for Strapi development mode
- Robust error handling with clear diagnostics
- Configuration validation to prevent common setup issues

## Features

- **Content Management**: Create, read, update, delete, publish, and unpublish entries
- **Media Management**: Upload files via base64 or file paths
- **Schema Operations**: Get schemas, manage relations between content types
- **Content Type Builder**: Create, update, and delete content types
- **Component Management**: Full CRUD operations on Strapi components
- **i18n Support**: Manage locales and localized content
- **Advanced Querying**: Filtering, pagination, sorting, and field selection
- **Direct API Access**: Execute custom REST requests against Strapi

**⚠️ Important Note on Schema Modifications**: The `update_content_type` tool does NOT support partial updates - it will replace ALL attributes with only the ones you provide. For safer schema modifications, we strongly recommend modifying Strapi's JSON schema files directly using AI assistance rather than using the schema modification tools.

For detailed information about all tools and resources, see the [Tools and Resources Reference](./docs/TOOLS-v2.md).

For internationalization (i18n) support and locale parameter usage, see the [i18n Guide](./docs/I18N.md).

## Installation

### Install from npm (Recommended)
```bash
npm install strapi-mcp
```

### Install from source (Development)
```bash
git clone https://github.com/glebtv/strapi-mcp.git
cd strapi-mcp
npm install
npm run build
```

## Configuration

### Environment Variables

Configure the following environment variables:

- `STRAPI_URL`: The URL of your Strapi instance (default: `http://localhost:1337`)
- `STRAPI_DEV_MODE`: Set to `"true"` to enable development mode features and schema modification tools (defaults to `false` for safety)

#### Authentication (choose one):

**Option 1: Admin Credentials (Recommended)**
- `STRAPI_ADMIN_EMAIL`: Admin email for your Strapi instance
- `STRAPI_ADMIN_PASSWORD`: Admin password for your Strapi instance

**Option 2: API Token (Limited functionality)**
- `STRAPI_API_TOKEN`: API token from Strapi admin panel

**Note:** Admin credentials provide full functionality. API tokens may have limited permissions based on Strapi configuration.

### Setting up Admin Credentials

1. Log in to your Strapi v5 admin panel
2. Ensure you have an admin account with full permissions
3. Use the admin email and password in your MCP server configuration

### Getting an API Token (Alternative)

1. Log in to your Strapi admin panel
2. Go to Settings > API Tokens
3. Click "Create new API Token"
4. Set a name, description, and token type (preferably "Full access")
5. Copy the generated token and use it in your MCP server configuration

## Setup

### For Claude Code

```
claude mcp add-json -s user strapi '{ "command": "node",
 "args": ["/data/strapi-mcp/dist/index.js"],
 "env": {
   "STRAPI_URL": "http://localhost:1337",
   "STRAPI_ADMIN_EMAIL": "admin@test.com",
   "STRAPI_ADMIN_PASSWORD": "Admin123!"
}}'
```
### For Claude Desktop

Configure the strapi-mcp server in your MCP settings file:

**MacOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`  
**Windows:** `%APPDATA%/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "strapi-mcp": {
      "command": "npx",
      "args": ["strapi-mcp"],
      "env": {
        "STRAPI_URL": "http://localhost:1337",
        "STRAPI_ADMIN_EMAIL": "admin@example.com",
        "STRAPI_ADMIN_PASSWORD": "your_admin_password"
      }
    }
  }
}
```

If you installed from source:
```json
{
  "mcpServers": {
    "strapi-mcp": {
      "command": "node",
      "args": ["/path/to/strapi-mcp/dist/index.js"],
      "env": {
        "STRAPI_URL": "http://localhost:1337",
        "STRAPI_ADMIN_EMAIL": "admin@example.com",
        "STRAPI_ADMIN_PASSWORD": "your_admin_password"
      }
    }
  }
}
```

### For Cursor

Use the same configuration format as Claude Desktop in your Cursor MCP settings.

### Running from Command Line

See the [Direct Usage Guide](./docs/DIRECT_USAGE.md) for instructions on running the server directly.

## Quick Start

Once configured, you can use the MCP tools in Claude Desktop. Here's a simple example:

```javascript
// List all content types
use_mcp_tool(
  server_name: "strapi-mcp",
  tool_name: "list_content_types",
  arguments: {}
)

// Get entries with filtering
use_mcp_tool(
  server_name: "strapi-mcp",
  tool_name: "get_entries",
  arguments: {
    "pluralApiId": "articles",
    "options": JSON.stringify({
      "filters": { "title": { "$contains": "hello" } },
      "pagination": { "page": 1, "pageSize": 10 }
    })
  }
)
```

For comprehensive examples and usage patterns, see the [Tools and Resources Reference](./docs/TOOLS-v2.md).

## Development

For development setup, building, testing, and contributing guidelines, see the [Development Guide](./docs/DEVELOPMENT.md).

## CI/CD

This project uses GitHub Actions for continuous integration:

- **CI** - Runs on every push and pull request to main branch
  - Tests on Node.js 22.x
  - Automatically sets up a local Strapi 5 instance
  - Creates required content types and admin user
  - Runs linting, type checking, and all tests with coverage
  - Displays coverage report in CI output

## Troubleshooting

For common issues and solutions, see the [Troubleshooting Guide](./docs/TROUBLESHOOTING.md).

## Documentation

- [Tools and Resources Reference](./docs/TOOLS-v2.md) - Detailed documentation for all tools and resources
- [Development Guide](./docs/DEVELOPMENT.md) - Setup for contributors and developers
- [Direct Usage Guide](./docs/DIRECT_USAGE.md) - Running the server from command line
- [Troubleshooting Guide](./docs/TROUBLESHOOTING.md) - Common issues and solutions
- [i18n Guide](./docs/I18N.md) - Internationalization support and locale usage
- [Changelog](./docs/CHANGELOG.md) - Detailed history of changes

## License

MIT

## Support

For issues and feature requests, please visit the [GitHub repository](https://github.com/glebtv/strapi-mcp).
