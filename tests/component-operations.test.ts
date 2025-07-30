// Jest test - describe, it, expect, beforeAll, afterAll are globals
import { getSharedClient, parseToolResponse } from './helpers/shared-client.js';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';

describe('Component Management Operations', () => {
  let client: Client;
  let testComponentUid: string;

  beforeAll(async () => {
    // Use the shared client instance
    client = await getSharedClient();
  }, 60000);

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
    }, 60000);

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
        arguments: {
          componentData: componentData
        }
      });

      const response = parseToolResponse(result);
      expect(response).toBeDefined();
      
      // Store component UID for future tests
      testComponentUid = `seo.test-seo-${timestamp}`;
    }, 60000);

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
    }, 60000);

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
    }, 60000);

    // Removed paginated component retrieval test - list_components doesn't support pagination
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
        // The error message should contain information about the component not being found
        expect(error.message).toBeDefined();
        expect(error.message.length).toBeGreaterThan(0);
      }
    }, 60000);

    it('should validate required fields when creating component', async () => {
      try {
        await client.callTool({
          name: 'create_component',
          arguments: {
            // Invalid - not wrapped in componentData object
            displayName: 'InvalidComponent',
            category: 'test'
          }
        });
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        // Should contain validation error message
        expect(error.message).toContain('Invalid arguments');
        expect(error.message.toLowerCase()).toContain('componentdata');
      }
    }, 60000);
  });
});