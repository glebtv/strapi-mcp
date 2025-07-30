import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

export interface AdminClientOptions {
  useAdminAuth?: boolean;
}

/**
 * Creates an MCP client with specified authentication method
 */
export async function createTestClient(options: AdminClientOptions = {}): Promise<{
  client: Client;
  transport: StdioClientTransport;
}> {
  const { useAdminAuth = true } = options;
  
  // Create a clean environment object with only necessary variables
  const env: Record<string, string | undefined> = {
    ...process.env,
    STRAPI_URL: process.env.STRAPI_URL || 'http://localhost:1337',
    NODE_ENV: process.env.NODE_ENV || 'test',
    PATH: process.env.PATH,
    HOME: process.env.HOME,
  };

  // Configure authentication - admin credentials are required
  if (useAdminAuth && process.env.STRAPI_ADMIN_EMAIL && process.env.STRAPI_ADMIN_PASSWORD) {
    env.STRAPI_ADMIN_EMAIL = process.env.STRAPI_ADMIN_EMAIL;
    env.STRAPI_ADMIN_PASSWORD = process.env.STRAPI_ADMIN_PASSWORD;
  }

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ['dist/index.js'],
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