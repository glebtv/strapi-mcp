import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

describe('Strapi 5 Filter Operators', () => {
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
      name: 'strapi5-filters-test',
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
      testDocumentIds.push(JSON.parse(result.content[0].text).documentId);
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

  it('should support $contains filter', async () => {
    const result = await client.callTool({
      name: 'get_entries',
      arguments: {
        pluralApiId: 'projects',
        options: JSON.stringify({
          filters: {
            name: {
              $contains: 'Beta'
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
    
    expect(ourResults).toHaveLength(1);
    expect(ourResults[0].name).toContain('Beta Project');
  });

  it('should support $in filter', async () => {
    const result = await client.callTool({
      name: 'get_entries',
      arguments: {
        pluralApiId: 'projects',
        options: JSON.stringify({
          filters: {
            name: {
              $in: [testProjectNames[0], testProjectNames[2]] // Alpha and Gamma
            }
          }
        })
      }
    });

    const response = JSON.parse(result.content[0].text);
    expect(response.data).toHaveLength(2);
    const names = response.data.map((p: any) => p.name);
    expect(names).toContain(testProjectNames[0]); // Alpha
    expect(names).toContain(testProjectNames[2]); // Gamma
  });
});