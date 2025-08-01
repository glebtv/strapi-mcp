# Strapi MCP Tool Improvements TODO

## Version 0.3.1 - Fixed Issues ✅

### 1. Enhanced Validation Error Reporting
**Problem**: When Strapi returns validation errors, users only saw generic messages like "2 errors occurred" without seeing the actual validation issues.

**Solution**: Modified error handling in `index.ts` to extract and format validation error details from the Strapi response:
- Checks for `details.errors` array in error objects
- Formats each error with its path and message (e.g., `title: Title is required`)
- Falls back to JSON stringification for non-standard error structures

**Impact**: Users now see clear, actionable error messages when validation fails, making debugging much easier.

### 2. API Token Name Conflict Resolution
**Problem**: When creating API tokens, if the name "strapi-mcp" was already taken, the creation would fail completely.

**Solution**: Implemented retry logic in `TokenManager`:
- First attempt uses simple name: `strapi-mcp`
- On "Name already taken" error, retries with random suffix: `strapi-mcp-abc123`
- Retries up to 5 times with different random suffixes
- Only fails if all attempts fail or a different error occurs

**Impact**: Multiple instances of strapi-mcp can now run against the same Strapi instance without conflicts.

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

### 6. Component Schema Discovery Issues

**Issue**: The `list_components` and `get_component_schema` tools have reliability issues.

**Current Behavior**:
- `list_components` returns empty array even when components exist
- `get_component_schema` fails with "Component not found" for valid component UIDs
- No way to discover component structure programmatically

**Expected Behavior**:
- Should list all available components with their UIDs
- Should return schema for nested components (e.g., sections.hero, pricing.plan)
- Should work with Strapi's component naming convention

**Examples of Missing Components**:
- `sections.hero`
- `sections.best-app-ever`
- `sections.numbered-features`
- `sections.key-features`
- `sections.client-testimonials`
- `sections.pricing-plan`
- `sections.newsletter`
- Nested components like `pricing.plan` (within pricing-plan section)

**Workaround**:
- Currently must inspect actual data responses to understand component structure
- Use the Strapi Admin UI to view component schemas

### 7. Nested Component Field Updates

**Issue**: Updating nested component fields (like `period` in pricing plans) requires special handling.

**Current Behavior**:
- Simple field updates on nested components don't always persist
- Field names might differ between API response and update payload
- Some fields like `price_period` vs `period` have naming inconsistencies

**Proposed Enhancement**:
- Document field mapping for common components
- Provide examples of updating nested component fields
- Add validation for component field updates

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