import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

describe('Strapi 5 Complex Filters', () => {
  let client: Client;
  let transport: StdioClientTransport;
  let testDocumentIds: string[] = [];
  let testProjectNames: string[] = [];

  beforeAll(async () => {
    transport = new StdioClientTransport({
      command: 'node',
      args: ['build/index.js'],
      env: process.env
    });

    client = new Client({
      name: 'strapi5-complex-filters-test',
      version: '1.0.0'
    }, {
      capabilities: {}
    });

    await client.connect(transport);

    // Create test data with unique timestamps to avoid slug conflicts
    const timestamp = Date.now();
    const projects = [
      { name: `Alpha Project ${timestamp}`, description: 'First project' },
      { name: `Beta Project ${timestamp}`, description: 'Second project' },
      { name: `Gamma Project ${timestamp}`, description: 'Third project' }
    ];

    testProjectNames = projects.map(p => p.name);

    for (const project of projects) {
      const result = await client.callTool({
        name: 'create_entry',
        arguments: {
          contentType: 'api::project.project',
          pluralApiId: 'projects',
          data: project
        }
      });
      const documentId = JSON.parse(result.content[0].text).documentId;
      testDocumentIds.push(documentId);
      
      // Publish the entry so it's visible through the public API
      await client.callTool({
        name: 'publish_entry',
        arguments: {
          pluralApiId: 'projects',
          documentId: documentId
        }
      });
    }
  });

  afterAll(async () => {
    // Cleanup
    for (const documentId of testDocumentIds) {
      try {
        await client.callTool({
          name: 'delete_entry',
          arguments: {
            pluralApiId: 'projects',
            documentId
          }
        });
      } catch (e) {}
    }

    if (transport) {
      await transport.close();
    }
  });

  it('should support complex filters with REST API', async () => {
    // First, get all test projects to ensure they exist
    const allResult = await client.callTool({
      name: 'get_entries',
      arguments: {
        pluralApiId: 'projects',
        options: JSON.stringify({
          filters: {
            documentId: {
              $in: testDocumentIds
            }
          }
        })
      }
    });
    
    const allProjects = JSON.parse(allResult.content[0].text);
    
    // Verify our test data exists
    expect(allProjects.data).toHaveLength(3);
    
    // Test complex filters - Strapi should handle $or filters
    const filterParams = {
      filters: {
        $or: [
          {
            name: {
              $contains: testProjectNames[0].split(' ')[0] // 'Alpha'
            }
          },
          {
            description: {
              $contains: 'Third'
            }
          }
        ]
      }
    };
    
    console.log('Filter params:', JSON.stringify(filterParams, null, 2));
    console.log('Test project names:', testProjectNames);
    console.log('Looking for name containing:', testProjectNames[0].split(' ')[0]);
    
    // Use get_entries instead of strapi_rest to avoid Content Manager API conversion
    // which might not support the same filter syntax
    const result = await client.callTool({
      name: 'get_entries',
      arguments: {
        pluralApiId: 'projects',
        options: JSON.stringify(filterParams)
      }
    });

    const response = JSON.parse(result.content[0].text);
    
    console.log('Response data count:', response.data.length);
    console.log('First few results:', response.data.slice(0, 3).map((item: any) => ({
      name: item.name,
      description: item.description,
      documentId: item.documentId
    })));
    
    // Since we can't filter by our specific test documentIds in the same query,
    // we'll verify that the results contain at least our expected items
    const ourResults = response.data.filter((item: any) => 
      testDocumentIds.includes(item.documentId)
    );
    
    console.log('Our test document IDs:', testDocumentIds);
    console.log('Filtered results count:', ourResults.length);
    console.log('Filtered results:', ourResults.map((item: any) => ({
      name: item.name,
      description: item.description
    })));
    
    expect(ourResults).toHaveLength(2);
    
    // Verify the correct items were found
    const foundNames = ourResults.map((item: any) => item.name);
    expect(foundNames.some((name: string) => name.includes('Alpha'))).toBe(true);
    expect(foundNames.some((name: string) => name === testProjectNames[2])).toBe(true); // Gamma has "Third" in description
  });
});