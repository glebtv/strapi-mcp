# Troubleshooting Guide

This guide covers common issues and their solutions when using the Strapi MCP server.

## Common Issues

### Authentication Issues

#### Error: "Missing required environment variable: STRAPI_URL"
**Cause**: The server cannot find the Strapi URL configuration.

**Solution**: 
- Ensure `STRAPI_URL` is set in your environment or MCP configuration
- Default value is `http://localhost:1337`

#### Error: "Missing required authentication"
**Cause**: No authentication credentials provided.

**Solution**: Provide either:
- Admin credentials: `STRAPI_ADMIN_EMAIL` and `STRAPI_ADMIN_PASSWORD`
- API token: `STRAPI_API_TOKEN`

Admin credentials are recommended for full functionality.

#### Error: "Failed to authenticate with provided admin credentials"
**Cause**: Invalid admin email/password or admin user doesn't exist.

**Solution**:
1. Verify credentials are correct
2. Ensure admin user exists in Strapi
3. Check if admin account is active
4. Try logging in manually via Strapi admin panel

#### Error: "STRAPI_API_TOKEN appears to be a placeholder value"
**Cause**: Using example/placeholder token values.

**Solution**: 
- Replace placeholder with actual API token from Strapi admin panel
- Go to Settings > API Tokens > Create new API Token

### Connection Issues

#### Error: "Cannot connect to Strapi instance: Connection refused"
**Cause**: Strapi is not running or not accessible at the configured URL.

**Solution**:
1. Ensure Strapi is running: `npm run develop` in your Strapi project
2. Verify the URL in `STRAPI_URL` is correct
3. Check if firewall is blocking the connection
4. Ensure database (if using PostgreSQL/MySQL) is running

#### Error: "Health check returned 503"
**Cause**: Strapi is restarting or in maintenance mode.

**Solution**:
- Wait for Strapi to finish restarting
- Check Strapi logs for errors
- If in dev mode, this is normal after schema changes

### Permission Issues

#### Error: "Access forbidden. Your API token may lack necessary permissions"
**Cause**: API token doesn't have required permissions.

**Solution**:
1. Use admin credentials instead of API token
2. If using API token, ensure it has "Full access" permissions
3. Check content type permissions in Strapi admin panel
4. Verify the token hasn't expired

#### Error: "Forbidden" when accessing public API
**Cause**: Content type doesn't allow public access.

**Solution**:
1. Go to Strapi admin > Settings > Roles > Public
2. Enable necessary permissions for your content types
3. Save changes and restart Strapi if needed

### Content Type Issues

#### Error: "Content type not found"
**Cause**: The specified content type doesn't exist.

**Solution**:
1. Use `list_content_types` tool to see available types
2. Check spelling of plural API ID
3. Ensure content type is created in Strapi
4. Verify content type isn't disabled

#### Error: "Invalid arguments: pluralApiId: Required"
**Cause**: Missing required parameter in tool call.

**Solution**:
- Include `pluralApiId` in your tool arguments
- Example: `{ "pluralApiId": "articles" }`

### File Upload Issues

#### Error: "File too large: ~XMB. Maximum ~0.75MB for base64 upload"
**Cause**: Base64 encoded file exceeds size limit.

**Solution**:
1. Use `upload_media_from_path` instead of `upload_media`
2. Compress/resize image before uploading
3. Convert to a more efficient format (e.g., PNG to JPEG)

#### Error: "Invalid base64 data"
**Cause**: Malformed base64 string.

**Solution**:
- Ensure base64 string is properly encoded
- Remove any data URI prefix (e.g., `data:image/jpeg;base64,`)
- Check for whitespace or special characters

### Schema and Structure Issues

#### Error: "Strapi is restarting, waiting for it to come back online..."
**Cause**: Normal behavior in dev mode after schema changes.

**Solution**:
- Wait for Strapi to restart (usually 5-10 seconds)
- Check `STRAPI_DEV_MODE` is set to `true` for dev environments
- Monitor Strapi console for restart completion

#### Error: "content must be a `string` type, but the final value was: `{...}`"
**Cause**: Sending wrong data type for field.

**Solution**:
- Check content type schema with `get_content_type_schema`
- Ensure field values match expected types
- For richtext fields, send strings not objects

### Relation Issues

#### Error: "Invalid document ID format"
**Cause**: Using numeric IDs instead of Strapi v5 document IDs.

**Solution**:
- Use string document IDs (e.g., "abc123xyz")
- Get proper IDs from `get_entries` response
- Don't use numeric IDs from Strapi v4

### i18n Issues

#### Error: "This locale already exists"
**Cause**: Trying to create a locale that's already enabled.

**Solution**:
1. List existing locales with `list_locales`
2. Delete existing locale first if needed
3. Use a different locale code

### Development Mode Issues

#### Performance Issues
**Cause**: Health checks and restart waiting in dev mode.

**Solution**:
- Set `STRAPI_DEV_MODE=false` for production
- Only use dev mode during active development
- Increase wait times if on slower hardware

## Debugging Tips

### Enable Verbose Logging

Check console output for detailed error messages. The server logs:
- Authentication attempts
- API requests and responses
- Health check status
- Schema reload events

### Use the MCP Inspector

```bash
npm run inspector
```

Provides a web interface for:
- Testing tool calls
- Viewing request/response data
- Debugging connection issues

### Check Strapi Logs

Always check your Strapi server logs for:
- Database connection errors
- Plugin initialization failures
- Permission denials
- Schema validation errors

### Test with Direct API Calls

Use the `direct_api_call` tool to test Strapi endpoints:

```javascript
use_mcp_tool(
  server_name: "strapi-mcp",
  tool_name: "direct_api_call",
  arguments: {
    "endpoint": "/_health",
    "method": "GET"
  }
)
```

## Getting Help

If you're still experiencing issues:

1. Check the [GitHub Issues](https://github.com/glebtv/strapi-mcp/issues)
2. Review test files for usage examples
3. Ensure you're using Strapi v5 (v4 is not supported)
4. Create a minimal reproduction case
5. Include full error messages and logs when reporting issues