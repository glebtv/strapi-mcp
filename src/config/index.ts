import dotenv from "dotenv";

dotenv.config();

export const config = {
  strapi: {
    url: process.env.STRAPI_URL || "http://localhost:1337",
    apiToken: process.env.STRAPI_API_TOKEN,
    devMode: process.env.STRAPI_DEV_MODE === "true",
    adminEmail: process.env.STRAPI_ADMIN_EMAIL,
    adminPassword: process.env.STRAPI_ADMIN_PASSWORD,
  },
  server: {
    name: "strapi-mcp",
    version: "0.2.0",
  },
};

let hasValidated = false;

export function validateConfig(): void {
  const { strapi } = config;

  // Validate that we have either API token or admin credentials
  if (!strapi.apiToken && !(strapi.adminEmail && strapi.adminPassword)) {
    console.error("[Error] Missing required authentication. Please provide either STRAPI_API_TOKEN or both STRAPI_ADMIN_EMAIL and STRAPI_ADMIN_PASSWORD environment variables");
    process.exit(1);
  }

  // Only validate API token format if we don't have admin credentials
  if (!strapi.adminEmail || !strapi.adminPassword) {
    if (strapi.apiToken && (
      strapi.apiToken === "strapi_token" ||
      strapi.apiToken === "your-api-token-here" ||
      strapi.apiToken.includes("placeholder")
    )) {
      console.error(
        "[Error] STRAPI_API_TOKEN appears to be a placeholder value. Please provide a real API token from your Strapi admin panel or use admin credentials instead."
      );
      process.exit(1);
    }
  }

  // Only log connection message once
  if (!hasValidated) {
    console.error(`[Setup] Connecting to Strapi at ${strapi.url}`);
    console.error(`[Setup] Development mode: ${strapi.devMode ? "enabled" : "disabled"}`);
    
    // Determine authentication method
    if (strapi.adminEmail && strapi.adminPassword) {
      console.error(`[Setup] Authentication: Using admin credentials (priority)`);
      if (strapi.apiToken && strapi.apiToken !== "strapi_token" && !strapi.apiToken.includes("placeholder")) {
        console.error(`[Setup] API token also available as fallback`);
      }
    } else if (strapi.apiToken) {
      console.error(`[Setup] Authentication: Using API token`);
    }
    
    hasValidated = true;
  }
}
