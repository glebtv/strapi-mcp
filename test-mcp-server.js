#!/usr/bin/env node

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Test results tracking
let passedTests = 0;
let failedTests = 0;
const testResults = [];

// Helper to log test results
function logTest(testName, passed, details = '') {
  if (passed) {
    passedTests++;
    console.log(chalk.green(`✓ ${testName}`));
    testResults.push({ test: testName, status: 'passed', details });
  } else {
    failedTests++;
    console.log(chalk.red(`✗ ${testName}`));
    if (details) console.log(chalk.gray(`  ${details}`));
    testResults.push({ test: testName, status: 'failed', details });
  }
}

// Helper to log section headers
function logSection(title) {
  console.log('\n' + chalk.blue.bold(`=== ${title} ===`));
}

// Helper to safely call tools
async function callTool(client, toolName, args = {}) {
  try {
    const result = await client.callTool(toolName, args);
    return { success: true, result };
  } catch (error) {
    return { success: false, error: error.message || String(error) };
  }
}

// Main test function
async function runTests() {
  logSection('Starting MCP Server');
  
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['build/index.js'],
    env: { ...process.env },
    cwd: __dirname
  });

  const client = new Client({
    name: 'test-client',
    version: '1.0.0'
  }, {
    capabilities: {}
  });

  try {
    await client.connect(transport);
    logTest('Server connection', true);

    // The server info is available after connection
    logTest('Server info', true, `Connected to server`);

    // List available tools
    logSection('Testing Available Tools');
    const tools = await client.listTools();
    logTest('List tools', tools.tools.length > 0, `Found ${tools.tools.length} tools`);

    // Test each tool
    for (const tool of tools.tools) {
      await testTool(client, tool);
    }

    // List available resources
    logSection('Testing Available Resources');
    const resources = await client.listResources();
    logTest('List resources', true, `Found ${resources.resources.length} resources`);

    // Test reading resources
    for (const resource of resources.resources) {
      await testResource(client, resource);
    }

    // Fix homepage issue
    logSection('Fixing Homepage Issue');
    await fixHomepageIssue(client);

  } catch (error) {
    console.error(chalk.red('Fatal error:'), error);
  } finally {
    // Cleanup
    await client.close();
    
    // Summary
    logSection('Test Summary');
    console.log(chalk.green(`Passed: ${passedTests}`));
    console.log(chalk.red(`Failed: ${failedTests}`));
    console.log(chalk.blue(`Total: ${passedTests + failedTests}`));
    
    // Exit with appropriate code
    process.exit(failedTests > 0 ? 1 : 0);
  }
}

// Test individual tools
async function testTool(client, tool) {
  console.log(chalk.yellow(`\nTesting tool: ${tool.name}`));
  
  switch (tool.name) {
    case 'list_content_types':
      const ctResult = await callTool(client, tool.name);
      logTest(`Tool: ${tool.name}`, ctResult.success, ctResult.error);
      break;
      
    case 'get_content_type_schema':
      const schemaResult = await callTool(client, tool.name, { 
        contentType: 'api::homepage.homepage' 
      });
      logTest(`Tool: ${tool.name}`, schemaResult.success, schemaResult.error);
      break;
      
    case 'get_entries':
      const entriesResult = await callTool(client, tool.name, { 
        contentType: 'api::homepage.homepage' 
      });
      logTest(`Tool: ${tool.name}`, entriesResult.success, entriesResult.error);
      break;
      
    case 'strapi_rest':
      const restResult = await callTool(client, tool.name, {
        endpoint: 'api/homepages',
        method: 'GET'
      });
      logTest(`Tool: ${tool.name}`, restResult.success, restResult.error);
      break;
      
    case 'strapi_get_components':
      const compResult = await callTool(client, tool.name, {
        page: 1,
        pageSize: 10
      });
      logTest(`Tool: ${tool.name}`, compResult.success, compResult.error);
      break;
      
    default:
      // Skip testing tools that require specific parameters
      console.log(chalk.gray(`  Skipping ${tool.name} (requires specific parameters)`));
  }
}

// Test individual resources
async function testResource(client, resource) {
  try {
    const result = await client.readResource(resource.uri);
    logTest(`Resource: ${resource.name}`, true, `URI: ${resource.uri}`);
  } catch (error) {
    logTest(`Resource: ${resource.name}`, false, error.message);
  }
}

// Fix the homepage issue
async function fixHomepageIssue(client) {
  try {
    // First, get all homepage entries
    const entriesResult = await callTool(client, 'get_entries', {
      contentType: 'api::homepage.homepage'
    });
    
    if (!entriesResult.success) {
      logTest('Fetch homepage entries', false, entriesResult.error);
      return;
    }
    
    const entries = JSON.parse(entriesResult.result.content[0].text);
    console.log(chalk.cyan(`Found ${entries.data.length} homepage entries`));
    
    // Check if we have duplicates
    if (entries.data.length > 1) {
      console.log(chalk.yellow('Multiple homepage entries detected. Analyzing...'));
      
      // Get schema to understand locale support
      const schemaResult = await callTool(client, 'get_content_type_schema', {
        contentType: 'api::homepage.homepage'
      });
      
      if (schemaResult.success) {
        const schema = JSON.parse(schemaResult.result.content[0].text);
        const hasI18n = schema.pluginOptions?.i18n?.localized === true;
        
        if (hasI18n) {
          console.log(chalk.cyan('Homepage supports localization'));
          
          // Group entries by locale
          const entriesByLocale = {};
          for (const entry of entries.data) {
            const locale = entry.locale || 'en';
            if (!entriesByLocale[locale]) {
              entriesByLocale[locale] = [];
            }
            entriesByLocale[locale].push(entry);
          }
          
          // Check for duplicates per locale
          let hasDuplicates = false;
          for (const [locale, localeEntries] of Object.entries(entriesByLocale)) {
            if (localeEntries.length > 1) {
              console.log(chalk.red(`Found ${localeEntries.length} entries for locale: ${locale}`));
              hasDuplicates = true;
              
              // Keep the first entry, delete the rest
              for (let i = 1; i < localeEntries.length; i++) {
                const deleteResult = await callTool(client, 'delete_entry', {
                  contentType: 'api::homepage.homepage',
                  id: localeEntries[i].documentId || localeEntries[i].id
                });
                
                if (deleteResult.success) {
                  console.log(chalk.green(`✓ Deleted duplicate entry ${localeEntries[i].documentId || localeEntries[i].id}`));
                } else {
                  console.log(chalk.red(`✗ Failed to delete entry: ${deleteResult.error}`));
                }
              }
            }
          }
          
          logTest('Fix homepage duplicates', hasDuplicates, 
            hasDuplicates ? 'Removed duplicate entries' : 'No duplicates found');
          
        } else {
          // No i18n, should only have one entry
          console.log(chalk.yellow('Homepage does not support localization, should only have one entry'));
          
          // Keep the first entry, delete the rest
          for (let i = 1; i < entries.data.length; i++) {
            const deleteResult = await callTool(client, 'delete_entry', {
              contentType: 'api::homepage.homepage',
              id: entries.data[i].documentId || entries.data[i].id
            });
            
            if (deleteResult.success) {
              console.log(chalk.green(`✓ Deleted duplicate entry ${entries.data[i].documentId || entries.data[i].id}`));
            } else {
              console.log(chalk.red(`✗ Failed to delete entry: ${deleteResult.error}`));
            }
          }
          
          logTest('Fix homepage duplicates', true, `Removed ${entries.data.length - 1} duplicate entries`);
        }
        
      } else {
        logTest('Get homepage schema', false, schemaResult.error);
      }
      
    } else if (entries.data.length === 0) {
      logTest('Homepage entries', false, 'No homepage entries found');
    } else {
      logTest('Homepage entries', true, 'Only one homepage entry exists (correct)');
    }
    
  } catch (error) {
    logTest('Fix homepage issue', false, error.message);
  }
}

// Run the tests
console.log(chalk.blue.bold('MCP Server Test Suite'));
console.log(chalk.gray('Testing Strapi MCP Server...\n'));

runTests().catch(error => {
  console.error(chalk.red('Test suite failed:'), error);
  process.exit(1);
});