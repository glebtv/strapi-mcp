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
    
    // Clean up existing projects
    console.log('Cleaning up existing projects...');
    const existingResult = await client.callTool({
      name: 'get_entries',
      arguments: {
        contentTypeUid: 'api::project.project',
        pagination: { pageSize: 100 }
      }
    });
    const existingProjects = JSON.parse(existingResult.content[0].text);
    
    for (const project of existingProjects.data || []) {
      await client.callTool({
        name: 'delete_entry',
        arguments: {
          contentTypeUid: 'api::project.project',
          documentId: project.documentId
        }
      });
    }
    
    if (existingProjects.data?.length > 0) {
      console.log(`Deleted ${existingProjects.data.length} existing projects`);
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
          contentTypeUid: 'api::project.project',
        publish: false,
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
    // Clean up test projects
    console.log('Cleaning up after tests...');
    for (const documentId of testDocumentIds) {
      try {
        await client.callTool({
          name: 'delete_entry',
          arguments: {
            contentTypeUid: 'api::project.project',
            documentId
          }
        });
      } catch (error) {
        // Ignore errors if already deleted
      }
    }
    console.log(`Cleanup complete: deleted ${testDocumentIds.length} test projects`);
  }, 60000);

  it('should support $contains filter', async () => {
    // First test - get ALL entries to see what we have
    const allResult = await client.callTool({
      name: 'get_entries',
      arguments: {
        contentTypeUid: 'api::project.project',
        pagination: { pageSize: 100 }
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
        contentTypeUid: 'api::project.project',
        filters: {
          $and: [{
            name: {
              $contains: 'Project'
            }
          }]
        }
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
    // Strapi v5 $in filter requires the array format with $and wrapper
    const result = await client.callTool({
      name: 'get_entries', 
      arguments: {
        contentTypeUid: 'api::project.project',
        filters: {
          $and: [{
            name: {
              $in: [testProjectNames[0], testProjectNames[2]] // Alpha Project, Gamma Development
            }
          }]
        }
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