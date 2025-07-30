import { z } from 'zod';
import { StrapiClient } from '../strapi-client.js';
import { Tool } from './types.js';

export function i18nTools(client: StrapiClient): Tool[] {
  return [
    {
      name: 'list_locales',
      description: 'List all enabled locales in Strapi i18n plugin',
      inputSchema: z.object({}),
      execute: async () => {
        const response = await client.adminRequest<any[]>('/i18n/locales');
        return response;
      }
    },
    {
      name: 'create_locale',
      description: 'Create a new locale in Strapi i18n plugin',
      inputSchema: z.object({
        code: z.string().describe('Locale code (e.g., "en", "fr", "es", "ru", "zh")'),
        name: z.string().optional().describe('Display name for the locale (e.g., "English (en)")'),
        isDefault: z.boolean().optional().default(false).describe('Set as default locale')
      }),
      execute: async (args) => {
        const name = args.name || `${args.code.toUpperCase()} (${args.code})`;
        
        const response = await client.adminRequest<any>(
          '/i18n/locales',
          'POST',
          {
            code: args.code,
            name: name,
            isDefault: args.isDefault
          }
        );
        
        return response;
      }
    },
    {
      name: 'delete_locale',
      description: 'Delete a locale from Strapi i18n plugin',
      inputSchema: z.object({
        id: z.number().describe('The ID of the locale to delete')
      }),
      execute: async (args) => {
        await client.adminRequest<any>(
          `/i18n/locales/${args.id}`,
          'DELETE'
        );
        
        return { success: true, message: `Locale ${args.id} deleted successfully` };
      }
    }
  ];
}