import axios, { AxiosInstance } from "axios";
import { config } from "../config/index.js";
import { ExtendedMcpError, ExtendedErrorCode } from "../errors/index.js";

export const strapiClient: AxiosInstance = axios.create({
  baseURL: config.strapi.url,
  headers: {
    "Content-Type": "application/json",
  },
  validateStatus: function (status) {
    return status < 500;
  }
});

if (config.strapi.apiToken) {
  strapiClient.defaults.headers.common['Authorization'] = `Bearer ${config.strapi.apiToken}`;
}

let connectionValidated = false;

export async function validateStrapiConnection(): Promise<void> {
  if (connectionValidated) return;
  
  try {
    console.error("[Setup] Validating connection to Strapi...");
    
    let response;
    let authMethod = "";
    
    if (config.strapi.admin.email && config.strapi.admin.password) {
      try {
        const { loginToStrapiAdmin, makeAdminApiRequest } = await import("../auth/index.js");
        await loginToStrapiAdmin();
        const data = await makeAdminApiRequest('/admin/users/me');
        if (data) {
          response = { status: 200, data }; // Create a response-like object
          authMethod = "admin credentials";
          console.error("[Setup] ✓ Admin authentication successful");
        }
      } catch (adminError) {
        console.error("[Setup] Admin authentication failed, trying API token...");
        // Don't throw here, try API token method instead
      }
    }
    
    if (!response) {
      try {
        response = await strapiClient.get('/api/upload/files?pagination[limit]=1');
        authMethod = "API token";
        console.error("[Setup] ✓ API token authentication successful");
      } catch (apiError) {
        console.error("[Setup] API token test failed, trying root endpoint...");
        response = await strapiClient.get('/');
        authMethod = "server connection";
        console.error("[Setup] ✓ Server is reachable");
      }
    }
    
    if (response && response.status >= 200 && response.status < 300) {
      console.error(`[Setup] ✓ Connection to Strapi successful using ${authMethod}`);
      connectionValidated = true;
    } else if (response) {
      throw new Error(`Unexpected response status: ${response.status}`);
    } else {
      throw new Error(`No response received from Strapi server`);
    }
  } catch (error: any) {
    console.error("[Setup] ✗ Failed to connect to Strapi");
    
    let errorMessage = "Cannot connect to Strapi instance";
    
    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNREFUSED') {
        errorMessage += `: Connection refused. Is Strapi running at ${config.strapi.url}?`;
      } else if (error.response?.status === 401) {
        errorMessage += `: Authentication failed. Check your API token or admin credentials.`;
      } else if (error.response?.status === 403) {
        errorMessage += `: Access forbidden. Your API token may lack necessary permissions.`;
      } else if (error.response?.status === 404) {
        errorMessage += `: Endpoint not found. Strapi server might be running but not properly configured.`;
      } else {
        errorMessage += `: ${error.message}`;
      }
    } else {
      errorMessage += `: ${error.message}`;
    }
    
    throw new ExtendedMcpError(ExtendedErrorCode.InternalError, errorMessage);
  }
}