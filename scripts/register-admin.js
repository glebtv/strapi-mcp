#!/usr/bin/env node

/**
 * Script to register the first admin user using the MCP server
 * This replaces the bootstrap function approach
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get admin credentials from environment or use defaults
const adminEmail = process.env.ADMIN_EMAIL || 'admin@ci.local';
const adminPassword = process.env.ADMIN_PASSWORD || 'Admin123456';

console.log(`📋 Registering admin user: ${adminEmail}`);

// Prepare the MCP requests
const initRequest = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "1.0",
    capabilities: {},
    clientInfo: {
      name: "register-admin",
      version: "1.0"
    }
  }
};

const toolRequest = {
  jsonrpc: "2.0",
  id: 2,
  method: "tools/call",
  params: {
    name: "register_first_admin",
    arguments: {
      email: adminEmail,
      password: adminPassword,
      firstname: "Admin",
      lastname: "User"
    }
  }
};

// Set up environment variables for MCP server
const env = {
  ...process.env,
  STRAPI_URL: process.env.STRAPI_URL || 'http://localhost:1337',
  STRAPI_ADMIN_EMAIL: adminEmail,
  STRAPI_ADMIN_PASSWORD: adminPassword,
  LOG_LEVEL: '0' // Only show errors
};

// Spawn the MCP server
const mcpPath = path.join(__dirname, '..', 'build', 'index.js');
const mcp = spawn(process.execPath, [mcpPath], {
  env,
  stdio: ['pipe', 'pipe', 'pipe']
});

let responseData = '';
let stderrData = '';
let initialized = false;
let responses = [];

mcp.stderr.on('data', (data) => {
  stderrData += data.toString();
});

mcp.stdout.on('data', (data) => {
  responseData += data.toString();
  
  // Try to parse complete JSON responses
  const lines = data.toString().split('\n');
  for (const line of lines) {
    if (line.trim() && line.trim().startsWith('{')) {
      try {
        const response = JSON.parse(line);
        responses.push(response);
        
        // If we got the init response, send the tool request
        if (response.id === 1 && response.result) {
          initialized = true;
          mcp.stdin.write(JSON.stringify(toolRequest) + '\n');
        }
        
        // If we got the tool response, process it
        if (response.id === 2) {
          if (response.error) {
            if (response.error.message.includes('already exist') || 
                response.error.message.includes('cannot register a new super admin')) {
              console.log('⚠️  Admin user already exists, skipping creation');
              process.exit(0);
            } else {
              console.error('❌ Failed to register admin:', response.error.message);
              process.exit(1);
            }
          }
          
          if (response.result && response.result.content) {
            console.log('✅ Admin user registered successfully!');
            console.log(`   Email: ${adminEmail}`);
            
            // Parse the result to get user info
            try {
              const resultData = JSON.parse(response.result.content[0].text);
              if (resultData.user && resultData.user.id) {
                console.log(`   User ID: ${resultData.user.id}`);
              }
            } catch (e) {
              // Ignore parsing errors for the result
            }
            
            process.exit(0);
          }
        }
      } catch (e) {
        // Not a complete JSON line yet
      }
    }
  }
});

mcp.on('close', (code) => {
  if (code !== 0) {
    console.error(`❌ MCP server exited with code ${code}`);
    if (stderrData) {
      console.error('Stderr:', stderrData);
    }
    process.exit(1);
  }
  
  if (!initialized) {
    console.error('❌ Failed to initialize MCP connection');
    console.error('Stdout:', responseData);
    console.error('Stderr:', stderrData);
    process.exit(1);
  }
});

// Send the initialization request
mcp.stdin.write(JSON.stringify(initRequest) + '\n');