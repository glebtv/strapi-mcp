import { beforeAll } from 'vitest';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import axios from 'axios';

// Load environment variables - prioritize .env.test
dotenv.config({ path: '.env.test' });
dotenv.config(); // Load .env as fallback

// Load tokens from test-tokens.json if it exists
const testTokensPath = path.join(process.cwd(), 'test-tokens.json');
if (fs.existsSync(testTokensPath)) {
  try {
    const tokens = JSON.parse(fs.readFileSync(testTokensPath, 'utf-8'));
    // Set tokens in environment if not already set
    if (!process.env.STRAPI_API_TOKEN && tokens.fullAccessToken) {
      process.env.STRAPI_API_TOKEN = tokens.fullAccessToken;
    }
    if (!process.env.STRAPI_READ_ONLY_TOKEN && tokens.readOnlyToken) {
      process.env.STRAPI_READ_ONLY_TOKEN = tokens.readOnlyToken;
    }
    // Override URL and credentials from test-tokens.json if available
    if (tokens.strapiUrl) {
      process.env.STRAPI_URL = tokens.strapiUrl;
    }
    if (tokens.adminEmail) {
      process.env.STRAPI_ADMIN_EMAIL = tokens.adminEmail;
    }
    if (tokens.adminPassword) {
      process.env.STRAPI_ADMIN_PASSWORD = tokens.adminPassword;
    }
    console.log('Loaded tokens from test-tokens.json');
  } catch (error) {
    console.warn('Failed to load test-tokens.json:', error);
  }
}

// Helper function to wait for Strapi to be ready
async function waitForStrapi(maxRetries = 30, delay = 1000) {
  const strapiUrl = process.env.STRAPI_URL;
  console.log(`Waiting for Strapi to be ready at ${strapiUrl}...`);
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await axios.get(`${strapiUrl}/_health`, {
        timeout: 1000,
        validateStatus: () => true
      });
      if (response.status === 204) {
        console.log('Strapi is ready!');
        return;
      }
    } catch (error) {
      // Connection refused, Strapi is not ready yet
    }
    
    if (i < maxRetries - 1) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw new Error(`Strapi did not become ready after ${maxRetries} attempts`);
}

// Ensure required environment variables are set
beforeAll(async () => {
  // Check that we have at least one authentication method
  const hasApiToken = !!process.env.STRAPI_API_TOKEN;
  const hasAdminCreds = !!(process.env.STRAPI_ADMIN_EMAIL && process.env.STRAPI_ADMIN_PASSWORD);
  
  if (!process.env.STRAPI_URL) {
    throw new Error('Missing required environment variable: STRAPI_URL');
  }
  
  if (!hasApiToken && !hasAdminCreds) {
    throw new Error('Missing authentication: Either STRAPI_API_TOKEN or both STRAPI_ADMIN_EMAIL and STRAPI_ADMIN_PASSWORD must be set');
  }
  
  console.log('Test environment configured:');
  console.log(`- Strapi URL: ${process.env.STRAPI_URL}`);
  console.log(`- API Token: ${hasApiToken ? 'Set' : 'Not set'}`);
  console.log(`- Admin Credentials: ${hasAdminCreds ? 'Set' : 'Not set'}`);
  
  if (hasAdminCreds && hasApiToken) {
    console.log('- Priority: Admin credentials will be used when both are available');
  }
  
  // Wait for Strapi to be ready before running tests
  await waitForStrapi();
});