import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

describe('Strapi 5 Flattened Response Format', () => {
  let client: Client;
  let transport: StdioClientTransport;

  beforeAll(async () => {
    transport = new StdioClientTransport({
      command: 'node',
      args: ['build/index.js'],
      env: process.env
    });

    client = new Client({
      name: 'strapi5-response-test',
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

  it('should return attributes directly on data object', async () => {
    // Create an entry
    const testName = 'Flattened Response Test ' + Date.now();
    const createResult = await client.callTool({
      name: 'create_entry',
      arguments: {
        contentType: 'api::project.project',
        pluralApiId: 'projects',
        data: {
          name: testName,
          description: 'Testing Strapi 5 response format'
        }
      }
    });

    const created = JSON.parse(createResult.content[0].text);
    
    // Attributes should be directly on the object, not nested
    expect(created.name).toBe(testName);
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