# Tool Changes v3 - Documentation

## Overview
This document details the significant tool changes and improvements made to the Strapi MCP server, focusing on tool consolidation, validation improvements, and API alignment.

## 1. Tool Consolidation

### Content Management Tools Merged

We consolidated six separate tools into three by adding a `publish` parameter (defaulting to `true`):

#### Before:
- `create_draft_entry` - Creates entry as draft
- `create_and_publish_entry` - Creates and publishes entry
- `update_entry_draft` - Updates entry as draft  
- `update_entry_and_publish` - Updates and publishes entry
- `create_localized_draft` - Creates localized version as draft
- `create_and_publish_localized_entry` - Creates and publishes localized version

#### After:
- **`create_entry`** - Single tool with `publish` parameter (default: `true`)
  - `publish: true` - Creates and publishes immediately
  - `publish: false` - Creates as draft
  - Handles content types with `draftAndPublish` disabled automatically

- **`update_entry`** - Single tool with `publish` parameter (default: `true`)
  - `publish: true` - Updates and publishes immediately
  - `publish: false` - Saves as draft
  - Handles content types with `draftAndPublish` disabled automatically

- **`create_localized_entry`** - Single tool with `publish` parameter (default: `true`)
  - `publish: true` - Creates and publishes localized version
  - `publish: false` - Creates localized draft
  - Validates that content type is i18n-enabled
  - Handles content types with `draftAndPublish` disabled automatically

### Benefits:
- Reduced API surface area from 6 tools to 3
- Consistent behavior with sensible defaults (publish by default)
- Backward compatibility through `draftAndPublish` option checking
- Cleaner, more intuitive API

## 2. Validation Improvements

### Required String Validation

Fixed a critical issue where Zod's `z.string()` accepts empty strings, causing confusing errors when required fields are empty.

#### Implementation:
```typescript
// Required string schema - ensures strings are not empty
const RequiredString = z.string().trim().min(1, { message: 'Field is required and cannot be empty' });

// Optional string schema - can be empty or undefined  
const OptionalString = z.string().trim().optional();
```

#### Applied to:
- All required `contentTypeUid` fields
- All required `documentId` fields
- Required `locale` fields for localized operations
- Required fields in relation tools (`relationField`, etc.)
- Required fields in media tools (`fileData`, `fileName`, `fileType`, `filePath`)
- Required `name` field in API token creation

### Array Validation

Added `.min(1)` validation to ensure arrays are not empty:

```typescript
// Before - accepts empty arrays
documentIds: z.array(z.string()).describe('Array of document IDs')

// After - requires at least one item
documentIds: z.array(RequiredString).min(1, { message: 'At least one document ID is required' })
```

#### Applied to:
- `publish_entries` - `documentIds` array
- `unpublish_entries` - `documentIds` array
- All relation tools - `relatedIds` arrays

### Error Message Improvements

Fixed double-escaped error messages from Strapi responses:

```typescript
// Before: Would show ""Method Not Allowed""
// After: Shows "Method Not Allowed"

// Remove surrounding quotes from JSON-encoded strings
const cleanedData = error.response.data.replace(/^"(.*)"$/, '$1');
```

## 3. API Method Renaming

### listContentTypes → contentManagerInit

Renamed the client method to match the actual Strapi API endpoint:

- **Old:** `client.listContentTypes()`
- **New:** `client.contentManagerInit()`
- **Endpoint:** `/content-manager/init`

This change makes the code more maintainable by using the actual API endpoint name.

## 4. Media Filter Documentation

Updated `list_media` tool with comprehensive filter examples using Strapi's MongoDB-style query syntax:

```typescript
filters: z.record(z.any()).optional().describe(
  'Filter parameters. Examples: ' +
  'Filter by image type: {"$and": [{"mime": {"$contains": "image"}}]}. ' +
  'Filter by file name: {"$and": [{"name": {"$contains": "logo"}}]}. ' +
  'Filter by folder: {"$and": [{"folderPath": {"$eq": "/"}}]}. ' +
  'Filter video files: {"$and": [{"mime": {"$contains": "video"}}]}. ' +
  'Filter audio files: {"$and": [{"mime": {"$contains": "audio"}}]}. ' +
  'Combine filters: {"$and": [{"mime": {"$contains": "image"}}, {"name": {"$contains": "banner"}}]}'
)
```

## 5. Query String Serialization

Integrated the `qs` library for proper parameter serialization to match Strapi's expectations:

```typescript
import qs from 'qs';

this.axios = axios.create({
  // ...
  paramsSerializer: {
    serialize: (params) => qs.stringify(params, { 
      arrayFormat: 'brackets',
      encode: false  // Don't double-encode
    })
  }
});
```

This ensures complex filter structures are properly encoded when sent to Strapi.

## 6. Token Management Updates

### Renamed Methods:
- **Old:** `clear_token_cache` - Misleading name suggesting cache
- **New:** `delete_saved_token` - Accurately describes deleting the saved token file

### New Tool:
- **`get_saved_token`** - Retrieves the saved token information from `~/.mcp/strapi-mcp.tokens.json`
  - Returns full token values (not masked)
  - Includes creation timestamp
  - Shows file path location
  - Returns error message if no token exists

## 7. Bulk Operations Fix

Removed nonsensical hardcoded pagination parameters from bulk operations:

```typescript
// Before - had hardcoded params that made no sense
async publishEntries(contentTypeUid: string, documentIds: string[]): Promise<any> {
  const params = {
    page: 1,
    pageSize: 10,
    sort: 'name:ASC'
  };
  // ...
}

// After - clean implementation
async publishEntries(contentTypeUid: string, documentIds: string[]): Promise<any> {
  return await this.client.adminRequest(
    `/content-manager/collection-types/${contentTypeUid}/actions/bulkPublish`,
    'POST',
    { documentIds }
  );
}
```

## Summary of Breaking Changes

1. **Tool Removals:**
   - Removed: `create_draft_entry`, `create_and_publish_entry`
   - Removed: `update_entry_draft`, `update_entry_and_publish`
   - Removed: `create_localized_draft`, `create_and_publish_localized_entry`
   - Removed: `clear_token_cache`

2. **Tool Additions:**
   - Added: `get_saved_token`

3. **Tool Modifications:**
   - `create_entry` - Now has `publish` parameter (default: true)
   - `update_entry` - Now has `publish` parameter (default: true)
   - `create_localized_entry` - Now has `publish` parameter (default: true)
   - `clear_token_cache` → `delete_saved_token` (renamed)

4. **Validation Changes:**
   - Empty strings no longer accepted for required string fields
   - Empty arrays no longer accepted for required array fields
   - Better error messages for validation failures

## Migration Guide

### For Create/Update Operations:

```typescript
// Old way - separate tools
await create_draft_entry({ contentTypeUid: 'api::article.article', data: {...} })
await create_and_publish_entry({ contentTypeUid: 'api::article.article', data: {...} })

// New way - single tool with publish parameter
await create_entry({ contentTypeUid: 'api::article.article', data: {...}, publish: false })  // draft
await create_entry({ contentTypeUid: 'api::article.article', data: {...}, publish: true })   // published (default)
await create_entry({ contentTypeUid: 'api::article.article', data: {...} })                  // published (default)
```

### For Token Management:

```typescript
// Old way
await clear_token_cache()  // Deleted the saved token

// New way
await delete_saved_token()  // Clear name for what it does
await get_saved_token()     // New - retrieve saved token info
```

### For Validation:

Empty strings and arrays will now be properly rejected:
```typescript
// These will now fail with clear error messages:
await get_entries({ contentTypeUid: '' })  
// Error: "Field is required and cannot be empty"

await publish_entries({ contentTypeUid: 'api::article.article', documentIds: [] })
// Error: "At least one document ID is required"
```

## Benefits

1. **Simpler API** - Fewer tools to learn and remember
2. **Better Defaults** - Publishing by default matches common use cases
3. **Clearer Errors** - Validation errors are now helpful instead of confusing
4. **Proper Validation** - Required fields are actually required
5. **Accurate Naming** - Methods and tools named for what they actually do
6. **Better Documentation** - Filter examples with actual working syntax