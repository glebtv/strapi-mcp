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

### Admin Authentication Endpoints

#### Admin Login
- **Endpoint**: `POST /admin/login`
- **Auth Required**: No
- **Rate Limited**: Yes
- **Request Body**:
  ```json
  {
    "email": "admin@example.com",
    "password": "password123"
  }
  ```
- **Response**: JWT token and user data

#### Renew Token
- **Endpoint**: `POST /admin/renew-token`
- **Auth Required**: No
- **Description**: Renew authentication token

#### Admin Registration (First Admin Only)
- **Endpoint**: `POST /admin/register-admin`
- **Auth Required**: No
- **Request Body**:
  ```json
  {
    "email": "admin@example.com",
    "password": "AdminPassword123",
    "firstname": "Admin",
    "lastname": "User"
  }
  ```

#### Registration Info
- **Endpoint**: `GET /admin/registration-info`
- **Auth Required**: No
- **Description**: Check if first admin exists

#### Register User
- **Endpoint**: `POST /admin/register`
- **Auth Required**: No
- **Description**: Register a new admin user (when enabled)

#### Forgot Password
- **Endpoint**: `POST /admin/forgot-password`
- **Auth Required**: No
- **Rate Limited**: Yes (email rate limit)
- **Request Body**:
  ```json
  {
    "email": "admin@example.com"
  }
  ```

#### Reset Password
- **Endpoint**: `POST /admin/reset-password`
- **Auth Required**: No
- **Request Body**:
  ```json
  {
    "password": "NewPassword123",
    "passwordConfirmation": "NewPassword123",
    "code": "reset-code-from-email"
  }
  ```

#### Logout
- **Endpoint**: `POST /admin/logout`
- **Auth Required**: Yes

### Admin General Endpoints

#### Initialize Admin
- **Endpoint**: `GET /admin/init`
- **Auth Required**: No
- **Description**: Initialize admin panel data

#### Get Project Settings
- **Endpoint**: `GET /admin/project-settings`
- **Auth Required**: Yes
- **Permissions**: `admin::project-settings.read`

#### Update Project Settings
- **Endpoint**: `POST /admin/project-settings`
- **Auth Required**: Yes
- **Permissions**: `admin::project-settings.update`

#### Get Project Type
- **Endpoint**: `GET /admin/project-type`
- **Auth Required**: No

#### Get Admin Information
- **Endpoint**: `GET /admin/information`
- **Auth Required**: Yes

#### List Plugins
- **Endpoint**: `GET /admin/plugins`
- **Auth Required**: Yes



### Admin User Management Endpoints

#### Get Current User
- **Endpoint**: `GET /admin/users/me`
- **Auth Required**: Yes

#### Update Current User
- **Endpoint**: `PUT /admin/users/me`
- **Auth Required**: Yes
- **Request Body**:
  ```json
  {
    "email": "newemail@example.com",
    "firstname": "John",
    "lastname": "Doe"
  }
  ```

#### Get Current User Permissions
- **Endpoint**: `GET /admin/users/me/permissions`
- **Auth Required**: Yes

#### Create User
- **Endpoint**: `POST /admin/users`
- **Auth Required**: Yes
- **Permissions**: `admin::users.create`
- **Request Body**:
  ```json
  {
    "email": "user@example.com",
    "firstname": "Jane",
    "lastname": "Doe",
    "roles": [1, 2],
    "isActive": true
  }
  ```

#### List Users
- **Endpoint**: `GET /admin/users`
- **Auth Required**: Yes
- **Permissions**: `admin::users.read`
- **Query Parameters**:
  - `filters[email][$contains]`: Filter by email
  - `filters[isActive][$eq]`: Filter by active status
  - `pagination[page]`: Page number
  - `pagination[pageSize]`: Items per page

#### Get User by ID
- **Endpoint**: `GET /admin/users/:id`
- **Auth Required**: Yes
- **Permissions**: `admin::users.read`

#### Update User
- **Endpoint**: `PUT /admin/users/:id`
- **Auth Required**: Yes
- **Permissions**: `admin::users.update`

#### Delete User
- **Endpoint**: `DELETE /admin/users/:id`
- **Auth Required**: Yes
- **Permissions**: `admin::users.delete`

#### Delete Multiple Users
- **Endpoint**: `POST /admin/users/batch-delete`
- **Auth Required**: Yes
- **Permissions**: `admin::users.delete`
- **Request Body**:
  ```json
  {
    "ids": [1, 2, 3]
  }
  ```

### Admin Role Management Endpoints

#### List Roles
- **Endpoint**: `GET /admin/roles`
- **Auth Required**: Yes
- **Permissions**: `admin::roles.read`

#### Get Role by ID
- **Endpoint**: `GET /admin/roles/:id`
- **Auth Required**: Yes
- **Permissions**: `admin::roles.read`

#### Create Role
- **Endpoint**: `POST /admin/roles`
- **Auth Required**: Yes
- **Permissions**: `admin::roles.create`
- **Request Body**:
  ```json
  {
    "name": "Editor",
    "description": "Can edit content"
  }
  ```

#### Update Role
- **Endpoint**: `PUT /admin/roles/:id`
- **Auth Required**: Yes
- **Permissions**: `admin::roles.update`

#### Delete Role
- **Endpoint**: `DELETE /admin/roles/:id`
- **Auth Required**: Yes
- **Permissions**: `admin::roles.delete`

#### Delete Multiple Roles
- **Endpoint**: `POST /admin/roles/batch-delete`
- **Auth Required**: Yes
- **Permissions**: `admin::roles.delete`

#### Get Role Permissions
- **Endpoint**: `GET /admin/roles/:id/permissions`
- **Auth Required**: Yes
- **Permissions**: `admin::roles.read`

#### Update Role Permissions
- **Endpoint**: `PUT /admin/roles/:id/permissions`
- **Auth Required**: Yes
- **Permissions**: `admin::roles.update`
- **Request Body**:
  ```json
  {
    "permissions": {
      "content-manager.explorer.create": {
        "properties": {
          "fields": ["title", "content"],
          "locales": ["en"]
        },
        "conditions": []
      }
    }
  }
  ```

### Admin Permissions Endpoints

#### Get All Permissions
- **Endpoint**: `GET /admin/permissions`
- **Auth Required**: Yes
- **Description**: Returns all available permissions in the system

#### Check Permissions
- **Endpoint**: `POST /admin/permissions/check`
- **Auth Required**: Yes
- **Description**: Check if current user has specific permissions

### Admin Webhook Endpoints

#### List Webhooks
- **Endpoint**: `GET /admin/webhooks`
- **Auth Required**: Yes
- **Permissions**: `admin::webhooks.read`

#### Get Webhook by ID
- **Endpoint**: `GET /admin/webhooks/:id`
- **Auth Required**: Yes
- **Permissions**: `admin::webhooks.read`

#### Create Webhook
- **Endpoint**: `POST /admin/webhooks`
- **Auth Required**: Yes
- **Permissions**: `admin::webhooks.create`
- **Request Body**:
  ```json
  {
    "name": "Content Update",
    "url": "https://example.com/webhook",
    "headers": {
      "Authorization": "Bearer token"
    },
    "events": ["entry.create", "entry.update"]
  }
  ```

#### Update Webhook
- **Endpoint**: `PUT /admin/webhooks/:id`
- **Auth Required**: Yes
- **Permissions**: `admin::webhooks.update`

#### Delete Webhook
- **Endpoint**: `DELETE /admin/webhooks/:id`
- **Auth Required**: Yes
- **Permissions**: `admin::webhooks.delete`

#### Delete Multiple Webhooks
- **Endpoint**: `POST /admin/webhooks/batch-delete`
- **Auth Required**: Yes
- **Permissions**: `admin::webhooks.delete`

#### Trigger Webhook
- **Endpoint**: `POST /admin/webhooks/:id/trigger`
- **Auth Required**: Yes
- **Permissions**: `admin::webhooks.trigger`

### Admin API Token Endpoints

#### List API Tokens
- **Endpoint**: `GET /admin/api-tokens`
- **Auth Required**: Yes
- **Permissions**: `admin::api-tokens.access`

#### Get API Token by ID
- **Endpoint**: `GET /admin/api-tokens/:id`
- **Auth Required**: Yes
- **Permissions**: `admin::api-tokens.read`

#### Create API Token
- **Endpoint**: `POST /admin/api-tokens`
- **Auth Required**: Yes
- **Permissions**: `admin::api-tokens.create`
- **Request Body**:
  ```json
  {
    "name": "Read-only Token",
    "description": "Token for reading content",
    "type": "read-only",
    "permissions": ["api::article.article.find"]
  }
  ```

#### Update API Token
- **Endpoint**: `PUT /admin/api-tokens/:id`
- **Auth Required**: Yes
- **Permissions**: `admin::api-tokens.update`

#### Delete API Token
- **Endpoint**: `DELETE /admin/api-tokens/:id`
- **Auth Required**: Yes
- **Permissions**: `admin::api-tokens.delete`

#### Regenerate API Token
- **Endpoint**: `POST /admin/api-tokens/:id/regenerate`
- **Auth Required**: Yes
- **Permissions**: `admin::api-tokens.regenerate`

### Admin Content API Configuration

#### Get Content API Permissions
- **Endpoint**: `GET /admin/content-api/permissions`
- **Auth Required**: Yes

#### Get Content API Routes
- **Endpoint**: `GET /admin/content-api/routes`
- **Auth Required**: Yes

### Admin Transfer Token Endpoints

#### List Transfer Tokens
- **Endpoint**: `GET /admin/transfer/tokens`
- **Auth Required**: Yes
- **Permissions**: `admin::transfer.tokens.access`

#### Get Transfer Token by ID
- **Endpoint**: `GET /admin/transfer/tokens/:id`
- **Auth Required**: Yes
- **Permissions**: `admin::transfer.tokens.read`

#### Create Transfer Token
- **Endpoint**: `POST /admin/transfer/tokens`
- **Auth Required**: Yes
- **Permissions**: `admin::transfer.tokens.create`
- **Request Body**:
  ```json
  {
    "name": "Migration Token",
    "description": "Token for data migration",
    "permissions": ["push", "pull"]
  }
  ```

#### Update Transfer Token
- **Endpoint**: `PUT /admin/transfer/tokens/:id`
- **Auth Required**: Yes
- **Permissions**: `admin::transfer.tokens.update`

#### Delete Transfer Token
- **Endpoint**: `DELETE /admin/transfer/tokens/:id`
- **Auth Required**: Yes
- **Permissions**: `admin::transfer.tokens.delete`

#### Regenerate Transfer Token
- **Endpoint**: `POST /admin/transfer/tokens/:id/regenerate`
- **Auth Required**: Yes
- **Permissions**: `admin::transfer.tokens.regenerate`

#### Transfer Push Runner
- **Endpoint**: `GET /admin/transfer/runner/push`
- **Auth Required**: Yes (via transfer token)
- **Description**: WebSocket endpoint for push operations

#### Transfer Pull Runner
- **Endpoint**: `GET /admin/transfer/runner/pull`
- **Auth Required**: Yes (via transfer token)
- **Description**: WebSocket endpoint for pull operations

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

### Admin Content Manager Endpoints

#### Initialize Content Manager
- **Endpoint**: `GET /admin/content-manager/init`
- **Auth Required**: Yes
- **Description**: Get content manager configuration

#### List Content Types
- **Endpoint**: `GET /admin/content-manager/content-types`
- **Auth Required**: Yes
- **Description**: List all content types with their configurations

#### Get Content Types Settings
- **Endpoint**: `GET /admin/content-manager/content-types-settings`
- **Auth Required**: Yes

#### Get Content Type Configuration
- **Endpoint**: `GET /admin/content-manager/content-types/:uid/configuration`
- **Auth Required**: Yes
- **Permissions**: `plugin::content-manager.collection-types.configure-view`

#### Update Content Type Configuration
- **Endpoint**: `PUT /admin/content-manager/content-types/:uid/configuration`
- **Auth Required**: Yes
- **Permissions**: `plugin::content-manager.collection-types.configure-view`

#### List Components
- **Endpoint**: `GET /admin/content-manager/components`
- **Auth Required**: Yes

#### Get Component Configuration
- **Endpoint**: `GET /admin/content-manager/components/:uid/configuration`
- **Auth Required**: Yes
- **Permissions**: `plugin::content-manager.components.configure-view`

#### Update Component Configuration
- **Endpoint**: `PUT /admin/content-manager/components/:uid/configuration`
- **Auth Required**: Yes
- **Permissions**: `plugin::content-manager.components.configure-view`

### Admin Content Manager - UID Operations

#### Generate UID
- **Endpoint**: `POST /admin/content-manager/uid/generate`
- **Auth Required**: Yes
- **Request Body**:
  ```json
  {
    "contentTypeUID": "api::article.article",
    "field": "slug",
    "data": {
      "title": "My Article Title"
    }
  }
  ```

#### Check UID Availability
- **Endpoint**: `POST /admin/content-manager/uid/check-availability`
- **Auth Required**: Yes
- **Request Body**:
  ```json
  {
    "contentTypeUID": "api::article.article",
    "field": "slug",
    "value": "my-article-slug"
  }
  ```

### Admin Content Manager - Relations

#### Find Available Relations
- **Endpoint**: `GET /admin/content-manager/relations/:model/:targetField`
- **Auth Required**: Yes
- **Query Parameters**:
  - `_q`: Search query
  - `pageSize`: Number of results
  - `page`: Page number

#### Find Existing Relations
- **Endpoint**: `GET /admin/content-manager/relations/:model/:id/:targetField`
- **Auth Required**: Yes
- **Description**: Get existing relations for a specific entry

### Admin Content Manager - Single Types

#### Get Single Type
- **Endpoint**: `GET /admin/content-manager/single-types/:model`
- **Auth Required**: Yes
- **Query Parameters**:
  - `locale`: Locale for i18n
  - `populate`: Relations to populate

#### Create/Update Single Type
- **Endpoint**: `PUT /admin/content-manager/single-types/:model`
- **Auth Required**: Yes

#### Delete Single Type
- **Endpoint**: `DELETE /admin/content-manager/single-types/:model`
- **Auth Required**: Yes
- **Query Parameters**:
  - `locale`: Locale for i18n

#### Publish Single Type
- **Endpoint**: `POST /admin/content-manager/single-types/:model/actions/publish`
- **Auth Required**: Yes

#### Unpublish Single Type
- **Endpoint**: `POST /admin/content-manager/single-types/:model/actions/unpublish`
- **Auth Required**: Yes

#### Discard Single Type Draft
- **Endpoint**: `POST /admin/content-manager/single-types/:model/actions/discard`
- **Auth Required**: Yes

#### Count Draft Relations (Single Type)
- **Endpoint**: `GET /admin/content-manager/single-types/:model/actions/countDraftRelations`
- **Auth Required**: Yes

### Admin Content Manager - Collection Types

#### List Collection Entries
- **Endpoint**: `GET /admin/content-manager/collection-types/:model`
- **Auth Required**: Yes
- **Query Parameters**:
  - `page`: Page number
  - `pageSize`: Items per page
  - `sort`: Sort order (e.g., `createdAt:desc`)
  - `filters`: Filter conditions
  - `populate`: Relations to populate
  - `locale`: Locale for i18n
  - `_q`: Search query

#### Create Entry
- **Endpoint**: `POST /admin/content-manager/collection-types/:model`
- **Auth Required**: Yes

#### Clone Entry
- **Endpoint**: `POST /admin/content-manager/collection-types/:model/clone/:sourceId`
- **Auth Required**: Yes

#### Auto-Clone Entry
- **Endpoint**: `POST /admin/content-manager/collection-types/:model/auto-clone/:sourceId`
- **Auth Required**: Yes

#### Get Entry by ID
- **Endpoint**: `GET /admin/content-manager/collection-types/:model/:id`
- **Auth Required**: Yes

#### Update Entry
- **Endpoint**: `PUT /admin/content-manager/collection-types/:model/:id`
- **Auth Required**: Yes

#### Delete Entry
- **Endpoint**: `DELETE /admin/content-manager/collection-types/:model/:id`
- **Auth Required**: Yes

#### Publish Entry
- **Endpoint**: `POST /admin/content-manager/collection-types/:model/:id/actions/publish`
- **Auth Required**: Yes

#### Unpublish Entry
- **Endpoint**: `POST /admin/content-manager/collection-types/:model/:id/actions/unpublish`
- **Auth Required**: Yes

#### Discard Entry Draft
- **Endpoint**: `POST /admin/content-manager/collection-types/:model/:id/actions/discard`
- **Auth Required**: Yes

#### Bulk Delete
- **Endpoint**: `POST /admin/content-manager/collection-types/:model/actions/bulkDelete`
- **Auth Required**: Yes
- **Request Body**:
  ```json
  {
    "ids": ["id1", "id2", "id3"]
  }
  ```

#### Bulk Publish
- **Endpoint**: `POST /admin/content-manager/collection-types/:model/actions/bulkPublish`
- **Auth Required**: Yes
- **Request Body**:
  ```json
  {
    "ids": ["id1", "id2", "id3"]
  }
  ```

#### Bulk Unpublish
- **Endpoint**: `POST /admin/content-manager/collection-types/:model/actions/bulkUnpublish`
- **Auth Required**: Yes

#### Count Draft Relations
- **Endpoint**: `GET /admin/content-manager/collection-types/:model/:id/actions/countDraftRelations`
- **Auth Required**: Yes

#### Count Many Entries Draft Relations
- **Endpoint**: `GET /admin/content-manager/collection-types/:model/actions/countManyEntriesDraftRelations`
- **Auth Required**: Yes
- **Query Parameters**:
  - `ids`: Array of entry IDs

### Admin Content Manager - History & Preview

#### List History Versions
- **Endpoint**: `GET /admin/content-manager/history-versions`
- **Auth Required**: Yes
- **Query Parameters**:
  - `page`: Page number
  - `pageSize`: Items per page
  - `filters[contentType]`: Filter by content type
  - `filters[entryId]`: Filter by entry ID

#### Restore History Version
- **Endpoint**: `PUT /admin/content-manager/history-versions/:versionId/restore`
- **Auth Required**: Yes

#### Get Preview URL
- **Endpoint**: `GET /admin/content-manager/preview/url/:contentType`
- **Auth Required**: Yes

### Content-Type Builder Endpoints (Admin Only)

#### Get Reserved Names
- **Endpoint**: `GET /admin/content-type-builder/reserved-names`
- **Auth Required**: Yes
- **Description**: Get list of reserved names that cannot be used

#### List Content Types
- **Endpoint**: `GET /admin/content-type-builder/content-types`
- **Auth Required**: Yes
- **Response**: Array of content type schemas

#### Get Content Type Schema
- **Endpoint**: `GET /admin/content-type-builder/content-types/:uid`
- **Auth Required**: Yes

#### Create Content Type
- **Endpoint**: `POST /admin/content-type-builder/content-types`
- **Auth Required**: Yes
- **Permissions**: `plugin::content-type-builder.read`
- **Request Body**:
  ```json
  {
    "contentType": {
      "displayName": "Article",
      "singularName": "article",
      "pluralName": "articles",
      "kind": "collectionType",
      "draftAndPublish": true,
      "pluginOptions": {},
      "attributes": {
        "title": {
          "type": "string",
          "required": true
        }
      }
    }
  }
  ```

#### Update Content Type
- **Endpoint**: `PUT /admin/content-type-builder/content-types/:uid`
- **Auth Required**: Yes
- **Permissions**: `plugin::content-type-builder.read`
- **Request Body**: Content type schema updates

#### Delete Content Type
- **Endpoint**: `DELETE /admin/content-type-builder/content-types/:uid`
- **Auth Required**: Yes
- **Permissions**: `plugin::content-type-builder.read`

#### Update Schema
- **Endpoint**: `POST /admin/content-type-builder/update-schema`
- **Auth Required**: Yes
- **Description**: Batch update schema (used internally)
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
      "attributes": {}
    }
  }
  ```

#### Get Update Schema Status
- **Endpoint**: `GET /admin/content-type-builder/update-schema-status`
- **Auth Required**: Yes
- **Description**: Check schema update status

### Component Builder Endpoints (Admin Only)

#### List Components
- **Endpoint**: `GET /admin/content-type-builder/components`
- **Auth Required**: Yes
- **Query Parameters**:
  - `pagination[page]`: Page number
  - `pagination[pageSize]`: Items per page

#### Get Component Schema
- **Endpoint**: `GET /admin/content-type-builder/components/:uid`
- **Auth Required**: Yes

#### Create Component
- **Endpoint**: `POST /admin/content-type-builder/components`
- **Auth Required**: Yes
- **Permissions**: `plugin::content-type-builder.read`
- **Request Body**:
  ```json
  {
    "component": {
      "displayName": "SEO",
      "category": "shared",
      "icon": "search",
      "attributes": {
        "metaTitle": {
          "type": "string"
        },
        "metaDescription": {
          "type": "text"
        }
      }
    }
  }
  ```

#### Update Component
- **Endpoint**: `PUT /admin/content-type-builder/components/:uid`
- **Auth Required**: Yes
- **Permissions**: `plugin::content-type-builder.read`
- **Request Body**: Component schema updates

#### Delete Component
- **Endpoint**: `DELETE /admin/content-type-builder/components/:uid`
- **Auth Required**: Yes
- **Permissions**: `plugin::content-type-builder.read`

#### Edit Component Category
- **Endpoint**: `PUT /admin/content-type-builder/component-categories/:name`
- **Auth Required**: Yes
- **Request Body**:
  ```json
  {
    "name": "new-category-name"
  }
  ```

#### Delete Component Category
- **Endpoint**: `DELETE /admin/content-type-builder/component-categories/:name`
- **Auth Required**: Yes

### Admin Upload/Media Endpoints

#### Get Upload Settings
- **Endpoint**: `GET /admin/upload/settings`
- **Auth Required**: Yes
- **Permissions**: `plugin::upload.settings.read`

#### Update Upload Settings
- **Endpoint**: `PUT /admin/upload/settings`
- **Auth Required**: Yes
- **Permissions**: `plugin::upload.settings.read`
- **Request Body**:
  ```json
  {
    "sizeOptimization": true,
    "responsiveDimensions": true,
    "autoOrientation": false
  }
  ```

#### Upload Files
- **Endpoint**: `POST /admin/upload`
- **Auth Required**: Yes
- **Request**: Multipart form data with:
  - `files`: File data
  - `path`: Folder path (optional)
  - `refId`: Related entry ID (optional)
  - `ref`: Related content type (optional)
  - `field`: Field name (optional)

#### List Files
- **Endpoint**: `GET /admin/upload/files`
- **Auth Required**: Yes
- **Query Parameters**:
  - `page`: Page number
  - `pageSize`: Items per page
  - `sort`: Sort order
  - `filters`: Filter conditions
  - `_q`: Search query

#### Get File by ID
- **Endpoint**: `GET /admin/upload/files/:id`
- **Auth Required**: Yes

#### Delete File
- **Endpoint**: `DELETE /admin/upload/files/:id`
- **Auth Required**: Yes

#### Get Folder by ID
- **Endpoint**: `GET /admin/upload/folders/:id`
- **Auth Required**: Yes

#### List Folders
- **Endpoint**: `GET /admin/upload/folders`
- **Auth Required**: Yes
- **Query Parameters**:
  - `page`: Page number
  - `pageSize`: Items per page
  - `sort`: Sort order
  - `filters`: Filter conditions

#### Create Folder
- **Endpoint**: `POST /admin/upload/folders`
- **Auth Required**: Yes
- **Request Body**:
  ```json
  {
    "name": "New Folder",
    "parent": 1
  }
  ```

#### Update Folder
- **Endpoint**: `PUT /admin/upload/folders/:id`
- **Auth Required**: Yes

#### Get Folder Structure
- **Endpoint**: `GET /admin/upload/folder-structure`
- **Auth Required**: Yes

#### Bulk Delete
- **Endpoint**: `POST /admin/upload/actions/bulk-delete`
- **Auth Required**: Yes
- **Request Body**:
  ```json
  {
    "fileIds": [1, 2, 3],
    "folderIds": [4, 5]
  }
  ```

#### Bulk Move
- **Endpoint**: `POST /admin/upload/actions/bulk-move`
- **Auth Required**: Yes
- **Request Body**:
  ```json
  {
    "fileIds": [1, 2, 3],
    "folderIds": [4, 5],
    "destinationFolderId": 10
  }
  ```

#### Get View Configuration
- **Endpoint**: `GET /admin/upload/configuration`
- **Auth Required**: Yes

#### Update View Configuration
- **Endpoint**: `PUT /admin/upload/configuration`
- **Auth Required**: Yes

### Admin Email Endpoints

#### Send Email
- **Endpoint**: `POST /admin/email`
- **Auth Required**: Yes
- **Permissions**: `plugin::email.settings.read`
- **Request Body**:
  ```json
  {
    "to": "recipient@example.com",
    "from": "sender@example.com",
    "subject": "Test Email",
    "text": "Plain text content",
    "html": "<p>HTML content</p>"
  }
  ```

#### Test Email Configuration
- **Endpoint**: `POST /admin/email/test`
- **Auth Required**: Yes
- **Permissions**: `plugin::email.settings.read`
- **Request Body**:
  ```json
  {
    "to": "test@example.com"
  }
  ```

#### Get Email Settings
- **Endpoint**: `GET /admin/email/settings`
- **Auth Required**: Yes
- **Permissions**: `plugin::email.settings.read`



### Admin i18n Endpoints

#### List ISO Locales
- **Endpoint**: `GET /admin/i18n/iso-locales`
- **Auth Required**: Yes

#### List Locales
- **Endpoint**: `GET /admin/i18n/locales`
- **Auth Required**: Yes
- **Permissions**: `plugin::i18n.locale.read`

#### Create Locale
- **Endpoint**: `POST /admin/i18n/locales`
- **Auth Required**: Yes
- **Permissions**: `plugin::i18n.locale.create`
- **Request Body**:
  ```json
  {
    "code": "es-ES",
    "name": "Spanish (Spain)",
    "isDefault": false
  }
  ```

#### Update Locale
- **Endpoint**: `PUT /admin/i18n/locales/:id`
- **Auth Required**: Yes
- **Permissions**: `plugin::i18n.locale.update`

#### Delete Locale
- **Endpoint**: `DELETE /admin/i18n/locales/:id`
- **Auth Required**: Yes
- **Permissions**: `plugin::i18n.locale.delete`

#### Get Non-Localized Fields
- **Endpoint**: `POST /admin/i18n/content-manager/actions/get-non-localized-fields`
- **Auth Required**: Yes
- **Request Body**:
  ```json
  {
    "model": "api::article.article",
    "id": 1,
    "locale": "en"
  }
  ```


### Additional Admin Endpoints

#### Get Content Manager Settings
- **Endpoint**: `GET /admin/content-manager/settings`
- **Auth Required**: Yes
- **Description**: Get content manager global settings

#### Update Content Manager Settings
- **Endpoint**: `PUT /admin/content-manager/settings`
- **Auth Required**: Yes
- **Description**: Update content manager global settings


#### Get Database Settings
- **Endpoint**: `GET /admin/project-settings/database`
- **Auth Required**: Yes
- **Description**: Get database configuration info



### Health Check
- **Endpoint**: `GET /_health`
- **Auth Required**: No
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