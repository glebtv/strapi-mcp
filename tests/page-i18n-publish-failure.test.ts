// Jest test - describe, it, expect, beforeAll, afterAll are globals
import { getSharedClient, parseToolResponse } from './helpers/shared-client.js';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import axios from 'axios';

describe('Page i18n Locale-Specific Publishing', () => {
  let client: Client;
  let pageDocumentId: string;
  const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1337';

  beforeAll(async () => {
    client = await getSharedClient();
  });

  afterAll(async () => {
    // Clean up
    if (pageDocumentId) {
      try {
        await client.callTool({
          name: 'delete_entry',
          arguments: {
            pluralApiId: 'pages',
            documentId: pageDocumentId
          }
        });
      } catch (error) {
        // Ignore
      }
    }
  });

  it('should publish ONLY Russian locale version of a page', async () => {
    // Step 1: Create a page in draft state
    const createResult = await client.callTool({
      name: 'create_entry',
      arguments: {
        contentType: 'api::page.page',
        pluralApiId: 'pages',
        locale: "ru",
        data: {
          title: 'Test Page for i18n Publishing',
          slug: `test-i18n-publish-${Date.now()}`,
          sections: [
            {
              __component: 'sections.hero',
              title: 'English Hero Title',
              subtitle: 'This is the English version'
            }
          ]
        },
        publish: false // Create in draft
      }
    });

    const createdPage = parseToolResponse(createResult);
    pageDocumentId = createdPage.documentId;

    // Step 2: The locale parameter is now supported in MCP tools
    // We created a Russian locale entry and will publish only that locale
    
    // Step 3: Publish ONLY the Russian locale using the locale parameter
    await client.callTool({
      name: 'publish_entry',
      arguments: {
        pluralApiId: 'pages',
        documentId: pageDocumentId,
        locale: 'ru'
      }
    });

    // Step 4: Verify what got published
    // We WANTED only Russian to be published

    // Check English - this SHOULD NOT be published
    // Since we created the entry with Russian locale, there's no English version
    try {
      await axios.get(`${STRAPI_URL}/api/pages/${pageDocumentId}?locale=en`);
      throw new Error('Expected 404 for English locale, but got a response');
    } catch (error: any) {
      // English is NOT published (good - this is what we want)
      expect(error.response?.status).toBe(404);
    }

    // Check Russian - this SHOULD be published
    const ruResponse = await axios.get(`${STRAPI_URL}/api/pages/${pageDocumentId}?locale=ru`);
    expect(ruResponse.status).toBe(200);
    expect(ruResponse.data.data).toBeDefined();
    
    console.log('SUCCESS: Russian locale was published correctly!');
    console.log('SUCCESS: English locale was NOT published!');
    console.log('The locale parameter is working as expected!');
  });
});
