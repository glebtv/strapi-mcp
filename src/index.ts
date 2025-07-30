#!/usr/bin/env node

process.on("unhandledRejection", (reason, promise) => {
  console.error("[FATAL] Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("[FATAL] Uncaught Exception:", error);
  process.exit(1);
});

/**
 * Strapi MCP Server
 *
 * This MCP server integrates with any Strapi CMS instance to provide:
 * - Access to Strapi content types as resources
 * - Tools to create and update content types in Strapi
 * - Tools to manage content entries (create, read, update, delete)
 * - Support for Strapi in development mode
 *
 * This server is designed to be generic and work with any Strapi instance,
 * regardless of the content types defined in that instance.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { config, validateConfig } from "./config/index.js";
import { setupHandlers } from "./server/handlers.js";
import { logger } from "./utils/logger.js";

// Debug logging for test environment
if (process.env.NODE_ENV === "test") {
  logger.debug(`[Startup] Debug - Admin Email: ${config.strapi.adminEmail ? "Set" : "Not set"}`);
  logger.debug(
    `[Startup] Debug - Admin Password: ${config.strapi.adminPassword ? "Set" : "Not set"}`
  );
}

// Validate configuration on startup
validateConfig();

// Create an MCP server with capabilities for resources and tools
const server = new Server(
  {
    name: config.server.name,
    version: config.server.version,
  },
  {
    capabilities: {
      resources: {},
      tools: {},
      strapi: {
        security: {
          write_protection: {
            policy: "ADMIN_CREDENTIALS_REQUIRED",
            description: "All operations require admin credentials",
            protected_operations: [
              "POST /api/* (Create)",
              "PUT /api/* (Update)",
              "DELETE /api/* (Delete)",
              "POST /api/upload (Media Upload)",
              "GET /api/* (Read)",
            ],
            requirements: [
              "Valid admin email and password",
              "Admin JWT token authentication",
              "Full admin access to Strapi backend",
            ],
          },
        },
        api_patterns: {
          rest: {
            collection: "GET /api/{pluralName}",
            single: "GET /api/{pluralName}/{documentId}",
            create: "POST /api/{pluralName}",
            update: "PUT /api/{pluralName}/{documentId}",
            delete: "DELETE /api/{pluralName}/{documentId}",
          },
        },
        common_errors: {
          "400": ["Missing required fields", "Invalid data format", "Validation errors"],
          "401": ["Invalid or expired admin JWT token", "Admin credentials incorrect"],
          "403": ["Admin account lacks necessary permissions"],
          "404": ["Resource not found", "Invalid endpoint path"],
        },
      },
    },
  }
);

// Setup all request handlers
setupHandlers(server);

/**
 * Start the server using stdio transport.
 */
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("[Error] Server error:", error);
  process.exit(1);
});
