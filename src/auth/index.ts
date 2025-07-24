import axios from "axios";
import { config } from "../config/index.js";

let adminJwtToken: string | null = null;

export async function loginToStrapiAdmin(): Promise<boolean> {
  const email = process.env.STRAPI_ADMIN_EMAIL;
  const password = process.env.STRAPI_ADMIN_PASSWORD;

  if (!email || !password) {
    console.error("[Auth] No admin credentials found in process.env, skipping admin login");
    return false;
  }

  try {
    console.error(`[Auth] Attempting login to Strapi admin at ${config.strapi.url}/admin/login as ${email}`);
    console.error(`[Auth] Full URL being used: ${config.strapi.url}/admin/login`);
    
    console.error(`[Auth] Sending POST request with email and password`);
    const response = await axios.post(`${config.strapi.url}/admin/login`, { 
      email, 
      password 
    });
    
    console.error(`[Auth] Response status: ${response.status}`);
    console.error(`[Auth] Response headers:`, JSON.stringify(response.headers));
    
    if (response.data && response.data.data && response.data.data.token) {
      adminJwtToken = response.data.data.token;
      console.error("[Auth] Successfully logged in to Strapi admin");
      console.error(`[Auth] Token received (first 20 chars): ${adminJwtToken?.substring(0, 20)}...`);
      return true;
    } else {
      console.error("[Auth] Login response missing token");
      console.error(`[Auth] Response data:`, JSON.stringify(response.data));
      return false;
    }
  } catch (error) {
    console.error("[Auth] Failed to log in to Strapi admin:");
    if (axios.isAxiosError(error)) {
      console.error(`[Auth] Status: ${error.response?.status}`);
      console.error(`[Auth] Response data:`, error.response?.data);
      console.error(`[Auth] Request URL: ${error.config?.url}`);
      console.error(`[Auth] Request method: ${error.config?.method}`);
    } else {
      console.error(error);
    }
    return false;
  }
}

export async function makeAdminApiRequest(endpoint: string, method: string = 'get', data?: any, params?: Record<string, any>): Promise<any> {
  if (!adminJwtToken) {
    console.error(`[Admin API] No token available, attempting login...`);
    const success = await loginToStrapiAdmin();
    if (!success) {
      console.error(`[Admin API] Login failed. Cannot authenticate for admin API access.`);
      throw new Error("Not authenticated for admin API access");
    }
    console.error(`[Admin API] Login successful, proceeding with request.`);
  }
  
  const fullUrl = `${config.strapi.url}${endpoint}`;
  console.error(`[Admin API] Making ${method.toUpperCase()} request to: ${fullUrl}`);
  
  if (data) {
    console.error(`[Admin API] Request payload: ${JSON.stringify(data, null, 2)}`);
  }
  
  try {
    console.error(`[Admin API] Sending request with Authorization header using token: ${adminJwtToken?.substring(0, 20)}...`);
    const response = await axios({
      method,
      url: fullUrl,
      headers: {
        'Authorization': `Bearer ${adminJwtToken}`,
        'Content-Type': 'application/json'
      },
      data,
      params
    });

    console.error(`[Admin API] Response status: ${response.status}`);
    if (response.data) {
      console.error(`[Admin API] Response received successfully`);
    }
    return response.data;
  } catch (error) {
    console.error(`[Admin API] Request to ${endpoint} failed:`);
    
    if (axios.isAxiosError(error)) {
      console.error(`[Admin API] Status: ${error.response?.status}`);
      console.error(`[Admin API] Error data: ${JSON.stringify(error.response?.data)}`);
      console.error(`[Admin API] Error headers: ${JSON.stringify(error.response?.headers)}`);
      
      if (error.response?.status === 401 && adminJwtToken) {
        console.error("[Admin API] Admin token might be expired. Attempting re-login...");
        adminJwtToken = null;
        const loginSuccess = await loginToStrapiAdmin();
        if (loginSuccess) {
          console.error("[Admin API] Re-login successful. Retrying original request...");
          try {
            const retryResponse = await axios({
              method,
              url: fullUrl,
              headers: {
                'Authorization': `Bearer ${adminJwtToken}`,
                'Content-Type': 'application/json'
              },
              data,
              params
            });
            console.error(`[Admin API] Retry successful, status: ${retryResponse.status}`);
            return retryResponse.data;
          } catch (retryError) {
            console.error(`[Admin API] Retry failed:`, retryError);
            throw retryError;
          }
        } else {
          console.error("[Admin API] Re-login failed. Throwing original error.");
          throw new Error("Admin re-authentication failed after token expiry.");
        }
      }
    } else {
      console.error(`[Admin API] Non-Axios error:`, error);
    }
    throw error;
  }
}

export function getAdminToken(): string | null {
  return adminJwtToken;
}

export function hasAdminCredentials(): boolean {
  return !!(config.strapi.admin.email && config.strapi.admin.password);
}