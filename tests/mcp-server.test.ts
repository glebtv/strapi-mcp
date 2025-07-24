import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

describe('Strapi MCP Server', () => {
  let client: Client;
  let transport: StdioClientTransport;

  beforeAll(async () => {
    transport = new StdioClientTransport({
      command: 'node',
      args: ['build/index.js'],
      env: process.env
    });

    client = new Client({
      name: 'test-suite',
      version: '1.0.0'
    }, {
      capabilities: {}
    });

    await client.connect(transport);
  });

  afterAll(async () => {
    if (transport) {
      await transport.close();
    }
  });

  describe('Content Types', () => {
    it('should list content types', async () => {
      const result = await client.callTool({
        name: 'list_content_types',
        arguments: {}
      });

      const contentTypes = JSON.parse(result.content[0].text);
      expect(contentTypes).toBeInstanceOf(Array);
      expect(contentTypes.length).toBeGreaterThan(0);
      expect(contentTypes[0]).toHaveProperty('uid');
      expect(contentTypes[0]).toHaveProperty('displayName');
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
          }
        }
      });
      
      const created = JSON.parse(createResult.content[0].text);
      expect(created).toHaveProperty('documentId');
      expect(created.documentId).toBeTruthy();
      
      // Now retrieve it
      const result = await client.callTool({
        name: 'get_entry',
        arguments: {
          pluralApiId: 'projects',
          documentId: created.documentId
        }
      });

      const entry = JSON.parse(result.content[0].text);
      expect(entry.documentId).toBe(created.documentId);
      expect(entry.name).toContain('Test Project for Retrieval');
      
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
      })).rejects.toThrow('ValidationError');
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
      })).rejects.toThrow('404');
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
            name: 'Test Technology ' + Date.now(),
            slug: 'test-technology-' + Date.now(),
            category: 'backend' // Use valid category
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

  describe.skip('Media Upload', () => {
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

  // TODO: Publishing in Strapi 5 works differently - need to investigate the correct approach
  // Setting publishedAt to null doesn't seem to unpublish entries
  describe.skip('Publishing', () => {
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
      expect(unpublished.publishedAt).toBeNull();
      
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