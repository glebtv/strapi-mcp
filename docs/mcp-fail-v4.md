# Strapi MCP Server Issues Report

## Date: 2025-08-08

## Critical Missing Tools

### 1. get_content_type_schema
**Error**: `No such tool available: mcp__strapi__get_content_type_schema`
**Impact**: Cannot programmatically discover content type schemas and field requirements
**Note**: Tool is referenced in error messages but doesn't exist

### 2. list_components
**Error**: `No such tool available: mcp__strapi__list_components`
**Impact**: Cannot discover available component types for dynamic zones

### 3. get_component_schema
**Missing**: No tool to retrieve component schemas
**Impact**: Cannot discover component field requirements

## Authentication & Permission Issues

### 4. Token Cache Inconsistency
**Issue**: `clear_token_cache` exists but doesn't resolve authentication failures for admin endpoints
**Impact**: Inconsistent authentication behavior across different API endpoints

## Error Message Quality Issues

### 5. Vague Validation Errors
**Current Error**: `Invalid relations`
**Missing Information**: Which specific relations are invalid and why

### 6. Generic Server Errors
**Current Error**: `Application error: a server-side exception has occurred`
**Missing Information**: Stack trace, specific error cause, or actionable guidance

### 7. Misleading Error Tips
**Current Message**: `Tip: Use get_content_type_schema to check which fields are required`
**Issue**: References non-existent tool

## Documentation Gaps

### 8. Population Syntax Documentation
**Missing Documentation**: Clear examples of population strategies for Strapi v5

**Suggested Documentation to Add**:
```markdown
## Population Strategies

### Dynamic Zones
For dynamic zones, populate at the zone level, not individual components:
✅ CORRECT: populate: {"sections": {"populate": "*"}}
❌ WRONG: populate: {"sections": {"features": "*"}}

### Deep Field Population
Use array syntax with dot notation:
✅ CORRECT: populate: ["sections", "sections.features", "sections.features.image"]
❌ WRONG: populate: {"sections": {"populate": {"features": {"populate": "*"}}}}

### Important Notes
- Dynamic zones are polymorphic and require special handling
- Cannot mix zone-level and field-specific population
- Strapi v5 removed support for some v4 population patterns
```

### 9. Media Reference Documentation
**Missing Documentation**: How to properly reference media in API calls

**Suggested Documentation to Add**:
```markdown
## Media References

When setting media fields via API:
✅ CORRECT: Use numeric media ID
   Example: "image": 42

❌ WRONG: Use documentId
   Example: "image": "laz6zpzb0osvtxuggvi9oo1e"

Note: Media IDs are different from document IDs
```

### 10. Component Field Requirements
**Missing Documentation**: Which fields are required vs optional in components

**Suggested Documentation to Add**:
```markdown
## Component Field Standards

Common field naming conventions:
- Testimonials: Use "quote" for content field
- Statistics: Use "value" for numeric/string value
- Authors: Use "author_name" with underscore

Required fields should be clearly marked in component schemas.
```

## Feature Requests

### 11. Schema Discovery Tools
Add comprehensive schema discovery:
- `get_content_type_schema` - Get content type structure
- `list_components` - List all available components
- `get_component_schema` - Get component field definitions
- `list_content_types` - Already exists but could include schema info

### 12. Better Error Response Format
Standardize error responses with:
- Specific field path that failed
- Expected value type/format
- Actual value received
- Suggested fix or example

## Priority Recommendations

1. **High Priority**: Implement `get_content_type_schema` and `list_components` tools - these are essential for dynamic content creation
2. **High Priority**: Improve error messages to include specific field paths and expected values
3. **Medium Priority**: Add clear population syntax documentation with Strapi v5 examples
4. **Medium Priority**: Fix authentication consistency across all endpoints

## Notes for MCP Developer

- Error messages currently reference non-existent tools, causing confusion
- The lack of schema discovery tools makes it impossible to work with unknown content types
- Population syntax has changed from Strapi v4 to v5 but isn't documented in MCP
- Consider adding a `test_connection` or `get_server_info` tool to verify setup