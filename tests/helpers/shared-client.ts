import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

let sharedClient: Client | null = null;
let sharedTransport: StdioClientTransport | null = null;
let connectionPromise: Promise<{ client: Client; transport: StdioClientTransport }> | null = null;

/**
 * Get or create a shared MCP client instance
 * This ensures we only create one server instance and login once
 */
export async function getSharedClient(): Promise<Client> {
  if (sharedClient) {
    return sharedClient;
  }

  // If already connecting, wait for that
  if (connectionPromise) {
    const result = await connectionPromise;
    return result.client;
  }

  // Create new connection
  connectionPromise = createSharedConnection();
  const result = await connectionPromise;
  return result.client;
}

async function createSharedConnection(): Promise<{ client: Client; transport: StdioClientTransport }> {
  try {
    // Create a clean environment object with only necessary variables
    const env: Record<string, string | undefined> = {
      ...process.env,
      STRAPI_URL: process.env.STRAPI_URL || 'http://localhost:1337',
      STRAPI_DEV_MODE: 'true', // Enable dev mode for tests
      NODE_ENV: process.env.NODE_ENV || 'test',
      PATH: process.env.PATH,
      HOME: process.env.HOME,
    };

    // Always use admin credentials
    if (process.env.STRAPI_ADMIN_EMAIL && process.env.STRAPI_ADMIN_PASSWORD) {
      env.STRAPI_ADMIN_EMAIL = process.env.STRAPI_ADMIN_EMAIL;
      env.STRAPI_ADMIN_PASSWORD = process.env.STRAPI_ADMIN_PASSWORD;
    } else {
      throw new Error('Admin credentials are required for tests');
    }

    sharedTransport = new StdioClientTransport({
      command: process.execPath,
      args: ['dist/index.js'],
      env
    });

    sharedClient = new Client({
      name: 'shared-test-client',
      version: '1.0.0'
    }, {
      capabilities: {}
    });

    await sharedClient.connect(sharedTransport);

    return { client: sharedClient, transport: sharedTransport };
  } catch (error) {
    // Reset on error
    sharedClient = null;
    sharedTransport = null;
    connectionPromise = null;
    throw error;
  }
}

/**
 * Close the shared client instance
 * Should be called in global teardown
 */
export async function closeSharedClient(): Promise<void> {
  if (sharedTransport) {
    await sharedTransport.close();
    sharedTransport = null;
    sharedClient = null;
    connectionPromise = null;
  }
}

/**
 * Helper to parse tool response
 */
export function parseToolResponse(result: any): any {
  return JSON.parse(result.content[0].text);
}