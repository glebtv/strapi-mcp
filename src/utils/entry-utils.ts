/**
 * Helper function to clean entry data for update operations
 * Removes metadata fields that shouldn't be sent back to Strapi
 */
export function cleanEntryForUpdate(entry: any): any {
  // List of fields that are metadata and shouldn't be sent in updates
  const metadataFields = [
    'id',
    'documentId',
    'createdAt',
    'updatedAt',
    'publishedAt',
    'locale',
    'status',
    'createdBy',
    'updatedBy',
    'localizations',
    'meta'
  ];

  // Create a clean copy without metadata fields
  const cleanEntry: any = {};
  for (const key in entry) {
    if (!metadataFields.includes(key) && entry.hasOwnProperty(key)) {
      cleanEntry[key] = entry[key];
    }
  }

  return cleanEntry;
}