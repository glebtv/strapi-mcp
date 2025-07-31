# Strapi MCP Tool Improvements TODO

## Current Issues and Limitations

### 1. Publishing Entries with i18n (Internationalization)

**Issue**: The `publish_entry` tool only publishes the default locale version of an entry, not specific locale versions.

**Current Behavior**:
- When calling `mcp__strapi__publish_entry`, it publishes only the default locale (usually 'ru' in this project)
- Cannot specify which locale to publish
- Other locale versions remain in draft state

**Expected Behavior**:
- Should accept an optional `locale` parameter
- Should be able to publish specific locale versions independently

**Workaround**: 
- Currently must use Strapi Admin UI to publish other locales
- Or use direct database manipulation (not recommended)

**Proposed Fix**:
```python
# Add locale parameter to publish_entry
def publish_entry(pluralApiId: str, documentId: str, locale: str = None):
    endpoint = f"api/{pluralApiId}/{documentId}"
    if locale:
        # Use Strapi's locale-specific publish endpoint
        endpoint += f"?locale={locale}"
    # ... rest of implementation
```

### 2. Component Schema Access

**Issue**: The `get_component_schema` tool sometimes returns HTML instead of JSON when Strapi is in development mode.

**Current Behavior**:
- Returns admin panel HTML when accessing component schemas
- Makes it difficult to programmatically inspect component structures

**Expected Behavior**:
- Should always return JSON schema data
- Should work consistently regardless of Strapi mode

### 3. Locale-Aware Operations

**Issue**: Several operations don't properly handle locale parameters for i18n content.

**Affected Tools**:
- `create_entry` - Creates in default locale only
- `update_entry` - Updates default locale only
- `publish_entry` - Publishes default locale only
- `unpublish_entry` - Unpublishes default locale only

**Proposed Enhancement**:
All content manipulation tools should accept an optional `locale` parameter that:
- Defaults to the default locale if not specified
- Allows targeting specific locale versions
- Uses Strapi's locale query parameter pattern: `?locale=en`

### 4. Batch Operations

**Missing Features**:
- Batch publish/unpublish operations
- Publish all locales of an entry at once
- Bulk update operations across multiple entries

**Proposed New Tools**:
- `publish_all_locales(pluralApiId, documentId)` - Publishes all locale versions
- `batch_publish(pluralApiId, documentIds[])` - Publishes multiple entries
- `sync_locales(pluralApiId, documentId, sourceLocale)` - Copies content structure from one locale to others

### 5. Better Error Messages

**Issue**: Generic error messages don't provide enough context for debugging.

**Examples**:
- "Method Not Allowed" without indicating why
- No indication when locale-specific operations fail
- Missing helpful hints about available parameters

**Proposed Enhancement**:
- Include available parameters in error messages
- Suggest alternatives when operations fail
- Provide locale-specific error context

## Implementation Priority

1. **High Priority**: Fix locale parameter for publish/unpublish operations
2. **Medium Priority**: Add batch operations for common tasks
3. **Low Priority**: Enhance error messages and developer experience

## Testing Checklist

When implementing fixes, ensure:
- [ ] Works with Strapi v5 i18n plugin
- [ ] Handles both single-locale and multi-locale content types
- [ ] Provides clear error messages for invalid operations
- [ ] Maintains backward compatibility
- [ ] Includes proper documentation with examples