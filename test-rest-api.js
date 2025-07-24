import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function test() {
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['build/index.js'],
    env: process.env
  });

  const client = new Client({
    name: 'test',
    version: '1.0.0'
  }, {
    capabilities: {}
  });

  try {
    await client.connect(transport);
    
    // Test strapi_rest with filters
    console.log('Testing REST API with filters...');
    const result = await client.callTool({
      name: 'strapi_rest',
      arguments: {
        endpoint: 'api/projects',
        method: 'GET',
        params: {
          filters: {
            name: {
              $contains: 'Test'
            }
          },
          pagination: {
            page: 1,
            pageSize: 10
          },
          sort: ['createdAt:desc']
        }
      }
    });
    
    console.log('REST API result:', result.content[0].text);
    
    await transport.close();
  } catch (error) {
    console.error('Error:', error.message);
    await transport.close();
  }
}

test();