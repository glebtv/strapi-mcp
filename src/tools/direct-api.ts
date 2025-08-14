import { z } from 'zod';
import { StrapiClient } from '../strapi-client.js';
import { Tool } from './types.js';

export function directApiTool(client: StrapiClient): Tool {
  return {
    name: 'strapi_rest',
    description: 'Executes direct REST API requests against Strapi endpoints for advanced use cases.',
    inputSchema: z.object({
      endpoint: z.string().describe('API endpoint (e.g., "api/articles")'),
      method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']).optional().default('GET').describe('HTTP method'),
      params: z.record(z.any()).optional().describe('Query parameters for GET requests. For dynamic zones: {"populate": {"sections": {"populate": "*"}}}'),
      body: z.record(z.any()).optional().describe('Request body for POST/PUT requests'),
      authenticated: z.boolean().optional().default(false).describe('Whether to include authentication token (true) or test public access (false)')
    }),
    execute: async (args) => {
      return await client.strapiRest(
        args.endpoint,
        args.method || 'GET',
        args.params,
        args.body,
        args.authenticated
      );
    }
  };
}
