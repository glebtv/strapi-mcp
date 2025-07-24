import { config } from "../config/index.js";

export function hasApiToken(): boolean {
  return !!config.strapi.apiToken;
}
