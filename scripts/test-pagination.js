#!/usr/bin/env node

const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

async function testPagination() {
  console.log('Testing pagination...');
  
  // Create MCP client
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['dist/index.js'],
    env: {
      ...process.env,
      STRAPI_URL: 'http://localhost:1337',
      STRAPI_ADMIN_EMAIL: 'admin@test.com',
      STRAPI_ADMIN_PASSWORD: 'Admin123!',
      STRAPI_DEV_MODE: 'true'
    }
  });

  const client = new Client({
    name: 'test-pagination',
    version: '1.0.0'
  }, {
    capabilities: {}
  });

  await client.connect(transport);

  try {
    // Test with specific pageSize
    console.log('\n1. Testing pagination with pageSize: 5...');
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
    console.log('Response meta:', JSON.stringify(response.meta, null, 2));
    console.log('Data length:', response.data?.length);
    
    // Also test with direct API call to see what's happening
    console.log('\n2. Testing with api::project.project...');
    const result2 = await client.callTool({
      name: 'get_entries',
      arguments: {
        pluralApiId: 'api::project.project',
        options: JSON.stringify({
          pagination: {
            page: 1,
            pageSize: 5
          }
        })
      }
    });
    
    const response2 = JSON.parse(result2.content[0].text);
    console.log('Response meta:', JSON.stringify(response2.meta, null, 2));
    console.log('Data length:', response2.data?.length);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

testPagination().catch(console.error);