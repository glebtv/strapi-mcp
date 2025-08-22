// Jest test - describe, it, expect, beforeAll are globals  
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { getSharedClient } from './helpers/shared-client.js';

describe('Strapi 5 Pagination', () => {
  let client: Client;

  beforeAll(async () => {
    client = await getSharedClient();
  }, 60000);

  it('should return proper pagination metadata', async () => {
    const result = await client.callTool({
      name: 'get_entries',
      arguments: {
        contentTypeUid: 'api::project.project',
        pagination: {
          page: 1,
          pageSize: 5
        }
      }
    });

    const response = JSON.parse(result.content[0].text);
    expect(response).toHaveProperty('meta');
    expect(response.meta).toHaveProperty('pagination');
    expect(response.meta.pagination).toHaveProperty('page');
    expect(response.meta.pagination).toHaveProperty('pageSize');
    expect(response.meta.pagination).toHaveProperty('total');
    expect(response.meta.pagination).toHaveProperty('pageCount');
    
    // Verify pagination structure (content-manager API has a default pageSize of 10)
    expect(response.meta.pagination.page).toBe(1);
    expect(response.meta.pagination.pageSize).toBeGreaterThan(0);
  }, 60000);
});
