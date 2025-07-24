export function generateSlug(text: string | number): string {
  const str = String(text); // Convert to string if needed
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "") // Remove special characters
    .replace(/[\s_-]+/g, "-") // Replace spaces and underscores with hyphens
    .replace(/^-+|-+$/g, ""); // Remove leading/trailing hyphens
}

export function ensureSlugField(contentType: string, data: any, _schema?: any): any {
  // For now, handle known content types that require slugs
  const slugRequiredTypes = [
    "api::project.project",
    "api::technology.technology",
    "api::service.service",
    "api::client.client",
  ];

  if (slugRequiredTypes.includes(contentType)) {
    // If slug is missing but we have a name/title field, generate it
    if (!data.slug && (data.name || data.title)) {
      const baseText = data.name || data.title;
      data.slug = generateSlug(baseText);
      console.error(`[Utils] Auto-generated slug: ${data.slug} from: ${baseText}`);
    }
  }

  return data;
}
