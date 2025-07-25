import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestClient, closeTestClient, parseToolResponse } from './helpers/admin-client.js';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import axios from 'axios';

describe('Internationalization (i18n) Content Type Creation and Management', () => {
  let adminClient: Client;
  let adminTransport: StdioClientTransport;
  let apiClient: Client;
  let apiTransport: StdioClientTransport;
  let createdDocumentId: string;
  const strapiUrl = process.env.STRAPI_URL || 'http://localhost:1337';

  beforeAll(async () => {
    // Create admin client for content type creation
    const adminResult = await createTestClient({ useAdminAuth: true, useApiToken: false });
    adminClient = adminResult.client;
    adminTransport = adminResult.transport;

    // Create API token client for regular operations
    const apiResult = await createTestClient({ useAdminAuth: false, useApiToken: true });
    apiClient = apiResult.client;
    apiTransport = apiResult.transport;
  });

  afterAll(async () => {
    // Cleanup - try to delete the content type if it exists
    try {
      await adminClient.callTool({
        name: 'delete_content_type',
        arguments: {
          contentType: 'api::doc.doc'
        }
      });
    } catch (error) {
      // Content type might not exist, that's ok
    }

    await closeTestClient(adminTransport);
    await closeTestClient(apiTransport);
  });

  describe('Create Localized Content Type', () => {
    it('should create a new content type called "doc" with localized fields using admin credentials', async () => {
      const contentTypeData = {
        displayName: 'Doc',
        singularName: 'doc',
        pluralName: 'docs',
        kind: 'collectionType',
        draftAndPublish: true,
        attributes: {
          name: {
            type: 'string',
            required: true,
            pluginOptions: {
              i18n: {
                localized: true
              }
            }
          },
          content: {
            type: 'richtext',
            required: false,
            pluginOptions: {
              i18n: {
                localized: true
              }
            }
          },
          slug: {
            type: 'uid',
            targetField: 'name',
            required: true
          },
          publishDate: {
            type: 'datetime',
            required: false,
            pluginOptions: {
              i18n: {
                localized: false
              }
            }
          }
        }
      };

      const result = await adminClient.callTool({
        name: 'create_content_type',
        arguments: contentTypeData
      });

      const response = parseToolResponse(result);
      expect(response).toBeDefined();
      
      // Wait for Strapi to restart and register the content type
      console.log('Waiting for Strapi to restart after content type creation...');
      
      // Poll the API endpoint until it becomes available (up to 30 seconds)
      const maxAttempts = 30;
      let attempts = 0;
      let apiReady = false;
      
      while (attempts < maxAttempts && !apiReady) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
        attempts++;
        
        try {
          const testResponse = await axios.get(`${strapiUrl}/api/docs?pagination[limit]=1`);
          if (testResponse.status === 200 || testResponse.status === 404) {
            // 200 = endpoint exists but no data, 404 = endpoint ready but no entries
            apiReady = true;
            console.log(`API endpoint ready after ${attempts} seconds`);
          }
        } catch (error: any) {
          if (error.response?.status === 404) {
            // This is actually good - means the endpoint exists but no entries yet
            apiReady = true;
            console.log(`API endpoint ready after ${attempts} seconds (404 - no entries)`);
          }
          // Otherwise, continue waiting
        }
      }
      
      if (!apiReady) {
        throw new Error('API endpoint did not become available within 30 seconds');
      }
    });

    it('should verify the content type was created', async () => {
      const result = await apiClient.callTool({
        name: 'list_content_types',
        arguments: {}
      });

      const contentTypes = parseToolResponse(result);
      const docContentType = contentTypes.find((ct: any) => ct.uid === 'api::doc.doc');
      
      expect(docContentType).toBeDefined();
      expect(docContentType.displayName).toBe('Doc');
      expect(docContentType.isLocalized).toBe(true);
    });
  });

  describe('Create Localized Documents', () => {
    it('should create a document in the default locale (en)', async () => {
      const result = await apiClient.callTool({
        name: 'create_entry',
        arguments: {
          contentType: 'api::doc.doc',
          pluralApiId: 'docs',
          data: {
            name: 'Getting Started Guide',
            content: 'Welcome to our documentation. This guide will help you get started quickly.',
            publishDate: new Date().toISOString()
          }
        }
      });

      const doc = parseToolResponse(result);
      expect(doc).toHaveProperty('documentId');
      expect(doc.name).toBe('Getting Started Guide');
      expect(doc.locale).toBe('en');
      
      createdDocumentId = doc.documentId;
    });

    it('should create Russian locale version of the document', async () => {
      // Use REST API directly for locale creation since MCP doesn't have direct locale support yet
      const result = await apiClient.callTool({
        name: 'strapi_rest',
        arguments: {
          endpoint: `api/docs/${createdDocumentId}?locale=ru`,
          method: 'PUT',
          body: {
            data: {
              name: 'Руководство по началу работы',
              content: 'Добро пожаловать в нашу документацию. Это руководство поможет вам быстро начать работу.'
            }
          }
        }
      });

      const doc = parseToolResponse(result);
      expect(doc.name).toBe('Руководство по началу работы');
      expect(doc.locale).toBe('ru');
    });

    it('should create Chinese locale version of the document', async () => {
      const result = await apiClient.callTool({
        name: 'strapi_rest',
        arguments: {
          endpoint: `api/docs/${createdDocumentId}?locale=zh`,
          method: 'PUT',
          body: {
            data: {
              name: '入门指南',
              content: '欢迎阅读我们的文档。本指南将帮助您快速上手。'
            }
          }
        }
      });

      const doc = parseToolResponse(result);
      expect(doc.name).toBe('入门指南');
      expect(doc.locale).toBe('zh');
    });
  });

  describe('Fetch and Verify Localized Documents via Public API', () => {
    it('should fetch all locale versions and verify they exist', async () => {
      // Fetch all docs (default locale)
      const defaultResult = await axios.get(`${strapiUrl}/api/docs`);
      expect(defaultResult.data.data).toBeInstanceOf(Array);
      
      const enDoc = defaultResult.data.data.find((d: any) => d.documentId === createdDocumentId);
      expect(enDoc).toBeDefined();
      expect(enDoc.name).toBe('Getting Started Guide');
      expect(enDoc.locale).toBe('en');
    });

    it('should fetch English version specifically', async () => {
      const result = await axios.get(`${strapiUrl}/api/docs/${createdDocumentId}?locale=en`);
      const doc = result.data.data;
      
      expect(doc.documentId).toBe(createdDocumentId);
      expect(doc.name).toBe('Getting Started Guide');
      expect(doc.content).toBe('Welcome to our documentation. This guide will help you get started quickly.');
      expect(doc.locale).toBe('en');
    });

    it('should fetch Russian version specifically', async () => {
      const result = await axios.get(`${strapiUrl}/api/docs/${createdDocumentId}?locale=ru`);
      const doc = result.data.data;
      
      expect(doc.documentId).toBe(createdDocumentId);
      expect(doc.name).toBe('Руководство по началу работы');
      expect(doc.content).toBe('Добро пожаловать в нашу документацию. Это руководство поможет вам быстро начать работу.');
      expect(doc.locale).toBe('ru');
    });

    it('should fetch Chinese version specifically', async () => {
      const result = await axios.get(`${strapiUrl}/api/docs/${createdDocumentId}?locale=zh`);
      const doc = result.data.data;
      
      expect(doc.documentId).toBe(createdDocumentId);
      expect(doc.name).toBe('入门指南');
      expect(doc.content).toBe('欢迎阅读我们的文档。本指南将帮助您快速上手。');
      expect(doc.locale).toBe('zh');
    });

    it('should fetch all documents in Russian locale', async () => {
      const result = await axios.get(`${strapiUrl}/api/docs?locale=ru`);
      const docs = result.data.data;
      
      expect(docs).toBeInstanceOf(Array);
      const ruDoc = docs.find((d: any) => d.documentId === createdDocumentId);
      expect(ruDoc).toBeDefined();
      expect(ruDoc.name).toBe('Руководство по началу работы');
      expect(ruDoc.locale).toBe('ru');
    });
  });

  describe('Update Localized Documents', () => {
    it('should update the English version without affecting other locales', async () => {
      const updateResult = await apiClient.callTool({
        name: 'update_entry',
        arguments: {
          pluralApiId: 'docs',
          documentId: createdDocumentId,
          data: {
            name: 'Getting Started Guide - Updated',
            content: 'Welcome to our updated documentation. This guide has been improved.'
          }
        }
      });

      const updatedDoc = parseToolResponse(updateResult);
      expect(updatedDoc.name).toBe('Getting Started Guide - Updated');

      // Verify other locales are not affected
      const ruResult = await axios.get(`${strapiUrl}/api/docs/${createdDocumentId}?locale=ru`);
      expect(ruResult.data.data.name).toBe('Руководство по началу работы');
      
      const zhResult = await axios.get(`${strapiUrl}/api/docs/${createdDocumentId}?locale=zh`);
      expect(zhResult.data.data.name).toBe('入门指南');
    });
  });

  describe('Content Type Schema Verification', () => {
    it('should verify the content type schema has i18n enabled fields', async () => {
      const result = await apiClient.callTool({
        name: 'get_content_type_schema',
        arguments: {
          contentType: 'api::doc.doc'
        }
      });

      const schema = parseToolResponse(result);
      
      // Check that i18n is enabled for the content type
      expect(schema.pluginOptions?.i18n?.localized).toBe(true);
      
      // Check individual field localization settings
      expect(schema.attributes.name.pluginOptions?.i18n?.localized).toBe(true);
      expect(schema.attributes.content.pluginOptions?.i18n?.localized).toBe(true);
      expect(schema.attributes.publishDate.pluginOptions?.i18n?.localized).toBe(false);
    });
  });

  describe('Cleanup', () => {
    it('should delete all locale versions of the document', async () => {
      // Delete each locale version
      for (const locale of ['en', 'ru', 'zh']) {
        try {
          await apiClient.callTool({
            name: 'strapi_rest',
            arguments: {
              endpoint: `api/docs/${createdDocumentId}?locale=${locale}`,
              method: 'DELETE'
            }
          });
        } catch (error) {
          // Some locales might already be deleted
        }
      }

      // Verify deletion
      try {
        await axios.get(`${strapiUrl}/api/docs/${createdDocumentId}`);
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.response?.status).toBe(404);
      }
    });
  });
});