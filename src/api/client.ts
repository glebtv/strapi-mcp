import axios, { AxiosInstance } from "axios";
import qs from "qs";
import { config } from "../config/index.js";
import { ExtendedMcpError, ExtendedErrorCode } from "../errors/index.js";
import { logger } from "../utils/logger.js";
import { setTimeout } from "timers/promises";
import { getCachedAdminToken, cacheAdminToken, clearTokenCache } from "../utils/token-cache.js";

// Check if we're in a test environment
const isTest = process.env.NODE_ENV === "test";

// Create axios instance for Strapi API requests - made lazy to ensure config is loaded
let _strapiClient: AxiosInstance | null = null;

export function getStrapiClient(): AxiosInstance {
  if (!_strapiClient) {
    logger.debug(`[API] Creating Strapi client`);

    _strapiClient = axios.create({
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

    // Add interceptor to log requests (no auth header needed for basic client)
    _strapiClient.interceptors.request.use((request) => {
      logger.debug(`[API] Request to: ${request.method?.toUpperCase()} ${request.url}`);
      logger.debug(`[API] Headers: ${JSON.stringify(request.headers)}`);
      return request;
    });
  }

  return _strapiClient;
}

// For backward compatibility - create a proxy that delegates to the real client
export const strapiClient = new Proxy({} as AxiosInstance, {
  get(target, prop) {
    return getStrapiClient()[prop as keyof AxiosInstance];
  },
});

// Function to reset the client (useful for tests)
export function resetStrapiClient(): void {
  logger.debug("[API] Resetting Strapi client");
  _strapiClient = null;
}

let connectionValidated = false;

// Store admin JWT token
let adminJwtToken: string | null = null;

// Reset token on startup if credentials changed
if (isTest) {
  adminJwtToken = null;
}

// Export a function to get the admin token
export function getAdminJwtToken(): string | null {
  return adminJwtToken;
}

// Export a function to clear the admin token (e.g., after Strapi restart)
export function clearAdminJwtToken(): void {
  logger.debug("[Auth] Clearing admin JWT token");
  adminJwtToken = null;

  // Also clear the cached token in test mode
  if (isTest) {
    clearTokenCache();
  }
}

// Remove the request interceptor - REST API uses public permissions now
// Admin JWT tokens are only used for admin API endpoints via makeAdminApiRequest

// Remove the response interceptor - REST API uses public permissions now

/**
 * Log in to the Strapi admin API using provided credentials
 */
// Track the last login attempt time to implement rate limiting
let lastLoginAttempt = 0;
const LOGIN_RATE_LIMIT_MS = 5000; // Minimum 5 seconds between login attempts
let loginInProgress = false; // Prevent concurrent login attempts

export async function loginToStrapiAdmin(): Promise<boolean> {
  // Check if we have admin credentials first
  const email = config.strapi.adminEmail;
  const password = config.strapi.adminPassword;

  if (!email || !password) {
    logger.error("[Auth] No admin credentials found in config");
    throw new ExtendedMcpError(
      ExtendedErrorCode.InternalError,
      "Admin credentials are required. Please provide STRAPI_ADMIN_EMAIL and STRAPI_ADMIN_PASSWORD."
    );
  }

  // If already have a token, return success
  if (adminJwtToken) {
    logger.debug("[Auth] Already have admin JWT token, skipping login");
    return true;
  }

  // Try to use cached token in test mode, but only if admin credentials are configured
  if (isTest && config.strapi.adminEmail && config.strapi.adminPassword) {
    const cachedToken = getCachedAdminToken();
    if (cachedToken) {
      adminJwtToken = cachedToken;
      logger.debug("[Auth] Using cached admin JWT token from disk");
      return true;
    }
  }

  // Prevent concurrent login attempts
  if (loginInProgress) {
    logger.debug("[Auth] Login already in progress, waiting...");
    // Wait for the current login to complete
    for (let i = 0; i < 30; i++) {
      await setTimeout(100);
      if (!loginInProgress) {
        return !!adminJwtToken;
      }
    }
    return false;
  }

  loginInProgress = true;

  try {
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

          // Cache the token in test mode
          if (isTest && adminJwtToken) {
            cacheAdminToken(adminJwtToken);
          }

          // Important: Admin JWT token is stored for both admin and REST API endpoints
          logger.debug("[Auth] Admin JWT token stored for all API operations");

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
  } finally {
    loginInProgress = false;
  }
}

/**
 * Make a request to Strapi using the admin JWT token
 * This handles both admin and REST API endpoints
 */
export async function makeAdminApiRequest(
  endpoint: string,
  method: string = "get",
  data?: any,
  params?: Record<string, any>
): Promise<any> {
  // Admin credentials are always required now
  if (!config.strapi.adminEmail || !config.strapi.adminPassword) {
    logger.error(`[Admin API] No admin credentials available`);
    throw new ExtendedMcpError(
      ExtendedErrorCode.AccessDenied,
      "Admin credentials are required. Please provide STRAPI_ADMIN_EMAIL and STRAPI_ADMIN_PASSWORD."
    );
  }

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
    // Admin credentials are required - test admin login
    const loginSuccess = await loginToStrapiAdmin();
    if (!loginSuccess) {
      throw new ExtendedMcpError(
        ExtendedErrorCode.InternalError,
        "Failed to authenticate with admin credentials. Please check your STRAPI_ADMIN_EMAIL and STRAPI_ADMIN_PASSWORD."
      );
    }

    // Verify connection with admin endpoint
    const adminData = await makeAdminApiRequest("/admin/users/me");
    if (adminData) {
      logger.info("[Setup] ✓ Admin authentication successful");
      logger.info("[Setup] ✓ Connection to Strapi successful using admin credentials");
      connectionValidated = true;
    } else {
      throw new Error("No response received from admin endpoint");
    }
  } catch (error: any) {
    let errorMessage = "Cannot connect to Strapi instance";

    if (axios.isAxiosError(error)) {
      if (error.code === "ECONNREFUSED") {
        errorMessage += `: Connection refused. Is Strapi running at ${config.strapi.url}?`;
      } else if (error.response?.status === 401) {
        errorMessage += `: Authentication failed. Check your admin credentials.`;
      } else if (error.response?.status === 403) {
        errorMessage += `: Access forbidden. Your admin account may lack necessary permissions.`;
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
