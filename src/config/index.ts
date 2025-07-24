import dotenv from 'dotenv';

dotenv.config();

export const config = {
  strapi: {
    url: process.env.STRAPI_URL || "http://localhost:1337",
    apiToken: process.env.STRAPI_API_TOKEN,
    devMode: process.env.STRAPI_DEV_MODE === "true"
  },
  server: {
    name: "strapi-mcp",
    version: "0.2.0"
  }
};

export function validateConfig(): void {
  const { strapi } = config;
  
  if (!strapi.apiToken) {
    console.error("[Error] Missing required STRAPI_API_TOKEN environment variable");
    process.exit(1);
  }

  if (strapi.apiToken === "strapi_token" || strapi.apiToken === "your-api-token-here" || strapi.apiToken.includes("placeholder")) {
    console.error("[Error] STRAPI_API_TOKEN appears to be a placeholder value. Please provide a real API token from your Strapi admin panel.");
    process.exit(1);
  }

  console.error(`[Setup] Connecting to Strapi at ${strapi.url}`);
}