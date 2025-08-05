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

// Helper function to validate dynamic zone components
function validateDynamicZoneComponents(data: any, schema: any): void {
  const errors: string[] = [];
  
  if (!schema.attributes || !Array.isArray(schema.attributes)) {
    return; // No attributes to validate
  }
  
  for (const attr of schema.attributes) {
    if (attr.type === 'dynamiczone' && data[attr.name]) {
      const fieldName = attr.name;
      const allowedComponents = attr.components || [];
      const providedComponents = data[fieldName];
      
      if (!Array.isArray(providedComponents)) {
        continue; // Skip if not an array
      }
      
      const invalidComponents: string[] = [];
      
      for (const component of providedComponents) {
        if (!component.__component) {
          errors.push(`Component in ${fieldName} is missing __component field`);
          continue;
        }
        
        if (!allowedComponents.includes(component.__component)) {
          invalidComponents.push(component.__component);
        }
      }
      
      if (invalidComponents.length > 0) {
        errors.push(
          `Invalid components for dynamic zone '${fieldName}':\n` +
          `  Provided: ${invalidComponents.join(', ')}\n` +
          `  Allowed: ${allowedComponents.join(', ')}`
        );
      }
    }
  }
  
  if (errors.length > 0) {
    throw new Error(
      'Dynamic zone validation failed:\n' + errors.join('\n\n') +
      '\n\nTip: Check the content type schema for allowed components or create missing components in Strapi admin.'
    );
  }
}

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
      description: 'Retrieves entries for a specific content type with support for filtering, pagination, sorting, and population. IMPORTANT: populate="*" only goes 1 level deep and does NOT populate dynamic zones. For dynamic zones use: {"populate": {"dynamicZoneName": {"populate": "*"}}}. For deep population of all fields, nest the populate parameter.',
      inputSchema: z.object({
        pluralApiId: z.string().describe('The plural API ID (e.g., "articles")'),
        options: z.string().optional().describe('JSON string with query options. Example for dynamic zones: {"populate": {"sections": {"populate": "*"}}}')
      }),
      execute: async (args) => {
        let options = {};
        if (args.options) {
          try {
            const parsedOptions = JSON.parse(args.options);
            options = QueryOptionsSchema.parse(parsedOptions);
          } catch (error) {
            if (error instanceof z.ZodError) {
              throw new Error(`Invalid query options: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`);
            }
            throw new Error(`Invalid options JSON: ${error}`);
          }
        }
        return await client.getEntries(args.pluralApiId, options);
      }
    },
    {
      name: 'get_entry',
      description: 'Retrieves a specific entry by its document ID. IMPORTANT: populate="*" only goes 1 level deep and does NOT populate dynamic zones. For dynamic zones use: {"populate": {"dynamicZoneName": {"populate": "*"}}}. For deep population of all fields, nest the populate parameter.',
      inputSchema: z.object({
        pluralApiId: z.string().describe('The plural API ID'),
        documentId: z.string().describe('The document ID'),
        locale: z.string().optional().describe('The locale to retrieve (e.g., "en", "fr", "ru"). If not specified, uses default locale'),
        options: z.string().optional().describe('JSON string with populate and fields options. Example for dynamic zones: {"populate": {"sections": {"populate": "*"}}}')
      }),
      execute: async (args) => {
        let options: any = {};
        if (args.options) {
          try {
            const parsedOptions = JSON.parse(args.options);
            options = QueryOptionsSchema.parse(parsedOptions);
          } catch (error) {
            if (error instanceof z.ZodError) {
              throw new Error(`Invalid query options: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`);
            }
            throw new Error(`Invalid options JSON: ${error}`);
          }
        }
        
        // Add locale to options if specified
        if (args.locale) {
          options.locale = args.locale;
        }
        
        return await client.getEntry(args.pluralApiId, args.documentId, options);
      }
    },
    {
      name: 'create_entry',
      description: 'Creates a new entry for a content type. IMPORTANT: Use get_content_type_schema first to check which fields are required. Each content type has different required fields. Common validation errors occur when required fields like "title", "name", or enum fields are missing.',
      inputSchema: z.object({
        contentType: z.string().describe('The content type UID'),
        pluralApiId: z.string().describe('The plural API ID'),
        data: z.record(z.any()).describe('The entry data. Must include all required fields as defined in the content type schema'),
        locale: z.string().optional().describe('The locale for the entry (e.g., "en", "fr", "ru"). Required for i18n-enabled content types'),
        publish: z.boolean().optional().describe('Whether to publish the entry immediately after creation')
      }),
      execute: async (args) => {
        // Check if content type is i18n-enabled
        const contentTypes = await client.listContentTypes();
        const contentType = contentTypes.find((ct: any) => ct.uid === args.contentType);
        
        if (!contentType) {
          throw new Error(`Content type not found: ${args.contentType}`);
        }
        
        // Get the full schema to check required fields
        const schema = await client.getContentTypeSchema(args.contentType);
        
        // Check for missing required fields
        const missingFields: Array<{ name: string; type?: string }> = [];
        
        // Handle both object and array formats for attributes
        if (schema.attributes) {
          if (Array.isArray(schema.attributes)) {
            // Attributes as array (some Strapi v5 responses)
            for (const attr of schema.attributes) {
              if (attr.required && attr.name && !(attr.name in args.data)) {
                missingFields.push({ name: attr.name, type: attr.type });
              }
            }
          } else if (typeof schema.attributes === 'object') {
            // Attributes as object (standard format)
            for (const [name, attr] of Object.entries(schema.attributes)) {
              if ((attr as any).required && !(name in args.data)) {
                missingFields.push({ name, type: (attr as any).type });
              }
            }
          }
        }
        
        if (missingFields.length > 0) {
          const schemaHint = missingFields.map(field => 
            `- ${field.name} (type: ${field.type || 'unknown'})`
          ).join('\n');
          
          throw new Error(
            `Missing required fields in data object:\n${schemaHint}\n\n` +
            `Current data only includes: ${Object.keys(args.data).join(', ')}\n\n` +
            'Please add the missing fields at the root level of your data object.'
          );
        }
        
        // Validate dynamic zone components
        validateDynamicZoneComponents(args.data, schema);
        
        // If content type is i18n-enabled, locale is required
        if (contentType.isLocalized && !args.locale) {
          // Get default locale
          const locales = await client.adminRequest<any[]>('/i18n/locales');
          const defaultLocale = locales.find((l: any) => l.isDefault);
          
          if (!defaultLocale) {
            throw new Error('Content type is i18n-enabled but no locale was specified and no default locale found');
          }
          
          // Use default locale
          args.locale = defaultLocale.code;
        }
        
        return await client.createEntry(args.contentType, args.pluralApiId, args.data, args.publish, args.locale);
      }
    },
    {
      name: 'update_entry',
      description: 'Updates an existing entry',
      inputSchema: z.object({
        pluralApiId: z.string().describe('The plural API ID'),
        documentId: z.string().describe('The document ID'),
        data: z.record(z.any()).describe('The updated data'),
        locale: z.string().optional().describe('The locale to update (e.g., "en", "fr", "ru"). Required for i18n-enabled content types')
      }),
      execute: async (args) => {
        // Get the content type to check if it's i18n-enabled
        const contentTypes = await client.listContentTypes();
        const contentType = contentTypes.find((ct: any) => 
          ct.pluralApiId === args.pluralApiId || ct.uid === args.pluralApiId
        );
        
        if (!contentType) {
          throw new Error(`Content type not found: ${args.pluralApiId}`);
        }
        
        // Get the full schema to validate dynamic zones
        const schema = await client.getContentTypeSchema(contentType.uid);
        
        // Validate dynamic zone components
        validateDynamicZoneComponents(args.data, schema);
        
        // If content type is i18n-enabled, locale is required
        if (contentType.isLocalized && !args.locale) {
          // Get default locale
          const locales = await client.adminRequest<any[]>('/i18n/locales');
          const defaultLocale = locales.find((l: any) => l.isDefault);
          
          if (!defaultLocale) {
            throw new Error('Content type is i18n-enabled but no locale was specified and no default locale found');
          }
          
          // Use default locale
          args.locale = defaultLocale.code;
        }
        
        return await client.updateEntry(args.pluralApiId, args.documentId, args.data, args.locale);
      }
    },
    {
      name: 'delete_entry',
      description: 'Deletes an entry',
      inputSchema: z.object({
        pluralApiId: z.string().describe('The plural API ID'),
        documentId: z.string().describe('The document ID'),
        locale: z.string().optional().describe('The locale to delete (e.g., "en", "fr", "ru"). If not specified, deletes all locales')
      }),
      execute: async (args) => {
        await client.deleteEntry(args.pluralApiId, args.documentId, args.locale);
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
        documentId: z.string().describe('The document ID'),
        locale: z.string().optional().describe('The locale to publish (e.g., "en", "fr", "ru"). Required for i18n-enabled content types')
      }),
      execute: async (args) => {
        // Get the content type to check if it's i18n-enabled
        const contentTypes = await client.listContentTypes();
        const contentType = contentTypes.find((ct: any) => 
          ct.pluralApiId === args.pluralApiId || ct.uid === args.pluralApiId
        );
        
        if (!contentType) {
          throw new Error(`Content type not found: ${args.pluralApiId}`);
        }
        
        // If content type is i18n-enabled, locale is required
        if (contentType.isLocalized && !args.locale) {
          // Get default locale
          const locales = await client.adminRequest<any[]>('/i18n/locales');
          const defaultLocale = locales.find((l: any) => l.isDefault);
          
          if (!defaultLocale) {
            throw new Error('Content type is i18n-enabled but no locale was specified and no default locale found');
          }
          
          // Use default locale
          args.locale = defaultLocale.code;
        }
        
        return await client.publishEntry(args.pluralApiId, args.documentId, args.locale);
      }
    },
    {
      name: 'unpublish_entry',
      description: 'Unpublishes a published entry (converts to draft)',
      inputSchema: z.object({
        pluralApiId: z.string().describe('The plural API ID'),
        documentId: z.string().describe('The document ID'),
        locale: z.string().optional().describe('The locale to unpublish (e.g., "en", "fr", "ru"). Required for i18n-enabled content types')
      }),
      execute: async (args) => {
        // Get the content type to check if it's i18n-enabled
        const contentTypes = await client.listContentTypes();
        const contentType = contentTypes.find((ct: any) => 
          ct.pluralApiId === args.pluralApiId || ct.uid === args.pluralApiId
        );
        
        if (!contentType) {
          throw new Error(`Content type not found: ${args.pluralApiId}`);
        }
        
        // If content type is i18n-enabled, locale is required
        if (contentType.isLocalized && !args.locale) {
          // Get default locale
          const locales = await client.adminRequest<any[]>('/i18n/locales');
          const defaultLocale = locales.find((l: any) => l.isDefault);
          
          if (!defaultLocale) {
            throw new Error('Content type is i18n-enabled but no locale was specified and no default locale found');
          }
          
          // Use default locale
          args.locale = defaultLocale.code;
        }
        
        return await client.unpublishEntry(args.pluralApiId, args.documentId, args.locale);
      }
    }
  ];
}