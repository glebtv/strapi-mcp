import { z } from 'zod';
import { StrapiClient } from '../strapi-client.js';
import { TokenManager } from '../token-manager.js';
import { Tool } from './types.js';

// Required string schema - ensures strings are not empty
const RequiredString = z.string().trim().min(1, { message: 'Field is required and cannot be empty' });

// Optional string schema - can be empty or undefined
const OptionalString = z.string().trim().optional();

export function apiTokenTools(client: StrapiClient): Tool[] {
  const tokenManager = new TokenManager(client);

  return [
    {
      name: 'create_api_token',
      description: 'Create a new API token for REST API access',
      inputSchema: z.object({
        name: RequiredString.describe('Name for the API token'),
        description: OptionalString.describe('Description of the token'),
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
      name: 'delete_saved_token',
      description: 'Delete the saved API token file used for REST API calls',
      inputSchema: z.object({}),
      execute: async () => {
        tokenManager.deleteSavedToken();
        return { success: true, message: 'Saved token deleted successfully' };
      }
    },
    {
      name: 'get_saved_token',
      description: 'Get the saved token information from ~/.mcp/strapi-mcp.tokens.json',
      inputSchema: z.object({}),
      execute: async () => {
        const tokenInfo = tokenManager.getSavedToken();
        if (!tokenInfo) {
          return { 
            success: false, 
            message: 'No saved token found',
            tokenPath: '~/.mcp/strapi-mcp.tokens.json'
          };
        }
        
        return {
          success: true,
          tokenInfo: tokenInfo,
          message: 'Token information retrieved successfully'
        };
      }
    }
  ];
}
