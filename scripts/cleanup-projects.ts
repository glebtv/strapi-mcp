import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function cleanupProjects() {
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['build/index.js'],
    env: process.env
  });

  const client = new Client({
    name: 'cleanup-script',
    version: '1.0.0'
  }, {
    capabilities: {}
  });

  try {
    await client.connect(transport);
    
    let hasMore = true;
    let totalDeleted = 0;
    let iteration = 0;
    
    // First, delete all published entries
    console.log('\n=== Cleaning PUBLISHED projects ===');
    while (hasMore) {
      iteration++;
      // Get projects page by page
      const result = await client.callTool({
        name: 'get_entries',
        arguments: {
          pluralApiId: 'projects',
          options: JSON.stringify({
            pagination: {
              page: 1,  // Always fetch page 1 as entries shift after deletion
              pageSize: 25
            },
            status: 'published'
          })
        }
      });
      
      const response = JSON.parse(result.content[0].text);
      const projects = response.data;
      const pagination = response.meta?.pagination;
      
      console.log(`Iteration ${iteration}: Found ${projects.length} projects to delete (Total remaining: ${pagination?.total || '?'})`);
      
      if (projects.length === 0 && pagination?.total > 0) {
        console.log('Warning: No projects returned but total indicates there are entries.');
      }
      
      // Delete each project
      for (const project of projects) {
        try {
          await client.callTool({
            name: 'delete_entry',
            arguments: {
              pluralApiId: 'projects',
              documentId: project.documentId
            }
          });
          console.log(`Deleted project: ${project.name} (${project.documentId})`);
          totalDeleted++;
        } catch (error) {
          console.error(`Failed to delete project ${project.documentId}:`, error);
        }
      }
      
      // Always stay on page 1 when deleting, as entries shift after deletion
      // Continue until no more entries are found
      hasMore = projects.length > 0;
    }
    
    // Now delete all draft entries
    console.log('\n=== Cleaning DRAFT projects ===');
    hasMore = true;
    iteration = 0;
    
    while (hasMore) {
      iteration++;
      // Get draft projects page by page
      const result = await client.callTool({
        name: 'get_entries',
        arguments: {
          pluralApiId: 'projects',
          options: JSON.stringify({
            pagination: {
              page: 1,  // Always fetch page 1 as entries shift after deletion
              pageSize: 25
            },
            status: 'draft'
          })
        }
      });
      
      const response = JSON.parse(result.content[0].text);
      const projects = response.data;
      const pagination = response.meta?.pagination;
      
      console.log(`Iteration ${iteration}: Found ${projects.length} draft projects to delete (Total drafts remaining: ${pagination?.total || '?'})`);
      
      // Delete each draft project
      for (const project of projects) {
        try {
          await client.callTool({
            name: 'delete_entry',
            arguments: {
              pluralApiId: 'projects',
              documentId: project.documentId
            }
          });
          console.log(`Deleted draft: ${project.name} (${project.documentId})`);
          totalDeleted++;
        } catch (error) {
          console.error(`Failed to delete draft ${project.documentId}:`, error);
        }
      }
      
      // Always stay on page 1 when deleting, as entries shift after deletion
      // Continue until no more entries are found
      hasMore = projects.length > 0;
    }
    
    console.log(`\nCleanup complete! Total projects deleted: ${totalDeleted}`);
  } catch (error) {
    console.error('Cleanup failed:', error);
  } finally {
    await transport.close();
  }
}

cleanupProjects();