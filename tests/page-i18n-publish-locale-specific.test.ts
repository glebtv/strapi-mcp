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

  it('should create and publish ONLY Russian locale version of a page', async () => {
    // Step 1: Create a page in English (default locale) in draft state
    const createEnResult = await client.callTool({
      name: 'create_entry',
      arguments: {
        contentType: 'api::page.page',
        pluralApiId: 'pages',
        locale: 'en',
        data: {
          title: 'Test Page EN',
          slug: `test-locale-specific-${Date.now()}`,
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

    const createdEnPage = parseToolResponse(createEnResult);
    pageDocumentId = createdEnPage.documentId;
    console.log('Created English page with documentId:', pageDocumentId);

    // Step 2: Create Russian version in draft state
    const createRuResult = await client.callTool({
      name: 'create_entry',
      arguments: {
        contentType: 'api::page.page',
        pluralApiId: 'pages',
        locale: 'ru',
        data: {
          title: 'Тестовая страница RU',
          slug: createdEnPage.slug, // Keep same slug for consistency
          sections: [
            {
              __component: 'sections.hero',
              title: 'Русский заголовок',
              subtitle: 'Это русская версия'
            }
          ]
        },
        publish: false // Create in draft
      }
    });

    const createdRuPage = parseToolResponse(createRuResult);
    console.log('Created Russian page:', createdRuPage);

    // Step 3: Verify both are in draft state (not visible in public API)
    try {
      await axios.get(`${STRAPI_URL}/api/pages/${pageDocumentId}?locale=en`);
      throw new Error('English page should not be visible in draft state');
    } catch (error: any) {
      expect(error.response?.status).toBe(404);
      console.log('✓ English page is in draft (not public)');
    }

    try {
      await axios.get(`${STRAPI_URL}/api/pages/${pageDocumentId}?locale=ru`);
      throw new Error('Russian page should not be visible in draft state');
    } catch (error: any) {
      expect(error.response?.status).toBe(404);
      console.log('✓ Russian page is in draft (not public)');
    }

    // Step 4: Publish ONLY the Russian locale
    console.log('Publishing ONLY Russian locale...');
    // In Strapi v5, each locale has its own document ID
    await client.callTool({
      name: 'publish_entry',
      arguments: {
        pluralApiId: 'pages',
        documentId: createdRuPage.documentId, // Use the Russian page's document ID
        locale: 'ru'
      }
    });

    // Step 5: Verify results
    // English should STILL NOT be published
    try {
      await axios.get(`${STRAPI_URL}/api/pages/${pageDocumentId}?locale=en`);
      throw new Error('English locale was published when we only wanted Russian!');
    } catch (error: any) {
      expect(error.response?.status).toBe(404);
      console.log('✓ SUCCESS: English locale is still NOT published');
    }

    // Russian SHOULD be published
    const ruResponse = await axios.get(`${STRAPI_URL}/api/pages/${createdRuPage.documentId}?locale=ru`);
    expect(ruResponse.status).toBe(200);
    expect(ruResponse.data.data).toBeDefined();
    const ruData = ruResponse.data.data;
    expect(ruData.title || ruData.attributes?.title).toBe('Тестовая страница RU');
    console.log('✓ SUCCESS: Russian locale IS published');
    
    console.log('\n🎉 LOCALE-SPECIFIC PUBLISHING WORKS!');
    console.log('We successfully published ONLY the Russian locale');
    console.log('The English locale remains in draft state');
  });

  it('should unpublish ONLY Russian locale version of a page', async () => {
    // Create and publish a page in both locales
    const createResult = await client.callTool({
      name: 'create_entry',
      arguments: {
        contentType: 'api::page.page',
        pluralApiId: 'pages',
        locale: 'en',
        data: {
          title: 'Test Unpublish EN',
          slug: `test-unpublish-${Date.now()}`,
          sections: [{
            __component: 'sections.hero',
            title: 'Test Hero EN'
          }]
        },
        publish: true // Publish immediately
      }
    });

    const createdEnPage = parseToolResponse(createResult);
    const enDocumentId = createdEnPage.documentId;

    // Create and publish Russian version
    const createRuResult = await client.callTool({
      name: 'create_entry',
      arguments: {
        contentType: 'api::page.page',
        pluralApiId: 'pages',
        locale: 'ru',
        data: {
          title: 'Тест Unpublish RU',
          slug: createdEnPage.slug, // Keep same slug
          sections: [{
            __component: 'sections.hero',
            title: 'Тест Hero RU'
          }]
        },
        publish: true
      }
    });
    
    const createdRuPage = parseToolResponse(createRuResult);
    const ruDocumentId = createdRuPage.documentId;

    // Both should be published
    const enCheck1 = await axios.get(`${STRAPI_URL}/api/pages/${enDocumentId}?locale=en`);
    expect(enCheck1.status).toBe(200);
    
    const ruCheck1 = await axios.get(`${STRAPI_URL}/api/pages/${ruDocumentId}?locale=ru`);
    expect(ruCheck1.status).toBe(200);

    // Unpublish ONLY Russian
    await client.callTool({
      name: 'unpublish_entry',
      arguments: {
        pluralApiId: 'pages',
        documentId: ruDocumentId,
        locale: 'ru'
      }
    });

    // English should STILL be published
    const enCheck2 = await axios.get(`${STRAPI_URL}/api/pages/${enDocumentId}?locale=en`);
    expect(enCheck2.status).toBe(200);
    console.log('✓ English locale is still published');

    // Russian should NOT be published
    try {
      await axios.get(`${STRAPI_URL}/api/pages/${ruDocumentId}?locale=ru`);
      throw new Error('Russian locale should not be published after unpublishing');
    } catch (error: any) {
      expect(error.response?.status).toBe(404);
      console.log('✓ Russian locale was successfully unpublished');
    }

    // Clean up both entries
    await client.callTool({
      name: 'delete_entry',
      arguments: {
        pluralApiId: 'pages',
        documentId: enDocumentId
      }
    });
    
    await client.callTool({
      name: 'delete_entry',
      arguments: {
        pluralApiId: 'pages',  
        documentId: ruDocumentId
      }
    });
  });
});