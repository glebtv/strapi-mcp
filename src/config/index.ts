import dotenv from 'dotenv';

dotenv.config();

export const config = {
  strapi: {
    url: process.env.STRAPI_URL || "http://localhost:1337",
    apiToken: process.env.STRAPI_API_TOKEN,
    devMode: process.env.STRAPI_DEV_MODE === "true",
    admin: {
      email: process.env.STRAPI_ADMIN_EMAIL,
      password: process.env.STRAPI_ADMIN_PASSWORD
    }
  },
  server: {
    name: "strapi-mcp",
    version: "0.2.0"
  }
};

export function validateConfig(): void {
  const { strapi } = config;
  
  if (!strapi.apiToken && !(strapi.admin.email && strapi.admin.password)) {
    console.error("[Error] Missing required authentication. Please provide either STRAPI_API_TOKEN or both STRAPI_ADMIN_EMAIL and STRAPI_ADMIN_PASSWORD environment variables");
    process.exit(1);
  }

  if (!strapi.admin.email || !strapi.admin.password) {
    if (strapi.apiToken && (strapi.apiToken === "strapi_token" || strapi.apiToken === "your-api-token-here" || strapi.apiToken.includes("placeholder"))) {
      console.error("[Error] STRAPI_API_TOKEN appears to be a placeholder value. Please provide a real API token from your Strapi admin panel or use admin credentials instead.");
      process.exit(1);
    }
  }

  console.error(`[Setup] Connecting to Strapi at ${strapi.url}`);
  console.error(`[Setup] Development mode: ${strapi.devMode ? "enabled" : "disabled"}`);

  if (strapi.admin.email && strapi.admin.password) {
    console.error(`[Setup] Authentication: Using admin credentials (priority)`);
    if (strapi.apiToken && strapi.apiToken !== "strapi_token" && !strapi.apiToken.includes("placeholder")) {
      console.error(`[Setup] API token also available as fallback`);
    }
  } else if (strapi.apiToken) {
    console.error(`[Setup] Authentication: Using API token`);
  } else {
    console.error(`[Setup] Authentication: ERROR - No valid authentication method available`);
  }
}