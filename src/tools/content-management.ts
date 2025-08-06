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
        const initData = await client.listContentTypes();
        return initData;
      }
    },
    {
      name: 'get_entries',
      description: 'Retrieves entries for a specific content type with support for filtering, pagination, sorting, and localization.',
      inputSchema: z.object({
        contentTypeUid: z.string().describe('The content type UID (e.g., "api::article.article")'),
        documentId: z.string().optional().describe('Filter by specific document ID (shared across all locale and status versions)'),
        locale: z.string().optional().describe('The locale to retrieve (e.g., "en", "fr", "ru")'),
        page: z.number().optional().describe('Page number for pagination (default: 1)'),
        pageSize: z.number().optional().describe('Number of entries per page (default: 10)'),
        sort: z.string().optional().describe('Sort order (e.g., "title:ASC" or "createdAt:DESC")'),
        options: z.string().optional().describe('JSON string with additional query options like filters, populate, fields, status')
      }),
      execute: async (args) => {
        let options: any = {};
        
        // Add documentId filter if provided
        if (args.documentId) {
          options.filters = {
            $and: [{
              documentId: { $eq: args.documentId }
            }]
          };
        }
        
        // Add direct parameters
        if (args.locale) options.locale = args.locale;
        if (args.page || args.pageSize) {
          options.pagination = {
            page: args.page || 1,
            pageSize: args.pageSize || 10
          };
        }
        if (args.sort) options.sort = args.sort;
        
        // Merge with additional options if provided
        if (args.options) {
          try {
            const parsedOptions = JSON.parse(args.options);
            // Deep merge filters if both exist
            if (parsedOptions.filters && options.filters) {
              // Combine filters with $and
              const existingFilters = options.filters.$and || [options.filters];
              const newFilters = parsedOptions.filters.$and || [parsedOptions.filters];
              options.filters = {
                $and: [...existingFilters, ...newFilters]
              };
              delete parsedOptions.filters;
            }
            // Merge parsed options, with direct parameters taking precedence
            options = { ...parsedOptions, ...options };
            if (parsedOptions.pagination && options.pagination) {
              options.pagination = { ...parsedOptions.pagination, ...options.pagination };
            }
          } catch (error) {
            throw new Error(`Invalid options JSON: ${error}`);
          }
        }
        
        return await client.getEntries(args.contentTypeUid, options);
      }
    },
    {
      name: 'create_draft_entry',
      description: 'Creates a NEW entry with a new documentId in DRAFT status. NOTE: This creates a completely new entry, NOT a localized version of an existing entry. For creating localized versions, use create_localized_draft. Use publish_entries to publish after creation.',
      inputSchema: z.object({
        contentTypeUid: z.string().describe('The content type UID (e.g., "api::article.article")'),
        data: z.record(z.any()).describe('The entry data. Must include all required fields as defined in the content type schema'),
        locale: z.string().optional().describe('The locale for the entry (e.g., "en", "fr", "ru"). Required for i18n-enabled content types')
      }),
      execute: async (args) => {
        // Check if content type is i18n-enabled
        const initData = await client.listContentTypes();
        const contentTypes = initData.contentTypes || [];
        const contentType = contentTypes.find((ct: any) => ct.uid === args.contentTypeUid);
        
        // If content type is i18n-enabled, locale is required
        if (contentType && contentType.pluginOptions?.i18n?.localized && !args.locale) {
          // Get default locale
          const locales = await client.adminRequest<any[]>('/i18n/locales');
          const defaultLocale = locales.find((l: any) => l.isDefault);
          
          if (defaultLocale) {
            // Use default locale
            args.locale = defaultLocale.code;
          }
        }
        
        return await client.createEntry(args.contentTypeUid, args.data, args.locale);
      }
    },
    {
      name: 'create_and_publish_entry',
      description: 'Creates and publishes a NEW entry with a new documentId. If the content type has draftAndPublish disabled, it will create the entry directly. NOTE: This creates a completely new entry, NOT a localized version of an existing entry.',
      inputSchema: z.object({
        contentTypeUid: z.string().describe('The content type UID (e.g., "api::article.article")'),
        data: z.record(z.any()).describe('The entry data. Must include all required fields as defined in the content type schema'),
        locale: z.string().optional().describe('The locale for the entry (e.g., "en", "fr", "ru"). Required for i18n-enabled content types')
      }),
      execute: async (args) => {
        // Check content type configuration
        const initData = await client.listContentTypes();
        const contentTypes = initData.contentTypes || [];
        const contentType = contentTypes.find((ct: any) => ct.uid === args.contentTypeUid);
        
        // If content type is i18n-enabled, locale is required
        if (contentType && contentType.pluginOptions?.i18n?.localized && !args.locale) {
          // Get default locale
          const locales = await client.adminRequest<any[]>('/i18n/locales');
          const defaultLocale = locales.find((l: any) => l.isDefault);
          
          if (defaultLocale) {
            // Use default locale
            args.locale = defaultLocale.code;
          }
        }
        
        // Check if draftAndPublish is disabled
        if (contentType && contentType.options?.draftAndPublish === false) {
          // When draftAndPublish is disabled, just create the entry directly
          console.error(`[ContentManagement] Content type ${args.contentTypeUid} has draftAndPublish disabled, creating entry directly`);
          return await client.createEntry(args.contentTypeUid, args.data, args.locale);
        }
        
        // Otherwise use the publish endpoint
        return await client.createPublishedEntry(args.contentTypeUid, args.data, args.locale);
      }
    },
    {
      name: 'create_localized_draft',
      description: 'Creates a localized version of an existing entry as a DRAFT. The draft will need to be published separately using publish_entries.',
      inputSchema: z.object({
        contentTypeUid: z.string().describe('The content type UID (e.g., "api::i18n-doc.i18n-doc")'),
        documentId: z.string().describe('The document ID of the existing entry'),
        data: z.record(z.any()).describe('The localized entry data'),
        locale: z.string().describe('The locale for the new version (e.g., "ru", "zh")')
      }),
      execute: async (args) => {
        // Check if content type is i18n-enabled
        const initData = await client.listContentTypes();
        const contentTypes = initData.contentTypes || [];
        const contentType = contentTypes.find((ct: any) => ct.uid === args.contentTypeUid);
        
        if (!contentType?.pluginOptions?.i18n?.localized) {
          throw new Error(`Content type ${args.contentTypeUid} is not i18n-enabled`);
        }
        
        return await client.createLocalizedDraft(args.contentTypeUid, args.documentId, args.data, args.locale);
      }
    },
    {
      name: 'create_and_publish_localized_entry',
      description: 'Creates AND publishes a localized version of an existing entry in one step. This adds a new locale version to an existing documentId.',
      inputSchema: z.object({
        contentTypeUid: z.string().describe('The content type UID (e.g., "api::i18n-doc.i18n-doc")'),
        documentId: z.string().describe('The document ID of the existing entry'),
        data: z.record(z.any()).describe('The localized entry data'),
        locale: z.string().describe('The locale for the new version (e.g., "ru", "zh")')
      }),
      execute: async (args) => {
        // Check if content type is i18n-enabled
        const initData = await client.listContentTypes();
        const contentTypes = initData.contentTypes || [];
        const contentType = contentTypes.find((ct: any) => ct.uid === args.contentTypeUid);
        
        if (!contentType?.pluginOptions?.i18n?.localized) {
          throw new Error(`Content type ${args.contentTypeUid} is not i18n-enabled`);
        }
        
        return await client.createAndPublishLocalizedEntry(args.contentTypeUid, args.documentId, args.data, args.locale);
      }
    },
    {
      name: 'publish_localized_entry',
      description: 'Publishes an existing DRAFT entry for a specific locale. The entry must already exist as a draft.',
      inputSchema: z.object({
        contentTypeUid: z.string().describe('The content type UID (e.g., "api::page.page")'),
        documentId: z.string().describe('The document ID of the entry to publish'),
        locale: z.string().describe('The locale to publish (e.g., "en", "ru", "zh")')
      }),
      execute: async (args) => {
        return await client.publishLocalizedEntry(args.contentTypeUid, args.documentId, args.locale);
      }
    },
    {
      name: 'update_entry_draft',
      description: 'Updates an existing entry and saves it as a DRAFT (unpublished). The entry will need to be published separately using publish_entries.',
      inputSchema: z.object({
        contentTypeUid: z.string().describe('The content type UID (e.g., "api::article.article")'),
        documentId: z.string().describe('The document ID'),
        data: z.record(z.any()).describe('The updated data'),
        locale: z.string().optional().describe('The locale to update (e.g., "en", "fr", "ru"). Required for i18n-enabled content types')
      }),
      execute: async (args) => {
        // Get the content type to check if it's i18n-enabled
        const initData = await client.listContentTypes();
        const contentTypes = initData.contentTypes || [];
        const contentType = contentTypes.find((ct: any) => ct.uid === args.contentTypeUid);
        
        // If content type is i18n-enabled, locale is required
        if (contentType && contentType.pluginOptions?.i18n?.localized && !args.locale) {
          // Get default locale
          const locales = await client.adminRequest<any[]>('/i18n/locales');
          const defaultLocale = locales.find((l: any) => l.isDefault);
          
          if (defaultLocale) {
            // Use default locale
            args.locale = defaultLocale.code;
          }
        }
        
        return await client.updateEntryDraft(args.contentTypeUid, args.documentId, args.data, args.locale);
      }
    },
    {
      name: 'update_entry_and_publish',
      description: 'Updates an existing entry and publishes it immediately in one step. If the content type has draftAndPublish disabled, it will update the entry directly.',
      inputSchema: z.object({
        contentTypeUid: z.string().describe('The content type UID (e.g., "api::article.article")'),
        documentId: z.string().describe('The document ID'),
        data: z.record(z.any()).describe('The updated data'),
        locale: z.string().optional().describe('The locale to update (e.g., "en", "fr", "ru"). Required for i18n-enabled content types')
      }),
      execute: async (args) => {
        // Get the content type to check configuration
        const initData = await client.listContentTypes();
        const contentTypes = initData.contentTypes || [];
        const contentType = contentTypes.find((ct: any) => ct.uid === args.contentTypeUid);
        
        // If content type is i18n-enabled, locale is required
        if (contentType && contentType.pluginOptions?.i18n?.localized && !args.locale) {
          // Get default locale
          const locales = await client.adminRequest<any[]>('/i18n/locales');
          const defaultLocale = locales.find((l: any) => l.isDefault);
          
          if (defaultLocale) {
            // Use default locale
            args.locale = defaultLocale.code;
          }
        }
        
        // Check if draftAndPublish is disabled
        if (contentType && contentType.options?.draftAndPublish === false) {
          // When draftAndPublish is disabled, just update the entry directly
          console.error(`[ContentManagement] Content type ${args.contentTypeUid} has draftAndPublish disabled, updating entry directly`);
          return await client.updateEntryDraft(args.contentTypeUid, args.documentId, args.data, args.locale);
        }
        
        // Otherwise use the publish endpoint
        return await client.updateEntryAndPublish(args.contentTypeUid, args.documentId, args.data, args.locale);
      }
    },
    {
      name: 'delete_entry',
      description: 'Deletes an entry',
      inputSchema: z.object({
        contentTypeUid: z.string().describe('The content type UID (e.g., "api::article.article")'),
        documentId: z.string().describe('The document ID'),
        locale: z.string().optional().describe('The locale to delete (e.g., "en", "fr", "ru"). If not specified, deletes all locales')
      }),
      execute: async (args) => {
        await client.deleteEntry(args.contentTypeUid, args.documentId, args.locale);
        return { success: true, message: `Entry ${args.documentId} deleted successfully` };
      }
    },
    {
      name: 'publish_entries',
      description: 'Publishes one or more draft entries (publishes all locales)',
      inputSchema: z.object({
        contentTypeUid: z.string().describe('The content type UID (e.g., "api::project.project")'),
        documentIds: z.array(z.string()).describe('Array of document IDs to publish')
      }),
      execute: async (args) => {
        return await client.publishEntries(args.contentTypeUid, args.documentIds);
      }
    },
    {
      name: 'unpublish_entries',
      description: 'Unpublishes one or more published entries (converts to draft, unpublishes all locales)',
      inputSchema: z.object({
        contentTypeUid: z.string().describe('The content type UID (e.g., "api::project.project")'),
        documentIds: z.array(z.string()).describe('Array of document IDs to unpublish')
      }),
      execute: async (args) => {
        return await client.unpublishEntries(args.contentTypeUid, args.documentIds);
      }
    }
  ];
}