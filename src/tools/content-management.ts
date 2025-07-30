import { z } from 'zod';
import { StrapiClient } from '../strapi-client.js';
import { Tool } from './types.js';

const QueryOptionsSchema = z.object({
  filters: z.record(z.any()).optional(),
  pagination: z.object({
    page: z.number().optional(),
    pageSize: z.number().optional(),
    limit: z.number().optional(),
    start: z.number().optional()
  }).optional(),
  sort: z.union([z.string(), z.array(z.string())]).optional(),
  populate: z.union([z.string(), z.array(z.string()), z.record(z.any())]).optional(),
  fields: z.array(z.string()).optional(),
  status: z.enum(['published', 'draft', 'all']).optional(),
  locale: z.string().optional()
});

export function contentManagementTools(client: StrapiClient): Tool[] {
  return [
    {
      name: 'list_content_types',
      description: 'Lists all available content types in the Strapi instance',
      inputSchema: z.object({}),
      execute: async () => {
        const contentTypes = await client.listContentTypes();
        return { data: contentTypes };
      }
    },
    {
      name: 'get_entries',
      description: 'Retrieves entries for a specific content type with support for filtering, pagination, sorting, and population',
      inputSchema: z.object({
        pluralApiId: z.string().describe('The plural API ID (e.g., "articles")'),
        options: z.string().optional().describe('JSON string with query options')
      }),
      execute: async (args) => {
        let options = {};
        if (args.options) {
          try {
            options = JSON.parse(args.options);
          } catch (error) {
            throw new Error(`Invalid options JSON: ${error}`);
          }
        }
        return await client.getEntries(args.pluralApiId, options);
      }
    },
    {
      name: 'get_entry',
      description: 'Retrieves a specific entry by its document ID',
      inputSchema: z.object({
        pluralApiId: z.string().describe('The plural API ID'),
        documentId: z.string().describe('The document ID'),
        options: z.string().optional().describe('JSON string with populate and fields options')
      }),
      execute: async (args) => {
        let options = {};
        if (args.options) {
          try {
            options = JSON.parse(args.options);
          } catch (error) {
            throw new Error(`Invalid options JSON: ${error}`);
          }
        }
        return await client.getEntry(args.pluralApiId, args.documentId, options);
      }
    },
    {
      name: 'create_entry',
      description: 'Creates a new entry for a content type',
      inputSchema: z.object({
        contentType: z.string().describe('The content type UID'),
        pluralApiId: z.string().describe('The plural API ID'),
        data: z.record(z.any()).describe('The entry data'),
        publish: z.boolean().optional().describe('Whether to publish the entry immediately after creation')
      }),
      execute: async (args) => {
        return await client.createEntry(args.contentType, args.pluralApiId, args.data, args.publish);
      }
    },
    {
      name: 'update_entry',
      description: 'Updates an existing entry',
      inputSchema: z.object({
        pluralApiId: z.string().describe('The plural API ID'),
        documentId: z.string().describe('The document ID'),
        data: z.record(z.any()).describe('The updated data')
      }),
      execute: async (args) => {
        return await client.updateEntry(args.pluralApiId, args.documentId, args.data);
      }
    },
    {
      name: 'delete_entry',
      description: 'Deletes an entry',
      inputSchema: z.object({
        pluralApiId: z.string().describe('The plural API ID'),
        documentId: z.string().describe('The document ID')
      }),
      execute: async (args) => {
        await client.deleteEntry(args.pluralApiId, args.documentId);
        return { success: true, message: `Entry ${args.documentId} deleted successfully` };
      }
    },
    {
      name: 'delete_all_entries',
      description: '⚠️ DESTRUCTIVE: Deletes ALL entries for a content type. This operation cannot be undone! Requires explicit approval.',
      inputSchema: z.object({
        pluralApiId: z.string().describe('The plural API ID of the content type'),
        confirmDeletion: z.literal(true).describe('Must be explicitly set to true to confirm this destructive operation')
      }),
      execute: async (args) => {
        if (args.confirmDeletion !== true) {
          throw new Error('Deletion not confirmed. Set confirmDeletion to true to proceed.');
        }
        
        const result = await client.deleteAllEntries(args.pluralApiId);
        return { 
          success: true, 
          message: `Deleted ${result.deletedCount} entries from ${args.pluralApiId}`,
          deletedCount: result.deletedCount
        };
      }
    },
    {
      name: 'publish_entry',
      description: 'Publishes a draft entry',
      inputSchema: z.object({
        pluralApiId: z.string().describe('The plural API ID'),
        documentId: z.string().describe('The document ID')
      }),
      execute: async (args) => {
        return await client.publishEntry(args.pluralApiId, args.documentId);
      }
    },
    {
      name: 'unpublish_entry',
      description: 'Unpublishes a published entry (converts to draft)',
      inputSchema: z.object({
        pluralApiId: z.string().describe('The plural API ID'),
        documentId: z.string().describe('The document ID')
      }),
      execute: async (args) => {
        return await client.unpublishEntry(args.pluralApiId, args.documentId);
      }
    }
  ];
}