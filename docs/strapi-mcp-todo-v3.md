# Strapi MCP Tool Enhancement Requirements v3

## Executive Summary
This document outlines critical enhancements needed for the Strapi MCP tool based on real-world usage issues encountered during content management operations. The primary focus is on improving dynamic zone management, partial updates, and fixing validation errors.

## Issues Encountered

### 1. Validation Errors with Relations
**Problem:** When updating entries with complex sections (dynamic zones), the tool returns "Invalid relations" errors even when the data structure appears correct.

**Example Error:**
```
MCP error -32603: Tool execution failed: Invalid relations
Validation errors:
- data (root level): Invalid relations
```

**Root Cause:** The tool seems to have issues handling component relations within dynamic zones, particularly when components reference other components or have nested structures.

### 2. Field Validation Constraints
**Problem:** Strict validation on certain fields causes unnecessary failures.

**Examples:**
- `meta_title` must be at most 60 characters (should be documented or auto-truncated)
- Icon fields have limited enum values that aren't clearly documented
- Component field names must match exact schema (e.g., `value` not `number` for stats)

### 3. Full Page Replacement Required
**Problem:** Currently, to update a single section in a page with multiple sections, you must send the entire page data structure, risking data loss or unintended changes to other sections.

### 4. Authentication Default
**Problem:** The `strapi_rest` tool defaults to `authenticated: true`, which often fails when API tokens aren't properly configured. Most read operations should work without authentication.

## Proposed Enhancements

### 1. Dynamic Section Management Tools

Add dedicated tools for managing individual sections within dynamic zones:

#### 1.1 `entry_section_add`
```typescript
interface EntrySectionAddParams {
  contentTypeUid: string;
  documentId: string;
  locale?: string;
  zoneField: string; // e.g., "sections"
  section: {
    __component: string;
    [key: string]: any;
  };
  position?: number; // Insert at specific position, default: append
}
```

**Usage Example:**
```javascript
entry_section_add({
  contentTypeUid: "api::landing-page.landing-page",
  documentId: "hayzlpir0c9g04wogdrx9ybb",
  locale: "en",
  zoneField: "sections",
  section: {
    __component: "sections.hero",
    title: "New Hero Section",
    subtitle: "Added without touching other sections"
  },
  position: 0 // Insert at beginning
})
```

#### 1.2 `entry_section_update`
```typescript
interface EntrySectionUpdateParams {
  contentTypeUid: string;
  documentId: string;
  locale?: string;
  zoneField: string;
  sectionIndex: number; // or sectionId if sections have IDs
  section: {
    __component: string;
    [key: string]: any;
  };
}
```

**Usage Example:**
```javascript
entry_section_update({
  contentTypeUid: "api::landing-page.landing-page",
  documentId: "hayzlpir0c9g04wogdrx9ybb",
  locale: "en",
  zoneField: "sections",
  sectionIndex: 2,
  section: {
    __component: "sections.stats",
    title: "Updated Stats Title",
    stats: [/* updated stats */]
  }
})
```

#### 1.3 `entry_section_delete`
```typescript
interface EntrySectionDeleteParams {
  contentTypeUid: string;
  documentId: string;
  locale?: string;
  zoneField: string;
  sectionIndex: number; // or sectionId
}
```

#### 1.4 `entry_section_reorder`
```typescript
interface EntrySectionReorderParams {
  contentTypeUid: string;
  documentId: string;
  locale?: string;
  zoneField: string;
  fromIndex: number;
  toIndex: number;
}
```

### 2. Partial Update Support for `update_entry`

Add a `partial` flag to the existing `update_entry` tool:

```typescript
interface UpdateEntryParams {
  contentTypeUid: string;
  documentId: string;
  locale?: string;
  data: object;
  publish?: boolean;
  partial?: boolean; // NEW: When true, merges with existing data
}
```

**Implementation Logic:**
1. When `partial: true`:
   - Fetch current entry data
   - Deep merge provided data with existing data
   - Submit merged data to Strapi
   - Preserve all unspecified fields and sections

**Usage Example:**
```javascript
update_entry({
  contentTypeUid: "api::landing-page.landing-page",
  documentId: "hayzlpir0c9g04wogdrx9ybb",
  locale: "en",
  partial: true,
  data: {
    meta_title: "Updated SEO Title",
    // Only updates meta_title, preserves all sections and other fields
  }
})
```

### 3. Authentication Default Change

Modify `strapi_rest` tool to default to unauthenticated requests:

```typescript
interface StrapiRestParams {
  endpoint: string;
  method?: string;
  params?: object;
  body?: object;
  authenticated?: boolean; // Change default from true to false
}
```

**Rationale:**
- Most read operations (GET) work without authentication
- Reduces token management complexity
- Follows principle of least privilege
- Only operations that modify data typically require authentication

### 4. Enhanced Validation and Error Handling

#### 4.1 Pre-validation
- Implement client-side validation before sending to Strapi
- Auto-truncate fields like `meta_title` to maximum length
- Validate enum values against known constraints

#### 4.2 Better Error Messages
Instead of:
```
Invalid relations
```

Provide:
```
Invalid relations in sections[5].reasons[1].icon: 
Value "eye" is not allowed. 
Valid values: check-circle, users, zap, shield, headphones, code
```

#### 4.3 Schema Caching
- Cache content type schemas locally
- Use for validation and auto-completion
- Refresh cache periodically or on-demand

### 5. Component Field Mapping

Create a mapping system for common field name variations:

```javascript
const fieldMappings = {
  "sections.stats": {
    "number": "value", // Auto-convert "number" to "value"
    "statistics": "stats" // Auto-convert "statistics" to "stats"
  },
  "sections.testimonials": {
    "content": "quote",
    "author": "author_name"
  }
};
```

## Implementation Priority

### Phase 1 (Critical)
1. Fix authentication default in `strapi_rest`
2. Implement partial update support
3. Add `entry_section_update` tool

### Phase 2 (High)
1. Add `entry_section_add` tool
2. Add `entry_section_delete` tool
3. Improve error messages

### Phase 3 (Medium)
1. Add `entry_section_reorder` tool
2. Implement field mapping system
3. Add schema caching

## Testing Requirements

### Test Cases
1. **Partial Update:** Update single field without affecting others
2. **Section Management:** Add, update, delete sections independently
3. **Authentication:** Verify unauthenticated reads work correctly
4. **Validation:** Test field constraints and error messages
5. **Localization:** Ensure all operations work with different locales
6. **Performance:** Measure impact of partial updates vs full updates

### Success Metrics
- Reduce API calls by 50% for section updates
- Eliminate "Invalid relations" errors
- Improve developer experience with clear error messages
- Support 100% of Strapi v5 dynamic zone operations

## Migration Guide

### For Existing Code
```javascript
// Old way (full update)
const page = await get_entries({...});
page.sections[2] = updatedSection;
await update_entry({ data: page });

// New way (partial update)
await entry_section_update({
  sectionIndex: 2,
  section: updatedSection
});
```

### Breaking Changes
- `strapi_rest` authentication default change (may affect existing authenticated workflows)
- Recommend audit of all `strapi_rest` calls to explicitly set `authenticated: true` where needed

## Appendix A: Common Validation Errors

### Field Length Limits
- `meta_title`: 60 characters
- `meta_description`: 160 characters
- `slug`: No special characters, lowercase only

### Required Component Fields
- `sections.stats.stats[].value` (not `number`)
- `sections.testimonials.testimonials[].quote` (not `content`)
- `sections.testimonials.testimonials[].author_name` (not `author`)

### Valid Icon Values
For `why-choose-us.reasons[].icon`:
- check-circle
- users
- zap
- shield
- headphones
- code

## Appendix B: Strapi v5 Compatibility

### API Changes from v4 to v5
- Flattened response structure (no `data.attributes`)
- `documentId` instead of `id` for all operations
- Localization handled via `locale` parameter
- Publishing handled via `status` field

### Population Strategies
```javascript
// ✅ Correct for dynamic zones
populate: {
  sections: {
    populate: "*"
  }
}

// ❌ Incorrect (causes "Invalid nested population query")
populate: {
  sections: {
    features: "*"
  }
}
```

## Conclusion

These enhancements will significantly improve the developer experience when working with Strapi v5 through the MCP tool. The focus on partial updates and section management will reduce errors, improve performance, and make content management more intuitive and reliable.

The proposed changes maintain backward compatibility while adding powerful new capabilities that align with modern CMS practices and Strapi v5's architecture.