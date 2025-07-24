import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function createTestProjects(count: number = 200) {
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['build/index.js'],
    env: process.env
  });

  const client = new Client({
    name: 'test-data-generator',
    version: '1.0.0'
  }, {
    capabilities: {}
  });

  try {
    await client.connect(transport);
    
    console.log(`Creating ${count} test projects...`);
    
    let created = 0;
    const batchSize = 10;
    
    for (let i = 0; i < count; i += batchSize) {
      const promises = [];
      
      for (let j = 0; j < batchSize && (i + j) < count; j++) {
        const projectNum = i + j + 1;
        const isDraft = projectNum % 3 === 0; // Every 3rd project is a draft
        
        const promise = client.callTool({
          name: 'create_entry',
          arguments: {
            contentType: 'api::project.project',
            pluralApiId: 'projects',
            data: {
              name: `Test Project ${projectNum}`,
              description: `This is test project number ${projectNum} - ${isDraft ? 'DRAFT' : 'PUBLISHED'}`
            }
          }
        }).then(async (result) => {
          const entry = JSON.parse(result.content[0].text);
          
          // If it should be a draft, unpublish it
          if (isDraft) {
            await client.callTool({
              name: 'unpublish_entry',
              arguments: {
                pluralApiId: 'projects',
                documentId: entry.documentId
              }
            });
          }
          
          created++;
          if (created % 10 === 0) {
            console.log(`Created ${created}/${count} projects...`);
          }
        }).catch(error => {
          console.error(`Failed to create project ${projectNum}:`, error.message);
        });
        
        promises.push(promise);
      }
      
      await Promise.all(promises);
    }
    
    console.log(`\nSuccessfully created ${created} test projects!`);
    console.log(`Published: ${Math.floor(created * 2/3)}, Drafts: ${Math.floor(created * 1/3)}`);
    
  } catch (error) {
    console.error('Failed to create test projects:', error);
  } finally {
    await transport.close();
  }
}

// Get count from command line or use default
const count = parseInt(process.argv[2]) || 200;
createTestProjects(count);