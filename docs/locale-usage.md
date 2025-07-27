# Locale Parameter Usage in Strapi MCP

This document explains how to use the locale parameter with Strapi MCP tools when working with internationalized (i18n) content.

## Overview

Strapi 5 supports internationalization (i18n) which allows you to create and manage content in multiple languages. The Strapi MCP server fully supports i18n operations through the `locale` parameter.

## Prerequisites

1. Your Strapi content type must have i18n enabled:
   ```json
   {
     "pluginOptions": {
       "i18n": {
         "localized": true
       }
     }
   }
   ```

2. You must have the required locales created in your Strapi instance (e.g., 'en', 'ru', 'zh')

## Using Locale Parameter in Tools

### 1. Fetching Entries with Locale

#### Get all entries in a specific locale:
```json
{
  "tool": "get_entries",
  "arguments": {
    "pluralApiId": "articles",
    "options": "{\"locale\": \"ru\"}"
  }
}
```

#### Get all entries in all locales:
```json
{
  "tool": "get_entries",
  "arguments": {
    "pluralApiId": "articles",
    "options": "{\"locale\": \"all\"}"
  }
}
```

### 2. Fetching a Single Entry with Locale

```json
{
  "tool": "get_entry",
  "arguments": {
    "pluralApiId": "articles",
    "documentId": "abc123",
    "options": "{\"locale\": \"zh\"}"
  }
}
```

### 3. Creating an Entry in a Specific Locale

```json
{
  "tool": "create_entry",
  "arguments": {
    "contentType": "api::article.article",
    "pluralApiId": "articles",
    "data": {
      "title": "Мой заголовок",
      "content": "Содержание на русском языке"
    },
    "locale": "ru"
  }
}
```

### 4. Updating an Entry in a Specific Locale

```json
{
  "tool": "update_entry",
  "arguments": {
    "pluralApiId": "articles",
    "documentId": "abc123",
    "data": {
      "title": "更新的标题",
      "content": "更新的中文内容"
    },
    "locale": "zh"
  }
}
```

### 5. Deleting a Specific Locale Version

```json
{
  "tool": "delete_entry",
  "arguments": {
    "pluralApiId": "articles",
    "documentId": "abc123",
    "locale": "ru"
  }
}
```

### 6. Using strapi_rest Tool with Locale

```json
{
  "tool": "strapi_rest",
  "arguments": {
    "endpoint": "api/articles",
    "method": "GET",
    "params": {
      "locale": "all",
      "populate": ["author", "categories"]
    }
  }
}
```

## Creating i18n-Enabled Content Types

When creating a new content type with i18n support:

```json
{
  "tool": "create_content_type",
  "arguments": {
    "displayName": "Article",
    "singularName": "article",
    "pluralName": "articles",
    "pluginOptions": {
      "i18n": {
        "localized": true
      }
    },
    "attributes": {
      "title": {
        "type": "string",
        "required": true,
        "pluginOptions": {
          "i18n": {
            "localized": true
          }
        }
      },
      "content": {
        "type": "richtext",
        "pluginOptions": {
          "i18n": {
            "localized": true
          }
        }
      },
      "slug": {
        "type": "uid",
        "targetField": "title"
      }
    }
  }
}
```

## Important Notes

1. **Default Locale**: If no locale is specified, Strapi uses the default locale (usually 'en')

2. **Document ID**: In Strapi 5, all locale versions of an entry share the same `documentId`

3. **Populating Localizations**: To fetch all available localizations for an entry:
   ```json
   {
     "tool": "get_entry",
     "arguments": {
       "pluralApiId": "articles",
       "documentId": "abc123",
       "options": "{\"populate\": [\"localizations\"]}"
     }
   }
   ```

4. **Locale Codes**: Use standard locale codes like:
   - 'en' for English
   - 'ru' for Russian
   - 'zh' for Chinese
   - 'fr' for French
   - 'es' for Spanish
   - etc.

5. **Creating Locales**: Locales must be created in Strapi before you can create content in those languages. This is typically done through the Strapi admin panel.

## Error Handling

If you try to use a locale that doesn't exist, you'll get an error response from Strapi. Always ensure the locale exists in your Strapi instance before attempting to create or fetch content in that locale.