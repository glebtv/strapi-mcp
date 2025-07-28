import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestClient, closeTestClient, parseToolResponse } from './helpers/admin-client.js';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

describe('Component Management Operations', () => {
  let client: Client;
  let transport: StdioClientTransport;
  let testComponentUid: string;

  beforeAll(async () => {
    // Use admin credentials for component operations
    const result = await createTestClient({ useAdminAuth: true, useApiToken: false });
    client = result.client;
    transport = result.transport;
  });

  afterAll(async () => {
    await closeTestClient(transport);
  });

  describe('Component CRUD Operations', () => {
    it('should list all components', async () => {
      const result = await client.callTool({
        name: 'list_components',
        arguments: {}
      });

      const components = parseToolResponse(result);
      expect(components).toBeInstanceOf(Array);
      
      // Check component structure
      if (components.length > 0) {
        const component = components[0];
        expect(component).toHaveProperty('uid');
        expect(component).toHaveProperty('category');
        expect(component).toHaveProperty('displayName');
      }
    });

    it('should create a test component', async () => {
      const timestamp = Date.now();
      const componentData = {
        displayName: `TestSEO${timestamp}`,
        category: 'seo',
        icon: 'search',
        attributes: {
          metaTitle: {
            type: 'string',
            required: true
          },
          metaDescription: {
            type: 'text',
            required: false
          },
          keywords: {
            type: 'string'
          }
        }
      };

      const result = await client.callTool({
        name: 'create_component',
        arguments: componentData
      });

      const response = parseToolResponse(result);
      expect(response).toBeDefined();
      
      // Store component UID for future tests
      testComponentUid = `seo.test-seo-${timestamp}`;
    });

    it('should get component schema', async () => {
      // First get a list of components
      const listResult = await client.callTool({
        name: 'list_components',
        arguments: {}
      });

      const components = parseToolResponse(listResult);
      
      if (components.length > 0) {
        const targetComponent = components[0];
        
        const result = await client.callTool({
          name: 'get_component_schema',
          arguments: {
            componentUid: targetComponent.uid
          }
        });

        const schema = parseToolResponse(result);
        expect(schema).toHaveProperty('uid', targetComponent.uid);
        expect(schema).toHaveProperty('schema');
        expect(schema.schema).toHaveProperty('attributes');
        expect(schema.schema.attributes).toBeInstanceOf(Object);
      }
    });

    it('should update a component', async () => {
      // Get list of components
      const listResult = await client.callTool({
        name: 'list_components',
        arguments: {}
      });

      const components = parseToolResponse(listResult);
      
      // Find a test component to update
      const testComponent = components.find((c: any) => 
        c.displayName?.includes('Test') || c.category === 'test'
      );

      if (testComponent) {
        const updateData = {
          componentUid: testComponent.uid,
          attributesToUpdate: {
            updatedField: {
              type: 'string',
              required: false
            }
          }
        };

        const result = await client.callTool({
          name: 'update_component',
          arguments: updateData
        });

        const response = parseToolResponse(result);
        expect(response).toBeDefined();
      }
    });

    it('should handle paginated component retrieval', async () => {
      const result = await client.callTool({
        name: 'strapi_get_components',
        arguments: {
          page: 1,
          pageSize: 5
        }
      });

      const response = parseToolResponse(result);
      expect(response).toHaveProperty('data');
      expect(response).toHaveProperty('meta');
      expect(response.meta).toHaveProperty('pagination');
      
      const { pagination } = response.meta;
      expect(pagination).toHaveProperty('page', 1);
      expect(pagination).toHaveProperty('pageSize', 5);
      expect(pagination).toHaveProperty('total');
      expect(pagination).toHaveProperty('pageCount');
      
      // Verify data array structure
      expect(response.data).toBeInstanceOf(Array);
      if (response.data.length > 0) {
        const component = response.data[0];
        expect(component).toHaveProperty('uid');
        expect(component).toHaveProperty('category');
        expect(component).toHaveProperty('displayName');
        expect(component).toHaveProperty('attributes');
      }
    });
  });

  describe('Component Error Handling', () => {
    it('should handle non-existent component schema request', async () => {
      try {
        await client.callTool({
          name: 'get_component_schema',
          arguments: {
            componentUid: 'non.existent.component'
          }
        });
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        // The error message contains the component UID
        expect(error.message.toLowerCase()).toContain('non.existent.component');
      }
    });

    it('should validate required fields when creating component', async () => {
      try {
        await client.callTool({
          name: 'create_component',
          arguments: {
            displayName: 'InvalidComponent'
            // Missing required fields: category, attributes
          }
        });
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.message).toContain('Missing required fields');
      }
    });
  });
});