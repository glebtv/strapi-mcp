#!/usr/bin/env node

const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

async function testRelations() {
  console.log('Testing relation functionality...');
  
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
    name: 'test-relations',
    version: '1.0.0'
  }, {
    capabilities: {}
  });

  await client.connect(transport);

  try {
    // Create a project
    console.log('\n1. Creating a project...');
    const projectResult = await client.callTool({
      name: 'create_entry',
      arguments: {
        contentType: 'api::project.project',
        pluralApiId: 'projects',
        data: {
          name: 'Main Project ' + Date.now()
        }
      }
    });
    
    const project = JSON.parse(projectResult.content[0].text);
    console.log('Created project:', project.documentId);
    
    // Create a technology
    console.log('\n2. Creating a technology...');
    const techResult = await client.callTool({
      name: 'create_entry',
      arguments: {
        contentType: 'api::technology.technology',
        pluralApiId: 'technologies',
        data: {
          name: 'Test Technology ' + Date.now()
        }
      }
    });
    
    const tech = JSON.parse(techResult.content[0].text);
    console.log('Created technology:', tech.documentId);
    
    // Connect the relation using document IDs (Strapi v5 uses document IDs everywhere)
    console.log('\n3. Connecting technology to project...');
    console.log('Using technology document ID:', tech.documentId);
    const connectResult = await client.callTool({
      name: 'connect_relation',
      arguments: {
        pluralApiId: 'projects',
        documentId: project.documentId,
        relationField: 'technologies',
        relatedIds: [tech.documentId]  // Use document ID as Strapi v5 expects
      }
    });
    
    const connected = JSON.parse(connectResult.content[0].text);
    console.log('Connect result:', JSON.stringify(connected, null, 2));
    
    // Get the project with relations populated
    console.log('\n4. Getting project with relations populated...');
    const getResult = await client.callTool({
      name: 'get_entry',
      arguments: {
        pluralApiId: 'projects',
        documentId: project.documentId,
        options: JSON.stringify({
          populate: '*'
        })
      }
    });
    
    const retrieved = JSON.parse(getResult.content[0].text);
    console.log('Project with relations:', JSON.stringify(retrieved, null, 2));
    
    // Clean up
    console.log('\n5. Cleaning up...');
    await client.callTool({
      name: 'delete_entry',
      arguments: {
        pluralApiId: 'projects',
        documentId: project.documentId
      }
    });
    
    await client.callTool({
      name: 'delete_entry',
      arguments: {
        pluralApiId: 'technologies',
        documentId: tech.documentId
      }
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

testRelations().catch(console.error);