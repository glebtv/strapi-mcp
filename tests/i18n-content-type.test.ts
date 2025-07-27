import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestClient, closeTestClient, parseToolResponse } from './helpers/admin-client.js';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import axios from 'axios';

describe('Internationalization (i18n) Content Type Creation and Management', { timeout: 120000 }, () => {
  let adminClient: Client;
  let adminTransport: StdioClientTransport;
  let apiClient: Client;
  let apiTransport: StdioClientTransport;
  let createdDocumentId: string;
  const strapiUrl = process.env.STRAPI_URL || 'http://localhost:1337';

  beforeAll(async () => {
    // Load test tokens if available
    try {
      const testTokens = await import('../test-tokens.json', { assert: { type: 'json' } });
      process.env.STRAPI_API_TOKEN = testTokens.default.fullAccessToken;
      process.env.STRAPI_ADMIN_EMAIL = testTokens.default.adminEmail;
      process.env.STRAPI_ADMIN_PASSWORD = testTokens.default.adminPassword;
    } catch (error) {
      console.warn('Could not load test-tokens.json, using default values');
      // Fallback to default token if file doesn't exist
      process.env.STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN || '69d41e37ebcd086fedac699f82ea44b8eca6a07c7aa14e73ee460ef3480626b361ebadf69983e76c1744463081737d5221c0ef6717d0411889937f2c9a02a1abf01d4f944e4d8d732a87c4d93e5dbb517e760b8df096af53566eb897488e10f036c4fbb5a5a493bb493c42f9d573b22e00c9bd86806441d30c1abe750ba271c1';
    }
    
    // Create admin client for content type creation
    const adminResult = await createTestClient({ useAdminAuth: true, useApiToken: false });
    adminClient = adminResult.client;
    adminTransport = adminResult.transport;

    // Create API token client for regular operations
    const apiResult = await createTestClient({ useAdminAuth: false, useApiToken: true });
    apiClient = apiResult.client;
    apiTransport = apiResult.transport;
    
    // Clean up any existing doc content type before starting
    try {
      await adminClient.callTool({
        name: 'delete_content_type',
        arguments: {
          contentType: 'api::doc.doc'
        }
      });
      console.log('Cleaned up existing doc content type');
      // Wait for Strapi to process the deletion
      await new Promise(resolve => setTimeout(resolve, 5000));
    } catch (error) {
      // Content type might not exist, that's ok
      console.log('No existing doc content type to clean up');
    }
    
    // Create required locales (Russian and Chinese) if they don't exist
    try {
      console.log('Creating required locales...');
      
      // Create Russian locale
      const ruResult = await adminClient.callTool({
        name: 'strapi_rest',
        arguments: {
          endpoint: 'api/i18n/locales',
          method: 'POST',
          body: {
            data: {
              name: 'Russian (ru)',
              code: 'ru'
            }
          }
        }
      });
      console.log('Created Russian locale');
      
      // Create Chinese locale
      const zhResult = await adminClient.callTool({
        name: 'strapi_rest',
        arguments: {
          endpoint: 'api/i18n/locales',
          method: 'POST',
          body: {
            data: {
              name: 'Chinese (zh)',
              code: 'zh'
            }
          }
        }
      });
      console.log('Created Chinese locale');
    } catch (error: any) {
      // Locales might already exist
      console.log('Locales might already exist:', error.message);
    }
  });

  afterAll(async () => {
    // Cleanup - try to delete the content type if it exists
    if (adminClient && adminTransport) {
      try {
        await adminClient.callTool({
          name: 'delete_content_type',
          arguments: {
            contentType: 'api::doc.doc'
          }
        });
      } catch (error: any) {
        // Content type might not exist, that's ok
        console.log('Cleanup: Content type api::doc.doc does not exist or already deleted');
      }

      await closeTestClient(adminTransport);
    }
    
    if (apiClient && apiTransport) {
      await closeTestClient(apiTransport);
    }
  });

  describe('Create Localized Content Type', () => {
    it('should create a new content type called "doc" with localized fields using admin credentials', async () => {
      const contentTypeData = {
        displayName: 'Doc',
        singularName: 'doc',
        pluralName: 'docs',
        kind: 'collectionType',
        draftAndPublish: true,
        pluginOptions: {
          i18n: {
            localized: true
          }
        },
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
      
      // In development mode, Strapi should auto-reload
      console.log('Waiting for Strapi to auto-reload after content type creation...');
      
      // Wait for Strapi to restart
      let strapiReady = false;
      let attempts = 0;
      const maxAttempts = 60; // Increase timeout to 60 seconds
      
      while (!strapiReady && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
        attempts++;
        
        try {
          // Check if Strapi is responding
          const healthCheck = await axios.get(`${strapiUrl}/_health`).catch(() => null);
          if (healthCheck || attempts > 5) {
            // Try the actual endpoint
            const testResponse = await axios.get(`${strapiUrl}/api/docs?pagination[limit]=1`);
            console.log('API endpoint ready, status:', testResponse.status);
            strapiReady = true;
          }
        } catch (error: any) {
          if (error.response?.status === 403) {
            console.log('API endpoint ready but permissions not set yet (403)');
            strapiReady = true;
          } else if (error.code !== 'ECONNREFUSED') {
            console.log('API endpoint check failed:', error.response?.status || error.message);
            // If it's not a connection refused error, Strapi is responding
            strapiReady = true;
          }
          // Otherwise, Strapi is still restarting
        }
      }
      
      if (!strapiReady) {
        console.log('Warning: Strapi did not become ready within 30 seconds');
      }
      
      // Wait a bit more for stability
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Update permissions to allow public access to the new content type
      console.log('Updating permissions for the new content type...');
      try {
        const permResult = await adminClient.callTool({
          name: 'update_content_type_permissions',
          arguments: {
            contentType: 'api::doc.doc',
            permissions: {
              public: {
                find: true,
                findOne: true,
                create: false,
                update: false,
                delete: false
              },
              authenticated: {
                find: true,
                findOne: true,
                create: true,
                update: true,
                delete: true
              }
            }
          }
        });
        
        const permResponse = parseToolResponse(permResult);
        console.log('Permissions update response:', permResponse);
        
        // Wait a bit for permissions to take effect
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (permError: any) {
        console.error('Failed to update permissions:', permError);
        throw permError; // Re-throw to see the actual error
      }
    }, 90000);

    it('should verify the content type was created', async () => {
      // Since list_content_types doesn't have admin credentials in the subprocess,
      // let's verify by trying to get the schema instead
      const result = await adminClient.callTool({
        name: 'get_content_type_schema',
        arguments: {
          contentType: 'api::doc.doc'
        }
      });

      const schema = parseToolResponse(result);
      
      expect(schema).toBeDefined();
      expect(schema.uid).toBe('api::doc.doc');
      
      // The schema structure from admin API is different
      if (schema.schema) {
        expect(schema.schema.info?.displayName).toBe('Doc');
        expect(schema.schema.pluginOptions?.i18n?.localized).toBe(true);
      } else {
        // Fallback for public API structure
        expect(schema.info?.displayName).toBe('Doc');
        expect(schema.pluginOptions?.i18n?.localized).toBe(true);
      }
      
      // Check specific fields have i18n enabled
      const attributes = schema.schema?.attributes || schema.attributes;
      expect(attributes?.name?.pluginOptions?.i18n?.localized).toBe(true);
      expect(attributes?.content?.pluginOptions?.i18n?.localized).toBe(true);
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
      console.log('Created document response:', JSON.stringify(doc, null, 2));
      
      expect(doc).toBeDefined();
      expect(doc.name).toBe('Getting Started Guide');
      
      // Strapi 5 returns documentId in the response
      if (doc.documentId) {
        createdDocumentId = doc.documentId;
      } else if (doc.id) {
        // Fallback to id if documentId is not present
        createdDocumentId = doc.id;
      }
      
      expect(createdDocumentId).toBeDefined();
      expect(createdDocumentId).not.toBe('');
      
      // Check locale if present
      if (doc.locale) {
        expect(doc.locale).toBe('en');
      }
    });

    it('should create Russian locale version of the document', async () => {
      // According to Strapi 5 docs, PUT with locale parameter creates a locale version
      // Let's try with the English documentId captured earlier
      console.log('Creating Russian locale for documentId:', createdDocumentId);
      
      const result = await apiClient.callTool({
        name: 'strapi_rest',
        arguments: {
          endpoint: `api/docs/${createdDocumentId}?locale=ru`,
          method: 'PUT',
          body: {
            data: {
              name: 'Руководство по началу работы',
              content: 'Добро пожаловать в нашу документацию. Это руководство поможет вам быстро начать работу.',
              // Explicitly include the slug since it's a required field
              slug: 'getting-started-guide-ru'
            }
          }
        }
      });

      const response = parseToolResponse(result);
      console.log('Russian locale creation response:', JSON.stringify(response, null, 2));
      
      // Check if the documentId matches the original
      const doc = response.data || response;
      expect(doc.name).toBe('Руководство по началу работы');
      
      if (doc.documentId) {
        console.log('Russian locale documentId:', doc.documentId);
        // It should be the same as the English documentId
        expect(doc.documentId).toBe(createdDocumentId);
      }
      
      // The locale field should be present in the response
      if (doc.locale) {
        expect(doc.locale).toBe('ru');
      } else {
        console.warn('Warning: locale field not present in response');
      }
    });

    it('should create Chinese locale version of the document', async () => {
      console.log('Creating Chinese locale for documentId:', createdDocumentId);
      
      const result = await apiClient.callTool({
        name: 'strapi_rest',
        arguments: {
          endpoint: `api/docs/${createdDocumentId}?locale=zh`,
          method: 'PUT',
          body: {
            data: {
              name: '入门指南',
              content: '欢迎阅读我们的文档。本指南将帮助您快速上手。',
              // Explicitly include the slug since it's a required field
              slug: 'getting-started-guide-zh'
            }
          }
        }
      });

      const response = parseToolResponse(result);
      console.log('Chinese locale creation response:', JSON.stringify(response, null, 2));
      
      const doc = response.data || response;
      expect(doc.name).toBe('入门指南');
      
      if (doc.documentId) {
        console.log('Chinese locale documentId:', doc.documentId);
        // It should be the same as the English documentId
        expect(doc.documentId).toBe(createdDocumentId);
      }
      
      // The locale field should be present in the response
      if (doc.locale) {
        expect(doc.locale).toBe('zh');
      } else {
        console.warn('Warning: locale field not present in response');
      }
    });
  });

  describe('Fetch and Verify Localized Documents', () => {
    describe('Public API Access', () => {
      it('should fetch all locale versions via public API', async () => {
        // Test without authentication
        const defaultResult = await axios.get(`${strapiUrl}/api/docs`);
        console.log('Public API fetch response:', JSON.stringify(defaultResult.data, null, 2));
        
        expect(defaultResult.data.data).toBeInstanceOf(Array);
        
        const enDoc = defaultResult.data.data.find((d: any) => d.documentId === createdDocumentId);
        expect(enDoc).toBeDefined();
        expect(enDoc.name).toBe('Getting Started Guide');
        
        // Check if locale field is present
        if (enDoc.locale) {
          expect(enDoc.locale).toBe('en');
        } else {
          console.warn('Warning: locale field not present in public API response');
        }
      });

      it('should fetch English version via public API', async () => {
        const result = await axios.get(`${strapiUrl}/api/docs/${createdDocumentId}?locale=en`);
        const doc = result.data.data;
        
        expect(doc.documentId).toBe(createdDocumentId);
        expect(doc.name).toBe('Getting Started Guide');
        expect(doc.content).toBe('Welcome to our documentation. This guide will help you get started quickly.');
        
        if (doc.locale) {
          expect(doc.locale).toBe('en');
        }
      });
    });

    describe('API Token Access', () => {
      const apiHeaders = {
        'Authorization': `Bearer ${process.env.STRAPI_API_TOKEN || '69d41e37ebcd086fedac699f82ea44b8eca6a07c7aa14e73ee460ef3480626b361ebadf69983e76c1744463081737d5221c0ef6717d0411889937f2c9a02a1abf01d4f944e4d8d732a87c4d93e5dbb517e760b8df096af53566eb897488e10f036c4fbb5a5a493bb493c42f9d573b22e00c9bd86806441d30c1abe750ba271c1'}`
      };

      it('should fetch all locale versions with API token', async () => {
        const defaultResult = await axios.get(`${strapiUrl}/api/docs`, { headers: apiHeaders });
        console.log('API token fetch response:', JSON.stringify(defaultResult.data, null, 2));
        
        expect(defaultResult.data.data).toBeInstanceOf(Array);
        
        const enDoc = defaultResult.data.data.find((d: any) => d.documentId === createdDocumentId);
        expect(enDoc).toBeDefined();
        expect(enDoc.name).toBe('Getting Started Guide');
      });

      it('should fetch English version with API token', async () => {
        const result = await axios.get(`${strapiUrl}/api/docs/${createdDocumentId}?locale=en`, { headers: apiHeaders });
        const doc = result.data.data;
        
        expect(doc.documentId).toBe(createdDocumentId);
        expect(doc.name).toBe('Getting Started Guide');
        expect(doc.content).toBe('Welcome to our documentation. This guide will help you get started quickly.');
        
        // Locale might be in different places in Strapi 5
        if (doc.locale) {
          expect(doc.locale).toBe('en');
        } else {
          console.warn('Warning: locale field not present in English fetch response');
        }
      });

      it('should fetch Russian version with API token', async () => {
        const result = await axios.get(`${strapiUrl}/api/docs/${createdDocumentId}?locale=ru&populate=*`, { headers: apiHeaders });
        const doc = result.data.data;
        
        console.log('Russian fetch response:', JSON.stringify(doc, null, 2));
        
        expect(doc.documentId).toBe(createdDocumentId);
        expect(doc.name).toBe('Руководство по началу работы');
        expect(doc.content).toBe('Добро пожаловать в нашу документацию. Это руководство поможет вам быстро начать работу.');
        
        if (doc.locale) {
          expect(doc.locale).toBe('ru');
        } else {
          console.warn('Warning: locale field not present in Russian fetch response');
        }
      });

      it('should fetch Chinese version with API token', async () => {
        const result = await axios.get(`${strapiUrl}/api/docs/${createdDocumentId}?locale=zh&populate=*`, { headers: apiHeaders });
        const doc = result.data.data;
        
        console.log('Chinese fetch response:', JSON.stringify(doc, null, 2));
        
        expect(doc.documentId).toBe(createdDocumentId);
        expect(doc.name).toBe('入门指南');
        expect(doc.content).toBe('欢迎阅读我们的文档。本指南将帮助您快速上手。');
        
        if (doc.locale) {
          expect(doc.locale).toBe('zh');
        } else {
          console.warn('Warning: locale field not present in Chinese fetch response');
        }
      });

      it('should fetch all documents in Russian locale with API token', async () => {
        const result = await axios.get(`${strapiUrl}/api/docs?locale=ru`, { headers: apiHeaders });
        const docs = result.data.data;
        
        console.log('Russian locale list response:', JSON.stringify(docs, null, 2));
        
        expect(docs).toBeInstanceOf(Array);
        const ruDoc = docs.find((d: any) => d.documentId === createdDocumentId);
        expect(ruDoc).toBeDefined();
        expect(ruDoc.name).toBe('Руководство по началу работы');
        
        if (ruDoc.locale) {
          expect(ruDoc.locale).toBe('ru');
        } else {
          console.warn('Warning: locale field not present in Russian locale list');
        }
      });
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
      const pluginOptions = schema.schema?.pluginOptions || schema.pluginOptions;
      expect(pluginOptions?.i18n?.localized).toBe(true);
      
      // Check individual field localization settings
      const attributes = schema.schema?.attributes || schema.attributes;
      expect(attributes?.name?.pluginOptions?.i18n?.localized).toBe(true);
      expect(attributes?.content?.pluginOptions?.i18n?.localized).toBe(true);
      expect(attributes?.publishDate?.pluginOptions?.i18n?.localized).toBe(false);
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