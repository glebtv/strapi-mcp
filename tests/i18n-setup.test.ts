// Jest test - describe, it, expect, beforeAll, afterAll are globals
import { createTestClient, closeTestClient, parseToolResponse } from './helpers/admin-client.js';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

describe('i18n Plugin Setup and Configuration', () => {
  let client: Client;
  let transport: StdioClientTransport;

  beforeAll(async () => {
    const result = await createTestClient({ useAdminAuth: true });
    client = result.client;
    transport = result.transport;
  });

  afterAll(async () => {
    await closeTestClient(transport);
  });

  describe('i18n Plugin Availability', () => {
    it('should have i18n plugin installed', async () => {
      // Use the MCP tool to list locales
      const result = await client.callTool({
        name: 'list_locales',
        arguments: {}
      });
      
      const locales = parseToolResponse(result);
      expect(locales).toBeInstanceOf(Array);
      expect(locales.length).toBeGreaterThan(0);
    });

    it('should have default locale as English', async () => {
      const result = await client.callTool({
        name: 'list_locales',
        arguments: {}
      });
      
      const locales = parseToolResponse(result);
      
      const defaultLocale = locales.find((l: any) => l.isDefault);
      expect(defaultLocale).toBeDefined();
      expect(defaultLocale.code).toBe('en');
    });

    it('should check for required locales (ru, zh)', async () => {
      const result = await client.callTool({
        name: 'list_locales',
        arguments: {}
      });
      
      const locales = parseToolResponse(result);
      const localeCodes = locales.map((l: any) => l.code);
      
      // These locales might need to be added manually
      if (!localeCodes.includes('ru')) {
        console.warn('Russian locale (ru) not found - you may need to add it manually in Strapi admin');
      }
      if (!localeCodes.includes('zh')) {
        console.warn('Chinese locale (zh) not found - you may need to add it manually in Strapi admin');
      }
      
      expect(localeCodes).toContain('en'); // At least English should be there
    });
  });

  describe('Content Type i18n Capabilities', () => {
    it('should list content types and show i18n status', async () => {
      const result = await client.callTool({
        name: 'list_content_types',
        arguments: {}
      });

      const response = parseToolResponse(result);
      const contentTypes = response.data || response;
      
      // Check if any content types have i18n enabled
      const localizedTypes = Array.isArray(contentTypes) ? contentTypes.filter((ct: any) => ct.isLocalized) : [];
      
      console.log(`Found ${localizedTypes.length} localized content types:`);
      localizedTypes.forEach((ct: any) => {
        console.log(`- ${ct.displayName} (${ct.uid})`);
      });
    });
  });
});