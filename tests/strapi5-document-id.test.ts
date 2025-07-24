import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

describe('Strapi 5 Document ID System', () => {
  let client: Client;
  let transport: StdioClientTransport;

  beforeAll(async () => {
    transport = new StdioClientTransport({
      command: 'node',
      args: ['build/index.js'],
      env: process.env
    });

    client = new Client({
      name: 'strapi5-documentid-test',
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