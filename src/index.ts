#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import dotenv from 'dotenv';
import { StrapiClient } from './strapi-client.js';
import { StrapiConfig } from './types.js';
import { getTools } from './tools/index.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Load environment variables
dotenv.config();

// Validate environment variables
const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1337';
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN;
const STRAPI_ADMIN_EMAIL = process.env.STRAPI_ADMIN_EMAIL;
const STRAPI_ADMIN_PASSWORD = process.env.STRAPI_ADMIN_PASSWORD;

// Validate authentication
if (!STRAPI_API_TOKEN && !(STRAPI_ADMIN_EMAIL && STRAPI_ADMIN_PASSWORD)) {
  console.error('[Error] Missing required authentication. Please provide either STRAPI_API_TOKEN or both STRAPI_ADMIN_EMAIL and STRAPI_ADMIN_PASSWORD');
  process.exit(1);
}

// Validate placeholder tokens
if (STRAPI_API_TOKEN && (STRAPI_API_TOKEN === 'strapi_token' || STRAPI_API_TOKEN === 'your-api-token-here' || STRAPI_API_TOKEN.includes('placeholder'))) {
  console.error('[Error] STRAPI_API_TOKEN appears to be a placeholder value. Please provide a real API token.');
  process.exit(1);
}

// Log configuration removed for cleaner test output

// Create Strapi client
const strapiConfig: StrapiConfig = {
  url: STRAPI_URL,
  adminEmail: STRAPI_ADMIN_EMAIL,
  adminPassword: STRAPI_ADMIN_PASSWORD,
  apiToken: STRAPI_API_TOKEN
};

const strapiClient = new StrapiClient(strapiConfig);

// Create MCP server
const server = new Server(
  {
    name: 'strapi-mcp',
    version: '0.4.1',
  },
  {
    capabilities: {
      resources: {},
      tools: {},
    },
  }
);

// Get all tool definitions
const tools = getTools(strapiClient);

// Tool call logging setup
const LOG_DIR = path.join(os.homedir(), '.mcp', 'strapi-mcp-logs');
const LOG_FILE = path.join(LOG_DIR, 'tool-calls.log');

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Log tool call asynchronously to avoid blocking the event loop
async function logToolCall(toolName: string, args: any, result: any, error?: any, duration?: number) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    tool: toolName,
    arguments: args,
    result: error ? undefined : result,
    error: error ? {
      message: error.message || String(error),
      stack: error.stack,
      details: (error as any).details
    } : undefined,
    duration: duration || 0
  };
  
  try {
    // Use promises version to avoid blocking
    await fs.promises.appendFile(LOG_FILE, JSON.stringify(logEntry) + '\n');
  } catch (e) {
    console.error('[Warning] Failed to write to log file:', e);
  }
}

/**
 * Handle listing available resources
 */
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  try {
    // Fetch all content types
    const initData = await strapiClient.listContentTypes();
    const contentTypes = initData.contentTypes || [];
    
    // Filter to only show content types that are displayed in content manager
    // This excludes system/plugin content types that can't be managed
    const manageableContentTypes = contentTypes.filter((ct: any) => ct.isDisplayed === true);
    
    // Create resources for manageable content types
    const resources = manageableContentTypes.map((ct: any) => ({
      uri: `strapi://content-type/${ct.uid}`,
      mimeType: 'application/json',
      name: ct.info.displayName,
      description: ct.info.description || `${ct.info.displayName} content type`
    }));
    
    return { resources };
  } catch (error) {
    console.error('[Error] Failed to list resources:', error);
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to list resources: ${error instanceof Error ? error.message : String(error)}`
    );
  }
});

/**
 * Handle reading resource content
 */
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  try {
    const uri = request.params.uri;
    
    // Parse URI: strapi://content-type/{contentTypeUid}
    const match = uri.match(/^strapi:\/\/content-type\/([^\/\?]+)$/);
    if (!match) {
      throw new McpError(ErrorCode.InvalidRequest, `Invalid URI format: ${uri}`);
    }
    
    const [, contentTypeUid] = match;
    
    // Get all content types to find the schema for this specific type
    const initData = await strapiClient.listContentTypes();
    const contentTypes = initData.contentTypes || [];
    
    // Find the specific content type schema
    const contentTypeSchema = contentTypes.find((ct: any) => ct.uid === contentTypeUid);
    
    if (!contentTypeSchema) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Content type not found: ${contentTypeUid}`
      );
    }
    
    // Return the full schema as the resource content
    return {
      contents: [{
        uri,
        mimeType: 'application/json',
        text: JSON.stringify(contentTypeSchema, null, 2)
      }]
    };
  } catch (error) {
    console.error('[Error] Failed to read resource:', error);
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to read resource: ${error instanceof Error ? error.message : String(error)}`
    );
  }
});

/**
 * Handle listing available tools
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: Object.values(tools).map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: zodToJsonSchema(tool.inputSchema)
    }))
  };
});

/**
 * Handle tool execution
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const startTime = Date.now();
  
  const tool = tools[name];
  if (!tool) {
    throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
  }
  
  try {
    // Validate arguments
    const validatedArgs = tool.inputSchema.parse(args);
    
    // Execute tool
    const result = await tool.execute(validatedArgs);
    
    // Log successful call
    const duration = Date.now() - startTime;
    // Don't await to avoid blocking the response
    logToolCall(name, args, result, undefined, duration).catch(e => 
      console.error('[Warning] Failed to log tool call:', e)
    );
    
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }]
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid arguments: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`
      );
    }
    
    // Log error
    const duration = Date.now() - startTime;
    // Don't await to avoid blocking the response
    logToolCall(name, args, null, error, duration).catch(e => 
      console.error('[Warning] Failed to log tool call error:', e)
    );
    
    console.error(`[Error] Tool ${name} failed:`, error);
    console.error('[Error] Tool arguments:', JSON.stringify(args, null, 2));
    
    // Extract detailed error information
    let errorMessage = error instanceof Error ? error.message : String(error);
    
    // If the error has validation details, format them nicely
    if (error instanceof Error && (error as any).details) {
      const details = (error as any).details;
      
      // Handle Strapi validation errors with nested structure
      if (details.errors && Array.isArray(details.errors)) {
        const formattedErrors = details.errors.map((err: any) => {
          if (err.path && err.message) {
            // Format path array into a readable string
            const pathStr = Array.isArray(err.path) ? err.path.join('.') : err.path;
            // Make it clear if the field should be at root level
            const fieldLocation = pathStr ? `data.${pathStr}` : 'data (root level)';
            return `${fieldLocation}: ${err.message}`;
          }
          return err.message || JSON.stringify(err);
        });
        
        // Check if this is a create_entry or update_entry call to provide more specific help
        const isContentOperation = ['create_entry', 'update_entry'].includes(name);
        const tipMessage = isContentOperation 
          ? '\n\nTip: Use get_content_type_schema first to check ALL required fields. Required fields must be included at the root level of the data object, not nested inside components.'
          : '\n\nTip: Use get_content_type_schema to check which fields are required before creating entries.';
        
        errorMessage = `${errorMessage}\n\nValidation errors:\n- ${formattedErrors.join('\n- ')}${tipMessage}`;
      } else {
        // Fallback for other error structures
        errorMessage = `${errorMessage}\n\nDetails: ${JSON.stringify(details, null, 2)}`;
      }
    }
    
    throw new McpError(
      ErrorCode.InternalError,
      `Tool execution failed: ${errorMessage}`
    );
  }
});

// Handle errors
process.on('unhandledRejection', (reason, _promise) => {
  console.error('[Fatal] Unhandled Rejection:', reason);
  // Exit immediately to prevent inconsistent state
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('[Fatal] Uncaught Exception:', error);
  process.exit(1);
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  // Log startup info to stderr (not stdout which is reserved for JSON-RPC)
  console.error('[INFO] Strapi MCP Server v0.4.1 started');
  console.error(`[INFO] Tool call logs will be written to: ${LOG_FILE}`);
}

main().catch((error) => {
  console.error('[Fatal] Failed to start server:', error);
  process.exit(1);
});