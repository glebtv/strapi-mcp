const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

async function test() {
  // Load test credentials
  const testTokens = require('../test-tokens.json');
  
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['dist/index.js'],
    env: {
      ...process.env,
      STRAPI_URL: testTokens.strapiUrl,
      STRAPI_ADMIN_EMAIL: testTokens.adminEmail,
      STRAPI_ADMIN_PASSWORD: testTokens.adminPassword
    }
  });

  const client = new Client({
    name: 'test',
    version: '1.0.0'
  }, { capabilities: {} });

  try {
    await client.connect(transport);
    
    console.log('Testing list_content_types...');
    const result = await client.callTool({
      name: 'list_content_types',
      arguments: {}
    });
    
    console.log('Raw result:', JSON.stringify(result, null, 2));
    const parsed = JSON.parse(result.content[0].text);
    console.log('Parsed content:', JSON.stringify(parsed, null, 2));
    console.log('Is array?', Array.isArray(parsed));
    console.log('Has data property?', parsed.hasOwnProperty('data'));
    console.log('Is data array?', Array.isArray(parsed.data));
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await transport.close();
  }
}

test().catch(console.error);