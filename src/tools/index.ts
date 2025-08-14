import { StrapiClient } from '../strapi-client.js';
import { Tool } from './types.js';
import { contentManagementTools } from './content-management.js';
import { mediaTools } from './media.js';
import { relationTools } from './relation.js';
import { directApiTool } from './direct-api.js';
import { apiTokenTools } from './api-token.js';
import { i18nTools } from './i18n.js';
import { sectionManagementTools } from './section-management.js';

export function getTools(client: StrapiClient): Record<string, Tool> {
  const tools: Record<string, Tool> = {};

  // Combine all tool groups
  const allTools = [
    ...contentManagementTools(client),
    ...mediaTools(client),
    ...relationTools(client),
    ...apiTokenTools(client),
    ...i18nTools(client),
    ...sectionManagementTools(client),
    directApiTool(client)
  ];

  // Index by name
  for (const tool of allTools) {
    tools[tool.name] = tool;
  }

  return tools;
}