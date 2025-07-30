// Jest test - describe, it, expect, beforeAll, afterAll are globals
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { getSharedClient } from './helpers/shared-client.js';

describe('Strapi 5 Filter Operators', () => {
  let client: Client;
  let testDocumentIds: string[] = [];
  let testProjectNames: string[] = [];

  beforeAll(async () => {
    client = await getSharedClient();
    
    // Reset arrays to ensure clean state
    testDocumentIds = [];
    testProjectNames = [];
    
    // Use the new delete_all_entries tool for complete cleanup
    console.log('Cleaning up ALL existing projects...');
    const deleteResult = await client.callTool({
      name: 'delete_all_entries',
      arguments: {
        pluralApiId: 'api::project.project',
        confirmDeletion: true
      }
    });
    
    const deleteResponse = JSON.parse(deleteResult.content[0].text);
    console.log(`Deleted ${deleteResponse.deletedCount} existing projects`);
    
    // Wait after cleanup to ensure deletions are processed
    if (deleteResponse.deletedCount > 0) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // Create test entries with different names
    testProjectNames = [
      'Alpha Project',
      'Beta Testing Project', 
      'Gamma Development',
      'Delta Project Test'
    ];
    
    for (const name of testProjectNames) {
      const result = await client.callTool({
        name: 'create_entry',
        arguments: {
          contentType: 'api::project.project',
          pluralApiId: 'projects',
          data: { 
            name,
            description: 'Test project for filters'
          }
        }
      });
      const created = JSON.parse(result.content[0].text);
      console.log(`Created project "${name}" with ID:`, created.documentId);
      testDocumentIds.push(created.documentId);
    }
    
    console.log('All created test project IDs:', testDocumentIds);
    
    // Wait a bit for Strapi to index the new entries
    await new Promise(resolve => setTimeout(resolve, 2000));
  }, 60000);
  
  afterAll(async () => {
    // Clean up ALL projects again to ensure clean state for other tests
    console.log('Cleaning up after tests...');
    const deleteResult = await client.callTool({
      name: 'delete_all_entries',
      arguments: {
        pluralApiId: 'api::project.project',
        confirmDeletion: true
      }
    });
    
    const deleteResponse = JSON.parse(deleteResult.content[0].text);
    console.log(`Cleanup complete: deleted ${deleteResponse.deletedCount} projects`);
  }, 60000);

  it('should support $contains filter', async () => {
    // First test - get ALL entries to see what we have
    const allResult = await client.callTool({
      name: 'get_entries',
      arguments: {
        pluralApiId: 'api::project.project',
        options: JSON.stringify({
          pagination: { pageSize: 100 }
        })
      }
    });
    const allProjects = JSON.parse(allResult.content[0].text);
    console.log('Total projects found:', allProjects.data.length);
    console.log('First 3 projects:', allProjects.data.slice(0, 3).map((p: any) => ({ 
      name: p.name, 
      id: p.documentId,
      description: p.description
    })));
    const ourProjects = allProjects.data.filter((p: any) => 
      testDocumentIds.includes(p.documentId)
    );
    console.log('All our test projects:', ourProjects.map((p: any) => p.name));
    
    // Content-manager API uses the same filter format as shown in the curl example
    const result = await client.callTool({
      name: 'get_entries',
      arguments: {
        pluralApiId: 'api::project.project',
        options: JSON.stringify({
          filters: {
            $and: [{
              name: {
                $contains: 'Project'
              }
            }]
          }
        })
      }
    });

    const response = JSON.parse(result.content[0].text);
    console.log('Filter response count:', response.data.length);
    console.log('Our test project IDs:', testDocumentIds);
    console.log('Test project names:', testProjectNames);
    
    // Filter to only our test entries to avoid issues with other tests running in parallel
    const ourResults = response.data.filter((item: any) => 
      testDocumentIds.includes(item.documentId)
    );
    console.log('Our matching results:', ourResults.map((r: any) => ({ name: r.name, id: r.documentId })));
    
    expect(ourResults).toHaveLength(3); // Alpha Project, Beta Testing Project, Delta Project Test
    const names = ourResults.map((p: any) => p.name);
    expect(names).toContain(testProjectNames[0]); // Alpha Project
    expect(names).toContain(testProjectNames[3]); // Delta Project Test
  }, 60000);

  it('should support $in filter', async () => {
    const result = await client.callTool({
      name: 'get_entries', 
      arguments: {
        pluralApiId: 'api::project.project',
        options: JSON.stringify({
          filters: {
            name: {
              $in: [testProjectNames[0], testProjectNames[2]] // Alpha Project, Gamma Development
            }
          }
        })
      }
    });

    const response = JSON.parse(result.content[0].text);
    
    // Filter to only our test entries
    const ourResults = response.data.filter((item: any) => 
      testDocumentIds.includes(item.documentId)
    );
    
    expect(ourResults).toHaveLength(2);
    const names = ourResults.map((p: any) => p.name);
    expect(names).toContain(testProjectNames[0]); // Alpha
    expect(names).toContain(testProjectNames[2]); // Gamma
  }, 60000);
});