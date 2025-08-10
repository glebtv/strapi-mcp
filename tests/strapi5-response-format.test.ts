// Jest test - describe, it, expect, beforeAll, afterAll are globals
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { getSharedClient } from './helpers/shared-client.js';

describe('Strapi 5 Flattened Response Format', () => {
  let client: Client;
  let testDocumentId: string;

  beforeAll(async () => {
    client = await getSharedClient();
  }, 60000);

  afterAll(async () => {
    // Cleanup
    if (testDocumentId) {
      try {
        await client.callTool({
          name: 'delete_entry',
          arguments: {
            documentId: testDocumentId
          }
        });
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }, 60000);

  it('should return attributes directly on data object', async () => {
    const testName = 'Flattened Response Test ' + Date.now();
    
    // Create entry
    const createResult = await client.callTool({
      name: 'create_entry',
      arguments: {
        contentTypeUid: 'api::project.project',
        publish: false,
        data: {
          name: testName,
          description: 'Testing Strapi 5 response format'
        }
      }
    });
    
    const created = JSON.parse(createResult.content[0].text);
    testDocumentId = created.documentId;
    
    // Attributes should be directly on the object, not nested
    expect(created.name).toBe(testName);
    expect(created.description).toBe('Testing Strapi 5 response format');
    
    // Should NOT have data.attributes structure
    expect(created.data).toBeUndefined();
    expect(created.attributes).toBeUndefined();
  }, 60000);
});
