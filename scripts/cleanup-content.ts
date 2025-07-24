import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function cleanupContent(pluralApiId: string) {
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
    
    console.log(`\nCleaning up ${pluralApiId}...`);
    
    let page = 1;
    let hasMore = true;
    let totalDeleted = 0;
    
    while (hasMore) {
      // Get entries page by page
      const result = await client.callTool({
        name: 'get_entries',
        arguments: {
          pluralApiId: pluralApiId,
          options: JSON.stringify({
            pagination: {
              page: page,
              pageSize: 25
            }
          })
        }
      });
      
      const response = JSON.parse(result.content[0].text);
      const entries = response.data;
      const pagination = response.meta?.pagination;
      
      console.log(`Page ${page}: Found ${entries.length} ${pluralApiId} to delete`);
      
      // Delete each entry
      for (const entry of entries) {
        try {
          await client.callTool({
            name: 'delete_entry',
            arguments: {
              pluralApiId: pluralApiId,
              documentId: entry.documentId
            }
          });
          const name = entry.name || entry.title || entry.documentId;
          console.log(`Deleted: ${name} (${entry.documentId})`);
          totalDeleted++;
        } catch (error) {
          console.error(`Failed to delete ${entry.documentId}:`, error);
        }
      }
      
      // Check if there are more pages
      if (pagination && pagination.page < pagination.pageCount) {
        page++;
      } else {
        hasMore = false;
      }
    }
    
    console.log(`\nCleanup complete! Total ${pluralApiId} deleted: ${totalDeleted}`);
  } catch (error) {
    console.error('Cleanup failed:', error);
  } finally {
    await transport.close();
  }
}

// Get content type from command line argument
const contentType = process.argv[2];

if (!contentType) {
  console.error('Please provide a plural API ID as argument');
  console.error('Example: npx tsx scripts/cleanup-content.ts projects');
  console.error('Example: npx tsx scripts/cleanup-content.ts technologies');
  process.exit(1);
}

cleanupContent(contentType);