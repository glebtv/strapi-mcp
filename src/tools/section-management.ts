import { z } from 'zod';
import { StrapiClient } from '../strapi-client.js';
import { Tool } from './types.js';
import { cleanEntryForUpdate } from '../utils/entry-utils.js';

// Required string schema - ensures strings are not empty
const RequiredString = z.string().trim().min(1, { message: 'Field is required and cannot be empty' });

// Optional string schema - can be empty or undefined
const OptionalString = z.string().trim().optional();

/**
 * Helper function to ensure locale for i18n-enabled content types
 */
async function ensureLocaleForI18nContent(
  client: StrapiClient,
  contentTypeUid: string,
  locale?: string
): Promise<string | undefined> {
  if (!locale) {
    const initData = await client.contentManagerInit();
    const contentTypes = initData.contentTypes || [];
    const contentType = contentTypes.find((ct: any) => ct.uid === contentTypeUid);

    if (contentType?.pluginOptions?.i18n?.localized) {
      const locales = await client.adminRequest<any[]>('/i18n/locales');
      const defaultLocale = locales.find((l: any) => l.isDefault);
      return defaultLocale?.code;
    }
  }

  return locale;
}

/**
 * Helper function to fetch entry and validate zone field
 */
async function fetchEntryAndValidateZone(
  client: StrapiClient,
  contentTypeUid: string,
  documentId: string,
  zoneField: string,
  locale?: string
) {
  const current = await client.getEntries(contentTypeUid, {
    filters: { documentId: { $eq: documentId } },
    locale: locale,
    populate: '*'
  });
  
  if (!current.data || current.data.length === 0) {
    throw new Error(`Entry with documentId ${documentId} not found`);
  }

  const entry = current.data[0];
  
  if (!Array.isArray(entry[zoneField])) {
    throw new Error(`Field '${zoneField}' is not a dynamic zone or does not exist`);
  }

  return entry;
}

export function sectionManagementTools(client: StrapiClient): Tool[] {
  return [
    {
      name: 'entry_section_add',
      description: 'Add a new section to a dynamic zone at a specific position without affecting other sections.',
      inputSchema: z.object({
        contentTypeUid: RequiredString.describe('The content type UID (e.g., "api::landing-page.landing-page")'),
        documentId: RequiredString.describe('The document ID of the entry'),
        locale: OptionalString.describe('The locale to update (e.g., "en", "fr", "ru"). Required for i18n-enabled content types'),
        zoneField: RequiredString.describe('The name of the dynamic zone field (e.g., "sections")'),
        section: z.record(z.any()).describe('The section data to add. Must include __component field'),
        position: z.number().optional().describe('Position to insert the section (0-based index). If not provided, appends to the end'),
        publish: z.boolean().optional().default(true).describe('Whether to publish the entry immediately (default: true)')
      }),
      execute: async (args) => {
        try {
          const locale = await ensureLocaleForI18nContent(client, args.contentTypeUid, args.locale);
          
          // Validate section has __component
          if (!args.section.__component) {
            throw new Error('Section must include __component field');
          }

          // Fetch entry and validate zone field
          const entry = await fetchEntryAndValidateZone(client, args.contentTypeUid, args.documentId, args.zoneField, locale);
          
          // Clean the entry to remove metadata fields
          const cleanedEntry = cleanEntryForUpdate(entry);
          
          // Add section at specified position
          const sections = [...entry[args.zoneField]];
          const position = args.position ?? sections.length;
          sections.splice(position, 0, args.section);
          cleanedEntry[args.zoneField] = sections;
          
          // Update entry
          if (args.publish) {
            return await client.updateEntryAndPublish(args.contentTypeUid, args.documentId, cleanedEntry, locale);
          } else {
            return await client.updateEntryDraft(args.contentTypeUid, args.documentId, cleanedEntry, locale);
          }
        } catch (error: any) {
          // Enhanced error handling for validation errors
          if (error.details?.errors) {
            const fieldErrors = error.details.errors.map((e: any) => 
              `${e.path?.join('.') || 'unknown'}: ${e.message}`
            ).join(', ');
            throw new Error(`Validation failed: ${fieldErrors}`);
          }
          throw error;
        }
      }
    },
    {
      name: 'entry_section_update',
      description: 'Update a specific section in a dynamic zone by index without affecting other sections.',
      inputSchema: z.object({
        contentTypeUid: RequiredString.describe('The content type UID (e.g., "api::landing-page.landing-page")'),
        documentId: RequiredString.describe('The document ID of the entry'),
        locale: OptionalString.describe('The locale to update (e.g., "en", "fr", "ru"). Required for i18n-enabled content types'),
        zoneField: RequiredString.describe('The name of the dynamic zone field (e.g., "sections")'),
        sectionIndex: z.number().min(0).describe('Index of the section to update (0-based)'),
        section: z.record(z.any()).describe('The updated section data. Must include __component field'),
        publish: z.boolean().optional().default(true).describe('Whether to publish the entry immediately (default: true)')
      }),
      execute: async (args) => {
        try {
          const locale = await ensureLocaleForI18nContent(client, args.contentTypeUid, args.locale);
          
          // Validate section has __component
          if (!args.section.__component) {
            throw new Error('Section must include __component field');
          }

          // Fetch entry and validate zone field
          const entry = await fetchEntryAndValidateZone(client, args.contentTypeUid, args.documentId, args.zoneField, locale);
          
          // Clean the entry to remove metadata fields
          const cleanedEntry = cleanEntryForUpdate(entry);
          
          // Validate section index
          const sections = entry[args.zoneField];
          if (args.sectionIndex >= sections.length || args.sectionIndex < 0) {
            throw new Error(`Section index ${args.sectionIndex} is out of range. Available sections: 0-${sections.length - 1}`);
          }
          
          // Update specific section
          sections[args.sectionIndex] = args.section;
          cleanedEntry[args.zoneField] = sections;
          
          // Update entry
          if (args.publish) {
            return await client.updateEntryAndPublish(args.contentTypeUid, args.documentId, cleanedEntry, locale);
          } else {
            return await client.updateEntryDraft(args.contentTypeUid, args.documentId, cleanedEntry, locale);
          }
        } catch (error: any) {
          // Enhanced error handling for validation errors
          if (error.details?.errors) {
            const fieldErrors = error.details.errors.map((e: any) => 
              `${e.path?.join('.') || 'unknown'}: ${e.message}`
            ).join(', ');
            throw new Error(`Validation failed: ${fieldErrors}`);
          }
          throw error;
        }
      }
    },
    {
      name: 'entry_section_delete',
      description: 'Delete a specific section from a dynamic zone by index without affecting other sections.',
      inputSchema: z.object({
        contentTypeUid: RequiredString.describe('The content type UID (e.g., "api::landing-page.landing-page")'),
        documentId: RequiredString.describe('The document ID of the entry'),
        locale: OptionalString.describe('The locale to update (e.g., "en", "fr", "ru"). Required for i18n-enabled content types'),
        zoneField: RequiredString.describe('The name of the dynamic zone field (e.g., "sections")'),
        sectionIndex: z.number().min(0).describe('Index of the section to delete (0-based)'),
        publish: z.boolean().optional().default(true).describe('Whether to publish the entry immediately (default: true)')
      }),
      execute: async (args) => {
        try {
          const locale = await ensureLocaleForI18nContent(client, args.contentTypeUid, args.locale);

          // Fetch entry and validate zone field
          const entry = await fetchEntryAndValidateZone(client, args.contentTypeUid, args.documentId, args.zoneField, locale);
          
          // Clean the entry to remove metadata fields
          const cleanedEntry = cleanEntryForUpdate(entry);
          
          // Validate section index
          const sections = entry[args.zoneField];
          if (args.sectionIndex >= sections.length || args.sectionIndex < 0) {
            throw new Error(`Section index ${args.sectionIndex} is out of range. Available sections: 0-${sections.length - 1}`);
          }
          
          // Remove section
          sections.splice(args.sectionIndex, 1);
          cleanedEntry[args.zoneField] = sections;
          
          // Update entry
          if (args.publish) {
            return await client.updateEntryAndPublish(args.contentTypeUid, args.documentId, cleanedEntry, locale);
          } else {
            return await client.updateEntryDraft(args.contentTypeUid, args.documentId, cleanedEntry, locale);
          }
        } catch (error: any) {
          // Enhanced error handling for validation errors
          if (error.details?.errors) {
            const fieldErrors = error.details.errors.map((e: any) => 
              `${e.path?.join('.') || 'unknown'}: ${e.message}`
            ).join(', ');
            throw new Error(`Validation failed: ${fieldErrors}`);
          }
          throw error;
        }
      }
    },
    {
      name: 'entry_section_reorder',
      description: 'Move a section from one position to another within a dynamic zone without affecting other sections.',
      inputSchema: z.object({
        contentTypeUid: RequiredString.describe('The content type UID (e.g., "api::landing-page.landing-page")'),
        documentId: RequiredString.describe('The document ID of the entry'),
        locale: OptionalString.describe('The locale to update (e.g., "en", "fr", "ru"). Required for i18n-enabled content types'),
        zoneField: RequiredString.describe('The name of the dynamic zone field (e.g., "sections")'),
        fromIndex: z.number().min(0).describe('Current index of the section to move (0-based)'),
        toIndex: z.number().min(0).describe('Target index to move the section to (0-based)'),
        publish: z.boolean().optional().default(true).describe('Whether to publish the entry immediately (default: true)')
      }),
      execute: async (args) => {
        try {
          const locale = await ensureLocaleForI18nContent(client, args.contentTypeUid, args.locale);

          // Fetch entry and validate zone field
          const entry = await fetchEntryAndValidateZone(client, args.contentTypeUid, args.documentId, args.zoneField, locale);
          
          // Clean the entry to remove metadata fields
          const cleanedEntry = cleanEntryForUpdate(entry);
          
          // Validate section indices
          const sections = entry[args.zoneField];
          if (args.fromIndex >= sections.length || args.fromIndex < 0) {
            throw new Error(`From index ${args.fromIndex} is out of range. Available sections: 0-${sections.length - 1}`);
          }
          if (args.toIndex >= sections.length || args.toIndex < 0) {
            throw new Error(`To index ${args.toIndex} is out of range. Available sections: 0-${sections.length - 1}`);
          }
          
          // Reorder sections
          const [movedSection] = sections.splice(args.fromIndex, 1);
          sections.splice(args.toIndex, 0, movedSection);
          cleanedEntry[args.zoneField] = sections;
          
          // Update entry
          if (args.publish) {
            return await client.updateEntryAndPublish(args.contentTypeUid, args.documentId, cleanedEntry, locale);
          } else {
            return await client.updateEntryDraft(args.contentTypeUid, args.documentId, cleanedEntry, locale);
          }
        } catch (error: any) {
          // Enhanced error handling for validation errors
          if (error.details?.errors) {
            const fieldErrors = error.details.errors.map((e: any) => 
              `${e.path?.join('.') || 'unknown'}: ${e.message}`
            ).join(', ');
            throw new Error(`Validation failed: ${fieldErrors}`);
          }
          throw error;
        }
      }
    }
  ];
}