import { beforeAll } from 'vitest';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Ensure required environment variables are set
beforeAll(() => {
  const requiredEnvVars = ['STRAPI_URL', 'STRAPI_API_TOKEN'];
  
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`Missing required environment variable: ${envVar}`);
    }
  }
  
  console.log('Test environment configured:');
  console.log(`- Strapi URL: ${process.env.STRAPI_URL}`);
  console.log(`- API Token: ${process.env.STRAPI_API_TOKEN ? 'Set' : 'Not set'}`);
});