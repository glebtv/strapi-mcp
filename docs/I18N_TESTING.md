# Internationalization (i18n) Testing Guide

This document describes the comprehensive i18n test suite for strapi-mcp, which demonstrates creating localized content types using admin credentials.

## Overview

The i18n test suite (`tests/i18n-content-type.test.ts`) demonstrates:
1. Creating a new content type with localized fields using admin credentials
2. Creating documents in multiple locales (English, Russian, Chinese)
3. Fetching and verifying localized content through Strapi's public API
4. Managing locale-specific content updates

## Prerequisites

### 1. Strapi i18n Plugin
The i18n plugin must be installed in your Strapi instance. It's typically included by default in Strapi 5.

### 2. Required Locales
The test requires these locales to be configured:
- `en` (English) - Default locale
- `ru` (Russian)
- `zh` (Chinese Simplified)

### 3. Admin Credentials
Component and content type creation requires admin credentials:
```bash
STRAPI_ADMIN_EMAIL=admin@example.com
STRAPI_ADMIN_PASSWORD=your_admin_password
```

## Test Structure

### 1. Content Type Creation
```typescript
// Creates a 'doc' content type with localized fields
const contentTypeData = {
  displayName: 'Doc',
  singularName: 'doc',
  pluralName: 'docs',
  attributes: {
    name: {
      type: 'string',
      pluginOptions: {
        i18n: { localized: true }
      }
    },
    content: {
      type: 'richtext',
      pluginOptions: {
        i18n: { localized: true }
      }
    },
    publishDate: {
      type: 'datetime',
      pluginOptions: {
        i18n: { localized: false } // Not localized
      }
    }
  }
};
```

### 2. Creating Localized Documents

The test creates documents in three locales:

#### English (Default)
```typescript
await client.callTool({
  name: 'create_entry',
  arguments: {
    contentType: 'api::doc.doc',
    pluralApiId: 'docs',
    data: {
      name: 'Getting Started Guide',
      content: 'Welcome to our documentation...'
    }
  }
});
```

#### Russian
```typescript
await client.callTool({
  name: 'strapi_rest',
  arguments: {
    endpoint: `api/docs/${documentId}?locale=ru`,
    method: 'PUT',
    body: {
      data: {
        name: 'Руководство по началу работы',
        content: 'Добро пожаловать в нашу документацию...'
      }
    }
  }
});
```

#### Chinese
```typescript
await client.callTool({
  name: 'strapi_rest',
  arguments: {
    endpoint: `api/docs/${documentId}?locale=zh`,
    method: 'PUT',
    body: {
      data: {
        name: '入门指南',
        content: '欢迎阅读我们的文档...'
      }
    }
  }
});
```

### 3. Fetching Localized Content

The test verifies content retrieval via public API:

```typescript
// Fetch specific locale
const result = await axios.get(`${strapiUrl}/api/docs/${documentId}?locale=ru`);

// Fetch all documents in a locale
const result = await axios.get(`${strapiUrl}/api/docs?locale=zh`);
```

## Running the Tests

### Local Development

1. Ensure your Strapi instance has i18n plugin enabled
2. Add required locales through Strapi admin panel or use the setup script
3. Set environment variables:
```bash
export STRAPI_URL=http://localhost:1337
export STRAPI_API_TOKEN=your_api_token
export STRAPI_ADMIN_EMAIL=admin@example.com
export STRAPI_ADMIN_PASSWORD=your_admin_password
```

4. Run the tests:
```bash
# Run all i18n tests
npm test tests/i18n-content-type.test.ts

# Run i18n setup verification
npm test tests/i18n-setup.test.ts
```

### CI/CD

The CI pipeline automatically:
1. Sets up a Strapi instance with i18n plugin
2. Creates admin credentials
3. Runs the locale setup script to add ru and zh locales
4. Executes all i18n tests

## Locale Setup Script

The `scripts/setup-i18n-locales.ts` script automatically adds required locales:

```bash
# Run manually if needed
node scripts/setup-i18n-locales.js
```

This script:
- Logs in as admin
- Checks existing locales
- Creates missing locales (ru, zh)
- Handles errors gracefully

## Key Concepts Demonstrated

### 1. Locale-Specific Operations
- Creating documents for specific locales
- Updating locale versions independently
- Deleting specific locale versions

### 2. Field Localization
- Localized fields (name, content) have different values per locale
- Non-localized fields (publishDate) share the same value across locales

### 3. API Patterns
- Default locale operations don't require locale parameter
- Non-default locales use `?locale=code` parameter
- PUT requests to `documentId?locale=code` create new locale versions

### 4. Schema Verification
The test verifies i18n configuration in content type schema:
```typescript
expect(schema.pluginOptions?.i18n?.localized).toBe(true);
expect(schema.attributes.name.pluginOptions?.i18n?.localized).toBe(true);
```

## Troubleshooting

### Missing Locales
If tests fail due to missing locales:
1. Check Strapi admin panel → Settings → Internationalization
2. Add missing locales manually or run the setup script
3. Ensure locale codes match exactly (e.g., 'zh' not 'zh-CN')

### Permission Errors
- Content type creation requires admin credentials
- Regular API token can create/read entries but not content types

### i18n Plugin Not Found
- Verify i18n plugin is installed in Strapi
- Check `package.json` for `@strapi/plugin-i18n`
- Restart Strapi after installing plugins

## Best Practices

1. **Always specify locale** when working with non-default locales
2. **Use documentId** consistently across all locale operations
3. **Test locale isolation** - updating one locale shouldn't affect others
4. **Handle missing locales** gracefully in production code
5. **Verify field localization** settings match your requirements

## Related Documentation

- [Strapi i18n REST API](https://docs.strapi.io/cms/api/rest/locale)
- [Strapi i18n Plugin](https://docs.strapi.io/cms/features/internationalization)
- [MCP Strapi Integration](../README.md)