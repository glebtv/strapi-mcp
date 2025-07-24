# Direct Usage Guide

This guide explains how to run the Strapi MCP server directly from the command line, without using Claude Desktop or Cursor.

## Prerequisites

- Node.js 18.x, 20.x, or 22.x installed
- Strapi v5 instance running
- Valid API token from Strapi

## Environment Setup

Set the required environment variables:

```bash
export STRAPI_URL=http://localhost:1337
export STRAPI_API_TOKEN=your-api-token
export STRAPI_DEV_MODE=true # optional, for development features
```

## Running the Server

### Option 1: Using npm (Globally Installed)

If you've installed the package globally:

```bash
npm install -g strapi-mcp
strapi-mcp
```

### Option 2: Using npx (Without Installation)

Run directly without installing:

```bash
npx strapi-mcp
```

### Option 3: From Source

If you've cloned the repository:

```bash
# Build first
npm install
npm run build

# Run the built server
node build/index.js
```

### Option 4: Development Mode

For development with auto-rebuild:

```bash
npm run watch
# In another terminal
node build/index.js
```

## Testing the Connection

Once the server is running, it will validate the connection to Strapi and output status messages:

```
[Info] Strapi MCP Server v0.2.0
[Info] Validating Strapi connection...
[Success] Connected to Strapi at http://localhost:1337
[Info] MCP server running on stdio
```

## Using with MCP Clients

### With MCP Inspector

For debugging and testing:

```bash
npm run inspector
```

This provides a web interface to interact with the MCP server.

### With Custom MCP Client

You can build your own MCP client that communicates with the server over stdio. The server expects JSON-RPC messages following the MCP protocol.

## Command Line Arguments

The server doesn't accept command line arguments. All configuration is done through environment variables.

## Logging and Debugging

Enable debug logging:

```bash
export DEBUG=strapi-mcp:*
strapi-mcp
```

## Common Use Cases

### Running Multiple Instances

For different Strapi instances, use different environment configurations:

```bash
# Instance 1
STRAPI_URL=http://localhost:1337 STRAPI_API_TOKEN=token1 strapi-mcp

# Instance 2 (in another terminal)
STRAPI_URL=http://localhost:1338 STRAPI_API_TOKEN=token2 strapi-mcp
```

### Using with Scripts

Create a shell script for easy startup:

```bash
#!/bin/bash
# start-strapi-mcp.sh

export STRAPI_URL=http://localhost:1337
export STRAPI_API_TOKEN=your-token-here
export STRAPI_DEV_MODE=true

exec npx strapi-mcp
```

### Docker Usage

Create a simple Dockerfile:

```dockerfile
FROM node:20-alpine
RUN npm install -g strapi-mcp
ENV STRAPI_URL=http://strapi:1337
CMD ["strapi-mcp"]
```

Run with:

```bash
docker build -t my-strapi-mcp .
docker run -e STRAPI_API_TOKEN=your-token my-strapi-mcp
```

## Troubleshooting Direct Usage

### Server Exits Immediately

- Check environment variables are set correctly
- Verify Strapi is accessible at the specified URL
- Ensure API token is valid

### No Output

The MCP server communicates via stdio. It won't show interactive output unless:
- There's an error during startup
- Debug logging is enabled
- You're using the MCP Inspector

### Permission Denied

If running from source:

```bash
chmod +x build/index.js
```

## Security Considerations

- Never hardcode API tokens in scripts
- Use environment files (.env) for local development only
- Consider using secret management tools for production
- Restrict file permissions on scripts containing tokens

## Integration Examples

### With systemd (Linux)

See the [Deployment Guide](./DEPLOYMENT.md) for systemd service configuration.

### With PM2

```bash
pm2 start strapi-mcp --name "strapi-mcp-server"
```

### With Supervisor

```ini
[program:strapi-mcp]
command=npx strapi-mcp
environment=STRAPI_URL="http://localhost:1337",STRAPI_API_TOKEN="your-token"
autostart=true
autorestart=true
```