#!/usr/bin/env node

const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const { spawn } = require('child_process');

async function testDeleteAll() {
  console.log('Testing delete_all_entries...');
  
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
    name: 'test-delete-all',
    version: '1.0.0'
  }, {
    capabilities: {}
  });

  await client.connect(transport);

  try {
    // First, create some test projects
    console.log('\n1. Creating test projects...');
    const testProjects = ['Test Project 1', 'Test Project 2', 'Test Project 3'];
    const createdIds = [];
    
    for (const name of testProjects) {
      const createResult = await client.callTool({
        name: 'create_entry',
        arguments: {
          contentType: 'api::project.project',
          pluralApiId: 'projects',
          data: { 
            name,
            description: 'Test project for delete test'
          }
        }
      });
      const created = JSON.parse(createResult.content[0].text);
      createdIds.push(created.documentId);
      console.log(`Created "${name}" with ID: ${created.documentId}`);
    }
    
    // List all projects
    console.log('\n2. Listing all projects...');
    const listResult = await client.callTool({
      name: 'get_entries',
      arguments: {
        pluralApiId: 'api::project.project',
        options: JSON.stringify({
          pagination: { pageSize: 100 }
        })
      }
    });
    
    const projects = JSON.parse(listResult.content[0].text);
    console.log(`Found ${projects.data.length} projects`);
    console.log('All projects:', projects.data.map(p => ({ name: p.name, id: p.documentId })));
    
    // Now try to delete all
    console.log('\n3. Calling delete_all_entries...');
    const deleteResult = await client.callTool({
      name: 'delete_all_entries',
      arguments: {
        pluralApiId: 'api::project.project',
        confirmDeletion: true
      }
    });
    
    const deleteResponse = JSON.parse(deleteResult.content[0].text);
    console.log('Delete result:', deleteResponse);
    
    // List again to verify
    console.log('\n4. Listing projects after deletion...');
    const listResult2 = await client.callTool({
      name: 'get_entries',
      arguments: {
        pluralApiId: 'api::project.project',
        options: JSON.stringify({
          pagination: { pageSize: 100 }
        })
      }
    });
    
    const projectsAfter = JSON.parse(listResult2.content[0].text);
    console.log(`Found ${projectsAfter.data.length} projects after deletion`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

testDeleteAll().catch(console.error);