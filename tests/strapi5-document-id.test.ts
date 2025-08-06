// Jest test - describe, it, expect, beforeAll are globals
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { getSharedClient } from './helpers/shared-client.js';

describe('Strapi 5 Document ID System', () => {
  let client: Client;

  beforeAll(async () => {
    client = await getSharedClient();
  }, 60000);

  it('should use documentId instead of numeric id', async () => {
    // Create an entry
    const createResult = await client.callTool({
      name: 'create_draft_entry',
      arguments: {
        contentTypeUid: 'api::project.project',
        data: {
          name: 'Test Project ' + Date.now(),
          description: 'Testing documentId system'
        }
      }
    });
    
    const created = JSON.parse(createResult.content[0].text);
    
    // Check that we have both id and documentId
    expect(created).toHaveProperty('id');
    expect(created).toHaveProperty('documentId');
    expect(typeof created.id).toBe('number');
    expect(typeof created.documentId).toBe('string');
    
    // Update using documentId
    const updateResult = await client.callTool({
      name: 'update_entry_draft',
      arguments: {
        contentTypeUid: 'api::project.project',
        documentId: created.documentId,
        data: {
          description: 'Updated via documentId'
        }
      }
    });
    
    const updated = JSON.parse(updateResult.content[0].text);
    expect(updated.documentId).toBe(created.documentId);
    expect(updated.description).toBe('Updated via documentId');
    
    // Cleanup
    await client.callTool({
      name: 'delete_entry',
      arguments: {
        contentTypeUid: 'api::project.project',
        documentId: created.documentId
      }
    });
  }, 60000);
});