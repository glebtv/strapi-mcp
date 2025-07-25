# Strapi MCP

⚠️ **IMPORTANT DISCLAIMER**: This software has been developed with the assistance of AI technology. It is provided as-is and should NOT be used in production environments without thorough testing and validation. The code may contain errors, security vulnerabilities, or unexpected behavior. Use at your own risk for research, learning, or development purposes only.

An MCP (Model Context Protocol) server for Strapi v5 CMS, providing seamless access to content types and entries through standardized tools and resources.

**Requirements**: This server only supports Strapi v5. Strapi v4 is not supported.

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
- **Advanced Querying**: Filtering, pagination, sorting, and field selection
- **Direct API Access**: Execute custom REST requests against Strapi

For detailed information about all tools and resources, see the [Tools and Resources Reference](./docs/TOOLS.md).

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
- `STRAPI_DEV_MODE`: Set to `"true"` to enable development mode features (defaults to `false`)

#### Authentication (choose one):

**Option 1: API Token (recommended for most use cases)**
- `STRAPI_API_TOKEN`: Your Strapi API token with appropriate permissions

**Option 2: Admin Credentials (required for component management)**
- `STRAPI_ADMIN_EMAIL`: Admin email for your Strapi instance
- `STRAPI_ADMIN_PASSWORD`: Admin password for your Strapi instance

**Note:** Admin credentials are required for component management operations. If both authentication methods are provided, admin credentials take priority.

**Important:** Avoid placeholder values like `"strapi_token"` - the server validates and rejects common placeholders

### Getting a Strapi v5 API Token

1. Log in to your Strapi v5 admin panel
2. Go to Settings > API Tokens
3. Click "Create new API Token"
4. Set a name, description, and token type (preferably "Full access")
5. Copy the generated token and use it in your MCP server configuration

## Setup

### For Cursor/Claude Desktop

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
        "STRAPI_API_TOKEN": "your_api_token_here"
        // Or use admin credentials for full functionality:
        // "STRAPI_ADMIN_EMAIL": "admin@example.com",
        // "STRAPI_ADMIN_PASSWORD": "your_admin_password"
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
      "args": ["/path/to/strapi-mcp/build/index.js"],
      "env": {
        "STRAPI_URL": "http://localhost:1337",
        "STRAPI_API_TOKEN": "your_api_token_here"
        // Or use admin credentials for full functionality:
        // "STRAPI_ADMIN_EMAIL": "admin@example.com",
        // "STRAPI_ADMIN_PASSWORD": "your_admin_password"
      }
    }
  }
}
```


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

For comprehensive examples and usage patterns, see the [Tools and Resources Reference](./docs/TOOLS.md).

## Development

For development setup, building, testing, and contributing guidelines, see the [Development Guide](./docs/DEVELOPMENT.md).

## CI/CD

This project uses GitHub Actions for continuous integration:

- **CI** - Runs on every push and pull request to main branch
  - Tests on Node.js 18.x, 20.x, and 22.x
  - Automatically sets up a local Strapi 5 instance with PostgreSQL
  - Creates required content types (projects, technologies)
  - Generates API tokens for authentication
  - Runs linting, type checking, and all tests

## Troubleshooting

For common issues and solutions, see the [Troubleshooting Guide](./docs/TROUBLESHOOTING.md).

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for a detailed history of changes.

## License

MIT

## Documentation

- [Tools and Resources Reference](./docs/TOOLS.md) - Detailed documentation for all tools and resources
- [Deployment Guide](./docs/DEPLOYMENT.md) - Production deployment instructions
- [Development Guide](./docs/DEVELOPMENT.md) - Setup for contributors and developers
- [Direct Usage Guide](./docs/DIRECT_USAGE.md) - Running the server from command line
- [Troubleshooting Guide](./docs/TROUBLESHOOTING.md) - Common issues and solutions

## Support

For issues and feature requests, please visit the [GitHub repository](https://github.com/glebtv/strapi-mcp).