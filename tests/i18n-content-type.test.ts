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
              pluralApiId: 'i18n-docs',
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
        name: 'get_content_type_schema',
        arguments: {
          contentType: 'api::i18n-doc.i18n-doc'
        }
      });

      const schema = parseToolResponse(result);
      
      expect(schema).toBeDefined();
      expect(schema.uid).toBe('api::i18n-doc.i18n-doc');
      expect(schema.pluginOptions?.i18n?.localized).toBe(true);
      
      // Check that attributes have i18n enabled
      if (Array.isArray(schema.attributes)) {
        const titleAttr = schema.attributes.find((attr: any) => attr.name === 'title');
        const contentAttr = schema.attributes.find((attr: any) => attr.name === 'content');
        expect(titleAttr?.pluginOptions?.i18n?.localized).toBe(true);
        expect(contentAttr?.pluginOptions?.i18n?.localized).toBe(true);
      } else {
        expect(schema.attributes?.title?.pluginOptions?.i18n?.localized).toBe(true);
        expect(schema.attributes?.content?.pluginOptions?.i18n?.localized).toBe(true);
      }
    });
  });

  describe('Create Localized Documents', () => {
    it('should create a document in the default locale (en)', async () => {
      const documentData = {
        title: 'Test Document EN',
        content: 'This is test content in English',
        summary: 'This is a test document in English',
        slug: 'test-document-en'
      };

      const result = await client.callTool({
        name: 'create_entry',
        arguments: {
          contentType: 'api::i18n-doc.i18n-doc',
          pluralApiId: 'i18n-docs',
          data: documentData,
          publish: true
        }
      });

      const created = parseToolResponse(result);
      expect(created).toBeDefined();
      expect(created.documentId).toBeDefined();
      expect(created.title).toBe('Test Document EN');
      expect(created.locale).toBe('en');
      
      createdDocumentIds.en = created.documentId;
    });

    it('should create Russian locale version of the document', async () => {
      expect(createdDocumentIds.en).toBeDefined();

      const documentData = {
        title: 'Тестовый документ RU',
        content: 'Это тестовый контент на русском языке',
        summary: 'Это тестовый документ на русском языке',
        slug: 'test-document-ru',
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
          contentType: 'api::i18n-doc.i18n-doc',
          pluralApiId: 'i18n-docs',
          data: documentData,
          publish: true
        }
      });

      const created = parseToolResponse(result);
      expect(created).toBeDefined();
      expect(created.documentId).toBeDefined();
      expect(created.title).toBe('Тестовый документ RU');
      expect(created.locale).toBe('ru');
      
      createdDocumentIds.ru = created.documentId;
    });

    it('should create Chinese locale version of the document', async () => {
      expect(createdDocumentIds.en).toBeDefined();

      const documentData = {
        title: '测试文档 ZH',
        content: '这是中文测试内容',
        summary: '这是一份中文测试文档',
        slug: 'test-document-zh',
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
          contentType: 'api::i18n-doc.i18n-doc',
          pluralApiId: 'i18n-docs',
          data: documentData,
          publish: true
        }
      });

      const created = parseToolResponse(result);
      expect(created).toBeDefined();
      expect(created.documentId).toBeDefined();
      expect(created.title).toBe('测试文档 ZH');
      expect(created.locale).toBe('zh');
      
      createdDocumentIds.zh = created.documentId;
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
        
        // Find the English document
        const enDoc = response.data.data.find((item: any) => item.locale === 'en');
        expect(enDoc).toBeDefined();
        expect(enDoc.title).toBe('Test Document EN');
      });

      it('should fetch English version via public API', async () => {
        const response = await axios.get(`${strapiUrl}/api/i18n-docs`, {
          params: {
            locale: 'en'
          }
        });

        expect(response.status).toBe(200);
        expect(response.data.data).toBeInstanceOf(Array);
        
        const enDoc = response.data.data.find((item: any) => item.title === 'Test Document EN');
        expect(enDoc).toBeDefined();
        expect(enDoc.locale).toBe('en');
      });
    });
  });

  describe('Update Localized Documents', () => {
    it('should update the English version without affecting other locales', async () => {
      expect(createdDocumentIds.en).toBeDefined();

      const updateData = {
        title: 'Updated Test Document EN',
        summary: 'This document has been updated'
      };

      const result = await client.callTool({
        name: 'update_entry',
        arguments: {
          pluralApiId: 'i18n-docs',
          documentId: createdDocumentIds.en,
          data: updateData
        }
      });

      const updated = parseToolResponse(result);
      expect(updated.title).toBe('Updated Test Document EN');
      expect(updated.summary).toBe('This document has been updated');

      // Verify other locales are not affected
      if (createdDocumentIds.ru) {
        const ruResult = await client.callTool({
          name: 'get_entry',
          arguments: {
            pluralApiId: 'i18n-docs',
            documentId: createdDocumentIds.ru
          }
        });
        const ruDoc = parseToolResponse(ruResult);
        // The document should still be in Russian locale
        expect(ruDoc).toBeDefined();
        if (ruDoc && ruDoc.title) {
          expect(ruDoc.title).toBe('Тестовый документ RU');
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
              pluralApiId: 'i18n-docs',
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