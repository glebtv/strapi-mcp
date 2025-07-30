// Jest setup file - no need to import beforeAll as it's global in Jest
import dotenv from 'dotenv';
import axios from 'axios';
import { getSharedClient, closeSharedClient } from './helpers/shared-client.js';

// Load environment variables - prioritize .env.test
dotenv.config({ path: '.env.test' });
dotenv.config(); // Load .env as fallback

// Global lock to ensure only one test waits for Strapi at a time
let strapiReadyPromise: Promise<void> | null = null;
let strapiIsReady = false;

// No longer loading from test-tokens.json - using environment variables directly

// Helper function to check if Strapi is responding
async function checkStrapiHealth() {
  try {
    const response = await axios.get(`${process.env.STRAPI_URL}/_health`, {
      timeout: 1000,
      validateStatus: () => true
    });
    return response.status === 204;
  } catch (error) {
    return false;
  }
}

// Helper function to wait for Strapi to be ready
async function waitForStrapi(maxRetries = 30, delay = 1000) {
  // First check if Strapi is still responding
  if (strapiIsReady) {
    const isHealthy = await checkStrapiHealth();
    if (!isHealthy) {
      // Strapi has restarted, reset the state
      strapiIsReady = false;
      strapiReadyPromise = null;
    } else {
      return;
    }
  }

  // If another test is already waiting, wait for that to complete
  if (strapiReadyPromise) {
    return strapiReadyPromise;
  }

  // Create a new promise that other tests can wait on
  strapiReadyPromise = (async () => {
    const strapiUrl = process.env.STRAPI_URL;
    // Waiting for Strapi to be ready...
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await axios.get(`${strapiUrl}/_health`, {
          timeout: 1000,
          validateStatus: () => true
        });
        if (response.status === 204) {
          strapiIsReady = true;
          return;
        }
      } catch (error) {
        // Connection refused, Strapi is not ready yet
      }
      
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    strapiReadyPromise = null;
    throw new Error(`Strapi did not become ready after ${maxRetries} attempts`);
  })();

  return strapiReadyPromise;
}

// Ensure required environment variables are set
beforeAll(async () => {
  // Check that we have admin credentials
  const hasAdminCreds = !!(process.env.STRAPI_ADMIN_EMAIL && process.env.STRAPI_ADMIN_PASSWORD);
  
  if (!process.env.STRAPI_URL) {
    throw new Error('Missing required environment variable: STRAPI_URL');
  }
  
  if (!hasAdminCreds) {
    throw new Error('Missing authentication: Both STRAPI_ADMIN_EMAIL and STRAPI_ADMIN_PASSWORD must be set');
  }
  
  // Test environment configured with admin credentials
  
  // Wait for Strapi to be ready before running tests
  await waitForStrapi();
  
  // Create the shared MCP client instance that will be used by all tests
  // This ensures we only login once and reuse the JWT token
  await getSharedClient();
});

// Clean up after all tests
afterAll(async () => {
  await closeSharedClient();
  // Give processes time to clean up
  await new Promise(resolve => setTimeout(resolve, 500));
}, 10000);