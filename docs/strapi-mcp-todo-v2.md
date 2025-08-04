# Strapi MCP Tool Errors Documentation

## Date: 2025-08-04

### Overview
This document details the errors encountered while using Strapi MCP tools during the creation of the About page for the Rocket Sensei project.

## Error #1: Missing Required Fields

### Error Message
```
MCP error -32603: Tool execution failed: title must be a `string` type, but the final value was: `null`.

Validation errors:
- title: title must be a `string` type, but the final value was: `null`.
```

### Context
When attempting to create a new landing page entry in Strapi using `mcp__strapi__create_entry`.

### Root Cause
The landing page content type requires both `name` and `title` fields at the root level, not just inside sections. I was only providing content within the sections array.

### Solution
Include all required root-level fields when creating entries:
```javascript
{
  "name": "О компании",        // Required
  "title": "О компании RocketWare",  // Required
  "slug": "about",            // Required
  "page_type": "about",       // Required with default "other"
  "sections": [...]
}
```

## Error #2: Incomplete Section Data Saving

### Issue Description
When creating or updating landing pages with multiple sections (hero, stats, features, cta), only the first section (hero) was being saved. The other sections were silently dropped.

### Symptoms
- Created page with 5 sections, but only hero section persisted
- No error message returned
- Update operations also failed to add additional sections

### Attempted Solutions
1. Used `mcp__strapi__create_entry` with full sections array - only hero saved
2. Used `mcp__strapi__update_entry` to add missing sections - still only hero saved
3. Used `mcp__strapi__strapi_rest` with PUT method - same result

### Likely Causes
1. **Missing Dynamic Zone Components**: The sections.stats and sections.cta components are not included in the landing page's dynamic zone configuration
2. **Schema Validation**: Strapi silently drops components that aren't registered in the dynamic zone

### Verification
Checked the content type schema and confirmed that `sections.stats` and `sections.cta` are NOT in the allowed components list:
```javascript
"components": [
  "sections.hero",
  "sections.partner-carousel",
  "sections.best-app-ever",
  "sections.numbered-features",
  "sections.app-progress",
  "sections.key-features",
  "sections.app-screenshots",
  "sections.software-integrations",
  "sections.client-testimonials",
  "sections.pricing-plan",
  "sections.blog-grid",
  "sections.newsletter",
  "sections.contact-page",
  "sections.contact-hero",
  "sections.why-choose-us",
  "sections.contact-process"
  // Missing: sections.stats, sections.cta, sections.features
]
```

## Error #3: Partial Data in API Responses

### Issue
When fetching landing pages with `populate: "*"`, nested component data was incomplete.

### Example
```javascript
// Request
mcp__strapi__get_entries({
  pluralApiId: "landing-pages",
  options: {"filters": {"slug": "about"}, "locale": "ru", "populate": "*"}
})

// Response sections had incomplete data:
{
  "__component": "sections.hero",
  "id": 210,
  "title": "...",
  "overlay_opacity": 0.7,
  "layout": "centered"
  // Missing: cta_buttons, description, subtitle, etc.
}
```

### Solution
Use nested population for dynamic zones:
```javascript
mcp__strapi__strapi_rest({
  endpoint: "api/landing-pages",
  method: "GET",
  params: {
    "filters": {"slug": "about"},
    "locale": "ru",
    "populate": {"sections": {"populate": "*"}}
  }
})
```

## Recommendations

1. **Always check content type schema** before creating entries to ensure all components are registered
2. **Use nested population** for dynamic zones and polymorphic structures
3. **Verify required fields** at the root level of content types
4. **Test with GET after POST/PUT** to confirm data was saved correctly
5. **Add missing components to dynamic zone** through Strapi admin or by updating the content type configuration

## Required Actions

To fix the About page sections issue:
1. Add `sections.stats`, `sections.cta`, and `sections.features` to the landing page dynamic zone configuration in Strapi admin
2. Restart Strapi server after schema changes
3. Re-create or update the about page content with all sections

## Current Status - UNRESOLVED ERRORS

### 1. Missing Components in Dynamic Zone (STILL BROKEN)
The following components are NOT registered in the landing page's dynamic zone and therefore CANNOT be used:
- `sections.stats` ❌
- `sections.cta` ❌ 
- `sections.features` ❌

**Impact**: The About page only displays the Hero section. All other sections are silently dropped by Strapi.

### 2. About Page Content Incomplete (STILL BROKEN)
- Russian page (`/ru/about`): Only has hero section
- English page (`/en/about`): Only has hero section  
- Chinese page (`/zh/about`): Only has hero section

**Current State**: All three locale versions are missing the stats, features, and CTA sections that were intended to be added.

### 3. Required Manual Fix
To resolve these issues, someone needs to:
1. Log into Strapi Admin Panel
2. Navigate to Content-Type Builder
3. Edit Landing Page content type
4. Add missing components to the sections dynamic zone:
   - sections.stats
   - sections.cta
   - sections.features
5. Save and restart Strapi
6. Re-run the content creation scripts

**Without this manual intervention, the About page will remain incomplete.**

## Related Files
- `/data/rocket-sensei/front/app/[locale]/about/page.tsx` - About page route
- `/data/rocket-sensei/front/components/sections/Stats.tsx` - Stats component (created but unused)
- `/data/rocket-sensei/front/components/sections/CTA.tsx` - CTA component (created but unused)
- `/data/rocket-sensei/front/components/DynamicSections.tsx` - Dynamic section renderer (updated)