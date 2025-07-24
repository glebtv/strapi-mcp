import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import dotenv from 'dotenv';

dotenv.config();

console.log('Environment check:');
console.log('- STRAPI_API_TOKEN:', process.env.STRAPI_API_TOKEN ? 'Set' : 'Not set');
console.log('- STRAPI_ADMIN_EMAIL:', process.env.STRAPI_ADMIN_EMAIL);
console.log('- STRAPI_ADMIN_PASSWORD:', process.env.STRAPI_ADMIN_PASSWORD ? 'Set' : 'Not set');

const transport = new StdioClientTransport({
  command: 'node',
  args: ['build/index.js'],
  env: process.env
});

const client = new Client({
  name: 'test-client',
  version: '1.0.0'
}, {
  capabilities: {}
});

await client.connect(transport);

try {
  // Try listing content types
  const result = await client.callTool({
    name: 'list_content_types',
    arguments: {}
  });
  
  console.log('\nContent types retrieved successfully');
  const contentTypes = JSON.parse(result.content[0].text);
  console.log('Number of content types:', contentTypes.length);
  
} catch (error) {
  console.error('\nError:', error.message);
} finally {
  await transport.close();
}