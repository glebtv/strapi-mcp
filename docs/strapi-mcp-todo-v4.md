# Strapi MCP Tool Enhancement Requirements v4

## Critical Bug Report: "Invalid status" Error

### Issue Summary
The `entry_section_add` tool consistently fails with "Invalid status" error when attempting to add sections to an existing page's dynamic zone. This error also affects the `update_entry` tool when trying to add new sections to the sections array.

### Error Details
**Error Message:**
```
MCP error -32603: MCP error -32603: Tool execution failed: Validation error: Invalid status

Details: {}
```

### Reproduction Steps

#### Environment
- **Strapi Version:** v5
- **Content Type:** `api::landing-page.landing-page`
- **Document ID:** `hayzlpir0c9g04wogdrx9ybb`
- **Page Status:** Draft (unpublished)
- **Existing Sections:** 1 (sections.hero already added)

#### Step 1: Attempt to Add Section Using entry_section_add
```javascript
mcp__strapi__entry_section_add({
  contentTypeUid: "api::landing-page.landing-page",
  documentId: "hayzlpir0c9g04wogdrx9ybb",
  locale: "ru",
  zoneField: "sections",
  publish: false, // Also tried with true
  section: {
    __component: "sections.stats",
    title: "Наши результаты говорят сами за себя",
    background_color: "dark",
    animate_numbers: true,
    stats: [
      {
        value: "400",
        label: "Завершенных проектов",
        suffix: "+"
      },
      // ... more stats
    ]
  }
})
```
**Result:** `MCP error -32603: Tool execution failed: Validation error: Invalid status`

#### Step 2: Attempt Using update_entry with Partial Flag
```javascript
mcp__strapi__update_entry({
  contentTypeUid: "api::landing-page.landing-page",
  documentId: "hayzlpir0c9g04wogdrx9ybb",
  locale: "ru",
  partial: true,
  publish: false, // Also tried with true
  data: {
    sections: [
      // Existing hero section
      {
        __component: "sections.hero",
        // ... hero data
      },
      // New stats section
      {
        __component: "sections.stats",
        // ... stats data
      }
    ]
  }
})
```
**Result:** Same `Invalid status` error

#### Step 3: Variations Attempted
1. **With `publish: true`** - Same error
2. **With `publish: false`** - Same error
3. **Without `publish` parameter** - Same error
4. **Different section types** - Same error

### Technical Analysis

#### Observations
1. The error message "Invalid status" suggests the issue is related to the document status field
2. The page shows `status: "modified"` in GET responses
3. The error occurs regardless of the `publish` parameter value
4. The first section (Hero) was successfully added, but subsequent sections fail

#### Potential Root Causes
1. **Status Field Conflict:** The MCP tool might be sending a `status` field that conflicts with Strapi v5's expected values
2. **Draft/Published State Issue:** There may be a mismatch between how the tool handles draft vs published states
3. **Partial Update Logic:** The partial update mechanism might not properly handle the existing document state
4. **Missing Required Fields:** The tool might be omitting required fields when merging data

### Current Workarounds
None identified. The only way to add multiple sections is to:
1. Manually construct the entire page structure with all sections
2. Use a direct REST API call with proper authentication
3. Update through Strapi Admin UI

### Impact
- **Severity:** High
- **Affected Operations:** 
  - Adding sections to existing pages
  - Updating pages with dynamic zones
  - Managing multi-section content
- **User Experience:** Forces users to recreate entire page structures for simple section additions

### Proposed Fix

#### Immediate Fix Required
The MCP tool needs to properly handle the `status` field in Strapi v5:

```javascript
// Current (broken) - likely sending
{
  data: {
    sections: [...],
    status: "some_invalid_value" // Or missing/malformed
  }
}

// Should be sending
{
  data: {
    sections: [...]
    // No status field in data - handled by publish parameter
  }
}
```

#### Implementation Notes
1. The `status` field should NOT be included in the data payload
2. The publish state should be controlled solely by the `publish` boolean parameter
3. When `publish: true`, use Strapi's publish endpoint
4. When `publish: false`, save as draft

### Test Cases for Fix Validation

#### Test 1: Add Section to Empty Page
- Create new page with no sections
- Add first section using `entry_section_add`
- Expected: Success

#### Test 2: Add Section to Page with Existing Sections
- Use page with 1+ existing sections
- Add new section using `entry_section_add`
- Expected: Success (currently fails)

#### Test 3: Update with Partial Flag
- Update single field using `partial: true`
- Expected: Other fields preserved

#### Test 4: Publish Parameter Handling
- Test with `publish: true` and `publish: false`
- Expected: Correct draft/published state

### Related Issues from v3
From the previous todo document (strapi-mcp-todo-v3.md):
- Validation errors with relations
- Full page replacement required
- Authentication default issues

This "Invalid status" error is a new critical issue not previously documented.

### Recommended Priority
**CRITICAL - P0**

This bug completely blocks the primary use case of the section management tools. Without the ability to add sections to existing pages, the tools are essentially unusable for their intended purpose.

### Additional Context

#### Working Operations
- Creating initial pages with sections (full create)
- Reading pages with sections
- First section addition (sometimes works)

#### Failing Operations
- Adding subsequent sections
- Partial updates to pages with sections
- Any operation after the page enters "modified" status

### Next Steps
1. Debug the exact payload being sent by the MCP tools
2. Compare with successful Strapi Admin UI requests
3. Identify the status field handling logic
4. Implement proper status/publish state management
5. Add comprehensive tests for section operations

---

## Appendix: Error Logs

### Full Error Response
```json
{
  "error": "MCP error -32603: MCP error -32603: Tool execution failed: Validation error: Invalid status",
  "details": {}
}
```

### Successful First Section Addition
The first section (Hero) was added successfully, suggesting the issue may be related to:
- State changes after first modification
- Array handling in partial updates
- Status field initialization

### Page State After First Section
```json
{
  "status": "modified",
  "publishedAt": null,
  "sections": [/* one section */]
}
```

This state seems to trigger the validation error on subsequent updates.