import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

describe('Strapi 5 Features', () => {
  let client: Client;
  let transport: StdioClientTransport;

  beforeAll(async () => {
    transport = new StdioClientTransport({
      command: 'node',
      args: ['build/index.js'],
      env: process.env
    });

    client = new Client({
      name: 'strapi5-test',
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

  describe('Document ID System', () => {
    it('should use documentId instead of numeric id', async () => {
      // Create an entry
      const createResult = await client.callTool({
        name: 'create_entry',
        arguments: {
          contentType: 'api::project.project',
          pluralApiId: 'projects',
          data: {
            name: 'Strapi 5 Test ' + Date.now()
          }
        }
      });

      const created = JSON.parse(createResult.content[0].text);
      
      // Check that we have both id and documentId
      expect(created).toHaveProperty('id');
      expect(created).toHaveProperty('documentId');
      expect(typeof created.id).toBe('number');
      expect(typeof created.documentId).toBe('string');
      
      // documentId should be a string with specific format
      expect(created.documentId).toMatch(/^[a-z0-9]+$/);

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

  describe('Flattened Response Format', () => {
    it('should return attributes directly on data object', async () => {
      // Create an entry
      const createResult = await client.callTool({
        name: 'create_entry',
        arguments: {
          contentType: 'api::project.project',
          pluralApiId: 'projects',
          data: {
            name: 'Flattened Response Test ' + Date.now(),
            description: 'Testing Strapi 5 response format'
          }
        }
      });

      const created = JSON.parse(createResult.content[0].text);
      
      // Attributes should be directly on the object, not nested
      expect(created.name).toBe('Flattened Response Test');
      expect(created.description).toBe('Testing Strapi 5 response format');
      
      // Should NOT have data.attributes structure
      expect(created.attributes).toBeUndefined();

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

  describe('Filter Operators', () => {
    let testDocumentIds: string[] = [];

    beforeAll(async () => {
      // Create test data
      const projects = [
        { name: 'Alpha Project', description: 'First project' },
        { name: 'Beta Project', description: 'Second project' },
        { name: 'Gamma Project', description: 'Third project' }
      ];

      for (const project of projects) {
        const result = await client.callTool({
          name: 'create_entry',
          arguments: {
            contentType: 'api::project.project',
            pluralApiId: 'projects',
            data: project
          }
        });
        testDocumentIds.push(JSON.parse(result.content[0].text).documentId);
      }
    });

    afterAll(async () => {
      // Cleanup
      for (const documentId of testDocumentIds) {
        try {
          await client.callTool({
            name: 'delete_entry',
            arguments: {
              pluralApiId: 'projects',
              documentId
            }
          });
        } catch (e) {}
      }
    });

    it('should support $contains filter', async () => {
      const result = await client.callTool({
        name: 'get_entries',
        arguments: {
          pluralApiId: 'projects',
          options: JSON.stringify({
            filters: {
              name: {
                $contains: 'Beta'
              }
            }
          })
        }
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.data).toHaveLength(1);
      expect(response.data[0].name).toBe('Beta Project');
    });

    it('should support $in filter', async () => {
      const result = await client.callTool({
        name: 'get_entries',
        arguments: {
          pluralApiId: 'projects',
          options: JSON.stringify({
            filters: {
              name: {
                $in: ['Alpha Project', 'Gamma Project']
              }
            }
          })
        }
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.data).toHaveLength(2);
      const names = response.data.map((p: any) => p.name);
      expect(names).toContain('Alpha Project');
      expect(names).toContain('Gamma Project');
    });

    it('should support complex filters with REST API', async () => {
      const result = await client.callTool({
        name: 'strapi_rest',
        arguments: {
          endpoint: 'api/projects',
          method: 'GET',
          params: {
            filters: {
              $or: [
                {
                  name: {
                    $contains: 'Alpha'
                  }
                },
                {
                  description: {
                    $contains: 'Third'
                  }
                }
              ]
            }
          }
        }
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.data).toHaveLength(2);
    });
  });

  describe('Pagination', () => {
    it('should return proper pagination metadata', async () => {
      const result = await client.callTool({
        name: 'get_entries',
        arguments: {
          pluralApiId: 'projects',
          options: JSON.stringify({
            pagination: {
              page: 1,
              pageSize: 5
            }
          })
        }
      });

      const response = JSON.parse(result.content[0].text);
      expect(response).toHaveProperty('meta');
      expect(response.meta).toHaveProperty('pagination');
      expect(response.meta.pagination).toHaveProperty('page');
      expect(response.meta.pagination).toHaveProperty('pageSize');
      expect(response.meta.pagination).toHaveProperty('pageCount');
      expect(response.meta.pagination).toHaveProperty('total');
    });
  });
});