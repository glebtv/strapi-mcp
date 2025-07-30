import dotenv from "dotenv";
import { logger } from "../utils/logger.js";

dotenv.config();

// In test mode, also load .env.test
if (process.env.NODE_ENV === "test") {
  // Don't override if admin credentials are explicitly set to empty
  const hasExplicitEmptyAdmin =
    process.env.STRAPI_ADMIN_EMAIL === "" || process.env.STRAPI_ADMIN_PASSWORD === "";
  if (!hasExplicitEmptyAdmin) {
    dotenv.config({ path: ".env.test", override: true });
  }
}

export const config = {
  strapi: {
    url: process.env.STRAPI_URL || "http://localhost:1337",
    devMode: process.env.STRAPI_DEV_MODE === "true",
    adminEmail: process.env.STRAPI_ADMIN_EMAIL,
    adminPassword: process.env.STRAPI_ADMIN_PASSWORD,
  },
  server: {
    name: "strapi-mcp",
    version: "0.2.0",
  },
};

// Debug log config in test mode
if (process.env.NODE_ENV === "test") {
  logger.debug(`[Config] Loaded configuration:`);
  logger.debug(`[Config] URL: ${config.strapi.url}`);
  logger.debug(`[Config] Admin Email: ${config.strapi.adminEmail ? "Set" : "Not set"}`);
  logger.debug(`[Config] Admin Password: ${config.strapi.adminPassword ? "Set" : "Not set"}`);
}

let hasValidated = false;

export function validateConfig(): void {
  const { strapi } = config;

  // Remove verbose debug logging in test mode to reduce noise

  // Validate that we have admin credentials
  if (!strapi.adminEmail || !strapi.adminPassword) {
    logger.always(
      "[Error] Missing required authentication. Please provide both STRAPI_ADMIN_EMAIL and STRAPI_ADMIN_PASSWORD environment variables"
    );
    process.exit(1);
  }

  // Only log connection message once
  if (!hasValidated) {
    logger.info(`[Setup] Connecting to Strapi at ${strapi.url}`);
    logger.info(`[Setup] Development mode: ${strapi.devMode ? "enabled" : "disabled"}`);
    logger.info(`[Setup] Authentication: Using admin credentials`);

    hasValidated = true;
  }
}
