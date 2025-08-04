import { z } from 'zod';
import { StrapiClient } from '../strapi-client.js';
import { Tool } from './types.js';

export function schemaTools(client: StrapiClient): Tool[] {
  return [
    {
      name: 'get_content_type_schema',
      description: 'Retrieves the complete schema for a content type including fields, types, and relations. ALWAYS use this before creating or updating entries to understand which fields are required. Look for fields with "required": true in the schema.',
      inputSchema: z.object({
        contentType: z.string().describe('The content type UID')
      }),
      execute: async (args) => {
        return await client.getContentTypeSchema(args.contentType);
      }
    }
  ];
}