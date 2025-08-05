import { StrapiClient } from '../strapi-client.js';
import { Tool } from './types.js';
import { contentManagementTools } from './content-management.js';
import { mediaTools } from './media.js';
import { schemaTools } from './schema.js';
import { contentTypeBuilderTools } from './content-type-builder.js';
import { componentTools } from './component.js';
import { relationTools } from './relation.js';
import { directApiTool } from './direct-api.js';
import { apiTokenTools } from './api-token.js';
import { i18nTools } from './i18n.js';

export function getTools(client: StrapiClient, devMode: boolean = false): Record<string, Tool> {
  const tools: Record<string, Tool> = {};

  // Combine all tool groups
  const allTools = [
    ...contentManagementTools(client),
    ...mediaTools(client),
    ...schemaTools(client),
    // Only include dangerous schema modification tools in dev mode
    ...(devMode ? contentTypeBuilderTools(client) : []),
    ...(devMode ? componentTools(client) : []),
    ...relationTools(client),
    ...apiTokenTools(client),
    ...i18nTools(client),
    directApiTool(client)
  ];

  // Index by name
  for (const tool of allTools) {
    tools[tool.name] = tool;
  }

  return tools;
}