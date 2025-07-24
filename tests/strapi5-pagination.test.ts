import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

describe('Strapi 5 Pagination', () => {
  let client: Client;
  let transport: StdioClientTransport;

  beforeAll(async () => {
    transport = new StdioClientTransport({
      command: 'node',
      args: ['build/index.js'],
      env: process.env
    });

    client = new Client({
      name: 'strapi5-pagination-test',
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