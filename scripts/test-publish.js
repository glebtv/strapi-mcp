#!/usr/bin/env node

const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

async function testPublish() {
  console.log('Testing publish functionality...');
  
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
    name: 'test-publish',
    version: '1.0.0'
  }, {
    capabilities: {}
  });

  await client.connect(transport);

  try {
    // Create a project
    console.log('\n1. Creating a project...');
    const createResult = await client.callTool({
      name: 'create_entry',
      arguments: {
        contentType: 'api::project.project',
        pluralApiId: 'projects',
        data: {
          name: 'Test Publish ' + Date.now(),
          description: 'Testing publish'
        }
      }
    });
    
    const created = JSON.parse(createResult.content[0].text);
    console.log('Created:', JSON.stringify(created, null, 2));
    console.log('DocumentId:', created.documentId);
    
    // Publish it
    console.log('\n2. Publishing the project...');
    const publishResult = await client.callTool({
      name: 'publish_entry',
      arguments: {
        pluralApiId: 'projects',
        documentId: created.documentId
      }
    });
    
    const published = JSON.parse(publishResult.content[0].text);
    console.log('Published result:', JSON.stringify(published, null, 2));
    
    // Get the entry to see if it has publishedAt
    console.log('\n3. Getting the published entry...');
    const getResult = await client.callTool({
      name: 'get_entry',
      arguments: {
        pluralApiId: 'projects',
        documentId: created.documentId
      }
    });
    
    const retrieved = JSON.parse(getResult.content[0].text);
    console.log('Retrieved entry:', JSON.stringify(retrieved, null, 2));
    
    // Unpublish it
    console.log('\n4. Unpublishing the project...');
    const unpublishResult = await client.callTool({
      name: 'unpublish_entry',
      arguments: {
        pluralApiId: 'projects',
        documentId: created.documentId
      }
    });
    
    const unpublished = JSON.parse(unpublishResult.content[0].text);
    console.log('Unpublished result:', JSON.stringify(unpublished, null, 2));
    
    // Clean up
    console.log('\n5. Cleaning up...');
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

testPublish().catch(console.error);