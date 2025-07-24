# Deployment Guide

This guide provides step-by-step instructions for deploying and configuring the Strapi MCP server.

## Prerequisites

- Node.js 18.x, 20.x, or 22.x installed
- A running Strapi v5 instance (**Strapi v4 is not supported**)
- Access to Strapi v5 admin panel to create API tokens

## Installation Options

### Option 1: Install from npm

```bash
npm install -g strapi-mcp
```

### Option 2: Install from source

```bash
git clone https://github.com/glebtv/strapi-mcp.git
cd strapi-mcp
npm install
npm run build
```

## Configuration Steps

### 1. Create a Strapi API Token

1. Log in to your Strapi admin panel
2. Navigate to **Settings → API Tokens**
3. Click **"Create new API Token"**
4. Configure the token:
   - **Name**: `MCP Server Token` (or any descriptive name)
   - **Description**: `Token for MCP server integration`
   - **Type**: Select **"Full access"** for all features
   - **Lifetime**: Choose based on your security requirements
5. Click **"Save"**
6. Copy the generated token immediately (it won't be shown again)

### 2. Configure Environment Variables

Set the following environment variables:

```bash
export STRAPI_URL=http://localhost:1337
export STRAPI_API_TOKEN=your-api-token-here
export STRAPI_DEV_MODE=false  # Set to true for development
```

### 3. Configure MCP Client (Claude Desktop/Cursor)

#### For Claude Desktop

Edit the configuration file:
- **MacOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%/Claude/claude_desktop_config.json`

Add the Strapi MCP server configuration:

```json
{
  "mcpServers": {
    "strapi-mcp": {
      "command": "npx",
      "args": ["strapi-mcp"],
      "env": {
        "STRAPI_URL": "http://localhost:1337",
        "STRAPI_API_TOKEN": "your-api-token-here"
      }
    }
  }
}
```

#### For Cursor

The configuration is similar to Claude Desktop. Check Cursor's documentation for the exact configuration file location.

### 4. Verify Installation

1. Restart Claude Desktop/Cursor
2. The MCP server should appear in the available servers list
3. Test by using a simple command:
   ```
   use_mcp_tool(
     server_name: "strapi-mcp",
     tool_name: "list_content_types",
     arguments: {}
   )
   ```

## Production Deployment

### Security Considerations

1. **API Token Security**:
   - Never commit API tokens to version control
   - Use environment variables or secure secret management
   - Rotate tokens regularly
   - Use tokens with minimal required permissions

2. **Network Security**:
   - Use HTTPS for production Strapi instances
   - Implement proper CORS settings in Strapi
   - Consider using a reverse proxy

3. **Access Control**:
   - Create dedicated API tokens for each MCP server instance
   - Monitor token usage in Strapi logs
   - Implement rate limiting if necessary

### Running as a Service

#### Using PM2

```bash
# Install PM2
npm install -g pm2

# Start the MCP server
pm2 start /path/to/strapi-mcp/build/index.js --name strapi-mcp

# Save PM2 configuration
pm2 save
pm2 startup
```

#### Using systemd (Linux)

Create `/etc/systemd/system/strapi-mcp.service`:

```ini
[Unit]
Description=Strapi MCP Server
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/strapi-mcp
Environment="STRAPI_URL=http://localhost:1337"
Environment="STRAPI_API_TOKEN=your-api-token"
ExecStart=/usr/bin/node /path/to/strapi-mcp/build/index.js
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

Enable and start the service:
```bash
sudo systemctl enable strapi-mcp
sudo systemctl start strapi-mcp
```

## Docker Deployment

### Using Docker

Create a `Dockerfile`:

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY build ./build

ENV STRAPI_URL=http://strapi:1337
ENV STRAPI_API_TOKEN=""

CMD ["node", "build/index.js"]
```

Build and run:
```bash
docker build -t strapi-mcp .
docker run -e STRAPI_API_TOKEN=your-token strapi-mcp
```

### Using Docker Compose

```yaml
version: '3.8'

services:
  strapi-mcp:
    image: strapi-mcp
    environment:
      - STRAPI_URL=http://strapi:1337
      - STRAPI_API_TOKEN=${STRAPI_API_TOKEN}
    depends_on:
      - strapi
    restart: unless-stopped

  strapi:
    image: strapi/strapi
    # ... your Strapi configuration
```

## Monitoring and Maintenance

### Logging

The MCP server logs to stdout/stderr. Configure your deployment platform to capture and store these logs.

### Health Checks

The server validates Strapi connectivity on startup. For continuous monitoring:

1. Monitor the process status
2. Check Strapi API availability
3. Validate API token permissions periodically

### Updates

```bash
# For npm installation
npm update -g strapi-mcp

# For source installation
cd /path/to/strapi-mcp
git pull
npm install
npm run build
# Restart the service
```

## Troubleshooting Deployment Issues

### Connection Issues

1. **Verify Strapi is accessible**:
   ```bash
   curl http://localhost:1337/_health
   ```

2. **Test API token**:
   ```bash
   curl -H "Authorization: Bearer your-api-token" http://localhost:1337/api/users/me
   ```

### Permission Issues

Ensure the API token has the required permissions:
- Access to content types
- CRUD operations on entries
- Media upload permissions
- Admin panel access (for content type management)

### Performance Optimization

1. **Connection Pooling**: The server reuses HTTP connections
2. **Response Caching**: Consider implementing caching for frequently accessed data
3. **Rate Limiting**: Implement rate limiting to prevent API abuse

## Support

For deployment issues:
1. Check the [Troubleshooting Guide](./TROUBLESHOOTING.md)
2. Review server logs for error messages
3. Open an issue on [GitHub](https://github.com/glebtv/strapi-mcp)