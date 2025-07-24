# Troubleshooting Guide

This guide helps you resolve common issues with the Strapi MCP server.

## Common Issues and Solutions

### 1. Placeholder API Token Error

**Error Message**:
```
[Error] STRAPI_API_TOKEN appears to be a placeholder value...
```

**Cause**: Using a placeholder value like "strapi_token" or "your-api-token-here" instead of a real API token.

**Solution**:
1. Log in to your Strapi v5 admin panel
2. Navigate to Settings → API Tokens
3. Create a new API token with "Full access" permissions
4. Copy the generated token
5. Replace the placeholder with the actual token in your configuration

### 2. Connection Refused

**Error Message**:
```
Cannot connect to Strapi instance: Connection refused. Is Strapi running at http://localhost:1337?
```

**Possible Causes**:
- Strapi is not running
- Strapi is running on a different port
- Network/firewall issues

**Solutions**:
1. Start Strapi: `npm run develop` or `yarn develop`
2. Verify the URL in `STRAPI_URL` environment variable
3. Check if Strapi is accessible: `curl http://localhost:1337/_health`
4. Ensure your database (PostgreSQL/MySQL) is running
5. Check firewall rules if Strapi is on a remote server

### 3. Authentication Failed

**Error Message**:
```
Cannot connect to Strapi instance: Authentication failed. Check your API token.
```

**Possible Causes**:
- Invalid API token
- Token lacks required permissions
- Token has expired

**Solutions**:
1. Verify the API token is correctly copied (no extra spaces)
2. Ensure the token has "Full access" permissions
3. Create a new token if the current one might be expired
4. Test the token manually:
   ```bash
   curl -H "Authorization: Bearer your-api-token" http://localhost:1337/api/users/me
   ```

### 4. Context Window Overflow

**Error Message**:
```
Error: Context window overflow due to large base64 strings
```

**Cause**: Attempting to upload files that are too large using base64 encoding.

**Solutions**:
1. Use `upload_media_from_path` for files larger than ~500KB
2. Compress images before uploading:
   - Reduce image resolution
   - Use appropriate compression formats (JPEG for photos, PNG for graphics)
3. The `upload_media` tool has a 1MB base64 limit (~750KB file size)

### 5. Permission Errors

**Error Message**:
```
Access forbidden. Your API token may lack necessary permissions.
```

**Possible Causes**:
- API token has limited permissions
- Content type permissions are restricted
- Specific actions are not allowed

**Solutions**:
1. Create a new API token with "Full access" permissions
2. Check content type permissions in Strapi:
   - Settings → Users & Permissions → Roles
   - Ensure the API token role has access to required content types
3. Verify specific actions are allowed (find, findOne, create, update, delete)

### 6. Content Type Not Found

**Error Message**:
```
Content type 'api::example.example' not found
```

**Possible Causes**:
- Incorrect content type UID
- Content type doesn't exist
- Using Strapi v4 format instead of v5

**Solutions**:
1. Use `list_content_types` tool to see available content types
2. Verify the UID format: `api::{singularName}.{singularName}`
3. Ensure you're using Strapi v5 (v4 is not supported)

### 7. Invalid Document ID

**Error Message**:
```
Document with ID 'xyz' not found
```

**Possible Causes**:
- Using numeric IDs from Strapi v4
- Document has been deleted
- Incorrect document ID format

**Solutions**:
1. Strapi v5 uses alphanumeric document IDs, not numeric IDs
2. Use `get_entries` to list entries and get valid document IDs
3. Document IDs look like: `clh1234567890abcdef`

### 8. Component Update Errors

**Error Message**:
```
Cannot update component field
```

**Possible Causes**:
- Incorrect component data structure
- Missing required component fields

**Solutions**:
```javascript
// Correct format for single components
{
  "data": {
    "componentName": {
      "field1": "value",
      "field2": "value"
    }
  }
}

// Correct format for repeatable components
{
  "data": {
    "componentName": [
      { "field1": "value" },
      { "field1": "value2" }
    ]
  }
}
```

### 9. Strapi Version Incompatibility

**Error Message**:
```
Unexpected response format from Strapi
```

**Cause**: Using Strapi v4 instead of v5.

**Solution**:
- This MCP server only supports Strapi v5
- Upgrade your Strapi instance to v5
- Check your Strapi version: `npm list strapi`

### 10. MCP Server Not Found

**Error Message**:
```
MCP server 'strapi-mcp' not found
```

**Possible Causes**:
- Server not properly configured in Claude Desktop
- Configuration file syntax error

**Solutions**:
1. Verify configuration file location:
   - MacOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%APPDATA%/Claude/claude_desktop_config.json`
2. Check JSON syntax is valid
3. Restart Claude Desktop after configuration changes

## Debugging Tips

### Enable Debug Logging

Set environment variable:
```bash
export DEBUG=strapi-mcp:*
```

### Test Strapi Connection

```bash
# Test health endpoint
curl http://localhost:1337/_health

# Test API token
curl -H "Authorization: Bearer your-api-token" \
     http://localhost:1337/api/content-type-builder/content-types
```

### Use MCP Inspector

```bash
npm run inspector
```

The Inspector provides:
- Real-time request/response logging
- Tool execution traces
- Error details

### Check Strapi Logs

Monitor Strapi server logs for:
- Authentication failures
- Permission denials
- Server errors

### Verify Environment Variables

```bash
echo $STRAPI_URL
echo $STRAPI_API_TOKEN
echo $STRAPI_DEV_MODE
```

## Getting Help

If you continue to experience issues:

1. Check the [GitHub Issues](https://github.com/glebtv/strapi-mcp/issues) for similar problems
2. Enable debug logging and collect relevant error messages
3. Create a new issue with:
   - Error messages
   - Steps to reproduce
   - Strapi version (must be v5)
   - Node.js version
   - MCP server version

## Performance Optimization

### Slow Response Times

1. **Enable connection keep-alive** (enabled by default)
2. **Limit population depth** to avoid over-fetching
3. **Use field selection** to retrieve only needed data
4. **Implement pagination** for large datasets

### Memory Issues

1. **Avoid large file uploads** via base64
2. **Use streaming for large datasets** (future feature)
3. **Monitor Strapi server resources**

## Security Best Practices

1. **Never commit API tokens** to version control
2. **Use environment variables** for sensitive data
3. **Create dedicated tokens** for each environment
4. **Implement token rotation** regularly
5. **Use HTTPS** for production Strapi instances
6. **Limit token permissions** to minimum required