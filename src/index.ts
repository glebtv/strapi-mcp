#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import dotenv from 'dotenv';
import { StrapiClient } from './strapi-client.js';
import { StrapiConfig } from './types.js';
import { getTools } from './tools/index.js';

// Load environment variables
dotenv.config();

// Validate environment variables
const STRAPI_URL = process.env.STRAPI_URL || "http://localhost:1337";
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN;
const STRAPI_ADMIN_EMAIL = process.env.STRAPI_ADMIN_EMAIL;
const STRAPI_ADMIN_PASSWORD = process.env.STRAPI_ADMIN_PASSWORD;
const STRAPI_DEV_MODE = process.env.STRAPI_DEV_MODE === "true";

// Validate authentication
if (!STRAPI_API_TOKEN && !(STRAPI_ADMIN_EMAIL && STRAPI_ADMIN_PASSWORD)) {
  console.error("[Error] Missing required authentication. Please provide either STRAPI_API_TOKEN or both STRAPI_ADMIN_EMAIL and STRAPI_ADMIN_PASSWORD");
  process.exit(1);
}

// Validate placeholder tokens
if (STRAPI_API_TOKEN && (STRAPI_API_TOKEN === "strapi_token" || STRAPI_API_TOKEN === "your-api-token-here" || STRAPI_API_TOKEN.includes("placeholder"))) {
  console.error("[Error] STRAPI_API_TOKEN appears to be a placeholder value. Please provide a real API token.");
  process.exit(1);
}

// Log configuration
console.error(`[Setup] Connecting to Strapi at ${STRAPI_URL}`);
console.error(`[Setup] Development mode: ${STRAPI_DEV_MODE ? "enabled" : "disabled"}`);
console.error(`[Setup] Authentication: ${STRAPI_ADMIN_EMAIL ? "Admin credentials" : "API token"}`);

// Create Strapi client
const strapiConfig: StrapiConfig = {
  url: STRAPI_URL,
  adminEmail: STRAPI_ADMIN_EMAIL,
  adminPassword: STRAPI_ADMIN_PASSWORD,
  apiToken: STRAPI_API_TOKEN,
  devMode: STRAPI_DEV_MODE
};

const strapiClient = new StrapiClient(strapiConfig);

// Create MCP server
const server = new Server(
  {
    name: "strapi-mcp",
    version: "0.3.0",
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

/**
 * Handle listing available resources
 */
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  try {
    // Fetch all content types
    const contentTypes = await strapiClient.listContentTypes();
    
    // Create resources for content types
    const resources = contentTypes.map(ct => ({
      uri: `strapi://content-type/${ct.pluralApiId}`,
      mimeType: "application/json",
      name: ct.info.displayName,
      description: ct.info.description || `${ct.info.displayName} content type`
    }));
    
    return { resources };
  } catch (error) {
    console.error("[Error] Failed to list resources:", error);
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
    
    // Parse URI: strapi://content-type/{pluralApiId}[/{documentId}][?filters=...]
    const match = uri.match(/^strapi:\/\/content-type\/([^\/\?]+)(?:\/([^\/\?]+))?(?:\?(.+))?$/);
    if (!match) {
      throw new McpError(ErrorCode.InvalidRequest, `Invalid URI format: ${uri}`);
    }
    
    const [, pluralApiId, documentId, queryString] = match;
    
    // Parse query parameters
    let options: any = {};
    if (queryString) {
      const params = new URLSearchParams(queryString);
      for (const [key, value] of params) {
        try {
          options[key] = JSON.parse(value);
        } catch {
          options[key] = value;
        }
      }
    }
    
    // Fetch content
    let content;
    if (documentId) {
      // Get specific entry
      content = await strapiClient.getEntry(pluralApiId, documentId, options);
    } else {
      // Get all entries
      content = await strapiClient.getEntries(pluralApiId, options);
    }
    
    return {
      contents: [{
        uri,
        mimeType: "application/json",
        text: JSON.stringify(content, null, 2)
      }]
    };
  } catch (error) {
    console.error("[Error] Failed to read resource:", error);
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
      inputSchema: tool.inputSchema
    }))
  };
});

/**
 * Handle tool execution
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  const tool = tools[name];
  if (!tool) {
    throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
  }
  
  try {
    // Validate arguments
    const validatedArgs = tool.inputSchema.parse(args);
    
    // Execute tool
    const result = await tool.execute(validatedArgs);
    
    return {
      content: [{
        type: "text",
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
    
    console.error(`[Error] Tool ${name} failed:`, error);
    throw new McpError(
      ErrorCode.InternalError,
      `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
});

// Handle errors
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Fatal] Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[Fatal] Uncaught Exception:', error);
  process.exit(1);
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[Server] Strapi MCP server started");
}

main().catch((error) => {
  console.error("[Fatal] Failed to start server:", error);
  process.exit(1);
});