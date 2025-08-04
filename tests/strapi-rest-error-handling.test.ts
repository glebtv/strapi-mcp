import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { getSharedClient } from './helpers/shared-client.js';

describe('strapi_rest error handling', () => {
  let client: Client;
  
  beforeAll(async () => {
    client = await getSharedClient();
  }, 60000);

  test('should throw an error for 403 responses', async () => {
    // Call strapi_rest with no authentication to trigger 403
    await expect(
      client.callTool({
        name: 'strapi_rest',
        arguments: {
          endpoint: 'api/users/me',
          method: 'GET',
          authenticated: false // This should trigger a 403
        }
      })
    ).rejects.toThrow('Forbidden');
  }, 10000);

  test('should throw an error for 404 responses', async () => {
    // Call strapi_rest with a non-existent endpoint
    await expect(
      client.callTool({
        name: 'strapi_rest',
        arguments: {
          endpoint: 'api/non-existent-endpoint',
          method: 'GET',
          authenticated: false // Don't authenticate to avoid timeout
        }
      })
    ).rejects.toThrow(/Request failed|Not Found/);
  }, 10000);

  test('should succeed for valid requests', async () => {
    // First list content types to get the init response
    const listResult = await client.callTool({
      name: 'list_content_types',
      arguments: {}
    });
    
    expect(listResult).toBeDefined();
    expect(listResult.content).toBeDefined();
    
    // Now test strapi_rest with the health endpoint which always exists
    const result = await client.callTool({
      name: 'strapi_rest',
      arguments: {
        endpoint: '_health',
        method: 'GET',
        authenticated: false
      }
    });
    
    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    expect(result.content[0]).toBeDefined();
    expect(result.content[0].type).toBe('text');
    
    // Health endpoint returns 204 No Content, so response might be empty
    // The important thing is it doesn't throw an error
  }, 10000);
});