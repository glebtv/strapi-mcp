# Strapi MCP - Working Session Manual

## Configuration

### Strapi v5 Document Service API Patterns

#### Creating Localized Content
```javascript
// IMPORTANT: Strapi v5 uses documentId for all locales of the same content
// Creating a new page with locales:
// 1. First create the base page (creates documentId)
// 2. Then create localized versions using the same documentId

// Example: Creating software-development page
// documentId: s629vt01y4t171qljlvxwuat (shared across all locales)
```

#### API Response Format
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

## Component Mapping

### Common Section Components
Strapi dynamic zones typically use components like:
- `sections.hero` → Hero sections
- `sections.stats` → Statistics  
- `sections.features` → Feature lists
- `sections.testimonials` → Customer testimonials
- `sections.gallery` → Image galleries
- `sections.cta` → Call-to-action blocks

The exact components available depend on your Strapi setup.

## Creating New Pages - Step by Step

### 1. Check if Page Exists
```javascript
mcp__strapi__get_entries({
  contentTypeUid: "api::landing-page.landing-page",
  options: JSON.stringify({
    filters: { slug: "page-slug" },
    populate: "*"
  })
})
```

### 2. Update Existing Page (Preferred Method)
```javascript
// For existing pages with empty content
mcp__strapi__update_entry({
  contentTypeUid: "api::landing-page.landing-page",
  documentId: "existing-doc-id",
  data: {
    // Page data with sections
  },
  locale: "en",
  publish: true
})
```

### 3. Create Localized Versions
```javascript
// After base page exists, create other locales
mcp__strapi__create_localized_entry({
  contentTypeUid: "api::landing-page.landing-page",
  documentId: "existing-doc-id", // Same as base page
  locale: "ru",
  data: {
    // Localized content
  },
  publish: true
})
```

## Section Data Structures

### Common Patterns
```javascript
// Stats Section Example
{
  __component: "sections.stats",
  title: "Statistics",
  stats: [
    {
      value: "100", // Note: field names vary
      label: "Items",
      suffix: "+"  // Optional
    }
  ]
}

// Features Section Example
{
  __component: "sections.features",
  title: "Features",
  features: [
    {
      title: "Feature Name",
      description: "Description text",
      icon: "icon-name" // Optional
    }
  ]
}
```

## Common Pitfalls & Solutions

### Slug Validation
- Use "software-development" NOT "services/software-development"
- Strapi validates slug format - no slashes allowed

### Population Errors
- Error: "Invalid nested population query detected"
- Solution: Use `populate: "*"` for dynamic zones, not specific fields

### Component Field Names
- Stats uses `value` not `number` for numeric values
- Check existing schema when field errors occur

## Testing & Development

### Common Testing Patterns
- Test all configured locales
- Verify dynamic zone content renders correctly
- Check API responses match expected structure
- Validate required fields before submission

## Strapi MCP Tool Usage

### Most Reliable Tools for This Project
1. `mcp__strapi__update_entry` - For updating existing content (replaces old update_entry_and_publish)
2. `mcp__strapi__create_localized_entry` - For adding locales (replaces old create_and_publish_localized_entry)
3. `mcp__strapi__get_entries` - For fetching content
4. `mcp__strapi__entry_section_update` - For partial updates to specific sections (faster than full page updates)
5. `mcp__strapi__entry_section_add` - For adding new sections without affecting others
6. `mcp__strapi__entry_section_delete` - For removing specific sections
7. `mcp__strapi__entry_section_reorder` - For reordering sections within dynamic zones

### Partial Update Tools (Faster Performance)
When modifying individual sections in dynamic zones, use partial update tools instead of updating the entire entry:
```javascript
// Update just one section (e.g., remove ratings from testimonials)
mcp__strapi__entry_section_update({
  contentTypeUid: "api::landing-page.landing-page",
  documentId: "bx818ayj1iyvndu7gznxjh3a",
  locale: "en",
  zoneField: "sections",
  sectionIndex: 4,  // Index of the section to update
  publish: true,
  section: {
    __component: "sections.client-testimonials",
    // ... section data
  }
})
```

### Clearing Field Values
To clear/remove field values in Strapi:
- **Empty string (`""`)**: Does NOT work for number fields (causes NaN error)
- **`null` value**: Works correctly to clear optional fields
```javascript
// Example: Remove star ratings from testimonials
testimonials: [{
  quote: "Great service",
  author_name: "Company",
  rating: null  // Clears the rating field
}]
```

### Avoid
- Direct `strapi_rest` for complex operations (requires API token management)
- Creating content without checking if it exists first


## Development Workflow

1. Always check if page exists first
2. Use update methods for existing pages
3. Create all locales together
4. Test all locale URLs after creation
5. Use screenshots to verify visual consistency

