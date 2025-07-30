// Jest test - describe, it, expect, beforeAll, afterAll are globals
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { getSharedClient } from './helpers/shared-client.js';

describe('Strapi 5 Complex Filters', () => {
  let client: Client;
  let testProjectNames: string[] = [];

  beforeAll(async () => {
    client = await getSharedClient();
  }, 60000);

  it('should support complex filters with REST API', async () => {
    // This test just verifies the REST API accepts complex filter syntax
    const result = await client.callTool({
      name: 'strapi_rest',
      arguments: {
        endpoint: 'api/projects',
        method: 'GET',
        params: {
          filters: {
            $and: [
              {
                name: {
                  $contains: 'Test'
                }
              },
              {
                $or: [
                  {
                    description: {
                      $notNull: true
                    }
                  },
                  {
                    createdAt: {
                      $gte: '2024-01-01'
                    }
                  }
                ]
              }
            ]
          },
          pagination: {
            page: 1,
            pageSize: 10
          }
        }
      }
    });

    const response = JSON.parse(result.content[0].text);
    expect(response).toHaveProperty('data');
    expect(response).toHaveProperty('meta');
    expect(response.data).toBeInstanceOf(Array);
  }, 60000);
});
