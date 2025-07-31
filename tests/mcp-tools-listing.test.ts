// Jest test - describe, it, expect, beforeAll, afterAll are globals
import { getSharedClient } from './helpers/shared-client.js';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';

describe('MCP Tools Functionality', () => {
  let client: Client;

  beforeAll(async () => {
    client = await getSharedClient();
  }, 60000);

  describe('Tools Work Correctly', () => {
    it('should successfully call list_content_types tool', async () => {
      const result = await client.callTool({
        name: 'list_content_types',
        arguments: {}
      });

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.content[0]).toHaveProperty('text');
      
      // Parse the response
      const contentTypes = JSON.parse(result.content[0].text);
      expect(contentTypes).toHaveProperty('data');
      expect(Array.isArray(contentTypes.data)).toBe(true);
    });

    it('should successfully call get_entries tool', async () => {
      const result = await client.callTool({
        name: 'get_entries',
        arguments: {
          pluralApiId: 'projects'
        }
      });

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.content[0]).toHaveProperty('text');
      
      // Parse the response
      const response = JSON.parse(result.content[0].text);
      // Response could be data array or object with data/meta
      expect(response).toBeDefined();
    });

    it('should handle invalid tool name', async () => {
      await expect(client.callTool({
        name: 'non_existent_tool',
        arguments: {}
      })).rejects.toThrow();
    });

    it('should handle invalid tool arguments', async () => {
      await expect(client.callTool({
        name: 'create_entry',
        arguments: {
          // Missing required contentType and data
        }
      })).rejects.toThrow();
    });

    it('should successfully call strapi_rest tool', async () => {
      const result = await client.callTool({
        name: 'strapi_rest',
        arguments: {
          endpoint: '/api/projects',
          method: 'GET'
        }
      });

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.content[0]).toHaveProperty('text');
    });
  });
});