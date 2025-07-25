import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

export interface AdminClientOptions {
  useAdminAuth?: boolean;
  useApiToken?: boolean;
}

/**
 * Creates an MCP client with specified authentication method
 */
export async function createTestClient(options: AdminClientOptions = {}): Promise<{
  client: Client;
  transport: StdioClientTransport;
}> {
  const { useAdminAuth = false, useApiToken = true } = options;
  
  const env: Record<string, any> = {
    ...process.env,
    STRAPI_URL: process.env.STRAPI_URL,
  };

  // Configure authentication based on options
  if (useAdminAuth) {
    env.STRAPI_ADMIN_EMAIL = process.env.STRAPI_ADMIN_EMAIL;
    env.STRAPI_ADMIN_PASSWORD = process.env.STRAPI_ADMIN_PASSWORD;
  } else {
    delete env.STRAPI_ADMIN_EMAIL;
    delete env.STRAPI_ADMIN_PASSWORD;
  }

  if (useApiToken) {
    env.STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN;
  } else {
    delete env.STRAPI_API_TOKEN;
  }

  const transport = new StdioClientTransport({
    command: 'node',
    args: ['build/index.js'],
    env
  });

  const client = new Client({
    name: 'test-client',
    version: '1.0.0'
  }, {
    capabilities: {}
  });

  await client.connect(transport);

  return { client, transport };
}

/**
 * Closes a test client and its transport
 */
export async function closeTestClient(transport: StdioClientTransport): Promise<void> {
  if (transport) {
    await transport.close();
  }
}

/**
 * Helper to parse tool response
 */
export function parseToolResponse(result: any): any {
  return JSON.parse(result.content[0].text);
}