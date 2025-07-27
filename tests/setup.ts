import { beforeAll } from 'vitest';
import dotenv from 'dotenv';

// Load environment variables - prioritize .env.test
dotenv.config({ path: '.env.test' });
dotenv.config(); // Load .env as fallback

// Ensure required environment variables are set
beforeAll(() => {
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
});