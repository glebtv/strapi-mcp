# Strapi MCP Tools Guide

## Strapi v5 Document Service API Patterns

### Creating Localized Content
```javascript
// IMPORTANT: Strapi v5 uses documentId for all locales of the same content
// Creating content with locales:
// 1. First create the base content (creates documentId)
// 2. Then create localized versions using the same documentId

// Example: Creating a page with multiple locales
// documentId: abc123xyz (shared across all locales)
```

### API Response Format
```javascript
// Strapi v5 returns flattened structure (no nested data.attributes)
// Direct access: response.data[0].title (not response.data[0].attributes.title)

// Population for dynamic zones MUST use "*"
populate: {
  sections: {
    populate: '*'  // REQUIRED for polymorphic structures
  }
}
// DO NOT use specific field targeting in dynamic zones - causes "Invalid nested population query"
```

## Working with Dynamic Zones

### Component Structure
Dynamic zones in Strapi allow for flexible content structures. Each component must include:
- `__component`: The component identifier (e.g., "sections.hero")
- Component-specific fields as defined in the schema

### Common Section Patterns
```javascript
// Hero Section
{
  __component: "sections.hero",
  title: "Page Title",
  subtitle: "Optional subtitle",
  // Additional fields per schema
}

// Stats Section
{
  __component: "sections.stats",
  title: "Statistics",
  stats: [
    {
      value: "100", // Note: Often "value" not "number"
      label: "Items",
      suffix: "+"  // Optional
    }
  ]
}

// Features Section
{
  __component: "sections.features",
  title: "Features",
  features: [
    {
      title: "Feature Name",
      description: "Feature description",
      icon: "icon-name" // Optional
    }
  ]
}

// Testimonials Section
{
  __component: "sections.testimonials",
  title: "What Clients Say",
  testimonials: [
    {
      quote: "Great service",
      author_name: "Client Name",
      rating: 5 // Optional
    }
  ]
}
```

## Creating and Managing Content

### 1. Check if Content Exists
```javascript
mcp__strapi__get_entries({
  contentTypeUid: "api::content-type.content-type",
  options: JSON.stringify({
    filters: { slug: "content-slug" },
    populate: "*"
  })
})
```

### 2. Update Existing Content (Preferred)
```javascript
mcp__strapi__update_entry({
  contentTypeUid: "api::content-type.content-type",
  documentId: "existing-doc-id",
  data: {
    // Content data
  },
  locale: "en",
  publish: true
})
```

### 3. Create Localized Versions
```javascript
// After base content exists, create other locales
mcp__strapi__create_localized_entry({
  contentTypeUid: "api::content-type.content-type",
  documentId: "existing-doc-id", // Same as base content
  locale: "fr",
  data: {
    // Localized content
  },
  publish: true
})
```

## Strapi MCP Tool Usage

### Most Reliable Tools
1. **`mcp__strapi__update_entry`** - For updating existing content
2. **`mcp__strapi__create_localized_entry`** - For adding locale versions
3. **`mcp__strapi__get_entries`** - For fetching content
4. **`mcp__strapi__entry_section_update`** - For partial updates to specific sections
5. **`mcp__strapi__entry_section_add`** - For adding new sections
6. **`mcp__strapi__entry_section_delete`** - For removing specific sections
7. **`mcp__strapi__entry_section_reorder`** - For reordering sections

### Partial Update Tools (Better Performance)
When modifying individual sections in dynamic zones, use partial update tools:
```javascript
// Update just one section
mcp__strapi__entry_section_update({
  contentTypeUid: "api::content-type.content-type",
  documentId: "doc-id",
  locale: "en",
  zoneField: "sections",
  sectionIndex: 2,  // Index of section to update
  publish: true,
  section: {
    __component: "sections.component-name",
    // ... section data
  }
})

// Add a new section at specific position
mcp__strapi__entry_section_add({
  contentTypeUid: "api::content-type.content-type",
  documentId: "doc-id",
  locale: "en",
  zoneField: "sections",
  position: 1, // Insert at position 1
  publish: true,
  section: {
    __component: "sections.new-component",
    // ... section data
  }
})

// Remove a section
mcp__strapi__entry_section_delete({
  contentTypeUid: "api::content-type.content-type",
  documentId: "doc-id",
  locale: "en",
  zoneField: "sections",
  sectionIndex: 3, // Remove section at index 3
  publish: true
})

// Reorder sections
mcp__strapi__entry_section_reorder({
  contentTypeUid: "api::content-type.content-type",
  documentId: "doc-id",
  locale: "en",
  zoneField: "sections",
  fromIndex: 2, // Move from position 2
  toIndex: 0,   // To position 0
  publish: true
})
```

### Clearing Field Values
To clear/remove field values in Strapi:
- **Empty string (`""`)**: Does NOT work for number fields (causes NaN error)
- **`null` value**: Works correctly to clear optional fields
```javascript
// Example: Clear an optional field
{
  optional_field: null  // Clears the field
}
```

## Common Pitfalls & Solutions

### Slug Validation
- Use simple slugs: "my-page" NOT "category/my-page"
- Strapi validates slug format - no slashes allowed

### Population Errors
- Error: "Invalid nested population query detected"
- Solution: Use `populate: "*"` for dynamic zones, not specific fields

### Component Field Names
- Check existing schema when field errors occur
- Field names may differ from expectations (e.g., `value` vs `number`)

## Development Workflow

1. **Check Existence**: Always verify if content exists before creating
2. **Use Updates**: Prefer updating existing content over creating new
3. **Create Locales**: Add all required locale versions
4. **Test Changes**: Verify changes through the API
5. **Use Partial Updates**: For better performance when modifying sections

## Working with Components

### Strapi Components are JSON Files
Components in Strapi are simple JSON schema files located at:
- `src/components/{category}/{component}.json`

You can edit these files directly - no special tools needed! Strapi will auto-reload in development mode after changes.

Example structure:
```json
{
  "collectionName": "components_sections_heroes",
  "info": {
    "displayName": "Hero",
    "description": "Hero section component"
  },
  "attributes": {
    "title": {
      "type": "string",
      "required": true
    },
    "subtitle": {
      "type": "string"
    }
  }
}
```

## Authentication & Permissions

### Admin Authentication
The MCP server handles authentication automatically using:
- Admin credentials (email/password) for full access
- API tokens as fallback

### Public Content Access
For content to be publicly accessible:
- Configure appropriate permissions in Strapi admin
- Enable find/findOne for public role
- Test public API access using: `mcp__strapi__strapi_rest` with `authenticated: false` flag
  ```javascript
  mcp__strapi__strapi_rest({
    endpoint: "api/articles",
    method: "GET",
    authenticated: false  // Tests public access without auth token
  })
  ```

## Testing & Validation

### Validate Content Structure
- Use `mcp__strapi__list_content_types` to see available types
- Use `mcp__strapi__list_components` to see available components
- Check schema definitions in the Strapi codebase

### Common Validation Errors
- **Missing required fields**: Check content type schema
- **Invalid field types**: Ensure correct data types (string, number, etc.)
- **Component mismatch**: Verify `__component` value matches schema

## Best Practices

1. **Use Partial Updates**: More efficient than full document updates
2. **Handle Locales Properly**: Create base content first, then locales
3. **Check Before Creating**: Avoid duplicate content
4. **Use Proper Field Types**: null for clearing, correct types for values
5. **Follow Schema**: Always reference the actual content type schema
6. **Test API Responses**: Verify structure and data after changes

## Troubleshooting

### Common Issues
- **429 Rate Limiting**: Use shared MCP server instance, avoid excessive logins
- **Missing Content Types**: Ensure content types are created in Strapi first
- **Module Not Found**: The output is in `dist/` not `build/`
- **Context Overflow**: Media upload tools have size limits to prevent base64 overflow
- **Health Check 204**: Strapi returns 204 (No Content) for `/_health` endpoint when healthy
- **Strapi v5 Document IDs**: Relation tools now expect string document IDs, not numeric IDs
- **Content Type Updates**: All content type operations use the `update-schema` endpoint in Strapi v5

---

**IMPORTANT INSTRUCTION**: After reading this guide, you should acknowledge your understanding by briefly summarizing one key point from this documentation, then STOP and WAIT for the user to provide specific instructions about what they want to do with Strapi. Do NOT proactively start exploring tools or checking content types unless the user explicitly asks you to do so.