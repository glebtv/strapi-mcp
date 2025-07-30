import { z } from 'zod';
import { StrapiClient } from '../strapi-client.js';
import { TokenManager } from '../token-manager.js';
import { Tool } from './types.js';

export function apiTokenTools(client: StrapiClient): Tool[] {
  const tokenManager = new TokenManager(client);
  
  return [
    {
      name: 'create_api_token',
      description: 'Create a new API token for REST API access',
      inputSchema: z.object({
        name: z.string().describe('Name for the API token'),
        description: z.string().optional().describe('Description of the token'),
        type: z.enum(['read-only', 'full-access', 'custom']).default('full-access').describe('Token access type'),
        lifespan: z.number().optional().describe('Token lifespan in days (null for no expiry)')
      }),
      execute: async (args) => {
        const lifespanMs = args.lifespan ? args.lifespan * 24 * 60 * 60 * 1000 : null;
        
        const response = await client.adminRequest<any>(
          '/admin/api-tokens',
          'POST',
          {
            name: args.name,
            description: args.description || '',
            type: args.type,
            lifespan: lifespanMs,
            permissions: null
          }
        );

        if (response?.data?.accessKey) {
          return {
            success: true,
            token: response.data.accessKey,
            message: 'API token created successfully. Save this token as it will not be shown again.'
          };
        }
        
        return { success: false, message: 'Failed to create API token' };
      }
    },
    {
      name: 'list_api_tokens',
      description: 'List all API tokens (note: actual token values are not shown)',
      inputSchema: z.object({}),
      execute: async () => {
        const response = await client.adminRequest<any>('/admin/api-tokens');
        return response?.data || [];
      }
    },
    {
      name: 'delete_api_token',
      description: 'Delete an API token',
      inputSchema: z.object({
        id: z.number().describe('The ID of the token to delete')
      }),
      execute: async (args) => {
        await client.adminRequest<any>(
          `/admin/api-tokens/${args.id}`,
          'DELETE'
        );
        return { success: true, message: `API token ${args.id} deleted successfully` };
      }
    },
    {
      name: 'clear_token_cache',
      description: 'Clear the cached API token used for REST API calls',
      inputSchema: z.object({}),
      execute: async () => {
        tokenManager.clearCache();
        return { success: true, message: 'Token cache cleared successfully' };
      }
    }
  ];
}