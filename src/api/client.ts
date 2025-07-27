import axios, { AxiosInstance } from "axios";
import qs from "qs";
import { config } from "../config/index.js";
import { ExtendedMcpError, ExtendedErrorCode } from "../errors/index.js";

export const strapiClient: AxiosInstance = axios.create({
  baseURL: config.strapi.url,
  headers: {
    "Content-Type": "application/json",
  },
  validateStatus: function (status) {
    return status < 500;
  },
  paramsSerializer: {
    serialize: (params) => {
      return qs.stringify(params, {
        encodeValuesOnly: true,
        arrayFormat: "brackets",
      });
    },
  },
});

if (config.strapi.apiToken) {
  strapiClient.defaults.headers.common["Authorization"] = `Bearer ${config.strapi.apiToken}`;
}

let connectionValidated = false;

// Store admin JWT token if we log in
let adminJwtToken: string | null = null;

// Export a function to get the admin token (for media uploads)
export function getAdminJwtToken(): string | null {
  return adminJwtToken;
}

/**
 * Log in to the Strapi admin API using provided credentials
 */
export async function loginToStrapiAdmin(): Promise<boolean> {
  const email = config.strapi.adminEmail;
  const password = config.strapi.adminPassword;

  if (!email || !password) {
    console.error("[Auth] No admin credentials found in config, skipping admin login");
    return false;
  }

  try {
    console.error(
      `[Auth] Attempting login to Strapi admin at ${config.strapi.url}/admin/login as ${email}`
    );

    const response = await axios.post(`${config.strapi.url}/admin/login`, {
      email,
      password,
    });

    if (response.data && response.data.data && response.data.data.token) {
      adminJwtToken = response.data.data.token;
      console.error("[Auth] Successfully logged in to Strapi admin");
      return true;
    } else {
      console.error("[Auth] Login response missing token");
      return false;
    }
  } catch (error) {
    console.error("[Auth] Failed to log in to Strapi admin:");
    if (axios.isAxiosError(error)) {
      console.error(`[Auth] Status: ${error.response?.status}`);
      console.error(`[Auth] Response data:`, error.response?.data);
    } else {
      console.error(error);
    }
    return false;
  }
}

/**
 * Make a request to the admin API using the admin JWT token
 */
export async function makeAdminApiRequest(
  endpoint: string,
  method: string = "get",
  data?: any,
  params?: Record<string, any>
): Promise<any> {
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
    const response = await axios({
      method,
      url: fullUrl,
      headers: {
        Authorization: `Bearer ${adminJwtToken}`,
        "Content-Type": "application/json",
      },
      data,
      params,
      timeout: 30000, // 30 second timeout
    });

    console.error(`[Admin API] Response status: ${response.status}`);
    return response.data;
  } catch (error) {
    console.error(`[Admin API] Request to ${endpoint} failed:`);

    if (axios.isAxiosError(error)) {
      console.error(`[Admin API] Status: ${error.response?.status}`);
      console.error(`[Admin API] Error data: ${JSON.stringify(error.response?.data)}`);

      // Check if it's an auth error (e.g., token expired)
      if (error.response?.status === 401 && adminJwtToken) {
        console.error("[Admin API] Admin token might be expired. Attempting re-login...");
        adminJwtToken = null; // Clear expired token
        const loginSuccess = await loginToStrapiAdmin();
        if (loginSuccess) {
          console.error("[Admin API] Re-login successful. Retrying original request...");
          // Retry the request once after successful re-login
          try {
            const retryResponse = await axios({
              method,
              url: fullUrl,
              headers: {
                Authorization: `Bearer ${adminJwtToken}`,
                "Content-Type": "application/json",
              },
              data,
              params,
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

export async function validateStrapiConnection(): Promise<void> {
  if (connectionValidated) return;

  try {
    let response;
    let authMethod = "";

    // First try admin authentication if available
    if (config.strapi.adminEmail && config.strapi.adminPassword) {
      try {
        // Test admin login
        await loginToStrapiAdmin();
        const adminData = await makeAdminApiRequest("/admin/users/me");
        if (adminData) {
          authMethod = "admin credentials";
          console.error("[Setup] ✓ Admin authentication successful");
          console.error(`[Setup] ✓ Connection to Strapi successful using ${authMethod}`);
          connectionValidated = true;
          return;
        }
      } catch {
        console.error("[Setup] Admin authentication failed, trying API token...");
      }
    }

    // If admin failed or not available, try API token
    try {
      response = await strapiClient.get("/api/upload/files?pagination[limit]=1");
      authMethod = "API token";
      console.error("[Setup] ✓ API token authentication successful");
    } catch {
      response = await strapiClient.get("/");
      authMethod = "server connection";
      console.error("[Setup] ✓ Server is reachable");
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
    let errorMessage = "Cannot connect to Strapi instance";

    if (axios.isAxiosError(error)) {
      if (error.code === "ECONNREFUSED") {
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
