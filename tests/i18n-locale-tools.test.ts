// Jest test - describe, it, expect, beforeAll, afterAll are globals
import { createTestClient, closeTestClient, parseToolResponse } from './helpers/admin-client.js';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

describe('i18n Locale Management Tools', () => {
  let client: Client;
  let transport: StdioClientTransport;
  let createdLocaleId: number | null = null;

  beforeAll(async () => {
    const result = await createTestClient();
    client = result.client;
    transport = result.transport;
  });

  afterAll(async () => {
    // Clean up created locale if any
    if (createdLocaleId) {
      try {
        await client.callTool({
          name: 'delete_locale',
          arguments: {
            id: createdLocaleId
          }
        });
      } catch (e) {
        // Ignore cleanup errors
      }
    }
    await closeTestClient(transport);
  });

  it('should list locales', async () => {
    const result = await client.callTool({
      name: 'list_locales',
      arguments: {}
    });

    const locales = parseToolResponse(result);
    expect(Array.isArray(locales)).toBe(true);
    expect(locales.length).toBeGreaterThan(0);
    
    // Should have at least English
    const englishLocale = locales.find((l: any) => l.code === 'en');
    expect(englishLocale).toBeDefined();
    expect(englishLocale.isDefault).toBe(true);
  });

  it('should create a new locale', async () => {
    const result = await client.callTool({
      name: 'create_locale',
      arguments: {
        code: 'ru',
        name: 'Russian (ru)'
      }
    });

    const createdLocale = parseToolResponse(result);
    console.log('Created locale response:', createdLocale);
    
    // The response might be wrapped
    const locale = createdLocale.data || createdLocale;
    expect(locale.code).toBe('ru');
    expect(locale.name).toBe('Russian (ru)');
    expect(locale.isDefault).toBe(false);
    
    // Store ID for cleanup
    createdLocaleId = locale.id;
  });

  it('should delete a locale', async () => {
    // First create a locale to delete
    const createResult = await client.callTool({
      name: 'create_locale',
      arguments: {
        code: 'es',
        name: 'Spanish (es)'
      }
    });
    
    const locale = parseToolResponse(createResult);
    
    // Now delete it
    const deleteResult = await client.callTool({
      name: 'delete_locale',
      arguments: {
        id: locale.id
      }
    });
    
    const deleteResponse = parseToolResponse(deleteResult);
    expect(deleteResponse.success).toBe(true);
    
    // Verify it's deleted by listing
    const listResult = await client.callTool({
      name: 'list_locales',
      arguments: {}
    });
    
    const locales = parseToolResponse(listResult);
    const deletedLocale = locales.find((l: any) => l.code === 'es');
    expect(deletedLocale).toBeUndefined();
  });
});