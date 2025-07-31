# Tools and Resources Reference

This document provides detailed information about all available tools and resources in the Strapi MCP server.

## Resources

The MCP server exposes Strapi content types as resources that can be accessed via URIs.

### Resource URI Formats

- `strapi://content-type/{pluralApiId}` - Get all entries for a content type
- `strapi://content-type/{pluralApiId}/{documentId}` - Get a specific entry
- `strapi://content-type/{pluralApiId}?filters={...}` - Get filtered entries

### Resource Properties

- **URI**: Unique identifier for the resource
- **Name**: Human-readable name from content type display name
- **Description**: Brief description of the resource
- **Mime Type**: `application/json` for all resources

## Tools Reference

### Content Management Tools

#### `list_content_types`
Lists all available content types in the Strapi instance.

**Arguments**: None

**Returns**: Array of content types with their UIDs, names, and attributes

**Example**:
```javascript
use_mcp_tool(
  server_name: "strapi-mcp",
  tool_name: "list_content_types",
  arguments: {}
)
```

#### `get_entries`
Retrieves entries for a specific content type with support for filtering, pagination, sorting, and population.

**Arguments**:
- `pluralApiId` (string, required): The plural API ID (e.g., 'articles')
- `options` (string, optional): JSON string with query options

**Options structure**:
```javascript
{
  "filters": {
    "field": { "$operator": "value" }
  },
  "pagination": {
    "page": 1,
    "pageSize": 25
  },
  "sort": ["field:asc", "field2:desc"],
  "populate": ["relation1", "relation2"],
  "fields": ["field1", "field2"],
  "status": "published", // or "draft" or "all"
  "locale": "en" // for i18n content
}
```

**Filter operators**:
- `$eq`: Equal
- `$ne`: Not equal
- `$contains`: Contains
- `$notContains`: Does not contain
- `$in`: In array
- `$notIn`: Not in array
- `$lt`: Less than
- `$lte`: Less than or equal
- `$gt`: Greater than
- `$gte`: Greater than or equal
- `$between`: Between two values
- `$startsWith`: Starts with
- `$endsWith`: Ends with

#### `get_entry`
Retrieves a specific entry by its document ID.

**Arguments**:
- `pluralApiId` (string, required): The plural API ID
- `documentId` (string, required): The document ID
- `options` (string, optional): JSON string with populate, fields, and locale options

#### `create_entry`
Creates a new entry for a content type.

**Arguments**:
- `pluralApiId` (string, required): The plural API ID
- `data` (object, required): The entry data
- `publish` (boolean, optional): Whether to publish immediately (default: false)

**Example**:
```javascript
use_mcp_tool(
  server_name: "strapi-mcp",
  tool_name: "create_entry",
  arguments: {
    "pluralApiId": "articles",
    "data": {
      "title": "My Article",
      "content": "Article content here"
    },
    "publish": true
  }
)
```

#### `update_entry`
Updates an existing entry.

**Arguments**:
- `pluralApiId` (string, required): The plural API ID
- `documentId` (string, required): The document ID to update
- `data` (object, required): The updated data

#### `delete_entry`
Deletes an entry by its document ID.

**Arguments**:
- `pluralApiId` (string, required): The plural API ID
- `documentId` (string, required): The document ID to delete

#### `publish_entry`
Publishes a draft entry.

**Arguments**:
- `pluralApiId` (string, required): The plural API ID
- `documentId` (string, required): The document ID to publish

#### `unpublish_entry`
Unpublishes a published entry (converts to draft).

**Arguments**:
- `pluralApiId` (string, required): The plural API ID
- `documentId` (string, required): The document ID to unpublish

#### `delete_all_entries`
Deletes all entries for a content type. **WARNING**: This is a destructive operation.

**Arguments**:
- `pluralApiId` (string, required): The plural API ID

### Media Management Tools

#### `upload_media`
Uploads a media file using base64 encoding (max ~750KB file due to context limits).

**Arguments**:
- `fileData` (string, required): Base64 encoded file data
- `fileName` (string, required): Name of the file
- `fileType` (string, required): MIME type (e.g., 'image/jpeg')

#### `upload_media_from_path`
Uploads a media file from a local file path (max 10MB, avoids context overflow).

**Arguments**:
- `filePath` (string, required): Path to the file
- `fileName` (string, optional): Override the file name
- `fileType` (string, optional): Override the MIME type

#### `list_media`
Lists media files in the Strapi media library.

**Arguments**:
- `options` (string, optional): JSON string with query parameters

#### `list_media_folders`
Lists media folders in the Strapi media library.

**Arguments**:
- `options` (string, optional): JSON string with query parameters

### Content Type Builder Tools

#### `get_content_type_schema`
Gets the complete schema for a content type.

**Arguments**:
- `contentType` (string, required): The content type UID (e.g., 'api::article.article')

#### `create_content_type`
Creates a new content type.

**Arguments**:
- `displayName` (string, required): Display name for the content type
- `singularName` (string, required): Singular API ID
- `pluralName` (string, required): Plural API ID
- `kind` (string, optional): 'collectionType' or 'singleType' (default: 'collectionType')
- `description` (string, optional): Description of the content type
- `draftAndPublish` (boolean, optional): Enable draft/publish feature (default: true)
- `attributes` (object, required): Field definitions
- `pluginOptions` (object, optional): Plugin options like i18n

**Example**:
```javascript
use_mcp_tool(
  server_name: "strapi-mcp",
  tool_name: "create_content_type",
  arguments: {
    "displayName": "Product",
    "singularName": "product",
    "pluralName": "products",
    "attributes": {
      "name": { "type": "string", "required": true },
      "price": { "type": "decimal" },
      "description": { "type": "richtext" }
    }
  }
)
```

#### `update_content_type`
Updates an existing content type by adding or modifying attributes.

**Arguments**:
- `contentType` (string, required): The content type UID
- `attributes` (object, required): Attributes to add or update
- `pluginOptions` (object, optional): Plugin options to update

#### `delete_content_type`
Deletes a content type. **WARNING**: This will delete all entries.

**Arguments**:
- `contentType` (string, required): The content type UID to delete

### Component Management Tools

#### `list_components`
Lists all available components.

**Arguments**: None

#### `get_component_schema`
Gets the schema for a specific component.

**Arguments**:
- `componentUid` (string, required): The component UID (e.g., 'shared.seo')

#### `create_component`
Creates a new component.

**Arguments**:
- `displayName` (string, required): Display name
- `category` (string, required): Component category
- `icon` (string, optional): Icon name (default: 'brush')
- `attributes` (object, required): Component fields

#### `update_component`
Updates an existing component.

**Arguments**:
- `componentUid` (string, required): The component UID
- `attributes` (object, required): Attributes to update

### Relation Management Tools

#### `connect_relation`
Connects entries to a relation field.

**Arguments**:
- `pluralApiId` (string, required): The plural API ID
- `documentId` (string, required): The document ID
- `relationField` (string, required): The relation field name
- `relatedIds` (array, required): Array of document IDs to connect

#### `disconnect_relation`
Disconnects entries from a relation field.

**Arguments**:
- `pluralApiId` (string, required): The plural API ID
- `documentId` (string, required): The document ID
- `relationField` (string, required): The relation field name
- `relatedIds` (array, required): Array of document IDs to disconnect

#### `set_relation`
Sets (replaces) all relations for a field.

**Arguments**:
- `pluralApiId` (string, required): The plural API ID
- `documentId` (string, required): The document ID
- `relationField` (string, required): The relation field name
- `relatedIds` (array, required): Array of document IDs to set

### i18n Tools

#### `list_locales`
Lists all enabled locales in Strapi i18n plugin.

**Arguments**: None

#### `create_locale`
Creates a new locale.

**Arguments**:
- `code` (string, required): Locale code (e.g., 'fr', 'es')
- `name` (string, required): Locale display name

#### `delete_locale`
Deletes a locale.

**Arguments**:
- `id` (number, required): The locale ID to delete

### Direct API Access

#### `direct_api_call`
Execute a direct REST API call to Strapi.

**Arguments**:
- `endpoint` (string, required): The API endpoint
- `method` (string, optional): HTTP method (default: 'GET')
- `params` (object, optional): Query parameters
- `body` (object, optional): Request body
- `authenticated` (boolean, optional): Include auth headers (default: true)

**Example**:
```javascript
use_mcp_tool(
  server_name: "strapi-mcp",
  tool_name: "direct_api_call",
  arguments: {
    "endpoint": "/api/custom-endpoint",
    "method": "POST",
    "body": {
      "custom": "data"
    }
  }
)
```

## Error Handling

All tools return structured errors with:
- Error message
- Status code (when applicable)
- Troubleshooting suggestions
- Details about what went wrong

Common error types:
- `ValidationError`: Invalid input data
- `NotFoundError`: Resource not found
- `UnauthorizedError`: Authentication failed
- `ForbiddenError`: Insufficient permissions
- `InternalServerError`: Server-side error

## Best Practices

1. **Use pagination** for large datasets to avoid timeouts
2. **Specify fields** to reduce response size when you only need specific data
3. **Use populate sparingly** as it increases response size
4. **Handle errors gracefully** - check for error responses
5. **Use admin credentials** for full functionality
6. **Test filters locally** before using in production
7. **Use `upload_media_from_path`** for files larger than 500KB