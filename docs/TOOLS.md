# Tools and Resources Reference

This document provides detailed information about all available tools and resources in the Strapi MCP server.

## Resources

The MCP server exposes Strapi content types as resources that can be accessed via URIs.

### Resource URI Formats

- `strapi://content-type/` - List all content types
- `strapi://content-type/{pluralApiId}` - Get schema for a content type (e.g., `strapi://content-type/articles`)
- `strapi://content-type/{pluralApiId}/{documentId}` - Get a specific entry (future feature)
- `strapi://content-type/{pluralApiId}?filters={...}` - Get filtered entries (future feature)

### Resource Properties

- **URI**: Unique identifier for the resource
- **Name**: Human-readable name
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
{
  "data": [
    {
      "uid": "api::article.article",
      "apiID": "article",
      "pluralApiId": "articles",
      "info": {
        "displayName": "Article",
        "description": "Article content type"
      }
    }
  ]
}
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
  "status": "published" // or "draft" or "all"
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
- `options` (string, optional): JSON string with populate and fields options

#### `create_entry`
Creates a new entry for a content type.

**Arguments**:
- `contentType` (string, required): The content type UID
- `pluralApiId` (string, required): The plural API ID
- `data` (object, required): The entry data

#### `update_entry`
Updates an existing entry.

**Arguments**:
- `pluralApiId` (string, required): The plural API ID
- `documentId` (string, required): The document ID
- `data` (object, required): The updated data

#### `delete_entry`
Deletes an entry.

**Arguments**:
- `pluralApiId` (string, required): The plural API ID
- `documentId` (string, required): The document ID

#### `publish_entry`
Publishes a draft entry.

**Arguments**:
- `pluralApiId` (string, required): The plural API ID
- `documentId` (string, required): The document ID

#### `unpublish_entry`
Unpublishes a published entry (converts to draft).

**Arguments**:
- `pluralApiId` (string, required): The plural API ID
- `documentId` (string, required): The document ID

### Media Management Tools

#### `upload_media`
Uploads a media file using base64 encoding. Limited to ~750KB files to prevent context window overflow.

**Arguments**:
- `fileData` (string, required): Base64 encoded file data
- `fileName` (string, required): Name for the file
- `fileType` (string, required): MIME type (e.g., 'image/jpeg')

#### `upload_media_from_path`
Uploads a media file from a local file path. Supports files up to 10MB.

**Arguments**:
- `filePath` (string, required): Local file system path
- `fileName` (string, optional): Override the file name
- `fileType` (string, optional): Override the MIME type

### Schema and Relations Tools

#### `get_content_type_schema`
Retrieves the complete schema for a content type including fields, types, and relations.

**Arguments**:
- `contentType` (string, required): The content type UID

**Returns**: Schema object with attributes, relations, and configuration

#### `connect_relation`
Connects entries to a relation field.

**Arguments**:
- `pluralApiId` (string, required): The plural API ID
- `documentId` (string, required): Main entry document ID
- `relationField` (string, required): Name of the relation field
- `relatedIds` (array, required): Array of document IDs to connect

#### `disconnect_relation`
Disconnects entries from a relation field.

**Arguments**:
- `pluralApiId` (string, required): The plural API ID
- `documentId` (string, required): Main entry document ID
- `relationField` (string, required): Name of the relation field
- `relatedIds` (array, required): Array of document IDs to disconnect

#### `set_relation`
Sets the complete list of related entries, replacing any existing relations.

**Arguments**:
- `pluralApiId` (string, required): The plural API ID
- `documentId` (string, required): Main entry document ID
- `relationField` (string, required): Name of the relation field
- `relatedIds` (array, required): Array of document IDs to set

### Content Type Builder Tools

#### `create_content_type`
Creates a new content type. Requires admin privileges.

**Arguments**:
- `displayName` (string, required): Display name
- `singularName` (string, required): Singular API ID
- `pluralName` (string, required): Plural API ID
- `kind` (string, optional): 'collectionType' or 'singleType'
- `description` (string, optional): Description
- `draftAndPublish` (boolean, optional): Enable draft/publish
- `attributes` (object, required): Field definitions

**Attribute types**:
- `string`: Short text
- `text`: Long text
- `richtext`: Rich text editor
- `email`: Email field
- `password`: Password field
- `integer`: Integer number
- `decimal`: Decimal number
- `float`: Float number
- `boolean`: True/false
- `date`: Date picker
- `datetime`: Date and time picker
- `time`: Time picker
- `json`: JSON data
- `uid`: Unique identifier
- `enumeration`: Dropdown with predefined values
- `media`: Media field
- `relation`: Relation to other content types
- `component`: Component field
- `dynamiczone`: Dynamic zone for components

#### `update_content_type`
Updates an existing content type's attributes. Requires admin privileges.

**Arguments**:
- `contentType` (string, required): Content type UID
- `attributes` (object, required): Attributes to add/update

#### `delete_content_type`
Deletes a content type. Requires admin privileges.

**Arguments**:
- `contentType` (string, required): Content type UID to delete

### Component Management Tools

#### `list_components`
Lists all available components.

**Arguments**: None

**Returns**: Array of components with their UIDs and categories

#### `get_component_schema`
Retrieves the schema for a specific component.

**Arguments**:
- `componentUid` (string, required): The component UID

#### `create_component`
Creates a new component.

**Arguments**:
- `componentData` (object, required): Component definition
  - `displayName` (string, required): Display name
  - `category` (string, required): Component category
  - `icon` (string, optional): Icon name
  - `attributes` (object, required): Field definitions

#### `update_component`
Updates an existing component.

**Arguments**:
- `componentUid` (string, required): Component UID
- `attributesToUpdate` (object, required): Attributes to update

### Direct API Access

#### `strapi_rest`
Executes direct REST API requests against Strapi endpoints for advanced use cases.

**Arguments**:
- `endpoint` (string, required): API endpoint (e.g., 'api/articles')
- `method` (string, optional): HTTP method (GET, POST, PUT, DELETE)
- `params` (object, optional): Query parameters for GET requests
- `body` (object, optional): Request body for POST/PUT requests

**Component handling**:
```javascript
// Reading components
{
  "params": {
    "populate": {
      "SEO": {
        "fields": ["Title", "seoDescription"]
      }
    }
  }
}

// Updating components
{
  "body": {
    "data": {
      "componentName": {
        "field": "value"
      }
    }
  }
}
```

## Advanced Usage

### Complex Filtering

Combine multiple filters:
```javascript
{
  "filters": {
    "$and": [
      { "title": { "$contains": "strapi" } },
      { "publishedAt": { "$notNull": true } }
    ]
  }
}
```

### Deep Population

Populate nested relations:
```javascript
{
  "populate": {
    "author": {
      "populate": ["profile", "articles"]
    },
    "categories": {
      "fields": ["name", "slug"]
    }
  }
}
```

### Pagination

```javascript
{
  "pagination": {
    "page": 1,
    "pageSize": 25,
    "withCount": true
  }
}
```

### Sorting

```javascript
{
  "sort": ["createdAt:desc", "title:asc"]
}
```

## API Endpoints Reference

### Authentication Endpoints

#### Admin Login
- **Endpoint**: `POST /admin/login`
- **Request Body**:
  ```json
  {
    "email": "admin@example.com",
    "password": "password123"
  }
  ```
- **Response**: JWT token for admin API access

#### Admin Registration (First Admin Only)
- **Endpoint**: `POST /admin/register-admin`
- **Request Body**:
  ```json
  {
    "email": "admin@example.com",
    "password": "AdminPassword123",
    "firstname": "Admin",
    "lastname": "User"
  }
  ```

### Content API Endpoints

#### List Entries
- **Endpoint**: `GET /api/{pluralApiId}`
- **Query Parameters**:
  - `filters`: Filter results (e.g., `filters[title][$contains]=strapi`)
  - `pagination[page]`: Page number
  - `pagination[pageSize]`: Items per page
  - `pagination[limit]`: Alias for pageSize
  - `sort`: Sort order (e.g., `sort=createdAt:desc`)
  - `populate`: Relations to populate (e.g., `populate[0]=author`)
  - `fields`: Select specific fields
  - `status`: For Draft & Publish (`published`, `draft`, `all`)
  - `locale`: For i18n (`en`, `ru`, `zh`, `all`, etc.)

#### Get Single Entry
- **Endpoint**: `GET /api/{pluralApiId}/{documentId}`
- **Query Parameters**: Same as list entries (populate, fields, locale, etc.)

#### Create Entry
- **Endpoint**: `POST /api/{pluralApiId}`
- **Request Body**:
  ```json
  {
    "data": {
      "field1": "value",
      "field2": 123,
      "status": "draft" // or "published"
    }
  }
  ```

#### Update Entry
- **Endpoint**: `PUT /api/{pluralApiId}/{documentId}`
- **Query Parameters**:
  - `locale`: Update specific locale
- **Request Body**:
  ```json
  {
    "data": {
      "field1": "new value",
      "status": "published"
    }
  }
  ```

#### Delete Entry
- **Endpoint**: `DELETE /api/{pluralApiId}/{documentId}`
- **Query Parameters**:
  - `locale`: Delete specific locale

### Media/Upload Endpoints

#### Upload Files
- **Endpoint**: `POST /upload`
- **Request**: Multipart form data with:
  - `files`: File data
  - `ref`: Related content type (optional)
  - `refId`: Related entry ID (optional)
  - `field`: Field name (optional)
- **Headers**: Requires authentication token

#### List Media Files
- **Endpoint**: `GET /upload/files`
- **Query Parameters**:
  - `filters`: Filter results
  - `pagination`: Page settings
  - `sort`: Sort order

#### Get Media File
- **Endpoint**: `GET /upload/files/{id}`

#### Delete Media File
- **Endpoint**: `DELETE /upload/files/{id}`

### Content-Type Builder Endpoints (Admin Only)

#### List Content Types
- **Endpoint**: `GET /content-type-builder/content-types`
- **Response**: Array of content type schemas

#### Get Content Type Schema
- **Endpoint**: `GET /content-type-builder/content-types/{contentTypeUid}`

#### Create Content Type
- **Endpoint**: `POST /content-type-builder/update-schema`
- **Request Body**:
  ```json
  {
    "components": [],
    "contentType": {
      "uid": "api::new-type.new-type",
      "displayName": "New Type",
      "singularName": "new-type",
      "pluralName": "new-types",
      "kind": "collectionType",
      "draftAndPublish": true,
      "attributes": {
        "title": { "type": "string", "required": true }
      }
    }
  }
  ```

#### Update Content Type
- **Endpoint**: `PUT /content-type-builder/content-types/{contentTypeUid}`
- **Request Body**: Same structure as create

#### Delete Content Type
- **Endpoint**: `DELETE /content-type-builder/content-types/{contentTypeUid}`

### Component Builder Endpoints (Admin Only)

#### List Components
- **Endpoint**: `GET /content-type-builder/components`
- **Query Parameters**:
  - `pagination[page]`: Page number
  - `pagination[pageSize]`: Items per page

#### Get Component Schema
- **Endpoint**: `GET /content-type-builder/components/{componentUid}`

#### Create Component
- **Endpoint**: `POST /content-type-builder/components`
- **Request Body**:
  ```json
  {
    "component": {
      "uid": "category.component-name",
      "displayName": "Component Name",
      "category": "category",
      "icon": "calendar",
      "attributes": {
        "field1": { "type": "string" }
      }
    }
  }
  ```

#### Update Component
- **Endpoint**: `PUT /content-type-builder/components/{componentUid}`
- **Request Body**: Same structure as create

### Admin API Endpoints

#### Get Admin User Info
- **Endpoint**: `GET /admin/users/me`

#### List Admin Users
- **Endpoint**: `GET /admin/users`
- **Query Parameters**:
  - `filters[isActive][$eq]`: Filter by active status

#### Get Roles
- **Endpoint**: `GET /users-permissions/roles`

#### Update Schema Status
- **Endpoint**: `POST /content-type-builder/update-schema-status`

### Health Check
- **Endpoint**: `GET /_health`
- **Response**: Server health status

## Error Handling

All tools return structured errors with:
- `code`: Error code for programmatic handling
- `message`: Human-readable error message
- `details`: Additional context when available

Common error codes:
- `InvalidRequest`: Invalid parameters
- `ResourceNotFound`: Content type or entry not found
- `AccessDenied`: Insufficient permissions
- `ConnectionError`: Cannot connect to Strapi
- `ServerError`: Strapi server error