// Jest test - describe, it, expect, beforeAll, afterAll are globals
import { getSharedClient, parseToolResponse } from './helpers/shared-client.js';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import axios from 'axios';

/**
 * Tests for i18n functionality using the pre-created i18n-doc content type from fixtures
 */
describe('Internationalization (i18n) Content Type Management', () => {
  let client: Client;
  let createdDocumentIds: { [locale: string]: string } = {};
  const strapiUrl = process.env.STRAPI_URL || 'http://localhost:1337';

  beforeAll(async () => {
    client = await getSharedClient();
  });

  afterAll(async () => {
    // Clean up any created documents
    for (const documentId of Object.values(createdDocumentIds)) {
      if (documentId) {
        try {
          await client.callTool({
            name: 'delete_entry',
            arguments: {
              contentTypeUid: 'api::i18n-doc.i18n-doc',
              documentId: documentId
            }
          });
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    }
  });

  describe('Verify i18n Content Type', () => {
    it('should verify the i18n-doc content type exists with localized fields', async () => {
      const result = await client.callTool({
        name: 'list_content_types',
        arguments: {
          attributes: true  // Include full attributes to check i18n settings
        }
      });

      const contentTypes = parseToolResponse(result);
      const i18nDoc = contentTypes.find((ct: any) => ct.uid === 'api::i18n-doc.i18n-doc');
      
      expect(i18nDoc).toBeDefined();
      expect(i18nDoc.uid).toBe('api::i18n-doc.i18n-doc');
      expect(i18nDoc.pluginOptions?.i18n?.localized).toBe(true);
      
      // Check that attributes have i18n enabled
      if (i18nDoc.attributes) {
        if (Array.isArray(i18nDoc.attributes)) {
          const titleAttr = i18nDoc.attributes.find((attr: any) => attr.name === 'title');
          const contentAttr = i18nDoc.attributes.find((attr: any) => attr.name === 'content');
          expect(titleAttr?.pluginOptions?.i18n?.localized).toBe(true);
          expect(contentAttr?.pluginOptions?.i18n?.localized).toBe(true);
        } else {
          expect(i18nDoc.attributes?.title?.pluginOptions?.i18n?.localized).toBe(true);
          expect(i18nDoc.attributes?.content?.pluginOptions?.i18n?.localized).toBe(true);
        }
      }
    });
  });

  describe('Create Localized Documents', () => {
    it('should create a document in the default locale (en)', async () => {
      const timestamp = Date.now();
      const documentData = {
        title: `Test Document EN ${timestamp}`,
        content: 'This is test content in English',
        summary: 'This is a test document in English',
        slug: `test-document-en-${timestamp}`
      };

      const result = await client.callTool({
        name: 'create_entry',
        arguments: {
          contentTypeUid: 'api::i18n-doc.i18n-doc',
          data: documentData,
          publish: false  // Create as draft
        }
      });

      const created = parseToolResponse(result);
      expect(created).toBeDefined();
      expect(created.documentId).toBeDefined();
      expect(created.title).toContain('Test Document EN');
      expect(created.locale).toBe('en');
      
      createdDocumentIds.en = created.documentId;
      
      // Publish the entry so it's visible via public API
      await client.callTool({
        name: 'publish_entries',
        arguments: {
          contentTypeUid: 'api::i18n-doc.i18n-doc',
          documentIds: [created.documentId]
        }
      });
    });

    it('should create Russian locale version of the document', async () => {
      expect(createdDocumentIds.en).toBeDefined();

      const timestamp = Date.now();
      const documentData = {
        title: `Тестовый документ RU ${timestamp}`,
        content: 'Это тестовый контент на русском языке',
        summary: 'Это тестовый документ на русском языке',
        slug: `test-document-ru-${timestamp}`,
        locale: 'ru'
      };

      // First, check if ru locale exists
      const localesResult = await client.callTool({
        name: 'list_locales',
        arguments: {}
      });

      const locales = parseToolResponse(localesResult);
      const hasRuLocale = locales.some((locale: any) => locale.code === 'ru');

      if (!hasRuLocale) {
        // Create Russian locale if it doesn't exist
        await client.callTool({
          name: 'create_locale',
          arguments: {
            code: 'ru',
            name: 'Russian'
          }
        });
      }

      // Create the Russian version
      const result = await client.callTool({
        name: 'create_entry',
        arguments: {
          contentTypeUid: 'api::i18n-doc.i18n-doc',
          data: documentData,
          locale: 'ru',
          publish: false  // Create as draft
        }
      });

      const created = parseToolResponse(result);
      expect(created).toBeDefined();
      expect(created.documentId).toBeDefined();
      expect(created.title).toContain('Тестовый документ RU');
      expect(created.locale).toBe('ru');
      
      createdDocumentIds.ru = created.documentId;
      
      // Publish the Russian version
      await client.callTool({
        name: 'publish_entries',
        arguments: {
          contentTypeUid: 'api::i18n-doc.i18n-doc',
          documentIds: [created.documentId]
        }
      });
    });

    it('should create Chinese locale version of the document', async () => {
      expect(createdDocumentIds.en).toBeDefined();

      const timestamp = Date.now();
      const documentData = {
        title: `测试文档 ZH ${timestamp}`,
        content: '这是中文测试内容',
        summary: '这是一份中文测试文档',
        slug: `test-document-zh-${timestamp}`,
        locale: 'zh'
      };

      // First, check if zh locale exists
      const localesResult = await client.callTool({
        name: 'list_locales',
        arguments: {}
      });

      const locales = parseToolResponse(localesResult);
      const hasZhLocale = locales.some((locale: any) => locale.code === 'zh');

      if (!hasZhLocale) {
        // Create Chinese locale if it doesn't exist
        await client.callTool({
          name: 'create_locale',
          arguments: {
            code: 'zh',
            name: 'Chinese'
          }
        });
      }

      // Create the Chinese version
      const result = await client.callTool({
        name: 'create_entry',
        arguments: {
          contentTypeUid: 'api::i18n-doc.i18n-doc',
          data: documentData,
          locale: 'zh',
          publish: false  // Create as draft
        }
      });

      const created = parseToolResponse(result);
      expect(created).toBeDefined();
      expect(created.documentId).toBeDefined();
      expect(created.title).toContain('测试文档 ZH');
      expect(created.locale).toBe('zh');
      
      createdDocumentIds.zh = created.documentId;
      
      // Publish the Chinese version
      await client.callTool({
        name: 'publish_entries',
        arguments: {
          contentTypeUid: 'api::i18n-doc.i18n-doc',
          documentIds: [created.documentId]
        }
      });
    });
  });

  describe('Read Localized Documents', () => {
    describe('Public API Access', () => {
      it('should fetch all locale versions via public API', async () => {
        // Wait for cache to update
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const response = await axios.get(`${strapiUrl}/api/i18n-docs`, {
          params: {
            populate: '*'
          }
        });

        expect(response.status).toBe(200);
        expect(response.data.data).toBeInstanceOf(Array);
        
        // Check if we have at least one document
        expect(response.data.data.length).toBeGreaterThan(0);
        
        const locales = response.data.data.map((item: any) => item.locale);
        expect(locales).toContain('en');
        
        // Find the English document (there might be multiple from previous tests)
        const enDocs = response.data.data.filter((item: any) => item.locale === 'en');
        expect(enDocs.length).toBeGreaterThan(0);
        // Check if at least one has our test title pattern
        const hasTestDoc = enDocs.some((doc: any) => doc.title && doc.title.includes('Test Document EN'));
        expect(hasTestDoc).toBe(true);
      });

      it('should fetch English version via public API', async () => {
        const response = await axios.get(`${strapiUrl}/api/i18n-docs`, {
          params: {
            locale: 'en'
          }
        });

        expect(response.status).toBe(200);
        expect(response.data.data).toBeInstanceOf(Array);
        
        // Find any English test document
        const enDocs = response.data.data.filter((item: any) => 
          item.title && item.title.includes('Test Document EN')
        );
        expect(enDocs.length).toBeGreaterThan(0);
        expect(enDocs[0].locale).toBe('en');
      });
    });
  });

  describe('Update Localized Documents', () => {
    it('should update the English version without affecting other locales', async () => {
      expect(createdDocumentIds.en).toBeDefined();

      const timestamp = Date.now();
      const updateData = {
        title: `Updated Test Document EN ${timestamp}`,
        summary: 'This document has been updated'
      };

      const result = await client.callTool({
        name: 'update_entry',
        arguments: {
          contentTypeUid: 'api::i18n-doc.i18n-doc',
          documentId: createdDocumentIds.en,
          data: updateData,
          locale: 'en',
          publish: false  // Update as draft
        }
      });

      const updated = parseToolResponse(result);
      expect(updated.title).toContain('Updated Test Document EN');
      expect(updated.summary).toBe('This document has been updated');

      // Verify other locales are not affected
      if (createdDocumentIds.ru) {
        const ruResult = await client.callTool({
          name: 'get_entries',
          arguments: {
            contentTypeUid: 'api::i18n-doc.i18n-doc',
            documentId: createdDocumentIds.ru,
            locale: 'ru'
          }
        });
        const ruResponse = parseToolResponse(ruResult);
        const ruDocs = ruResponse.data || ruResponse.results || [];
        // The document should still be in Russian locale with original title
        if (ruDocs.length > 0) {
          const ruDoc = ruDocs[0];
          expect(ruDoc.title).toContain('Тестовый документ RU');
        }
      }
    });
  });

  describe('Delete Localized Documents', () => {
    it('should delete all locale versions of the document', async () => {
      // Delete documents in cleanup
      for (const [locale, documentId] of Object.entries(createdDocumentIds)) {
        if (documentId) {
          const result = await client.callTool({
            name: 'delete_entry',
            arguments: {
              contentTypeUid: 'api::i18n-doc.i18n-doc',
              documentId: documentId
            }
          });

          const response = parseToolResponse(result);
          expect(response.success).toBe(true);
        }
      }

      // Clear the IDs
      createdDocumentIds = {};
    });
  });
});