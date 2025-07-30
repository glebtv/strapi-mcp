import { z } from 'zod';
import { StrapiClient } from '../strapi-client.js';
import { Tool } from './types.js';

export function componentTools(client: StrapiClient): Tool[] {
  return [
    {
      name: 'list_components',
      description: 'Lists all available components',
      inputSchema: z.object({}),
      execute: async () => {
        return await client.listComponents();
      }
    },
    {
      name: 'get_component_schema',
      description: 'Retrieves the schema for a specific component',
      inputSchema: z.object({
        componentUid: z.string().describe('The component UID')
      }),
      execute: async (args) => {
        return await client.getComponentSchema(args.componentUid);
      }
    },
    {
      name: 'create_component',
      description: 'Creates a new component',
      inputSchema: z.object({
        componentData: z.object({
          displayName: z.string().describe('Display name'),
          category: z.string().describe('Component category'),
          icon: z.string().optional().describe('Icon name'),
          attributes: z.record(z.any()).describe('Field definitions')
        }).describe('Component definition')
      }),
      execute: async (args) => {
        return await client.createComponent(args.componentData);
      }
    },
    {
      name: 'update_component',
      description: 'Updates an existing component',
      inputSchema: z.object({
        componentUid: z.string().describe('Component UID'),
        attributesToUpdate: z.record(z.any()).describe('Attributes to update')
      }),
      execute: async (args) => {
        return await client.updateComponent(args.componentUid, args.attributesToUpdate);
      }
    }
  ];
}