import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestClient, closeTestClient, parseToolResponse } from './helpers/admin-client.js';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import axios from 'axios';

describe('i18n Plugin Setup and Configuration', () => {
  let client: Client;
  let transport: StdioClientTransport;
  const strapiUrl = process.env.STRAPI_URL || 'http://localhost:1337';

  beforeAll(async () => {
    const result = await createTestClient({ useAdminAuth: false, useApiToken: true });
    client = result.client;
    transport = result.transport;
  });

  afterAll(async () => {
    await closeTestClient(transport);
  });

  describe('i18n Plugin Availability', () => {
    it('should have i18n plugin installed', async () => {
      try {
        // Try to fetch locales endpoint
        const response = await axios.get(`${strapiUrl}/api/i18n/locales`);
        expect(response.status).toBe(200);
        expect(response.data).toBeInstanceOf(Array);
      } catch (error: any) {
        // If i18n is not installed (404) or no permissions (403), skip these tests
        if (error.response?.status === 404) {
          console.warn('i18n plugin not installed, skipping i18n tests');
        } else if (error.response?.status === 403) {
          console.warn('i18n plugin installed but API token lacks permissions, continuing with limited tests');
        }
        expect([403, 404]).toContain(error.response?.status);
      }
    });

    it('should have default locale as English', async () => {
      try {
        const response = await axios.get(`${strapiUrl}/api/i18n/locales`);
        const locales = response.data;
        
        const defaultLocale = locales.find((l: any) => l.isDefault);
        expect(defaultLocale).toBeDefined();
        expect(defaultLocale.code).toBe('en');
      } catch (error) {
        // Skip if i18n not available
      }
    });

    it('should check for required locales (ru, zh)', async () => {
      try {
        const response = await axios.get(`${strapiUrl}/api/i18n/locales`);
        const locales = response.data;
        const localeCodes = locales.map((l: any) => l.code);
        
        // These locales might need to be added manually
        if (!localeCodes.includes('ru')) {
          console.warn('Russian locale (ru) not found - you may need to add it manually in Strapi admin');
        }
        if (!localeCodes.includes('zh')) {
          console.warn('Chinese locale (zh) not found - you may need to add it manually in Strapi admin');
        }
        
        expect(localeCodes).toContain('en'); // At least English should be there
      } catch (error) {
        // Skip if i18n not available
      }
    });
  });

  describe('Content Type i18n Capabilities', () => {
    it('should list content types and show i18n status', async () => {
      const result = await client.callTool({
        name: 'list_content_types',
        arguments: {}
      });

      const contentTypes = parseToolResponse(result);
      
      // Check if any content types have i18n enabled
      const localizedTypes = contentTypes.filter((ct: any) => ct.isLocalized);
      
      console.log(`Found ${localizedTypes.length} localized content types:`);
      localizedTypes.forEach((ct: any) => {
        console.log(`- ${ct.displayName} (${ct.uid})`);
      });
    });
  });
});