import { z } from 'zod';
import { StrapiClient } from '../strapi-client.js';
import { Tool } from './types.js';
import { cleanEntryForUpdate } from '../utils/entry-utils.js';

// Required string schema - ensures strings are not empty
const RequiredString = z.string().trim().min(1, { message: 'Field is required and cannot be empty' });

// Optional string schema - can be empty or undefined
const OptionalString = z.string().trim().optional();

// Query options schema removed - using direct JSON parsing instead

/**
 * Helper function to get content type configuration
 */
async function getContentTypeConfig(
  client: StrapiClient,
  contentTypeUid: string
): Promise<any> {
  const initData = await client.contentManagerInit();
  
  // Check if we got a valid response
  if (!initData || typeof initData !== 'object') {
    throw new Error('Failed to retrieve content types from Strapi. The server may be down or unreachable.');
  }
  
  const contentTypes = initData.contentTypes || [];
  return contentTypes.find((ct: any) => ct.uid === contentTypeUid);
}

/**
 * Helper function to ensure locale for i18n-enabled content types
 */
async function ensureLocaleForI18nContent(
  client: StrapiClient,
  contentTypeUid: string,
  locale?: string
): Promise<string | undefined> {
  const contentType = await getContentTypeConfig(client, contentTypeUid);

  if (contentType?.pluginOptions?.i18n?.localized && !locale) {
    const locales = await client.adminRequest<any[]>('/i18n/locales');
    const defaultLocale = locales.find((l: any) => l.isDefault);
    return defaultLocale?.code;
  }

  return locale;
}

export function contentManagementTools(client: StrapiClient): Tool[] {
  return [
    {
      name: 'list_content_types',
      description: 'Lists all available content types in the Strapi instance. NOTE: Content types are defined as JSON schema files at src/api/{name}/content-types/{name}/schema.json. This tool is for checking if Strapi has loaded your schema changes.',
      inputSchema: z.object({
        kind: z.enum(['system', 'user', 'all']).optional().describe('Filter by content type kind: "system" for plugin/admin types, "user" for user-created types, "all" for everything (default: "user")'),
        filter: OptionalString.describe('Optional search filter - matches against uid, apiID, pluralApiId, or info.pluralName (case-insensitive substring match)'),
        attributes: z.boolean().optional().default(false).describe('Include full attributes in response (default: false to reduce token usage)')
      }),
      execute: async (args) => {
        try {
          const data = await client.contentManagerInit();

          // Check if we got a valid response
          if (!data || typeof data !== 'object') {
            throw new Error('Failed to retrieve content types from Strapi. The server may be down or unreachable.');
          }

          // Extract only contentTypes from the response
          let contentTypes = data.contentTypes || [];

        // Filter by kind
        const kind = args.kind || 'user';
        if (kind !== 'all') {
          contentTypes = contentTypes.filter((ct: any) => {
            // System/plugin content types usually start with 'plugin::', 'admin::', or 'strapi::'
            // User content types usually start with 'api::'
            const isSystem = ct.uid.startsWith('plugin::') || ct.uid.startsWith('admin::') || ct.uid.startsWith('strapi::');

            if (kind === 'system') {
              return isSystem;
            } else if (kind === 'user') {
              return !isSystem && ct.uid.startsWith('api::');
            }
            return true;
          });
        }

        // Apply additional filter if provided
        if (args.filter) {
          const filterLower = args.filter.toLowerCase();
          contentTypes = contentTypes.filter((ct: any) => {
            return (
              ct.uid?.toLowerCase().includes(filterLower) ||
              ct.apiID?.toLowerCase().includes(filterLower) ||
              ct.pluralApiId?.toLowerCase().includes(filterLower) ||
              ct.info?.pluralName?.toLowerCase().includes(filterLower)
            );
          });
        }

        // If attributes is false, return minimal data to reduce token usage
        if (!args.attributes) {
          return contentTypes.map((ct: any) => ({
            uid: ct.uid,
            apiID: ct.apiID,
            pluralApiId: ct.pluralApiId || ct.info?.pluralName
          }));
        }

        return contentTypes;
        } catch (error: any) {
          // Return the error in a format that tools can handle
          throw new Error(error.message || 'Failed to retrieve content types from Strapi. The server may be down or unreachable.');
        }
      }
    },
    {
      name: 'list_components',
      description: 'Lists all available components in the Strapi instance. NOTE: Components are defined as JSON schema files at src/components/{category}/{name}.json. Edit these files directly to modify components.',
      inputSchema: z.object({
        filter: OptionalString.describe('Optional search filter - matches against uid, apiID, category, or info.displayName (case-insensitive substring match)'),
        attributes: z.boolean().optional().default(false).describe('Include full attributes in response (default: false to reduce token usage)')
      }),
      execute: async (args) => {
        try {
          const data = await client.contentManagerInit();

          // Check if we got a valid response
          if (!data || typeof data !== 'object') {
            throw new Error('Failed to retrieve components from Strapi. The server may be down or unreachable.');
          }

          // Extract components from the response
          let components = data.components || [];

        // Apply filter if provided
        if (args.filter) {
          const filterLower = args.filter.toLowerCase();
          components = components.filter((comp: any) => {
            return (
              comp.uid?.toLowerCase().includes(filterLower) ||
              comp.apiID?.toLowerCase().includes(filterLower) ||
              comp.category?.toLowerCase().includes(filterLower) ||
              comp.info?.displayName?.toLowerCase().includes(filterLower)
            );
          });
        }

        // If attributes is false, remove the attributes field from each component to reduce token usage
        if (!args.attributes) {
          return components.map((comp: any) => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { attributes, ...rest } = comp;
            return rest;
          });
        }

        return components;
        } catch (error: any) {
          // Return the error in a format that tools can handle
          throw new Error(error.message || 'Failed to retrieve components from Strapi. The server may be down or unreachable.');
        }
      }
    },
    {
      name: 'get_entries',
      description: 'Retrieves entries for a specific content type with support for filtering, pagination, sorting, and localization.',
      inputSchema: z.object({
        contentTypeUid: RequiredString.describe('The content type UID (e.g., "api::article.article")'),
        documentId: OptionalString.describe('Filter by specific document ID (shared across all locale and status versions)'),
        locale: OptionalString.describe('The locale to retrieve (e.g., "en", "fr", "ru")'),
        page: z.number().optional().describe('Page number for pagination (default: 1)'),
        pageSize: z.number().optional().describe('Number of entries per page (default: 10)'),
        sort: OptionalString.describe('Sort order (e.g., "title:ASC" or "createdAt:DESC")'),
        options: OptionalString.describe('JSON string with additional query options like filters, populate, fields, status')
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
      name: 'create_entry',
      description: 'Creates a NEW entry with a new documentId. NOTE: This creates a completely new entry, NOT a localized version of an existing entry. For creating localized versions, use create_localized_draft.',
      inputSchema: z.object({
        contentTypeUid: RequiredString.describe('The content type UID (e.g., "api::article.article")'),
        data: z.record(z.any()).describe('The entry data. Must include all required fields as defined in the content type schema'),
        locale: OptionalString.describe('The locale for the entry (e.g., "en", "fr", "ru"). Required for i18n-enabled content types'),
        publish: z.boolean().optional().default(true).describe('Whether to publish the entry immediately (default: true publishes, false creates as draft)')
      }),
      execute: async (args) => {
        // Ensure locale for i18n-enabled content types
        const locale = await ensureLocaleForI18nContent(client, args.contentTypeUid, args.locale);

        // Check content type configuration
        const contentType = await getContentTypeConfig(client, args.contentTypeUid);

        // Check if draftAndPublish is disabled
        if (contentType?.options?.draftAndPublish === false) {
          // When draftAndPublish is disabled, just create the entry directly
          // The publish parameter is ignored since there's no draft/publish concept
          console.error(`[ContentManagement] Content type ${args.contentTypeUid} has draftAndPublish disabled, creating entry directly`);
          return await client.createEntry(args.contentTypeUid, args.data, locale);
        }

        // If publish is requested, use the publish endpoint
        if (args.publish) {
          return await client.createPublishedEntry(args.contentTypeUid, args.data, locale);
        }

        // Otherwise create as draft
        return await client.createEntry(args.contentTypeUid, args.data, locale);
      }
    },
    {
      name: 'create_localized_entry',
      description: 'Creates a localized version of an existing entry. This adds a new locale version to an existing documentId.',
      inputSchema: z.object({
        contentTypeUid: z.string().describe('The content type UID (e.g., "api::i18n-doc.i18n-doc")'),
        documentId: RequiredString.describe('The document ID of the existing entry'),
        data: z.record(z.any()).describe('The localized entry data'),
        locale: RequiredString.describe('The locale for the new version (e.g., "ru", "zh")'),
        publish: z.boolean().optional().default(true).describe('Whether to publish the entry immediately (default: true publishes, false creates as draft)')
      }),
      execute: async (args) => {
        // Check if content type is i18n-enabled
        const contentType = await getContentTypeConfig(client, args.contentTypeUid);

        if (!contentType?.pluginOptions?.i18n?.localized) {
          throw new Error(`Content type ${args.contentTypeUid} is not i18n-enabled`);
        }

        // Check if draftAndPublish is disabled
        if (contentType?.options?.draftAndPublish === false) {
          // When draftAndPublish is disabled, just create the localized entry directly
          // The publish parameter is ignored since there's no draft/publish concept
          console.error(`[ContentManagement] Content type ${args.contentTypeUid} has draftAndPublish disabled, creating localized entry directly`);
          return await client.createLocalizedDraft(args.contentTypeUid, args.documentId, args.data, args.locale);
        }

        // If publish is requested, use the publish endpoint
        if (args.publish) {
          return await client.createAndPublishLocalizedEntry(args.contentTypeUid, args.documentId, args.data, args.locale);
        }

        // Otherwise create as draft
        return await client.createLocalizedDraft(args.contentTypeUid, args.documentId, args.data, args.locale);
      }
    },
    {
      name: 'publish_localized_entry',
      description: 'Publishes an existing DRAFT entry for a specific locale. The entry must already exist as a draft.',
      inputSchema: z.object({
        contentTypeUid: z.string().describe('The content type UID (e.g., "api::page.page")'),
        documentId: RequiredString.describe('The document ID of the entry to publish'),
        locale: RequiredString.describe('The locale to publish (e.g., "en", "ru", "zh")')
      }),
      execute: async (args) => {
        return await client.publishLocalizedEntry(args.contentTypeUid, args.documentId, args.locale);
      }
    },
    {
      name: 'update_entry',
      description: 'Updates an existing entry. By default publishes immediately, or saves as draft if publish=false.',
      inputSchema: z.object({
        contentTypeUid: RequiredString.describe('The content type UID (e.g., "api::article.article")'),
        documentId: RequiredString.describe('The document ID'),
        data: z.record(z.any()).describe('The updated data'),
        locale: OptionalString.describe('The locale to update (e.g., "en", "fr", "ru"). Required for i18n-enabled content types'),
        publish: z.boolean().optional().default(true).describe('Whether to publish the entry immediately (default: true publishes, false saves as draft)'),
        partial: z.boolean().optional().default(false).describe('When true, merges provided data with existing entry data instead of replacing it completely')
      }),
      execute: async (args) => {
        // Ensure locale for i18n-enabled content types
        const locale = await ensureLocaleForI18nContent(client, args.contentTypeUid, args.locale);

        let dataToUpdate = args.data;

        // Handle partial updates
        if (args.partial) {
          // Fetch current entry
          const current = await client.getEntries(args.contentTypeUid, {
            filters: { documentId: { $eq: args.documentId } },
            locale: locale,
            populate: '*'
          });
          
          if (!current.data || current.data.length === 0) {
            throw new Error(`Entry with documentId ${args.documentId} not found`);
          }

          const existingEntry = current.data[0];
          
          // Clean the existing entry to remove metadata fields
          const cleanedExisting = cleanEntryForUpdate(existingEntry);
          
          // Merge provided data with cleaned existing entry
          dataToUpdate = Object.assign({}, cleanedExisting, args.data);
        }

        // Check content type configuration
        const contentType = await getContentTypeConfig(client, args.contentTypeUid);

        // Check if draftAndPublish is disabled
        if (contentType?.options?.draftAndPublish === false) {
          // When draftAndPublish is disabled, just update the entry directly
          // The publish parameter is ignored since there's no draft/publish concept
          return await client.updateEntryDraft(args.contentTypeUid, args.documentId, dataToUpdate, locale);
        }

        // If publish is requested, use the publish endpoint
        if (args.publish) {
          return await client.updateEntryAndPublish(args.contentTypeUid, args.documentId, dataToUpdate, locale);
        }

        // Otherwise update as draft
        return await client.updateEntryDraft(args.contentTypeUid, args.documentId, dataToUpdate, locale);
      }
    },
    {
      name: 'delete_entry',
      description: 'Deletes an entry',
      inputSchema: z.object({
        contentTypeUid: RequiredString.describe('The content type UID (e.g., "api::article.article")'),
        documentId: RequiredString.describe('The document ID'),
        locale: OptionalString.describe('The locale to delete (e.g., "en", "fr", "ru"). If not specified, deletes all locales')
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
        contentTypeUid: RequiredString.describe('The content type UID (e.g., "api::project.project")'),
        documentIds: z.array(RequiredString).min(1, { message: 'At least one document ID is required' }).describe('Array of document IDs to publish')
      }),
      execute: async (args) => {
        return await client.publishEntries(args.contentTypeUid, args.documentIds);
      }
    },
    {
      name: 'unpublish_entries',
      description: 'Unpublishes one or more published entries (converts to draft, unpublishes all locales)',
      inputSchema: z.object({
        contentTypeUid: RequiredString.describe('The content type UID (e.g., "api::project.project")'),
        documentIds: z.array(RequiredString).min(1, { message: 'At least one document ID is required' }).describe('Array of document IDs to unpublish')
      }),
      execute: async (args) => {
        return await client.unpublishEntries(args.contentTypeUid, args.documentIds);
      }
    }
  ];
}
