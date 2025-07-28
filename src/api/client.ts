import axios, { AxiosInstance } from "axios";
import qs from "qs";
import { config } from "../config/index.js";
import { ExtendedMcpError, ExtendedErrorCode } from "../errors/index.js";
import { logger } from "../utils/logger.js";
import { setTimeout } from "timers/promises";

// Check if we're in a test environment
const isTest = process.env.NODE_ENV === "test";

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

// Set API token for REST API calls if available
// Note: Admin JWT tokens don't work for REST API endpoints
if (config.strapi.apiToken) {
  strapiClient.defaults.headers.common["Authorization"] = `Bearer ${config.strapi.apiToken}`;
  logger.info("[Setup] API token set for REST API calls");
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
// Track the last login attempt time to implement rate limiting
let lastLoginAttempt = 0;
const LOGIN_RATE_LIMIT_MS = 2000; // Minimum 2 seconds between login attempts

export async function loginToStrapiAdmin(): Promise<boolean> {
  const email = config.strapi.adminEmail;
  const password = config.strapi.adminPassword;

  if (!email || !password) {
    logger.info("[Auth] No admin credentials found in config, skipping admin login");
    return false;
  }

  // Implement rate limiting to avoid 429 errors
  const now = Date.now();
  const timeSinceLastAttempt = now - lastLoginAttempt;
  if (timeSinceLastAttempt < LOGIN_RATE_LIMIT_MS) {
    const waitTime = LOGIN_RATE_LIMIT_MS - timeSinceLastAttempt;
    logger.debug(`[Auth] Rate limiting: waiting ${waitTime}ms before login attempt`);
    await setTimeout(waitTime);
  }

  // Retry logic with exponential backoff
  const maxRetries = 3;
  let retryDelay = 1000; // Start with 1 second

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      lastLoginAttempt = Date.now();
      logger.debug(
        `[Auth] Attempting login to Strapi admin at ${config.strapi.url}/admin/login as ${email} (attempt ${attempt}/${maxRetries})`
      );

      const response = await axios.post(`${config.strapi.url}/admin/login`, {
        email,
        password,
      });

      if (response.data && response.data.data && response.data.data.token) {
        adminJwtToken = response.data.data.token;
        logger.info("[Auth] Successfully logged in to Strapi admin");

        // Important: Do NOT update strapiClient to use admin JWT token
        // Admin JWT tokens only work for admin API endpoints, not REST API endpoints
        // strapiClient should continue using API token for REST API calls
        logger.debug("[Auth] Admin JWT token stored for admin API operations only");

        return true;
      } else {
        logger.error("[Auth] Login response missing token");
        return false;
      }
    } catch (error) {
      logger.debug(`[Auth] Login attempt ${attempt} failed:`);
      if (axios.isAxiosError(error)) {
        logger.debug(`[Auth] Status: ${error.response?.status}`);
        logger.debug(`[Auth] Response data:`, error.response?.data);

        // Handle rate limiting (429)
        if (error.response?.status === 429 && attempt < maxRetries) {
          // Extract retry-after header if available
          const retryAfter = error.response.headers["retry-after"];
          const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : retryDelay;
          logger.debug(`[Auth] Rate limited (429). Waiting ${waitTime}ms before retry...`);
          await setTimeout(waitTime);
          retryDelay *= 2; // Exponential backoff
          continue;
        }
      } else {
        logger.error(error);
      }

      // If we've exhausted retries or it's not a rate limit error, return false
      if (attempt === maxRetries) {
        return false;
      }
    }
  }

  return false;
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
    logger.debug(`[Admin API] No token available, attempting login...`);
    const success = await loginToStrapiAdmin();
    if (!success) {
      logger.error(`[Admin API] Login failed. Cannot authenticate for admin API access.`);
      throw new Error("Authentication failed: Not authenticated for admin API access");
    }
    logger.debug(`[Admin API] Login successful, proceeding with request.`);
  }

  const fullUrl = `${config.strapi.url}${endpoint}`;
  logger.debug(`[Admin API] Making ${method.toUpperCase()} request to: ${fullUrl}`);

  if (data) {
    logger.debug(`[Admin API] Request payload: ${JSON.stringify(data, null, 2)}`);
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

    logger.debug(`[Admin API] Response status: ${response.status}`);
    return response.data;
  } catch (error) {
    // Check if this is an expected error in tests
    const isExpectedTestError =
      isTest &&
      axios.isAxiosError(error) &&
      error.response &&
      [400, 401, 403, 404].includes(error.response.status);

    if (!isExpectedTestError) {
      logger.error(`[Admin API] Request to ${endpoint} failed:`);

      if (axios.isAxiosError(error)) {
        logger.error(`[Admin API] Status: ${error.response?.status}`);
        logger.error(`[Admin API] Error data: ${JSON.stringify(error.response?.data)}`);
      }
    }

    if (axios.isAxiosError(error)) {
      // Check if it's an auth error (e.g., token expired)
      if (error.response?.status === 401 && adminJwtToken) {
        logger.warn("[Admin API] Admin token might be expired. Attempting re-login...");
        adminJwtToken = null; // Clear expired token
        const loginSuccess = await loginToStrapiAdmin();
        if (loginSuccess) {
          logger.info("[Admin API] Re-login successful. Retrying original request...");
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
            logger.debug(`[Admin API] Retry successful, status: ${retryResponse.status}`);
            return retryResponse.data;
          } catch (retryError) {
            logger.error(`[Admin API] Retry failed:`, retryError);
            throw retryError;
          }
        } else {
          logger.error("[Admin API] Re-login failed. Throwing original error.");
          throw new Error("Admin re-authentication failed after token expiry.");
        }
      }
    } else {
      logger.error(`[Admin API] Non-Axios error:`, error);
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
          logger.info("[Setup] ✓ Admin authentication successful");
          logger.info(`[Setup] ✓ Connection to Strapi successful using ${authMethod}`);
          connectionValidated = true;
          return;
        }
      } catch {
        logger.debug("[Setup] Admin authentication failed, trying API token...");
      }
    }

    // If admin failed or not available, try API token
    try {
      response = await strapiClient.get("/api/upload/files?pagination[limit]=1");
      authMethod = "API token";
      logger.info("[Setup] ✓ API token authentication successful");
    } catch {
      response = await strapiClient.get("/");
      authMethod = "server connection";
      logger.info("[Setup] ✓ Server is reachable");
    }

    if (response && response.status >= 200 && response.status < 300) {
      logger.info(`[Setup] ✓ Connection to Strapi successful using ${authMethod}`);
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
