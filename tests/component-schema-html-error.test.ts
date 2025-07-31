// Jest test - describe, it, expect, beforeAll, afterAll are globals
import { getSharedClient, parseToolResponse } from './helpers/shared-client.js';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';

describe('Component Schema HTML Error', () => {
  let client: Client;

  beforeAll(async () => {
    client = await getSharedClient();
  }, 60000);

  describe('get_component_schema error handling', () => {
    it('should handle non-existent component error properly', async () => {
      // Test with a component that doesn't exist
      await expect(client.callTool({
        name: 'get_component_schema',
        arguments: {
          componentUid: 'sections.hero'
        }
      })).rejects.toThrow('Component sections.hero not found');
    });

    it('should list components first to ensure we have valid component UIDs', async () => {
      // First, list all components
      const listResult = await client.callTool({
        name: 'list_components',
        arguments: {}
      });

      const components = parseToolResponse(listResult);
      console.log('Available components:', components);
      
      expect(Array.isArray(components)).toBe(true);
      
      if (components.length > 0) {
        // Try to get schema for the first component
        const firstComponent = components[0];
        console.log('Testing with component:', firstComponent.uid);
        
        const schemaResult = await client.callTool({
          name: 'get_component_schema',
          arguments: {
            componentUid: firstComponent.uid
          }
        });

        const schema = parseToolResponse(schemaResult);
        
        // Verify it's not HTML
        if (typeof schema === 'string' && schema.includes('<!doctype html>')) {
          throw new Error(`Component schema for ${firstComponent.uid} returned HTML instead of JSON`);
        }
        
        expect(schema).toBeDefined();
        expect(schema).toHaveProperty('uid', firstComponent.uid);
      }
    });
  });
});