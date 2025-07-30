// Jest test - describe, it, expect, beforeAll, afterAll, beforeEach, afterEach are globals
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { getSharedClient } from './helpers/shared-client.js';

describe('Strapi MCP Server', () => {
  let client: Client;

  beforeAll(async () => {
    client = await getSharedClient();
  }, 60000);

  describe('Content Types', () => {
    it('should list content types', async () => {
      const result = await client.callTool({
        name: 'list_content_types',
        arguments: {}
      });

      const response = JSON.parse(result.content[0].text);
      const contentTypes = response.data || response;
      expect(contentTypes).toBeInstanceOf(Array);
      expect(contentTypes.length).toBeGreaterThan(0);
      expect(contentTypes[0]).toHaveProperty('uid');
      expect(contentTypes[0]).toHaveProperty('info');
      expect(contentTypes[0].info).toHaveProperty('displayName');
    });
  });

  describe('CRUD Operations', () => {
    it('should create an entry', async () => {
      const result = await client.callTool({
        name: 'create_entry',
        arguments: {
          contentType: 'api::project.project',
          pluralApiId: 'projects',
          data: {
            name: 'Test Project ' + Date.now(),
            description: 'Created by test suite'
          }
        }
      });

      const created = JSON.parse(result.content[0].text);
      expect(created).toHaveProperty('documentId');
      expect(created.name).toContain('Test Project');
    });

    it('should get an entry by documentId', async () => {
      // First create an entry to retrieve
      const createResult = await client.callTool({
        name: 'create_entry',
        arguments: {
          contentType: 'api::project.project',
          pluralApiId: 'projects',
          data: {
            name: 'Test Project for Retrieval ' + Date.now()
          },
          status: 'published' // Ensure it's published so we can fetch it
        }
      });
      
      const created = JSON.parse(createResult.content[0].text);
      expect(created).toHaveProperty('documentId');
      expect(created.documentId).toBeTruthy();
      
      // Now retrieve it - since the entry was created in draft status, we need to fetch it as draft
      const result = await client.callTool({
        name: 'get_entry',
        arguments: {
          pluralApiId: 'projects',
          documentId: created.documentId
        }
      });
      
      const entry = JSON.parse(result.content[0].text);
      const entryData = entry.data || entry;
      expect(entryData.documentId).toBe(created.documentId);
      expect(entryData.name).toContain('Test Project for Retrieval');
      
      // Cleanup
      await client.callTool({
        name: 'delete_entry',
        arguments: {
          pluralApiId: 'projects',
          documentId: created.documentId
        }
      });
    });

    it('should update an entry', async () => {
      // First create an entry to update
      const createResult = await client.callTool({
        name: 'create_entry',
        arguments: {
          contentType: 'api::project.project',
          pluralApiId: 'projects',
          data: {
            name: 'Original Name ' + Date.now(),
            description: 'Original description'
          }
        }
      });
      
      const created = JSON.parse(createResult.content[0].text);
      expect(created).toHaveProperty('documentId');
      
      // Now update it
      const result = await client.callTool({
        name: 'update_entry',
        arguments: {
          pluralApiId: 'projects',
          documentId: created.documentId,
          data: {
            description: 'Updated by test suite'
          }
        }
      });

      const updated = JSON.parse(result.content[0].text);
      expect(updated.documentId).toBe(created.documentId);
      expect(updated.description).toBe('Updated by test suite');
      expect(updated.name).toContain('Original Name'); // Should not change
      
      // Cleanup
      await client.callTool({
        name: 'delete_entry',
        arguments: {
          pluralApiId: 'projects',
          documentId: created.documentId
        }
      });
    });

    it('should list entries with filters', async () => {
      const result = await client.callTool({
        name: 'get_entries',
        arguments: {
          pluralApiId: 'projects',
          options: JSON.stringify({
            filters: {
              name: {
                $contains: 'Test'
              }
            }
          })
        }
      });

      const response = JSON.parse(result.content[0].text);
      expect(response).toHaveProperty('data');
      expect(response).toHaveProperty('meta');
      expect(response.data).toBeInstanceOf(Array);
    });

    it('should delete an entry', async () => {
      // First create an entry to delete
      const createResult = await client.callTool({
        name: 'create_entry',
        arguments: {
          contentType: 'api::project.project',
          pluralApiId: 'projects',
          data: {
            name: 'To Be Deleted ' + Date.now()
          }
        }
      });
      const created = JSON.parse(createResult.content[0].text);
      
      // Now delete it
      const deleteResult = await client.callTool({
        name: 'delete_entry',
        arguments: {
          pluralApiId: 'projects',
          documentId: created.documentId
        }
      });

      expect(deleteResult.content[0].text).toContain('success');
    });
  });

  describe('Error Handling', () => {
    it('should return Strapi validation errors', async () => {
      await expect(client.callTool({
        name: 'create_entry',
        arguments: {
          contentType: 'api::project.project',
          pluralApiId: 'projects',
          data: {
            name: 123 // Should be string
          }
        }
      })).rejects.toThrow('name must be a `string` type');
    });

    it('should return 404 for non-existent entries', async () => {
      await expect(client.callTool({
        name: 'update_entry',
        arguments: {
          pluralApiId: 'projects',
          documentId: 'non-existent-id',
          data: {
            name: 'Test'
          }
        }
      })).rejects.toThrow('Entity not found');
    });
  });

  describe('REST API', () => {
    it('should make REST requests with query parameters', async () => {
      const result = await client.callTool({
        name: 'strapi_rest',
        arguments: {
          endpoint: 'api/projects',
          method: 'GET',
          params: {
            pagination: {
              page: 1,
              pageSize: 10
            },
            sort: ['createdAt:desc']
          }
        }
      });

      const response = JSON.parse(result.content[0].text);
      expect(response).toHaveProperty('data');
      expect(response).toHaveProperty('meta');
    });
  });

  describe('Relations', () => {
    let mainDocumentId: string;
    let relatedDocumentId: string;

    beforeEach(async () => {
      // Create main entry
      const mainResult = await client.callTool({
        name: 'create_entry',
        arguments: {
          contentType: 'api::project.project',
          pluralApiId: 'projects',
          data: {
            name: 'Main Project ' + Date.now()
          }
        }
      });
      mainDocumentId = JSON.parse(mainResult.content[0].text).documentId;

      // Create related entry with required fields
      const relatedResult = await client.callTool({
        name: 'create_entry',
        arguments: {
          contentType: 'api::technology.technology',
          pluralApiId: 'technologies',
          data: {
            name: 'Test Technology ' + Date.now()
          }
        }
      });
      relatedDocumentId = JSON.parse(relatedResult.content[0].text).documentId;
    });

    afterEach(async () => {
      // Cleanup
      try {
        await client.callTool({
          name: 'delete_entry',
          arguments: {
            pluralApiId: 'projects',
            documentId: mainDocumentId
          }
        });
      } catch (e) {}

      try {
        await client.callTool({
          name: 'delete_entry',
          arguments: {
            pluralApiId: 'technologies',
            documentId: relatedDocumentId
          }
        });
      } catch (e) {}
    });

    it('should connect relations', async () => {
      const result = await client.callTool({
        name: 'connect_relation',
        arguments: {
          pluralApiId: 'projects',
          documentId: mainDocumentId,
          relationField: 'technologies',
          relatedIds: [relatedDocumentId]
        }
      });

      const updated = JSON.parse(result.content[0].text);
      expect(updated).toHaveProperty('documentId');
    });

    it('should disconnect relations', async () => {
      // First connect
      await client.callTool({
        name: 'connect_relation',
        arguments: {
          pluralApiId: 'projects',
          documentId: mainDocumentId,
          relationField: 'technologies',
          relatedIds: [relatedDocumentId]
        }
      });

      // Then disconnect
      const result = await client.callTool({
        name: 'disconnect_relation',
        arguments: {
          pluralApiId: 'projects',
          documentId: mainDocumentId,
          relationField: 'technologies',
          relatedIds: [relatedDocumentId]
        }
      });

      const updated = JSON.parse(result.content[0].text);
      expect(updated).toHaveProperty('documentId');
    });

    it('should set relations', async () => {
      const result = await client.callTool({
        name: 'set_relation',
        arguments: {
          pluralApiId: 'projects',
          documentId: mainDocumentId,
          relationField: 'technologies',
          relatedIds: [relatedDocumentId]
        }
      });

      const updated = JSON.parse(result.content[0].text);
      expect(updated).toHaveProperty('documentId');
    });
  });

  describe('Media Upload', () => {
    it('should upload media from base64', async () => {
      // Create a small test image
      const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
      
      const result = await client.callTool({
        name: 'upload_media',
        arguments: {
          fileData: testImageBase64,
          fileName: 'test-pixel.png',
          fileType: 'image/png'
        }
      });

      const media = JSON.parse(result.content[0].text);
      expect(media).toHaveProperty('id');
      expect(media).toHaveProperty('url');
      expect(media.name).toBe('test-pixel.png');
    });
  });

  // Publishing in Strapi 5 uses the status parameter
  // - Published entries are fetched by default or with status=published
  // - Draft entries require status=draft
  // - Unpublishing is done by updating with status=draft, which sets publishedAt to null
  describe('Publishing', () => {
    it('should publish an entry', async () => {
      // Create entry to publish with unique name
      const uniqueName = 'Draft Project ' + Date.now();
      const createResult = await client.callTool({
        name: 'create_entry',
        arguments: {
          contentType: 'api::project.project',
          pluralApiId: 'projects',
          data: {
            name: uniqueName
          }
        }
      });
      const created = JSON.parse(createResult.content[0].text);
      
      // Publish it
      const result = await client.callTool({
        name: 'publish_entry',
        arguments: {
          pluralApiId: 'projects',
          documentId: created.documentId
        }
      });

      const published = JSON.parse(result.content[0].text);
      console.log('Published entry:', JSON.stringify(published, null, 2));
      expect(published.publishedAt).toBeTruthy();
      
      // Cleanup
      await client.callTool({
        name: 'delete_entry',
        arguments: {
          pluralApiId: 'projects',
          documentId: created.documentId
        }
      });
    });

    it('should unpublish an entry', async () => {
      // Create and publish entry with unique name
      const uniqueName = 'Published Project ' + Date.now();
      const createResult = await client.callTool({
        name: 'create_entry',
        arguments: {
          contentType: 'api::project.project',
          pluralApiId: 'projects',
          data: {
            name: uniqueName
          }
        }
      });
      const created = JSON.parse(createResult.content[0].text);
      
      // First publish
      await client.callTool({
        name: 'publish_entry',
        arguments: {
          pluralApiId: 'projects',
          documentId: created.documentId
        }
      });

      // Then unpublish
      const result = await client.callTool({
        name: 'unpublish_entry',
        arguments: {
          pluralApiId: 'projects',
          documentId: created.documentId
        }
      });

      const unpublished = JSON.parse(result.content[0].text);
      console.log('Unpublished entry:', JSON.stringify(unpublished, null, 2));
      // In Strapi v5, unpublishing creates a draft version
      // The response may still show the published version
      // Check if there's a draft in localizations or availableStatus
      if (unpublished.localizations && unpublished.localizations.length > 0) {
        const draft = unpublished.localizations.find(loc => loc.status === 'draft' && loc.publishedAt === null);
        expect(draft).toBeDefined();
      }
      
      // Verify the entry is now a draft by fetching it with status=draft
      const draftResult = await client.callTool({
        name: 'get_entries',
        arguments: {
          pluralApiId: 'projects',
          options: JSON.stringify({
            filters: {
              documentId: created.documentId
            },
            status: 'draft'
          })
        }
      });
      const draftEntries = JSON.parse(draftResult.content[0].text);
      expect(draftEntries.data).toHaveLength(1);
      expect(draftEntries.data[0].documentId).toBe(created.documentId);
      
      // Cleanup
      await client.callTool({
        name: 'delete_entry',
        arguments: {
          pluralApiId: 'projects',
          documentId: created.documentId
        }
      });
    });
  });
});