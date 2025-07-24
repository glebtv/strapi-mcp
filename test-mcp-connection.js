#\!/usr/bin/env node

import { spawn } from 'child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import chalk from 'chalk';

async function testMCPServer() {
  console.log(chalk.blue.bold('Testing Strapi MCP Server Connection\n'));
  
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['build/index.js'],
    env: process.env
  });

  const client = new Client({
    name: 'strapi-mcp-test',
    version: '1.0.0'
  }, {
    capabilities: {}
  });

  try {
    console.log(chalk.yellow('Connecting to MCP server...'));
    await client.connect(transport);
    console.log(chalk.green('✓ Connected successfully\!\n'));

    // Test listing content types
    console.log(chalk.yellow('Testing list_content_types tool...'));
    const contentTypesResult = await client.callTool({
      name: 'list_content_types',
      arguments: {}
    });
    
    console.log(chalk.green('✓ Content types retrieved:'));
    const contentTypes = JSON.parse(contentTypesResult.content[0].text);
    contentTypes.forEach(ct => {
      console.log(chalk.cyan(`  - ${ct.uid}: ${ct.displayName}`));
    });

    // Test getting entries
    if (contentTypes.length > 0) {
      const firstContentType = contentTypes[0];
      console.log(chalk.yellow(`\nTesting get_entries for ${firstContentType.uid}...`));
      
      try {
        const entriesResult = await client.callTool({
          name: 'get_entries',
          arguments: {
            contentType: firstContentType.uid
          }
        });
        
        const entries = JSON.parse(entriesResult.content[0].text);
        console.log(chalk.green(`✓ Retrieved ${entries.data?.length || 0} entries`));
      } catch (error) {
        console.log(chalk.red(`✗ Failed to get entries: ${error.message}`));
      }
    }

    await transport.close();
    console.log(chalk.blue('\n✓ Test completed successfully\!'));
  } catch (error) {
    console.error(chalk.red('✗ Error:'), error.message);
    await transport.close();
    process.exit(1);
  }
}

testMCPServer();
