# Direct Usage Guide

This guide explains how to run the Strapi MCP server directly from the command line.

## Prerequisites

- Node.js 18.x or higher
- npm
- A running Strapi v5 instance

## Running with Environment Variables

### Using a `.env` file (Recommended)

1. Create a `.env` file in the project root:
```env
STRAPI_URL=http://localhost:1337
STRAPI_ADMIN_EMAIL=admin@example.com
STRAPI_ADMIN_PASSWORD=your_admin_password
STRAPI_DEV_MODE=true
```

2. Run the server:
```bash
# If installed globally
strapi-mcp

# If running from source
node --env-file=.env dist/index.js

# Or with Node.js 20.6.0+
node --env-file=.env dist/index.js
```

### Using Environment Variables Directly

```bash
# Set environment variables
export STRAPI_URL=http://localhost:1337
export STRAPI_ADMIN_EMAIL=admin@example.com
export STRAPI_ADMIN_PASSWORD=your_admin_password
export STRAPI_DEV_MODE=true

# Run the server
strapi-mcp

# Or from source
node dist/index.js
```

### Windows Command Prompt

```cmd
set STRAPI_URL=http://localhost:1337
set STRAPI_ADMIN_EMAIL=admin@example.com
set STRAPI_ADMIN_PASSWORD=your_admin_password
set STRAPI_DEV_MODE=true

strapi-mcp
```

### Windows PowerShell

```powershell
$env:STRAPI_URL="http://localhost:1337"
$env:STRAPI_ADMIN_EMAIL="admin@example.com"
$env:STRAPI_ADMIN_PASSWORD="your_admin_password"
$env:STRAPI_DEV_MODE="true"

strapi-mcp
```

## Using with npx

Run directly without installation:

```bash
npx strapi-mcp
```

With environment variables:
```bash
STRAPI_URL=http://localhost:1337 \
STRAPI_ADMIN_EMAIL=admin@example.com \
STRAPI_ADMIN_PASSWORD=your_admin_password \
npx strapi-mcp
```

## Testing the Connection

Once the server is running, it will validate the configuration and attempt to connect to Strapi. You should see output like:

```
MCP server running on stdio
```

If there are configuration errors, you'll see detailed error messages explaining what needs to be fixed.

## Using with MCP Clients

### With the MCP Inspector

The MCP Inspector is useful for testing and debugging:

```bash
# Install the inspector
npm install -g @modelcontextprotocol/inspector

# Run with the inspector
mcp-inspector node dist/index.js
```

This will open a web interface where you can:
- Test tool calls
- View available tools and resources
- See request/response data

### Programmatic Usage

You can also use the server programmatically with any MCP client:

```javascript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const transport = new StdioClientTransport({
  command: 'node',
  args: ['/path/to/strapi-mcp/dist/index.js'],
  env: {
    STRAPI_URL: 'http://localhost:1337',
    STRAPI_ADMIN_EMAIL: 'admin@example.com',
    STRAPI_ADMIN_PASSWORD: 'your_password'
  }
});

const client = new Client({
  name: 'strapi-mcp-client',
  version: '1.0.0'
}, {
  capabilities: {}
});

await client.connect(transport);

// List content types
const result = await client.callTool({
  name: 'list_content_types',
  arguments: {}
});
```

## Configuration Options

### Required Configuration

One of the following authentication methods must be provided:

**Option 1: Admin Credentials (Recommended)**
- `STRAPI_ADMIN_EMAIL`: Admin user email
- `STRAPI_ADMIN_PASSWORD`: Admin user password

**Option 2: API Token**
- `STRAPI_API_TOKEN`: API token from Strapi admin panel

### Optional Configuration

- `STRAPI_URL`: Strapi instance URL (default: `http://localhost:1337`)
- `STRAPI_DEV_MODE`: Enable development mode features (default: `false`)

## Troubleshooting Direct Usage

### Common Issues

1. **"Missing required authentication"**
   - Ensure you've set either admin credentials or API token
   - Check environment variable names are correct

2. **"Cannot connect to Strapi instance"**
   - Verify Strapi is running at the specified URL
   - Check network connectivity
   - Ensure firewall isn't blocking the connection

3. **"command not found: strapi-mcp"**
   - Install globally: `npm install -g strapi-mcp`
   - Or use npx: `npx strapi-mcp`
   - Or run directly: `node /path/to/dist/index.js`

### Debugging

Enable debug output by setting the `DEBUG` environment variable:

```bash
DEBUG=* strapi-mcp
```

This will show detailed information about:
- Configuration loading
- Authentication attempts
- API requests and responses
- Error details

## Security Considerations

1. **Never commit `.env` files** to version control
2. **Use strong passwords** for admin accounts
3. **Rotate API tokens** regularly
4. **Limit API token permissions** to what's needed
5. **Use HTTPS** in production environments

## Next Steps

- Configure the server in Claude Desktop for AI integration
- Explore available tools with the MCP Inspector
- Read the [Tools Reference](./TOOLS-v2.md) for detailed usage
- Check [Troubleshooting](./TROUBLESHOOTING.md) if you encounter issues