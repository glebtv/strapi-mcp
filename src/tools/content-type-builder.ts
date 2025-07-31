import { z } from 'zod';
import { StrapiClient } from '../strapi-client.js';
import { Tool } from './types.js';

const AttributeSchema = z.object({
  type: z.string(),
  required: z.boolean().optional(),
  unique: z.boolean().optional(),
  default: z.any().optional(),
  minLength: z.number().optional(),
  maxLength: z.number().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  enum: z.array(z.string()).optional(),
  private: z.boolean().optional(),
  configurable: z.boolean().optional(),
  target: z.string().optional(),
  relation: z.string().optional(),
  component: z.string().optional(),
  repeatable: z.boolean().optional(),
  pluginOptions: z.any().optional()
});

export function contentTypeBuilderTools(client: StrapiClient): Tool[] {
  return [
    {
      name: 'create_content_type',
      description: 'Creates a new content type. Requires admin privileges',
      inputSchema: z.object({
        displayName: z.string().describe('Display name'),
        singularName: z.string().describe('Singular API ID'),
        pluralName: z.string().describe('Plural API ID'),
        kind: z.enum(['collectionType', 'singleType']).optional().describe('Content type kind'),
        description: z.string().optional().describe('Description'),
        draftAndPublish: z.boolean().optional().describe('Enable draft/publish'),
        attributes: z.record(AttributeSchema).describe('Field definitions'),
        pluginOptions: z.object({
          i18n: z.object({
            localized: z.boolean().describe('Enable i18n for this content type')
          }).optional()
        }).optional().describe('Plugin options like i18n settings')
      }),
      execute: async (args) => {
        return await client.createContentType(args);
      }
    },
    {
      name: 'update_content_type',
      description: 'Updates an existing content type\'s attributes. Requires admin privileges',
      inputSchema: z.object({
        contentType: z.string().describe('Content type UID'),
        attributes: z.record(AttributeSchema).describe('Attributes to add/update'),
        pluginOptions: z.object({
          i18n: z.object({
            localized: z.boolean().describe('Enable i18n for this content type')
          }).optional()
        }).optional().describe('Plugin options like i18n settings')
      }),
      execute: async (args) => {
        return await client.updateContentType(args.contentType, args.attributes, { 
          pluginOptions: args.pluginOptions 
        });
      }
    },
    {
      name: 'delete_content_type',
      description: 'Deletes a content type. Requires admin privileges',
      inputSchema: z.object({
        contentType: z.string().describe('Content type UID to delete')
      }),
      execute: async (args) => {
        return await client.deleteContentType(args.contentType);
      }
    }
  ];
}