#!/usr/bin/env node

const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

async function testGetEntry() {
  console.log('Testing get_entry...');
  
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
    name: 'test-get-entry',
    version: '1.0.0'
  }, {
    capabilities: {}
  });

  await client.connect(transport);

  try {
    // Create a project first
    console.log('\n1. Creating a project...');
    const createResult = await client.callTool({
      name: 'create_entry',
      arguments: {
        contentType: 'api::project.project',
        pluralApiId: 'projects',
        data: {
          name: 'Test Get Entry ' + Date.now(),
          description: 'Testing get entry'
        }
      }
    });
    
    const created = JSON.parse(createResult.content[0].text);
    console.log('Created:', created.documentId);
    
    // Get it back
    console.log('\n2. Getting the entry...');
    const getResult = await client.callTool({
      name: 'get_entry',
      arguments: {
        pluralApiId: 'projects',
        documentId: created.documentId
      }
    });
    
    const retrieved = JSON.parse(getResult.content[0].text);
    console.log('Retrieved:', JSON.stringify(retrieved, null, 2));
    console.log('DocumentId on retrieved:', retrieved.documentId);
    console.log('DocumentId in data:', retrieved.data?.documentId);
    
    // Clean up
    await client.callTool({
      name: 'delete_entry',
      arguments: {
        pluralApiId: 'projects',
        documentId: created.documentId
      }
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

testGetEntry().catch(console.error);