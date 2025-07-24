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
    
    // Test creating a project
    console.log('Creating a test project...');
    const createResult = await client.callTool({
      name: 'create_entry',
      arguments: {
        contentType: 'api::project.project',
        data: {
          name: 'Test Project',
          description: 'This is a test project created via MCP'
        }
      }
    });
    
    const created = JSON.parse(createResult.content[0].text);
    console.log('Created project:', JSON.stringify(created, null, 2));
    
    // If we have a documentId, test updating it
    if (created.documentId) {
      console.log('\nUpdating the project...');
      const updateResult = await client.callTool({
        name: 'update_entry',
        arguments: {
          contentType: 'api::project.project',
          id: created.documentId,
          data: {
            description: 'Updated description via MCP'
          }
        }
      });
      
      const updated = JSON.parse(updateResult.content[0].text);
      console.log('Updated project:', JSON.stringify(updated, null, 2));
      
      // Test deleting the project
      console.log('\nDeleting the project...');
      const deleteResult = await client.callTool({
        name: 'delete_entry',
        arguments: {
          contentType: 'api::project.project',
          id: created.documentId
        }
      });
      
      console.log('Delete result:', deleteResult.content[0].text);
    }
    
    await transport.close();
  } catch (error) {
    console.error('Error:', error.message);
    if (error.data) {
      console.error('Error details:', error.data);
    }
    await transport.close();
  }
}

test();