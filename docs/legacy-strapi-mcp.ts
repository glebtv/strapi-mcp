#!/usr/bin/env node

process.on('unhandledRejection', (reason, promise) => {
  console.error('[FATAL] Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[FATAL] Uncaught Exception:', error);
  process.exit(1); // Mandatory exit after uncaught exception
});

/**
 * Strapi MCP Server
 * 
 * This MCP server integrates with any Strapi CMS instance to provide:
 * - Access to Strapi content types as resources
 * - Tools to create and update content types in Strapi
 * - Tools to manage content entries (create, read, update, delete)
 * - Support for Strapi in development mode
 * 
 * This server is designed to be generic and work with any Strapi instance,
 * regardless of the content types defined in that instance.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  ErrorCode,
  McpError,
  ReadResourceRequest,
  CallToolRequest,
} from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Extended error codes to include additional ones we need
enum ExtendedErrorCode {
  // Original error codes from SDK
  InvalidRequest = 'InvalidRequest',
  MethodNotFound = 'MethodNotFound',
  InvalidParams = 'InvalidParams',
  InternalError = 'InternalError',
  
  // Additional error codes
  ResourceNotFound = 'ResourceNotFound',
  AccessDenied = 'AccessDenied'
}

// Custom error class extending McpError to support our extended error codes
class ExtendedMcpError extends McpError {
  public extendedCode: ExtendedErrorCode;
  
  constructor(code: ExtendedErrorCode, message: string) {
    // Map our extended codes to standard MCP error codes when needed
    let mcpCode: ErrorCode;
    
    // Map custom error codes to standard MCP error codes
    switch (code) {
      case ExtendedErrorCode.ResourceNotFound:
      case ExtendedErrorCode.AccessDenied:
        // Map custom codes to InternalError for SDK compatibility
        mcpCode = ErrorCode.InternalError;
        break;
      case ExtendedErrorCode.InvalidRequest:
        mcpCode = ErrorCode.InvalidRequest;
        break;
      case ExtendedErrorCode.MethodNotFound:
        mcpCode = ErrorCode.MethodNotFound;
        break;
      case ExtendedErrorCode.InvalidParams:
        mcpCode = ErrorCode.InvalidParams;
        break;
      case ExtendedErrorCode.InternalError:
      default:
        mcpCode = ErrorCode.InternalError;
        break;
    }
    
    // Call super before accessing 'this'
    super(mcpCode, message);
    
    // Store the extended code for reference
    this.extendedCode = code;
  }
}

// Configuration from environment variables
const STRAPI_URL = process.env.STRAPI_URL || "http://localhost:1337";
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN;
const STRAPI_DEV_MODE = process.env.STRAPI_DEV_MODE === "true";
const STRAPI_ADMIN_EMAIL = process.env.STRAPI_ADMIN_EMAIL;
const STRAPI_ADMIN_PASSWORD = process.env.STRAPI_ADMIN_PASSWORD;

// Validate required environment variables
if (!STRAPI_API_TOKEN && !(STRAPI_ADMIN_EMAIL && STRAPI_ADMIN_PASSWORD)) {
  console.error("[Error] Missing required authentication. Please provide either STRAPI_API_TOKEN or both STRAPI_ADMIN_EMAIL and STRAPI_ADMIN_PASSWORD environment variables");
  process.exit(1);
}

// Only validate API token format if we don't have admin credentials (since admin creds take priority)
if (!STRAPI_ADMIN_EMAIL || !STRAPI_ADMIN_PASSWORD) {
  // If no admin credentials, validate that API token is not a placeholder
  if (STRAPI_API_TOKEN && (STRAPI_API_TOKEN === "strapi_token" || STRAPI_API_TOKEN === "your-api-token-here" || STRAPI_API_TOKEN.includes("placeholder"))) {
    console.error("[Error] STRAPI_API_TOKEN appears to be a placeholder value. Please provide a real API token from your Strapi admin panel or use admin credentials instead.");
    process.exit(1);
  }
}

console.error(`[Setup] Connecting to Strapi at ${STRAPI_URL}`);
console.error(`[Setup] Development mode: ${STRAPI_DEV_MODE ? "enabled" : "disabled"}`);

// Determine authentication method priority
if (STRAPI_ADMIN_EMAIL && STRAPI_ADMIN_PASSWORD) {
  console.error(`[Setup] Authentication: Using admin credentials (priority)`);
  if (STRAPI_API_TOKEN && STRAPI_API_TOKEN !== "strapi_token" && !STRAPI_API_TOKEN.includes("placeholder")) {
    console.error(`[Setup] API token also available as fallback`);
  }
} else if (STRAPI_API_TOKEN) {
  console.error(`[Setup] Authentication: Using API token`);
} else {
  console.error(`[Setup] Authentication: ERROR - No valid authentication method available`);
}

// Axios instance for Strapi API
const strapiClient = axios.create({
  baseURL: STRAPI_URL,
  headers: {
    "Content-Type": "application/json",
  },
  validateStatus: function (status) {
    // Consider only 5xx as errors - for more robust error handling
    return status < 500;
  }
});

// If API token is provided, use it
if (STRAPI_API_TOKEN) {
  strapiClient.defaults.headers.common['Authorization'] = `Bearer ${STRAPI_API_TOKEN}`;
}

// Store admin JWT token if we log in
let adminJwtToken: string | null = null;

/**
 * Log in to the Strapi admin API using provided credentials
 */
async function loginToStrapiAdmin(): Promise<boolean> {
  // Use process.env directly here to ensure latest values are used
  const email = process.env.STRAPI_ADMIN_EMAIL;
  const password = process.env.STRAPI_ADMIN_PASSWORD;

  if (!email || !password) {
    console.error("[Auth] No admin credentials found in process.env, skipping admin login");
    return false;
  }

  try {
    // Log the authentication attempt with more detail
    console.error(`[Auth] Attempting login to Strapi admin at ${STRAPI_URL}/admin/login as ${email}`);
    console.error(`[Auth] Full URL being used: ${STRAPI_URL}/admin/login`);
    
    // Make the request with more detailed logging
    console.error(`[Auth] Sending POST request with email and password`);
    const response = await axios.post(`${STRAPI_URL}/admin/login`, { 
      email, 
      password 
    });
    
    console.error(`[Auth] Response status: ${response.status}`);
    console.error(`[Auth] Response headers:`, JSON.stringify(response.headers));
    
    // Check if we got back valid data
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

/**
 * Make a request to the admin API using the admin JWT token
 */
async function makeAdminApiRequest(endpoint: string, method: string = 'get', data?: any, params?: Record<string, any>): Promise<any> { // Add params
  if (!adminJwtToken) {
    // Try to log in first
    console.error(`[Admin API] No token available, attempting login...`);
    const success = await loginToStrapiAdmin();
    if (!success) {
      console.error(`[Admin API] Login failed. Cannot authenticate for admin API access.`);
      throw new Error("Not authenticated for admin API access");
    }
    console.error(`[Admin API] Login successful, proceeding with request.`);
  }
  
  const fullUrl = `${STRAPI_URL}${endpoint}`;
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
      data, // Used for POST, PUT, etc.
      params // Used for GET requests query parameters
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
    // If not a 401 or re-login failed, throw the original error
    throw error;
  }
}

// Cache for content types
let contentTypesCache: any[] = [];

/**
 * Create an MCP server with capabilities for resources and tools
 */
const server = new Server(
  {
    name: "strapi-mcp",
    version: "0.2.0",
  },
  {
    capabilities: {
      resources: {},
      tools: {},
    },
  }
);

/**
 * Fetch all content types from Strapi
 */
async function fetchContentTypes(): Promise<any[]> {
  try {
     // Validate connection before attempting to fetch
     await validateStrapiConnection();
     
     console.error("[API] Fetching content types from Strapi");
 
     // If we have cached content types, return them
     // --- DEBUG: Temporarily disable cache ---
     // if (contentTypesCache.length > 0) {
     //   console.error("[API] Returning cached content types");
     //   return contentTypesCache;
     // }
     // --- END DEBUG ---

    // Helper function to process and cache content types
    const processAndCacheContentTypes = (data: any[], source: string): any[] => {
      console.error(`[API] Successfully fetched collection types from ${source}`);
      const contentTypes = data.map((item: any) => {
        const uid = item.uid;
        const apiID = uid.split('.').pop() || '';
        return {
          uid: uid,
          apiID: apiID,
          info: {
            displayName: item.info?.displayName || apiID.charAt(0).toUpperCase() + apiID.slice(1).replace(/-/g, ' '),
            description: item.info?.description || `${apiID} content type`,
          },
          attributes: item.attributes || {}
        };
      });

      // Filter out internal types
      const filteredTypes = contentTypes.filter((ct: any) =>
        !ct.uid.startsWith("admin::") &&
        !ct.uid.startsWith("plugin::")
      );

      console.error(`[API] Found ${filteredTypes.length} content types via ${source}`);
      contentTypesCache = filteredTypes; // Update cache
      return filteredTypes;
    };
 
     // --- Attempt 1: Use Admin Credentials if available ---
     console.error(`[DEBUG] Checking admin creds: EMAIL=${Boolean(STRAPI_ADMIN_EMAIL)}, PASSWORD=${Boolean(STRAPI_ADMIN_PASSWORD)}`);
     if (STRAPI_ADMIN_EMAIL && STRAPI_ADMIN_PASSWORD) {
       console.error("[API] Attempting to fetch content types using admin credentials");
       try {
         // Use makeAdminApiRequest which handles login
         // Try the content-type-builder endpoint first, as it's more common for schema listing
         console.error("[API] Trying admin endpoint: /content-type-builder/content-types");
         const adminResponse = await makeAdminApiRequest('/content-type-builder/content-types');
 
         console.error("[API] Admin response structure:", Object.keys(adminResponse || {}));
         
         // Strapi's admin API often wraps data, check common structures
         let adminData = null;
        if (adminResponse && adminResponse.data && Array.isArray(adminResponse.data)) {
            adminData = adminResponse.data; // Direct array in response.data
        } else if (adminResponse && Array.isArray(adminResponse)) {
            adminData = adminResponse; // Direct array response
        }
        
        if (adminData && adminData.length > 0) {
          return processAndCacheContentTypes(adminData, "Admin API (/content-type-builder/content-types)");
        } else {
           console.error("[API] Admin API response did not contain expected data array or was empty.", adminResponse);
        }
      } catch (adminError) {
        console.error(`[API] Failed to fetch content types using admin credentials:`, adminError);
        if (axios.isAxiosError(adminError)) {
          console.error(`[API] Admin API Error Status: ${adminError.response?.status}`);
          console.error(`[API] Admin API Error Data:`, adminError.response?.data);
        }
        // Don't throw, proceed to next method
      }
    } else {
       console.error("[API] Admin credentials not provided, skipping admin API attempt.");
    }

    // --- Attempt 2: Try different admin endpoints ---
    if (STRAPI_ADMIN_EMAIL && STRAPI_ADMIN_PASSWORD) {
      console.error("[API] Trying alternative admin endpoint: /content-manager/content-types");
      try {
        const adminResponse2 = await makeAdminApiRequest('/content-manager/content-types');
        console.error("[API] Admin response 2 structure:", Object.keys(adminResponse2 || {}));
        
        let adminData2 = null;
        if (adminResponse2 && adminResponse2.data && Array.isArray(adminResponse2.data)) {
            adminData2 = adminResponse2.data;
        } else if (adminResponse2 && Array.isArray(adminResponse2)) {
            adminData2 = adminResponse2;
        }
        
        if (adminData2 && adminData2.length > 0) {
          return processAndCacheContentTypes(adminData2, "Admin API (/content-manager/content-types)");
        }
      } catch (adminError2) {
        console.error(`[API] Alternative admin endpoint also failed:`, adminError2);
      }
    }

    // --- Attempt 3: Use API Token via strapiClient (Original Primary Method) ---
    console.error("[API] Attempting to fetch content types using API token (strapiClient)");
    try {
      // This is the most reliable way *if* the token has permissions
      const response = await strapiClient.get('/content-manager/collection-types');

      if (response.data && Array.isArray(response.data)) {
        // Note: This path might require admin permissions, often fails with API token
        return processAndCacheContentTypes(response.data, "Content Manager API (/content-manager/collection-types)");
      }
    } catch (apiError) {
      console.error(`[API] Failed to fetch from content manager API:`, apiError);
      if (axios.isAxiosError(apiError)) {
        console.error(`[API] API Error Status: ${apiError.response?.status}`);
        console.error(`[API] API Error Data:`, apiError.response?.data);
      }
    }
    
    // --- Attempt 4: Discovery via exploring known endpoints ---
    console.error(`[API] Trying content type discovery via known patterns...`);
    
    // Try to discover by checking common content types
    const commonTypes = ['article', 'page', 'post', 'user', 'category'];
    const discoveredTypes = [];
    
    for (const type of commonTypes) {
      try {
        const testResponse = await strapiClient.get(`/api/${type}?pagination[limit]=1`);
        if (testResponse.status === 200) {
          console.error(`[API] Discovered content type: api::${type}.${type}`);
          discoveredTypes.push({
            uid: `api::${type}.${type}`,
            apiID: type,
            info: {
              displayName: type.charAt(0).toUpperCase() + type.slice(1),
              description: `${type} content type (discovered)`,
            },
            attributes: {}
          });
        }
      } catch (e) {
        // Ignore 404s and continue
      }
    }
    
    if (discoveredTypes.length > 0) {
      console.error(`[API] Found ${discoveredTypes.length} content types via discovery`);
      contentTypesCache = discoveredTypes;
      return discoveredTypes;
    }
    
    // Final attempt: Try to discover content types by checking for common endpoint patterns
    // If all proper API methods failed, provide a helpful error message instead of silent failure
    let errorMessage = "Unable to fetch content types from Strapi. This could be due to:\n";
    errorMessage += "1. Strapi server not running or unreachable\n";
    errorMessage += "2. Invalid API token or insufficient permissions\n";
    errorMessage += "3. Admin credentials not working\n";
    errorMessage += "4. Database connectivity issues\n";
    errorMessage += "5. Strapi instance configuration problems\n\n";
    errorMessage += "Please check:\n";
    errorMessage += `- Strapi is running at ${STRAPI_URL}\n`;
    errorMessage += "- Your API token has proper permissions\n";
    errorMessage += "- Admin credentials are correct\n";
    errorMessage += "- Database is accessible and running\n";
    errorMessage += "- Try creating a test content type in your Strapi admin panel";
    
    throw new ExtendedMcpError(ExtendedErrorCode.InternalError, errorMessage);
    
  } catch (error: any) {
    console.error("[Error] Failed to fetch content types:", error);
    
    let errorMessage = "Failed to fetch content types";
    let errorCode = ExtendedErrorCode.InternalError;
    
    if (axios.isAxiosError(error)) {
      errorMessage += `: ${error.response?.status} ${error.response?.statusText}`;
      if (error.response?.status === 403) {
        errorCode = ExtendedErrorCode.AccessDenied;
        errorMessage += ` (Permission denied - check API token permissions)`;
      } else if (error.response?.status === 401) {
        errorCode = ExtendedErrorCode.AccessDenied;
        errorMessage += ` (Unauthorized - API token may be invalid or expired)`;
      }
    } else if (error instanceof Error) {
      errorMessage += `: ${error.message}`;
    } else {
      errorMessage += `: ${String(error)}`;
    }
    
    throw new ExtendedMcpError(errorCode, errorMessage);
  }
}

/**
 * Interface for query parameters
 */
interface QueryParams {
  filters?: Record<string, any>;
  pagination?: {
    page?: number;
    pageSize?: number;
  };
  sort?: string[];
  populate?: string | string[] | Record<string, any>;
  fields?: string[];
}

/**
 * Fetch entries for a specific content type with optional filtering, pagination, and sorting
 */
async function fetchEntries(contentType: string, queryParams?: QueryParams): Promise<any> {
  // Validate connection before attempting to fetch
  await validateStrapiConnection();
  
  let response;
  let success = false;
  let fetchedData: any[] = [];
  let fetchedMeta: any = {};
  const collection = contentType.split(".")[1]; // Keep this for potential path variations if needed

  // --- Attempt 1: Use Admin Credentials via makeAdminApiRequest ---
  // Only attempt if admin credentials are provided
  if (STRAPI_ADMIN_EMAIL && STRAPI_ADMIN_PASSWORD) {
    console.error(`[API] Attempt 1: Fetching entries for ${contentType} using makeAdminApiRequest (Admin Credentials)`);
    try {
      // Use the full content type UID for the content-manager endpoint
      const adminEndpoint = `/content-manager/collection-types/${contentType}`;
      // Prepare query params for admin request (might need adjustment based on API)
      // Let's assume makeAdminApiRequest handles params correctly
      const adminParams: Record<string, any> = {};
      // Convert nested Strapi v4 params to flat query params if needed, or pass as is
      // Example: filters[field][$eq]=value, pagination[page]=1, sort=field:asc, populate=*, fields=field1,field2
      // For simplicity, let's pass the original structure first and modify makeAdminApiRequest
      if (queryParams?.filters) adminParams.filters = queryParams.filters;
      if (queryParams?.pagination) adminParams.pagination = queryParams.pagination;
      if (queryParams?.sort) adminParams.sort = queryParams.sort;
      if (queryParams?.populate) adminParams.populate = queryParams.populate;
      if (queryParams?.fields) adminParams.fields = queryParams.fields;

      // Make the request using admin credentials (modify makeAdminApiRequest to handle params)
      const adminResponse = await makeAdminApiRequest(adminEndpoint, 'get', undefined, adminParams); // Pass params here

      // Process admin response (structure might differ, e.g., response.data.results)
      if (adminResponse && adminResponse.results && Array.isArray(adminResponse.results)) {
         console.error(`[API] Successfully fetched data via admin credentials for ${contentType}`);
         // Admin API often returns data in 'results' and pagination info separately
         fetchedData = adminResponse.results;
         fetchedMeta = adminResponse.pagination || {}; // Adjust based on actual admin API response structure

         // Filter out potential errors within items
         fetchedData = fetchedData.filter((item: any) => !item?.error);

         if (fetchedData.length > 0) {
            console.error(`[API] Returning data fetched via admin credentials for ${contentType}`);
            return { data: fetchedData, meta: fetchedMeta };
         } else {
            console.error(`[API] Admin fetch succeeded for ${contentType} but returned no entries. Trying API token.`);
         }
      } else {
         console.error(`[API] Admin fetch for ${contentType} did not return expected 'results' array. Response:`, adminResponse);
         console.error(`[API] Falling back to API token.`);
      }
    } catch (adminError) {
      console.error(`[API] Failed to fetch entries using admin credentials for ${contentType}:`, adminError);
      console.error(`[API] Falling back to API token.`);
    }
  } else {
     console.error("[API] Admin credentials not provided, using API token instead.");
  }

  // --- Attempt 2: Use API Token via strapiClient (as fallback) ---
  console.error(`[API] Attempt 2: Fetching entries for ${contentType} using strapiClient (API Token)`);
  try {
    const params: Record<string, any> = {};
    // ... build params from queryParams ... (existing code)
    if (queryParams?.filters) params.filters = queryParams.filters;
    if (queryParams?.pagination) params.pagination = queryParams.pagination;
    if (queryParams?.sort) params.sort = queryParams.sort;
    if (queryParams?.populate) params.populate = queryParams.populate;
    if (queryParams?.fields) params.fields = queryParams.fields;

    // Try multiple possible API paths (keep this flexibility)
    const possiblePaths = [
      `/api/${collection}`,
      `/api/${collection.toLowerCase()}`,
      // Add more variations if necessary
    ];

    for (const path of possiblePaths) {
      try {
        console.error(`[API] Trying path with strapiClient: ${path}`);
        response = await strapiClient.get(path, { params });

        if (response.data && response.data.error) {
          console.error(`[API] Path ${path} returned an error:`, response.data.error);
          continue; // Try next path
        }

        console.error(`[API] Successfully fetched data from: ${path} using strapiClient`);
        success = true;

        // Process response data
        if (response.data.data) {
          fetchedData = Array.isArray(response.data.data) ? response.data.data : [response.data.data];
          fetchedMeta = response.data.meta || {};
        } else if (Array.isArray(response.data)) {
          fetchedData = response.data;
          fetchedMeta = { pagination: { page: 1, pageSize: fetchedData.length, pageCount: 1, total: fetchedData.length } };
        } else {
           // Handle unexpected format, maybe log it
           console.warn(`[API] Unexpected response format from ${path} using strapiClient:`, response.data);
           fetchedData = response.data ? [response.data] : []; // Wrap if not null/undefined
           fetchedMeta = {};
        }

        // Filter out potential errors within items if any structure allows it
        fetchedData = fetchedData.filter((item: any) => !item?.error);

        break; // Exit loop on success
      } catch (err: any) {
        if (axios.isAxiosError(err) && (err.response?.status === 404 || err.response?.status === 403 || err.response?.status === 401)) {
          // 404: Try next path. 403/401: Permissions issue
          console.error(`[API] Path ${path} failed with ${err.response?.status}, trying next path...`);
          continue;
        }
        // For other errors, rethrow to be caught by the outer try-catch
        console.error(`[API] Unexpected error on path ${path} with strapiClient:`, err);
        throw err;
      }
    }

    // If strapiClient succeeded AND returned data, return it
    if (success && fetchedData.length > 0) {
      console.error(`[API] Returning data fetched via strapiClient for ${contentType}`);
      return { data: fetchedData, meta: fetchedMeta };
    } else if (success && fetchedData.length === 0) {
       console.error(`[API] Content type ${contentType} exists but has no entries (empty collection)`);
       // Return empty result for legitimate empty collections (not an error)
       return { data: [], meta: fetchedMeta };
    } else {
       console.error(`[API] strapiClient failed to fetch entries for ${contentType}.`);
    }

  } catch (error) {
    // Catch errors from the strapiClient attempts (excluding 404/403/401 handled above)
    console.error(`[API] Error during strapiClient fetch for ${contentType}:`, error);
  }

  // --- All attempts failed: Provide helpful error instead of silent empty return ---
  console.error(`[API] All attempts failed to fetch entries for ${contentType}`);
  
  let errorMessage = `Failed to fetch entries for content type ${contentType}. This could be due to:\n`;
  errorMessage += "1. Content type doesn't exist in your Strapi instance\n";
  errorMessage += "2. API token lacks permissions to access this content type\n";
  errorMessage += "3. Admin credentials don't have access to this content type\n";
  errorMessage += "4. Content type exists but has no published entries\n";
  errorMessage += "5. Database connectivity issues\n\n";
  errorMessage += "Troubleshooting:\n";
  errorMessage += `- Verify ${contentType} exists in your Strapi admin panel\n`;
  errorMessage += "- Check your API token permissions\n";
  errorMessage += "- Ensure the content type has published entries\n";
  errorMessage += "- Verify admin credentials if using admin authentication";
  
  throw new ExtendedMcpError(ExtendedErrorCode.ResourceNotFound, errorMessage);
}

/**
 * Fetch a specific entry by ID
 */
async function fetchEntry(contentType: string, id: string, queryParams?: QueryParams): Promise<any> {
  try {
    console.error(`[API] Fetching entry ${id} for content type: ${contentType}`);
    
    // Extract the collection name from the content type UID
    const collection = contentType.split(".")[1];
    
    // --- Attempt 1: Use Admin Credentials ---
    if (STRAPI_ADMIN_EMAIL && STRAPI_ADMIN_PASSWORD) {
      console.error(`[API] Attempt 1: Fetching entry ${id} for ${contentType} using admin credentials`);
      try {
        // Admin API for content management uses a different path structure
        const adminEndpoint = `/content-manager/collection-types/${contentType}/${id}`;
        
        // Prepare admin params
        const adminParams: Record<string, any> = {};
        if (queryParams?.populate) adminParams.populate = queryParams.populate;
        if (queryParams?.fields) adminParams.fields = queryParams.fields;
        
        // Make the request
        const adminResponse = await makeAdminApiRequest(adminEndpoint, 'get', undefined, adminParams);
        
        if (adminResponse) {
          console.error(`[API] Successfully fetched entry ${id} via admin credentials`);
          return adminResponse;
        }
      } catch (adminError) {
        console.error(`[API] Failed to fetch entry ${id} using admin credentials:`, adminError);
        console.error(`[API] Falling back to API token...`);
      }
    } else {
      console.error(`[API] Admin credentials not provided, falling back to API token`);
    }
    
    // --- Attempt 2: Use API Token as fallback ---
    // Build query parameters only for populate and fields
    const params: Record<string, any> = {};
    if (queryParams?.populate) {
      params.populate = queryParams.populate;
    }
    if (queryParams?.fields) {
      params.fields = queryParams.fields;
    }

    console.error(`[API] Attempt 2: Fetching entry ${id} for ${contentType} using API token`);
    // Get the entry from Strapi
    const response = await strapiClient.get(`/api/${collection}/${id}`, { params });
    
    return response.data.data;
  } catch (error: any) {
    console.error(`[Error] Failed to fetch entry ${id} for ${contentType}:`, error);
    
    let errorMessage = `Failed to fetch entry ${id} for ${contentType}`;
    let errorCode = ExtendedErrorCode.InternalError;

    if (axios.isAxiosError(error)) {
      errorMessage += `: ${error.response?.status} ${error.response?.statusText}`;
      if (error.response?.status === 404) {
        errorCode = ExtendedErrorCode.ResourceNotFound;
        errorMessage += ` (Entry not found)`;
      } else if (error.response?.status === 403) {
        errorCode = ExtendedErrorCode.AccessDenied;
        errorMessage += ` (Permission denied - check API token permissions)`;
      } else if (error.response?.status === 401) {
        errorCode = ExtendedErrorCode.AccessDenied;
        errorMessage += ` (Unauthorized - API token may be invalid or expired)`;
      }
    } else if (error instanceof Error) {
      errorMessage += `: ${error.message}`;
    } else {
      errorMessage += `: ${String(error)}`;
    }
    
    throw new ExtendedMcpError(errorCode, errorMessage);
  }
}

/**
 * Create a new entry
 */
async function createEntry(contentType: string, data: any): Promise<any> {
  try {
    console.error(`[API] Creating new entry for content type: ${contentType}`);
    
    // Extract the collection name from the content type UID
    const collection = contentType.split(".")[1];
    
    // --- Attempt 1: Use Admin Credentials via makeAdminApiRequest ---
    if (STRAPI_ADMIN_EMAIL && STRAPI_ADMIN_PASSWORD) {
      console.error(`[API] Attempt 1: Creating entry for ${contentType} using makeAdminApiRequest`);
      try {
        // Admin API for content management often uses a different path structure
        const adminEndpoint = `/content-manager/collection-types/${contentType}`;
        console.error(`[API] Trying admin create endpoint: ${adminEndpoint}`);
        
        // Admin API might need the data directly, not nested under 'data'
        const adminResponse = await makeAdminApiRequest(adminEndpoint, 'post', data);

        // Check response from admin API (structure might differ)
        if (adminResponse) {
          console.error(`[API] Successfully created entry via makeAdminApiRequest.`);
          // Admin API might return the created entry directly or nested under 'data'
          return adminResponse.data || adminResponse;
        } else {
          // Should not happen if makeAdminApiRequest resolves, but handle defensively
          console.warn(`[API] Admin create completed but returned no data.`);
          // Return a success indicator even without data, as the operation likely succeeded
          return { message: "Create via admin succeeded, no data returned." };
        }
      } catch (adminError) {
        console.error(`[API] Failed to create entry using admin credentials:`, adminError);
        // Only try API token if admin credentials fail
        console.error(`[API] Admin credentials failed, attempting to use API token as fallback.`);
      }
    } else {
      console.error("[API] Admin credentials not provided, falling back to API token.");
    }
    
    // --- Attempt 2: Use API Token via strapiClient (as fallback) ---
    console.error(`[API] Attempt 2: Creating entry for ${contentType} using strapiClient`);
    try {
      // Create the entry in Strapi
      const response = await strapiClient.post(`/api/${collection}`, {
        data: data
      });
      
      if (response.data && response.data.data) {
        console.error(`[API] Successfully created entry via strapiClient.`);
        return response.data.data;
      } else {
        console.warn(`[API] Create via strapiClient completed, but no data returned.`);
        throw new McpError(
          ErrorCode.InternalError,
          `Failed to create entry for ${contentType}: No data returned from API`
        );
      }
    } catch (error) {
      console.error(`[API] Failed to create entry via strapiClient:`, error);
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to create entry for ${contentType} via strapiClient: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  } catch (error) {
    console.error(`[Error] Failed to create entry for ${contentType}:`, error);
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to create entry for ${contentType}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Update an existing entry
 */
async function updateEntry(contentType: string, id: string, data: any): Promise<any> {
  const collection = contentType.split(".")[1];
  const apiPath = `/api/${collection}/${id}`;
  let responseData: any = null;

  // --- Attempt 1: Use Admin Credentials via makeAdminApiRequest ---
  if (STRAPI_ADMIN_EMAIL && STRAPI_ADMIN_PASSWORD) {
    console.error(`[API] Attempt 1: Updating entry ${id} for ${contentType} using makeAdminApiRequest`);
    try {
      // Admin API for content management often uses a different path structure
      const adminEndpoint = `/content-manager/collection-types/${contentType}/${id}`;
      console.error(`[API] Trying admin update endpoint: ${adminEndpoint}`);
      
      // Admin API PUT might just need the data directly, not nested under 'data'
      const adminResponse = await makeAdminApiRequest(adminEndpoint, 'put', data); // Send 'data' directly

      // Check response from admin API (structure might differ)
      if (adminResponse) {
        console.error(`[API] Successfully updated entry ${id} via makeAdminApiRequest.`);
        // Admin API might return the updated entry directly or nested under 'data'
        return adminResponse.data || adminResponse; 
      } else {
        // Should not happen if makeAdminApiRequest resolves, but handle defensively
        console.warn(`[API] Admin update for ${id} completed but returned no data.`);
        // Return a success indicator even without data, as the operation likely succeeded
        return { id: id, message: "Update via admin succeeded, no data returned." }; 
      }
    } catch (adminError) {
      console.error(`[API] Failed to update entry ${id} using admin credentials:`, adminError);
      console.error(`[API] Admin credentials failed, attempting to use API token as fallback.`);
    }
  } else {
    console.error("[API] Admin credentials not provided, falling back to API token.");
  }

  // --- Attempt 2: Use API Token via strapiClient (as fallback) ---
  console.error(`[API] Attempt 2: Updating entry ${id} for ${contentType} using strapiClient`);
  try {
    const response = await strapiClient.put(apiPath, { data: data });
    
    // Check if data was returned
    if (response.data && response.data.data) {
      console.error(`[API] Successfully updated entry ${id} via strapiClient.`);
      return response.data.data; // Success with data returned
    } else {
      // Update might have succeeded but didn't return data
      console.warn(`[API] Update via strapiClient for ${id} completed, but no updated data returned.`);
      // Return a success indicator even without data, as the operation likely succeeded
      return { id: id, message: "Update via API token succeeded, no data returned." };
    }
  } catch (error) {
    console.error(`[API] Failed to update entry ${id} via strapiClient:`, error);
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to update entry ${id} for ${contentType} via strapiClient: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Delete an entry
 */
async function deleteEntry(contentType: string, id: string): Promise<void> {
  try {
    console.error(`[API] Deleting entry ${id} for content type: ${contentType}`);
    
    // Extract the collection name from the content type UID
    const collection = contentType.split(".")[1];
    
    // --- Attempt 1: Use Admin Credentials via makeAdminApiRequest ---
    if (STRAPI_ADMIN_EMAIL && STRAPI_ADMIN_PASSWORD) {
      console.error(`[API] Attempt 1: Deleting entry ${id} for ${contentType} using makeAdminApiRequest`);
      try {
        // Admin API for content management often uses a different path structure
        const adminEndpoint = `/content-manager/collection-types/${contentType}/${id}`;
        console.error(`[API] Trying admin delete endpoint: ${adminEndpoint}`);
        
        // Admin API DELETE request
        const adminResponse = await makeAdminApiRequest(adminEndpoint, 'delete');

        // Check response from admin API
        console.error(`[API] Successfully deleted entry ${id} via makeAdminApiRequest.`);
        return; // Success - exit early
      } catch (adminError) {
        console.error(`[API] Failed to delete entry ${id} using admin credentials:`, adminError);
        console.error(`[API] Admin credentials failed, attempting to use API token as fallback.`);
      }
    } else {
      console.error("[API] Admin credentials not provided, falling back to API token.");
    }
    
    // --- Attempt 2: Use API Token via strapiClient (as fallback) ---
    console.error(`[API] Attempt 2: Deleting entry ${id} for ${contentType} using strapiClient`);
    try {
      // Delete the entry from Strapi using API token
      const response = await strapiClient.delete(`/api/${collection}/${id}`);
      
      if (response.status >= 200 && response.status < 300) {
        console.error(`[API] Successfully deleted entry ${id} via strapiClient.`);
        return; // Success
      } else {
        throw new Error(`Unexpected response status: ${response.status}`);
      }
    } catch (error) {
      console.error(`[API] Failed to delete entry ${id} via strapiClient:`, error);
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to delete entry ${id} for ${contentType} via strapiClient: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  } catch (error) {
    console.error(`[Error] Failed to delete entry ${id} for ${contentType}:`, error);
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to delete entry ${id} for ${contentType}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Upload media file to Strapi
 */
async function uploadMedia(fileData: string, fileName: string, fileType: string): Promise<any> {
  try {
    console.error(`[API] Uploading media file: ${fileName} (type: ${fileType})`);
    
    // Calculate base64 size and warn about large files
    const base64Size = fileData.length;
    const estimatedFileSize = Math.round((base64Size * 3) / 4); // Rough file size estimate
    const estimatedFileSizeMB = (estimatedFileSize / (1024 * 1024)).toFixed(2);
    
    console.error(`[API] File size: ~${estimatedFileSizeMB}MB (base64 length: ${base64Size})`);
    
    // Add size limits to prevent context window overflow
    const MAX_BASE64_SIZE = 1024 * 1024; // 1MB of base64 text (~750KB file)
    if (base64Size > MAX_BASE64_SIZE) {
      const maxFileSizeMB = ((MAX_BASE64_SIZE * 3) / 4 / (1024 * 1024)).toFixed(2);
      throw new Error(`File too large. Base64 data is ${base64Size} characters (~${estimatedFileSizeMB}MB file). Maximum allowed is ${MAX_BASE64_SIZE} characters (~${maxFileSizeMB}MB file). Large files cause context window overflow. Consider using smaller files or implementing chunked upload.`);
    }
    
    // Warn about large files that might cause issues
    if (base64Size > 100000) { // 100KB of base64 text
      console.error(`[API] Warning: Large file detected (~${estimatedFileSizeMB}MB). This may cause context window issues.`);
    }
    
    const buffer = Buffer.from(fileData, 'base64');
    
    // --- Attempt 1: Use Admin Credentials if available ---
    if (STRAPI_ADMIN_EMAIL && STRAPI_ADMIN_PASSWORD) {
      console.error(`[API] Attempt 1: Uploading media file using admin credentials`);
      try {
        // For admin uploads, we need to use axios directly with admin token
        // since makeAdminApiRequest doesn't handle FormData well
        if (!adminJwtToken) {
          await loginToStrapiAdmin();
        }
        
        const formData = new FormData();
        const blob = new Blob([buffer], { type: fileType });
        formData.append('files', blob, fileName);

        const adminResponse = await axios.post(`${STRAPI_URL}/api/upload`, formData, {
          headers: {
            'Authorization': `Bearer ${adminJwtToken}`,
            // Don't set Content-Type, let axios handle it for FormData
          }
        });
        
        const cleanResponse = filterBase64FromResponse(adminResponse.data);
        console.error(`[API] Successfully uploaded media file via admin credentials`);
        return cleanResponse;
      } catch (adminError) {
        console.error(`[API] Failed to upload media file using admin credentials:`, adminError);
        console.error(`[API] Falling back to API token...`);
      }
    } else {
      console.error("[API] Admin credentials not provided, using API token.");
    }
    
    // --- Attempt 2: Use API Token via strapiClient (as fallback) ---
    console.error(`[API] Attempt 2: Uploading media file using API token`);
    // Use FormData for file upload
    const formData = new FormData();
    // Convert Buffer to Blob with the correct content type
    const blob = new Blob([buffer], { type: fileType });
    formData.append('files', blob, fileName);

    const response = await strapiClient.post('/api/upload', formData, {
      headers: {
        // Let axios set the correct multipart/form-data content-type with boundary
        'Content-Type': 'multipart/form-data'
      }
    });
    
    // Filter out any base64 data from the response to prevent context overflow
    const cleanResponse = filterBase64FromResponse(response.data);
    
    return cleanResponse;
  } catch (error) {
    console.error(`[Error] Failed to upload media file ${fileName}:`, error);
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to upload media file ${fileName}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Upload media file from file path (alternative to base64)
 */
async function uploadMediaFromPath(filePath: string, fileName?: string, fileType?: string): Promise<any> {
  try {
    const fs = await import('fs');
    const path = await import('path');
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    
    // Get file stats
    const stats = fs.statSync(filePath);
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    
    console.error(`[API] Uploading media file from path: ${filePath} (${fileSizeMB}MB)`);
    
    // Add size limits
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    if (stats.size > MAX_FILE_SIZE) {
      throw new Error(`File too large: ${fileSizeMB}MB. Maximum allowed is 10MB.`);
    }
    
    // Auto-detect fileName and fileType if not provided
    const actualFileName = fileName || path.basename(filePath);
    const extension = path.extname(filePath).toLowerCase();
    
    let actualFileType = fileType;
    if (!actualFileType) {
      // Basic MIME type detection
      const mimeTypes: Record<string, string> = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.pdf': 'application/pdf',
        '.txt': 'text/plain',
        '.json': 'application/json',
        '.mp4': 'video/mp4',
        '.avi': 'video/avi',
        '.mov': 'video/quicktime'
      };
      actualFileType = mimeTypes[extension] || 'application/octet-stream';
    }
    
    // Read file and convert to base64
    const fileBuffer = fs.readFileSync(filePath);
    const base64Data = fileBuffer.toString('base64');
    
    // Use the existing uploadMedia function (which now has admin credential support)
    return await uploadMedia(base64Data, actualFileName, actualFileType);
    
  } catch (error) {
    console.error(`[Error] Failed to upload media file from path ${filePath}:`, error);
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to upload media file from path: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Filter base64 data from API responses to prevent context overflow
 */
function filterBase64FromResponse(data: any): any {
  if (!data) return data;
  
  // If it's an array, filter each item
  if (Array.isArray(data)) {
    return data.map(item => filterBase64FromResponse(item));
  }
  
  // If it's an object, process each property
  if (typeof data === 'object') {
    const filtered: any = {};
    
    for (const [key, value] of Object.entries(data)) {
      // Skip or truncate fields that might contain base64 data
      if (typeof value === 'string') {
        // Check if this looks like base64 data (long string, mostly alphanumeric with +/=)
        if (value.length > 1000 && /^[A-Za-z0-9+/=]+$/.test(value.substring(0, 100))) {
          filtered[key] = `[BASE64_DATA_FILTERED - ${value.length} chars]`;
        } else {
          filtered[key] = value;
        }
      } else {
        filtered[key] = filterBase64FromResponse(value);
      }
    }
    
    return filtered;
  }
  
  return data;
}

/**
 * Fetch the schema for a specific content type
 */
 async function fetchContentTypeSchema(contentType: string): Promise<any> {
   try {
     console.error(`[API] Fetching schema for content type: ${contentType}`);
 
     // --- Attempt 1: Use Admin Credentials if available ---
     if (STRAPI_ADMIN_EMAIL && STRAPI_ADMIN_PASSWORD) {
       console.error("[API] Attempting to fetch schema using admin credentials");
       try {
         const endpoint = `/content-type-builder/content-types/${contentType}`;
         console.error(`[API] Trying admin endpoint: ${endpoint}`);
         const adminResponse = await makeAdminApiRequest(endpoint);
 
         // Check for schema data (often nested under 'data')
         if (adminResponse && adminResponse.data) {
            console.error("[API] Successfully fetched schema via Admin API");
            return adminResponse.data; // Return the schema data
         } else {
            console.error("[API] Admin API response for schema did not contain expected data.", adminResponse);
         }
       } catch (adminError) {
         console.error(`[API] Failed to fetch schema using admin credentials:`, adminError);
         // Don't throw, proceed to next method if it was a 404 or auth error
         if (!(axios.isAxiosError(adminError) && (adminError.response?.status === 401 || adminError.response?.status === 403 || adminError.response?.status === 404))) {
            throw adminError; // Rethrow unexpected errors
         }
       }
     } else {
        console.error("[API] Admin credentials not provided, skipping admin API attempt for schema.");
     }
 
     // --- Attempt 2: Infer schema from public API (Fallback) ---
     console.error("[API] Attempting to infer schema from public API");

    // Extract the collection name from the content type UID
    const collection = contentType.split(".")[1];
    
    // Try to get a sample entry to infer the schema
    try {
      // Try multiple possible API paths
      const possiblePaths = [
        `/api/${collection}`,
        `/api/${collection.toLowerCase()}`,
        `/api/v1/${collection}`,
        `/${collection}`,
        `/${collection.toLowerCase()}`
      ];
      
      let response;
      let success = false;
      
      // Try each path until one works
      for (const path of possiblePaths) {
        try {
          console.error(`[API] Trying path for schema inference: ${path}`);
          // Request with small limit to minimize data transfer
          response = await strapiClient.get(`${path}?pagination[limit]=1&pagination[page]=1`);
          console.error(`[API] Successfully fetched sample data from: ${path}`);
          success = true;
          break;
        } catch (err: any) {
          if (axios.isAxiosError(err) && err.response?.status === 404) {
            // Continue to try the next path if not found
            continue;
          }
          // For other errors, throw immediately
          throw err;
        }
      }
      
      if (!success || !response) {
        throw new Error(`Could not find any valid API path for ${collection}`);
      }
      
      // Extract a sample entry to infer schema
      let sampleEntry;
      if (response.data.data && Array.isArray(response.data.data) && response.data.data.length > 0) {
        // Standard Strapi v4 response
        sampleEntry = response.data.data[0];
      } else if (Array.isArray(response.data) && response.data.length > 0) {
        // Array response
        sampleEntry = response.data[0];
      } else if (response.data) {
        // Object response
        sampleEntry = response.data;
      }
      
      if (!sampleEntry) {
        throw new Error(`No sample entries available to infer schema for ${contentType}`);
      }
      
      // Infer schema from sample entry
      const attributes: Record<string, any> = {};
      
      // Process entry to infer attribute types
      Object.entries(sampleEntry.attributes || sampleEntry).forEach(([key, value]) => {
        if (key === 'id') return; // Skip ID field
        
        let type: string = typeof value;
        
        if (type === 'object') {
          if (value === null) {
            type = 'string'; // Assume nullable string
          } else if (Array.isArray(value)) {
            type = 'relation'; // Assume array is a relation
          } else if (value instanceof Date) {
            type = 'datetime';
          } else {
            type = 'json'; // Complex object
          }
        }
        
        attributes[key] = { type };
      });
      
      // Return inferred schema
      return {
        uid: contentType,
        apiID: collection,
        info: {
          displayName: collection.charAt(0).toUpperCase() + collection.slice(1),
          description: `Inferred schema for ${collection}`,
        },
        attributes
      };
      
    } catch (inferError) {
      console.error(`[API] Failed to infer schema:`, inferError);
      
      // Return a minimal schema as fallback
      return {
        uid: contentType,
        apiID: collection,
        info: {
          displayName: collection.charAt(0).toUpperCase() + collection.slice(1),
          description: `${collection} content type`,
        },
        attributes: {}
      };
    }
  } catch (error: any) {
    let errorMessage = `Failed to fetch schema for ${contentType}`;
    let errorCode = ExtendedErrorCode.InternalError;

    if (axios.isAxiosError(error)) {
      errorMessage += `: ${error.response?.status} ${error.response?.statusText}`;
      if (error.response?.status === 404) {
        errorCode = ExtendedErrorCode.ResourceNotFound;
        errorMessage += ` (Content type not found)`;
      } else if (error.response?.status === 403) {
        errorCode = ExtendedErrorCode.AccessDenied;
        errorMessage += ` (Permission denied - check API token permissions for Content-Type Builder)`;
      } else if (error.response?.status === 401) {
        errorCode = ExtendedErrorCode.AccessDenied;
        errorMessage += ` (Unauthorized - API token may be invalid or expired)`;
      } else if (error.response?.status === 400) {
        errorCode = ExtendedErrorCode.InvalidRequest;
        errorMessage += ` (Bad request - malformed content type ID)`;
      }
    } else if (error instanceof Error) {
      errorMessage += `: ${error.message}`;
    } else {
      errorMessage += `: ${String(error)}`;
    }

    console.error(`[Error] ${errorMessage}`);
    throw new ExtendedMcpError(errorCode, errorMessage);
  }
}

/**
 * Connect related entries for a specific field
 */
async function connectRelation(contentType: string, id: string, relationField: string, relatedIds: number[] | string[]): Promise<any> {
  try {
    console.error(`[API] Connecting relations for ${contentType} ${id}, field ${relationField}`);
    
    // Validate that we have valid IDs
    if (!relatedIds || relatedIds.length === 0) {
      throw new Error("At least one related ID is required to connect");
    }
    
    // Convert string IDs to numbers and validate they're valid
    const validIds = relatedIds.map(rid => {
      const numId = Number(rid);
      if (isNaN(numId) || numId <= 0) {
        throw new Error(`Invalid related ID: ${rid}. IDs must be positive numbers.`);
      }
      return numId;
    });
    
    const updateData = {
      data: { // Strapi v4 expects relation updates within the 'data' object for PUT
        [relationField]: {
          connect: validIds.map(rid => ({ id: rid }))
        }
      }
    };
    
    // Reuse updateEntry logic which correctly wraps payload in { data: ... }
    return await updateEntry(contentType, id, updateData.data); 
  } catch (error) {
    // Rethrow McpError or wrap others
    if (error instanceof McpError) throw error;
    
    console.error(`[Error] Failed to connect relation ${relationField} for ${contentType} ${id}:`, error);
    
    let errorMessage = `Failed to connect relation '${relationField}': `;
    
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 400) {
        errorMessage += `Bad request - this could mean: (1) The relation field '${relationField}' doesn't exist on ${contentType}, (2) One or more of the related IDs don't exist, or (3) The relation field type doesn't support 'connect' operations. Please verify the field exists and the IDs are valid.`;
      } else if (error.response?.status === 404) {
        errorMessage += `Entry ${id} not found in ${contentType}. Make sure the entry exists before trying to connect relations.`;
      } else {
        errorMessage += `${error.response?.status} ${error.response?.statusText}`;
      }
      errorMessage += ` Raw error: ${JSON.stringify(error.response?.data)}`;
    } else if (error instanceof Error) {
      errorMessage += error.message;
    } else {
      errorMessage += String(error);
    }
    
    throw new McpError(ErrorCode.InternalError, errorMessage);
  }
}

/**
 * Disconnect related entries for a specific field
 */
async function disconnectRelation(contentType: string, id: string, relationField: string, relatedIds: number[] | string[]): Promise<any> {
  try {
    console.error(`[API] Disconnecting relations for ${contentType} ${id}, field ${relationField}`);
    
    // Validate that we have valid IDs
    if (!relatedIds || relatedIds.length === 0) {
      throw new Error("At least one related ID is required to disconnect");
    }
    
    // Convert string IDs to numbers and validate they're valid
    const validIds = relatedIds.map(rid => {
      const numId = Number(rid);
      if (isNaN(numId) || numId <= 0) {
        throw new Error(`Invalid related ID: ${rid}. IDs must be positive numbers.`);
      }
      return numId;
    });
    
     const updateData = {
      data: { // Strapi v4 expects relation updates within the 'data' object for PUT
        [relationField]: {
          disconnect: validIds.map(rid => ({ id: rid }))
        }
      }
    };
    
    // Reuse updateEntry logic which correctly wraps payload in { data: ... }
    return await updateEntry(contentType, id, updateData.data); 

  } catch (error) {
     // Rethrow McpError or wrap others
     if (error instanceof McpError) throw error;
    
    console.error(`[Error] Failed to disconnect relation ${relationField} for ${contentType} ${id}:`, error);
    
    let errorMessage = `Failed to disconnect relation '${relationField}': `;
    
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 400) {
        errorMessage += `Bad request - this could mean: (1) The relation field '${relationField}' doesn't exist on ${contentType}, (2) One or more of the related IDs don't exist or aren't currently connected, or (3) The relation field type doesn't support 'disconnect' operations. Please verify the field exists and the IDs are currently connected.`;
      } else if (error.response?.status === 404) {
        errorMessage += `Entry ${id} not found in ${contentType}. Make sure the entry exists before trying to disconnect relations.`;
      } else {
        errorMessage += `${error.response?.status} ${error.response?.statusText}`;
      }
      errorMessage += ` Raw error: ${JSON.stringify(error.response?.data)}`;
    } else if (error instanceof Error) {
      errorMessage += error.message;
    } else {
      errorMessage += String(error);
    }
    
    throw new McpError(ErrorCode.InternalError, errorMessage);
 }
 }
 
 /**
  * Update an existing content type in Strapi. Requires admin privileges.
  */
 async function updateContentType(contentTypeUid: string, attributesToUpdate: Record<string, any>): Promise<any> {
   try {
     console.error(`[API] Updating content type: ${contentTypeUid}`);
 
     if (!contentTypeUid || !attributesToUpdate || typeof attributesToUpdate !== 'object') {
       throw new Error("Missing required fields: contentTypeUid, attributesToUpdate (object)");
     }
 
     // 1. Fetch the current schema
     console.error(`[API] Fetching current schema for ${contentTypeUid}`);
     // Use fetchContentTypeSchema which already tries admin endpoint first
     const currentSchemaData = await fetchContentTypeSchema(contentTypeUid);
 
     // Ensure we have the schema structure (might be nested under 'schema')
     let currentSchema = currentSchemaData.schema || currentSchemaData;
     if (!currentSchema || !currentSchema.attributes) {
         // If schema is still not found or malformed after fetchContentTypeSchema tried, error out
          console.error("[API] Could not retrieve a valid current schema structure.", currentSchemaData);
          throw new Error(`Could not retrieve a valid schema structure for ${contentTypeUid}`);
     }
     console.error(`[API] Current attributes: ${Object.keys(currentSchema.attributes).join(', ')}`);
 
 
     // 2. Merge new/updated attributes into the current schema's attributes
     const updatedAttributes = { ...currentSchema.attributes, ...attributesToUpdate };
     console.error(`[API] Attributes after update: ${Object.keys(updatedAttributes).join(', ')}`);
 
 
     // 3. Construct the payload for the PUT request
     // Strapi's PUT endpoint expects the *entire* content type definition under the 'contentType' key,
     // and potentially component updates under 'components'. We only update contentType here.
     const payload = {
       contentType: {
         ...currentSchema, // Spread the existing schema details
         attributes: updatedAttributes // Use the merged attributes
       }
       // If components needed updating, add a 'components: [...]' key here
     };
 
     // Remove potentially problematic fields if they exist at the top level of currentSchema
     // These are often managed internally by Strapi
     delete payload.contentType.uid; // UID is usually in the URL, not body for PUT
     // delete payload.contentType.schema; // If schema was nested, remove the outer key
 
 
     console.error(`[API] Update Payload for PUT /content-type-builder/content-types/${contentTypeUid}: ${JSON.stringify(payload, null, 2)}`);
 
     // 4. Make the PUT request using admin credentials
     const endpoint = `/content-type-builder/content-types/${contentTypeUid}`;
     const response = await makeAdminApiRequest(endpoint, 'put', payload);
 
     console.error(`[API] Content type update response:`, response);
 
     // Response might vary, often includes the updated UID or a success message
     return response?.data || { message: `Content type ${contentTypeUid} update initiated. Strapi might be restarting.` };
 
   } catch (error: any) {
     console.error(`[Error] Failed to update content type ${contentTypeUid}:`, error);
 
     let errorMessage = `Failed to update content type ${contentTypeUid}`;
     let errorCode = ExtendedErrorCode.InternalError;
 
     if (axios.isAxiosError(error)) {
       errorMessage += `: ${error.response?.status} ${error.response?.statusText}`;
       const responseData = JSON.stringify(error.response?.data);
       if (error.response?.status === 400) {
          errorCode = ExtendedErrorCode.InvalidParams;
          errorMessage += ` (Bad Request - Check payload/attributes): ${responseData}`;
       } else if (error.response?.status === 404) {
          errorCode = ExtendedErrorCode.ResourceNotFound;
          errorMessage += ` (Content Type Not Found)`;
       } else if (error.response?.status === 403 || error.response?.status === 401) {
          errorCode = ExtendedErrorCode.AccessDenied;
          errorMessage += ` (Permission Denied - Admin credentials might lack permissions): ${responseData}`;
       } else {
          errorMessage += `: ${responseData}`;
       }
     } else if (error instanceof Error) {
       errorMessage += `: ${error.message}`;
     } else {
       errorMessage += `: ${String(error)}`;
     }
 
     throw new ExtendedMcpError(errorCode, errorMessage);
   }
 }
 
 
 /**
  * Create a new content type in Strapi. Requires admin privileges.
  */
 async function createContentType(contentTypeData: any): Promise<any> {
   try {
     const { displayName, singularName, pluralName, kind = 'collectionType', attributes, draftAndPublish = true, description = "" } = contentTypeData;
 
     if (!displayName || !singularName || !pluralName || !attributes) {
       throw new Error("Missing required fields: displayName, singularName, pluralName, attributes");
     }
 
     // Construct the payload for the Content-Type Builder API
     // Ensure API IDs are Strapi-compliant (lowercase, no spaces, etc.)
     const singularApiId = singularName.toLowerCase().replace(/\s+/g, '-');
     const pluralApiId = pluralName.toLowerCase().replace(/\s+/g, '-');
     const collectionName = pluralName.toLowerCase().replace(/\s+/g, '_'); // Table name often uses underscores
     
     // For Strapi v4, the primary difference is in the nesting structure
     // The data should be formatted exactly like in the Strapi UI
     const payload = {
       contentType: {
         displayName: displayName,
         singularName: singularApiId,
         pluralName: pluralApiId,
         description: description,
         kind: kind,
         collectionName: collectionName,
         options: {
           draftAndPublish: draftAndPublish
         },
         pluginOptions: {},
         attributes: typeof attributes === 'object' && !Array.isArray(attributes) ? attributes : {}
       }
     };
 
     console.error(`[API] Creating new content type: ${displayName}`);
     console.error(`[API] Attempting to create content type with payload: ${JSON.stringify(payload, null, 2)}`);
     
     // Make sure we're using the correct Content-Type Builder endpoint
     // This is the documented endpoint for Strapi v4
     const endpoint = '/content-type-builder/content-types';
     console.error(`[API] Using endpoint: ${endpoint}`);
     
     try {
       const response = await makeAdminApiRequest(endpoint, 'post', payload);
       console.error(`[API] Raw response from makeAdminApiRequest (createContentType):`, response); 
     
       console.error(`[API] Content type creation response:`, response);
     
       // Strapi might restart after schema changes, response might vary
       // Often returns { data: { uid: 'api::...' } } or similar on success
       return response?.data || { message: "Content type creation initiated. Strapi might be restarting." };
     } catch (apiError) {
       console.error(`[API] CRITICAL ERROR in makeAdminApiRequest call:`, apiError);
       
       if (axios.isAxiosError(apiError) && apiError.response) {
         // Log the complete error details for debugging
         console.error(`[API] Status Code: ${apiError.response.status}`);
         console.error(`[API] Status Text: ${apiError.response.statusText}`);
         console.error(`[API] Response Headers:`, apiError.response.headers);
         console.error(`[API] DETAILED ERROR PAYLOAD:`, JSON.stringify(apiError.response.data, null, 2));
         
         // Check for specific error messages from Strapi that indicate payload issues
         if (apiError.response.status === 400) {
           const errorData = apiError.response.data;
           console.error(`[API] 400 BAD REQUEST - Payload validation error`);
           
           // Extract and log specific validation errors
           if (errorData.error && errorData.message) {
             console.error(`[API] Error Type: ${errorData.error}`);
             console.error(`[API] Error Message: ${errorData.message}`);
           }
           
           // Log any validation details
           if (errorData.data && errorData.data.errors) {
             console.error(`[API] Validation Errors:`, JSON.stringify(errorData.data.errors, null, 2));
           }
         }
       }
       throw apiError; // Re-throw to be caught by outer catch
     }
   } catch (error: any) {
     console.error(`[Error RAW] createContentType caught error:`, error); 
     if (axios.isAxiosError(error) && error.response) {
       console.error(`[Error DETAIL] Strapi error response data (createContentType): ${JSON.stringify(error.response.data)}`);
       console.error(`[Error DETAIL] Strapi error response status (createContentType): ${error.response.status}`);
       console.error(`[Error DETAIL] Strapi error response headers (createContentType): ${JSON.stringify(error.response.headers)}`);
     }
     console.error(`[Error] Failed to create content type:`, error); // This line was already there, keeping it for context
 
     let errorMessage = `Failed to create content type`;
     let errorCode = ExtendedErrorCode.InternalError;
 
     if (axios.isAxiosError(error)) {
       errorMessage += `: ${error.response?.status} ${error.response?.statusText}`;
       if (error.response?.status === 400) {
          errorCode = ExtendedErrorCode.InvalidParams;
          errorMessage += ` (Bad Request - Check payload format/names): ${JSON.stringify(error.response?.data)}`;
       } else if (error.response?.status === 403 || error.response?.status === 401) {
          errorCode = ExtendedErrorCode.AccessDenied;
          errorMessage += ` (Permission Denied - Admin credentials might lack permissions)`;
       }
     } else if (error instanceof Error) {
       errorMessage += `: ${error.message}`;
     } else {
       errorMessage += `: ${String(error)}`;
     }
 
     throw new ExtendedMcpError(errorCode, errorMessage);
   }
 }
 
 /**
  * Publish an entry
  */
 async function publishEntry(contentType: string, id: string): Promise<any> {
   try {
     console.error(`[API] Publishing entry ${id} for content type: ${contentType}`);
     
     // --- Attempt 1: Use Admin Credentials ---
     if (STRAPI_ADMIN_EMAIL && STRAPI_ADMIN_PASSWORD) {
       console.error(`[API] Attempt 1: Publishing entry ${id} for ${contentType} using admin credentials`);
       try {
         // The admin API endpoint for publishing
         const adminEndpoint = `/content-manager/collection-types/${contentType}/${id}/actions/publish`;
         
         // Make the POST request to publish
         const adminResponse = await makeAdminApiRequest(adminEndpoint, 'post');
         
         if (adminResponse) {
           console.error(`[API] Successfully published entry ${id} via admin credentials`);
           return adminResponse;
         }
       } catch (adminError) {
         console.error(`[API] Failed to publish entry ${id} using admin credentials:`, adminError);
         console.error(`[API] Falling back to API token...`);
       }
     } else {
       console.error(`[API] Admin credentials not provided, falling back to API token`);
     }
     
     // --- Attempt 2: Use API Token (fallback) - update the publishedAt field directly ---
     const collection = contentType.split(".")[1];
     console.error(`[API] Attempt 2: Publishing entry ${id} for ${contentType} using API token`);
     
     // For API token, we'll update the publishedAt field to the current time
     const now = new Date().toISOString();
     const response = await strapiClient.put(`/api/${collection}/${id}`, {
       data: {
         publishedAt: now
       }
     });
     
     return response.data.data;
   } catch (error) {
     console.error(`[Error] Failed to publish entry ${id} for ${contentType}:`, error);
     throw new McpError(
       ErrorCode.InternalError,
       `Failed to publish entry ${id} for ${contentType}: ${error instanceof Error ? error.message : String(error)}`
     );
   }
 }

 /**
  * Unpublish an entry
  */
 async function unpublishEntry(contentType: string, id: string): Promise<any> {
   try {
     console.error(`[API] Unpublishing entry ${id} for content type: ${contentType}`);
     
     // --- Attempt 1: Use Admin Credentials ---
     if (STRAPI_ADMIN_EMAIL && STRAPI_ADMIN_PASSWORD) {
       console.error(`[API] Attempt 1: Unpublishing entry ${id} for ${contentType} using admin credentials`);
       try {
         // The admin API endpoint for unpublishing
         const adminEndpoint = `/content-manager/collection-types/${contentType}/${id}/actions/unpublish`;
         
         // Make the POST request to unpublish
         const adminResponse = await makeAdminApiRequest(adminEndpoint, 'post');
         
         if (adminResponse) {
           console.error(`[API] Successfully unpublished entry ${id} via admin credentials`);
           return adminResponse;
         }
       } catch (adminError) {
         console.error(`[API] Failed to unpublish entry ${id} using admin credentials:`, adminError);
         console.error(`[API] Falling back to API token...`);
       }
     } else {
       console.error(`[API] Admin credentials not provided, falling back to API token`);
     }
     
     // --- Attempt 2: Use API Token (fallback) - set publishedAt to null ---
     const collection = contentType.split(".")[1];
     console.error(`[API] Attempt 2: Unpublishing entry ${id} for ${contentType} using API token`);
     
     // For API token, we'll set the publishedAt field to null
     const response = await strapiClient.put(`/api/${collection}/${id}`, {
       data: {
         publishedAt: null
       }
     });
     
     return response.data.data;
   } catch (error) {
     console.error(`[Error] Failed to unpublish entry ${id} for ${contentType}:`, error);
     throw new McpError(
       ErrorCode.InternalError,
       `Failed to unpublish entry ${id} for ${contentType}: ${error instanceof Error ? error.message : String(error)}`
     );
   }
 }

 /**
  * List all components
  */
 async function listComponents(): Promise<any[]> {
   try {
     console.error(`[API] Listing all components`);
     
     // Admin credentials are required for component operations
     if (!STRAPI_ADMIN_EMAIL || !STRAPI_ADMIN_PASSWORD) {
       throw new ExtendedMcpError(
         ExtendedErrorCode.AccessDenied,
         "Admin credentials are required for component operations"
       );
     }
     
     // The admin API endpoint for components
     const adminEndpoint = `/content-type-builder/components`;
     
     // Make the GET request to fetch components
     const componentsResponse = await makeAdminApiRequest(adminEndpoint);
     
     if (!componentsResponse || !componentsResponse.data) {
       console.error(`[API] No components found or unexpected response format`);
       return [];
     }
     
     // Process the components data
     const components = Array.isArray(componentsResponse.data) 
       ? componentsResponse.data 
       : [componentsResponse.data];
     
     // Return formatted component info
     return components.map((component: any) => ({
       uid: component.uid,
       category: component.category,
       displayName: component.info?.displayName || component.uid.split('.').pop(),
       description: component.info?.description || `${component.uid} component`,
       icon: component.info?.icon
     }));
   } catch (error) {
     console.error(`[Error] Failed to list components:`, error);
     throw new McpError(
       ErrorCode.InternalError,
       `Failed to list components: ${error instanceof Error ? error.message : String(error)}`
     );
   }
 }

 /**
  * Get component schema
  */
 async function getComponentSchema(componentUid: string): Promise<any> {
   try {
     console.error(`[API] Fetching schema for component: ${componentUid}`);
     
     // Admin credentials are required for component operations
     if (!STRAPI_ADMIN_EMAIL || !STRAPI_ADMIN_PASSWORD) {
       throw new ExtendedMcpError(
         ExtendedErrorCode.AccessDenied,
         "Admin credentials are required for component operations"
       );
     }
     
     // The admin API endpoint for a specific component
     const adminEndpoint = `/content-type-builder/components/${componentUid}`;
     
     // Make the GET request to fetch the component schema
     const componentResponse = await makeAdminApiRequest(adminEndpoint);
     
     if (!componentResponse || !componentResponse.data) {
       throw new ExtendedMcpError(
         ExtendedErrorCode.ResourceNotFound,
         `Component ${componentUid} not found or access denied`
       );
     }
     
     return componentResponse.data;
   } catch (error) {
     console.error(`[Error] Failed to fetch component schema for ${componentUid}:`, error);
     throw new McpError(
       ErrorCode.InternalError,
       `Failed to fetch component schema for ${componentUid}: ${error instanceof Error ? error.message : String(error)}`
     );
   }
 }

 /**
  * Create a new component
  */
 async function createComponent(componentData: any): Promise<any> {
   try {
     console.error(`[API] Creating new component`);
     
     // Admin credentials are required for component operations
     if (!STRAPI_ADMIN_EMAIL || !STRAPI_ADMIN_PASSWORD) {
       throw new ExtendedMcpError(
         ExtendedErrorCode.AccessDenied,
         "Admin credentials are required for component operations"
       );
     }
     
     const { displayName, category, icon, attributes } = componentData;
     
     if (!displayName || !category || !attributes) {
       throw new Error("Missing required fields: displayName, category, attributes");
     }
     
     // Convert displayName to API-friendly string (lowercase, hyphens)
     const apiName = displayName.toLowerCase().replace(/\s+/g, '-');
     
     // Construct the payload for the API
     const payload = {
       component: {
         category: category,
         icon: icon || 'brush',
         displayName: displayName,
         attributes: attributes
       }
     };
     
     console.error(`[API] Component creation payload:`, payload);
     
     // The admin API endpoint for creating components
     const adminEndpoint = `/content-type-builder/components`;
     
     // Make the POST request to create the component
     const response = await makeAdminApiRequest(adminEndpoint, 'post', payload);
     
     console.error(`[API] Component creation response:`, response);
     
     // Strapi might restart after schema changes
     return response?.data || { message: "Component creation initiated. Strapi might be restarting." };
   } catch (error) {
     console.error(`[Error] Failed to create component:`, error);
     throw new McpError(
       ErrorCode.InternalError,
       `Failed to create component: ${error instanceof Error ? error.message : String(error)}`
     );
   }
 }

 /**
  * Update an existing component
  */
 async function updateComponent(componentUid: string, attributesToUpdate: Record<string, any>): Promise<any> {
   try {
     console.error(`[API] Updating component: ${componentUid}`);
     
     // Admin credentials are required for component operations
     if (!STRAPI_ADMIN_EMAIL || !STRAPI_ADMIN_PASSWORD) {
       throw new ExtendedMcpError(
         ExtendedErrorCode.AccessDenied,
         "Admin credentials are required for component operations"
       );
     }
     
     // 1. Fetch the current component schema
     console.error(`[API] Fetching current schema for ${componentUid}`);
     const currentSchemaData = await getComponentSchema(componentUid);
     
     // Ensure we have the schema structure
     let currentSchema = currentSchemaData.schema || currentSchemaData;
     if (!currentSchema || !currentSchema.attributes) {
       console.error("[API] Could not retrieve a valid current schema structure.", currentSchemaData);
       throw new Error(`Could not retrieve a valid schema structure for ${componentUid}`);
     }
     
     // 2. Merge new/updated attributes into the current schema's attributes
     const updatedAttributes = { ...currentSchema.attributes, ...attributesToUpdate };
     
     // 3. Construct the payload for the PUT request
     const payload = {
       component: {
         ...currentSchema,
         attributes: updatedAttributes
       }
     };
     
     // Remove potentially problematic fields
     delete payload.component.uid;
     
     console.error(`[API] Component update payload:`, payload);
     
     // 4. Make the PUT request to update the component
     const adminEndpoint = `/content-type-builder/components/${componentUid}`;
     const response = await makeAdminApiRequest(adminEndpoint, 'put', payload);
     
     console.error(`[API] Component update response:`, response);
     
     // Response might vary, but should typically include the updated component data
     return response?.data || { message: `Component ${componentUid} update initiated. Strapi might be restarting.` };
   } catch (error) {
     console.error(`[Error] Failed to update component ${componentUid}:`, error);
     throw new McpError(
       ErrorCode.InternalError,
       `Failed to update component ${componentUid}: ${error instanceof Error ? error.message : String(error)}`
     );
   }
 }

/**
 * Handler for listing available Strapi content as resources.
 * Each content type and entry is exposed as a resource with:
 * - A strapi:// URI scheme
 * - JSON MIME type
 * - Human readable name and description
 */
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  try {
    // Fetch all content types
    const contentTypes = await fetchContentTypes();
    
    // Create a resource for each content type
    const contentTypeResources = contentTypes.map(ct => ({
      uri: `strapi://content-type/${ct.uid}`,
      mimeType: "application/json",
      name: ct.info.displayName,
      description: `Strapi content type: ${ct.info.displayName}`
    }));
    
    // Return the resources
    return {
      resources: contentTypeResources
    };
  } catch (error) {
    console.error("[Error] Failed to list resources:", error);
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to list resources: ${error instanceof Error ? error.message : String(error)}`
    );
  }
});

/**
 * Handler for reading the contents of a specific resource.
 * Takes a strapi:// URI and returns the content as JSON.
 * 
 * Supports URIs in the following formats:
 * - strapi://content-type/[contentTypeUid] - Get all entries for a content type
 * - strapi://content-type/[contentTypeUid]/[entryId] - Get a specific entry
 * - strapi://content-type/[contentTypeUid]?[queryParams] - Get filtered entries
 */
server.setRequestHandler(ReadResourceRequestSchema, async (request: ReadResourceRequest) => {
  try {
    const uri = request.params.uri;
    
    // Parse the URI for content type
    const contentTypeMatch = uri.match(/^strapi:\/\/content-type\/([^\/\?]+)(?:\/([^\/\?]+))?(?:\?(.+))?$/);
    if (!contentTypeMatch) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Invalid URI format: ${uri}`
      );
    }
    
    const contentTypeUid = contentTypeMatch[1];
    const entryId = contentTypeMatch[2];
    const queryString = contentTypeMatch[3];
    
    // Parse query parameters if present
    let queryParams: QueryParams = {};
    if (queryString) {
      try {
        // Parse the query string into an object
        const parsedParams = new URLSearchParams(queryString);
        
        // Extract filters
        const filtersParam = parsedParams.get('filters');
        if (filtersParam) {
          queryParams.filters = JSON.parse(filtersParam);
        }
        
        // Extract pagination
        const pageParam = parsedParams.get('page');
        const pageSizeParam = parsedParams.get('pageSize');
        if (pageParam || pageSizeParam) {
          queryParams.pagination = {};
          if (pageParam) queryParams.pagination.page = parseInt(pageParam, 10);
          if (pageSizeParam) queryParams.pagination.pageSize = parseInt(pageSizeParam, 10);
        }
        
        // Extract sort
        const sortParam = parsedParams.get('sort');
        if (sortParam) {
          queryParams.sort = sortParam.split(',');
        }
        
        // Extract populate
        const populateParam = parsedParams.get('populate');
        if (populateParam) {
          try {
            // Try to parse as JSON
            queryParams.populate = JSON.parse(populateParam);
          } catch {
            // If not valid JSON, treat as comma-separated string
            queryParams.populate = populateParam.split(',');
          }
        }
        
        // Extract fields
        const fieldsParam = parsedParams.get('fields');
        if (fieldsParam) {
          queryParams.fields = fieldsParam.split(',');
        }
      } catch (parseError) {
        console.error("[Error] Failed to parse query parameters:", parseError);
        throw new McpError(
          ErrorCode.InvalidRequest,
          `Invalid query parameters: ${parseError instanceof Error ? parseError.message : String(parseError)}`
        );
      }
    }
    
    // If an entry ID is provided, fetch that specific entry
    if (entryId) {
      const entry = await fetchEntry(contentTypeUid, entryId, queryParams);
      
      return {
        contents: [{
          uri: request.params.uri,
          mimeType: "application/json",
          text: JSON.stringify(entry, null, 2)
        }]
      };
    }
    
    // Otherwise, fetch entries with query parameters
    const entries = await fetchEntries(contentTypeUid, queryParams);
    
    // Return the entries as JSON
    return {
      contents: [{
        uri: request.params.uri,
        mimeType: "application/json",
        text: JSON.stringify(entries, null, 2)
      }]
    };
  } catch (error) {
    console.error("[Error] Failed to read resource:", error);
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to read resource: ${error instanceof Error ? error.message : String(error)}`
    );
  }
});

/**
 * Handler that lists available tools.
 * Exposes tools for working with Strapi content.
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "list_content_types",
        description: "List all available content types in Strapi",
        inputSchema: {
          type: "object",
          properties: {}
        }
      },
      {
        name: "get_entries",
        description: "Get entries for a specific content type with optional filtering, pagination, sorting, and population of relations",
        inputSchema: {
          type: "object",
          properties: {
            contentType: {
              type: "string",
              description: "The content type UID (e.g., 'api::article.article')"
            },
            options: {
              type: "string",
              description: "JSON string with query options including filters, pagination, sort, populate, and fields. Example: '{\"filters\":{\"title\":{\"$contains\":\"hello\"}},\"pagination\":{\"page\":1,\"pageSize\":10},\"sort\":[\"title:asc\"],\"populate\":[\"author\",\"categories\"],\"fields\":[\"title\",\"content\"]}'"
            }
          },
          required: ["contentType"]
        }
      },
      {
        name: "get_entry",
        description: "Get a specific entry by ID",
        inputSchema: {
          type: "object",
          properties: {
            contentType: {
              type: "string",
              description: "The content type UID (e.g., 'api::article.article')"
            },
            id: {
              type: "string",
              description: "The ID of the entry"
            },
            options: {
              type: "string",
              description: "JSON string with query options including populate and fields. Example: '{\"populate\":[\"author\",\"categories\"],\"fields\":[\"title\",\"content\"]}'"
            }
          },
          required: ["contentType", "id"]
        }
      },
      {
        name: "create_entry",
        description: "Create a new entry for a content type",
        inputSchema: {
          type: "object",
          properties: {
            contentType: {
              type: "string",
              description: "The content type UID (e.g., 'api::article.article')"
            },
            data: {
              type: "object",
              description: "The data for the new entry"
            }
          },
          required: ["contentType", "data"]
        }
      },
      {
        name: "update_entry",
        description: "Update an existing entry",
        inputSchema: {
          type: "object",
          properties: {
            contentType: {
              type: "string",
              description: "The content type UID (e.g., 'api::article.article')"
            },
            id: {
              type: "string",
              description: "The ID of the entry to update"
            },
            data: {
              type: "object",
              description: "The updated data for the entry"
            }
          },
          required: ["contentType", "id", "data"]
        }
      },
      {
        name: "delete_entry",
        description: "Deletes a specific entry.",
        inputSchema: {
          type: "object",
          properties: {
            contentType: {
              type: "string",
              description: "Content type UID.",
            },
            id: {
              type: "string",
              description: "Entry ID.",
            },
          },
          required: ["contentType", "id"]
        }
      },
      {
        name: "upload_media",
        description: "Upload a media file to the Strapi Media Library. Maximum size: ~750KB file (1MB base64). For larger files, use upload_media_from_path.",
        inputSchema: {
          type: "object",
          properties: {
            fileData: {
              type: "string",
              description: "Base64 encoded string of the file data. Large files cause context window overflow.",
            },
            fileName: {
              type: "string",
              description: "The desired name for the file.",
            },
            fileType: {
              type: "string",
              description: "The MIME type of the file (e.g., 'image/jpeg', 'application/pdf').",
            },
          },
          required: ["fileData", "fileName", "fileType"]
        }
      },
      {
        name: "upload_media_from_path",
        description: "Upload a media file from a local file path. Avoids context window overflow issues. Maximum size: 10MB.",
        inputSchema: {
          type: "object",
          properties: {
            filePath: {
              type: "string",
              description: "Local file system path to the file to upload.",
            },
            fileName: {
              type: "string",
              description: "Optional: Override the file name. If not provided, uses the original filename.",
            },
            fileType: {
              type: "string",
              description: "Optional: Override the MIME type. If not provided, auto-detects from file extension.",
            },
          },
          required: ["filePath"]
        }
      },
      {
        name: "get_content_type_schema",
        description: "Get the schema (fields, types, relations) for a specific content type.",
        inputSchema: {
          type: "object",
          properties: {
            contentType: {
              type: "string",
              description: "The API ID of the content type (e.g., 'api::article.article').",
            },
          },
          required: ["contentType"]
        }
      },
      {
        name: "connect_relation",
        description: "Connects related entries to a relation field.",
        inputSchema: {
          type: "object",
          properties: {
            contentType: { type: "string", description: "Main content type UID." },
            id: { type: "string", description: "Main entry ID." },
            relationField: { type: "string", description: "Relation field name." },
            relatedIds: { type: "array", items: { type: "string" }, description: "Array of entry IDs to connect." }
          },
          required: ["contentType", "id", "relationField", "relatedIds"]
        }
      },
      {
        name: "disconnect_relation",
        description: "Disconnects related entries from a relation field.",
        inputSchema: {
          type: "object",
          properties: {
            contentType: { type: "string", description: "Main content type UID." },
            id: { type: "string", description: "Main entry ID." },
            relationField: { type: "string", description: "Relation field name." },
            relatedIds: { type: "array", items: { type: "string" }, description: "Array of entry IDs to disconnect." }
          },
          required: ["contentType", "id", "relationField", "relatedIds"]
         }
       },
       {
         name: "create_content_type",
         description: "Creates a new content type (Admin privileges required).",
         inputSchema: {
           type: "object",
           properties: {
             displayName: { type: "string", description: "Display name for content type." },
             singularName: { type: "string", description: "Singular name for API ID." },
             pluralName: { type: "string", description: "Plural name for API ID." },
             kind: { type: "string", enum: ["collectionType", "singleType"], default: "collectionType", description: "Kind of content type." },
             description: { type: "string", description: "Optional description." },
             draftAndPublish: { type: "boolean", default: true, description: "Enable draft/publish?" },
             attributes: {
               type: "object",
               description: "Fields for the content type. E.g., { \"title\": { \"type\": \"string\" } }",
               additionalProperties: {
                 type: "object",
                 properties: {
                   type: { type: "string", description: "Field type (string, text, number, etc.)" },
                   required: { type: "boolean", description: "Is this field required?" },
                   // Add other common attribute properties as needed
                 },
                 required: ["type"]
               }
             }
           },
           required: ["displayName", "singularName", "pluralName", "attributes"]
         }
       },
       {
         name: "update_content_type",
         description: "Updates a content type attributes (Admin privileges required).",
         inputSchema: {
           type: "object",
           properties: {
             contentType: { type: "string", description: "UID of content type to update." },
             attributes: {
               type: "object",
               description: "Attributes to add/update. E.g., { \"new_field\": { \"type\": \"boolean\" } }",
               additionalProperties: {
                 type: "object",
                 properties: {
                   type: { type: "string", description: "Field type (string, boolean, etc.)" },
                   // Include other relevant attribute properties like 'required', 'default', 'relation', 'target', etc.
                 },
                 required: ["type"]
               }
             }
           },
           required: ["contentType", "attributes"]
         }
       },
       {
         name: "delete_content_type",
         description: "Deletes a content type (Admin privileges required).",
         inputSchema: {
           type: "object",
           properties: {
             contentType: { type: "string", description: "UID of content type to delete (e.g., 'api::test.test')." }
           },
           required: ["contentType"]
         }
       },
       {
         name: "list_components",
         description: "List all available components in Strapi",
         inputSchema: {
           type: "object",
           properties: {}
         }
       },
       {
         name: "get_component_schema",
         description: "Get the schema for a specific component",
         inputSchema: {
           type: "object",
           properties: {
             componentUid: {
               type: "string",
               description: "The API ID of the component"
             }
           },
           required: ["componentUid"]
         }
       },
       {
         name: "create_component",
         description: "Create a new component",
         inputSchema: {
           type: "object",
           properties: {
             displayName: {
               type: "string",
               description: "Display name for the component"
             },
             category: {
               type: "string",
               description: "Category name for the component (e.g., 'basic', 'layout', 'content')"
             },
             icon: {
               type: "string",
               description: "Icon name for the component (default: 'brush')"
             },
             attributes: {
               type: "object",
               description: "Component attributes definition. E.g., { \"title\": { \"type\": \"string\" }, \"content\": { \"type\": \"text\" } }",
               additionalProperties: {
                 type: "object",
                 properties: {
                   type: { type: "string", description: "Field type (string, text, number, etc.)" },
                   required: { type: "boolean", description: "Is this field required?" }
                 },
                 required: ["type"]
               }
             }
           },
           required: ["displayName", "category", "attributes"]
         }
       },
       {
         name: "update_component",
         description: "Update an existing component",
         inputSchema: {
           type: "object",
           properties: {
             componentUid: {
               type: "string",
               description: "The API ID of the component to update"
             },
             attributesToUpdate: {
               type: "object",
               description: "The attributes to update for the component"
             }
           },
           required: ["componentUid", "attributesToUpdate"]
         }
       },
       {
         name: "publish_entry",
         description: "Publishes a specific entry.",
         inputSchema: {
           type: "object",
           properties: {
             contentType: {
               type: "string",
               description: "Content type UID."
             },
             id: {
               type: "string",
               description: "Entry ID."
             }
           },
           required: ["contentType", "id"]
         }
       },
       {
         name: "unpublish_entry",
         description: "Unpublishes a specific entry.",
         inputSchema: {
           type: "object",
           properties: {
             contentType: {
               type: "string",
               description: "Content type UID."
             },
             id: {
               type: "string",
               description: "Entry ID."
             }
           },
           required: ["contentType", "id"]
         }
       },
     ]
   };
 });

/**
 * Handler for tool calls.
 * Implements various tools for working with Strapi content.
 */
server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
  try {
    switch (request.params.name) {
      case "list_content_types": {
        const contentTypes = await fetchContentTypes();
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify(contentTypes.map(ct => ({
              uid: ct.uid,
              displayName: ct.info.displayName,
              description: ct.info.description
            })), null, 2)
          }]
        };
      }
      
      case "get_entries": {
        const { contentType, options } = request.params.arguments as any;
        if (!contentType) {
          throw new McpError(
            ErrorCode.InvalidParams,
            "Content type is required"
          );
        }
        
        // Parse the options string into a queryParams object
        let queryParams: QueryParams = {};
        if (options) {
          try {
            queryParams = JSON.parse(options);
          } catch (parseError) {
            console.error("[Error] Failed to parse query options:", parseError);
            throw new McpError(
              ErrorCode.InvalidParams,
              `Invalid query options: ${parseError instanceof Error ? parseError.message : String(parseError)}`
            );
          }
        }
        
        // Fetch entries with query parameters
        const entries = await fetchEntries(String(contentType), queryParams);
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify(entries, null, 2)
          }]
        };
      }
      
      case "get_entry": {
        const { contentType, id, options } = request.params.arguments as any;
        
        if (!contentType || !id) {
          throw new McpError(
            ErrorCode.InvalidParams,
            "Content type and ID are required"
          );
        }
        
        // Parse the options string into a queryParams object
        let queryParams: QueryParams = {};
        if (options) {
          try {
            queryParams = JSON.parse(options);
          } catch (parseError) {
            console.error("[Error] Failed to parse query options:", parseError);
            throw new McpError(
              ErrorCode.InvalidParams,
              `Invalid query options: ${parseError instanceof Error ? parseError.message : String(parseError)}`
            );
          }
        }
        
        const entry = await fetchEntry(String(contentType), String(id), queryParams);
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify(entry, null, 2)
          }]
        };
      }
      
      case "create_entry": {
        const contentType = String(request.params.arguments?.contentType);
        const data = request.params.arguments?.data;
        
        if (!contentType || !data) {
          throw new McpError(
            ErrorCode.InvalidParams,
            "Content type and data are required"
          );
        }
        
        const entry = await createEntry(contentType, data);
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify(entry, null, 2)
          }]
        };
      }
      
      case "update_entry": {
        const contentType = String(request.params.arguments?.contentType);
        const id = String(request.params.arguments?.id);
        const data = request.params.arguments?.data;
        
        if (!contentType || !id || !data) {
          throw new McpError(
            ErrorCode.InvalidParams,
            "Content type, ID, and data are required"
          );
        }
        
        const entry = await updateEntry(contentType, id, data);

        if (entry) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify(entry, null, 2)
            }]
          };
        } else {
          // Handle cases where update might succeed but not return the entry
          console.warn(`[API] Update for ${contentType} ${id} completed, but no updated entry data was returned by the API.`);
          return {
            content: [{
              type: "text",
              text: `Successfully updated entry ${id} for ${contentType}, but no updated data was returned by the API.`
            }]
          };
        }
      }
      
      case "delete_entry": {
        const contentType = String(request.params.arguments?.contentType);
        const id = String(request.params.arguments?.id);
        
        if (!contentType || !id) {
          throw new McpError(
            ErrorCode.InvalidParams,
            "Content type and ID are required"
          );
        }
        
        await deleteEntry(contentType, id);
        
        return {
          content: [{
            type: "text",
            text: `Successfully deleted entry ${id} from ${contentType}`
          }]
        };
      }
      
      case "upload_media": {
        const fileData = String(request.params.arguments?.fileData);
        const fileName = String(request.params.arguments?.fileName);
        const fileType = String(request.params.arguments?.fileType);
        
        if (!fileData || !fileName || !fileType) {
          throw new McpError(
            ErrorCode.InvalidParams,
            "File data, file name, and file type are required"
          );
        }
        
        // Log a truncated version of the fileData to avoid context overflow in logs
        const truncatedFileData = fileData.length > 100 ? `${fileData.substring(0, 100)}... [${fileData.length} chars total]` : fileData;
        console.error(`[API] Received base64 upload request: fileName=${fileName}, fileType=${fileType}, data=${truncatedFileData}`);
        
        const media = await uploadMedia(fileData, fileName, fileType);
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify(media, null, 2)
          }]
        };
      }
      
      case "upload_media_from_path": {
        const filePath = String(request.params.arguments?.filePath);
        const fileName = request.params.arguments?.fileName ? String(request.params.arguments.fileName) : undefined;
        const fileType = request.params.arguments?.fileType ? String(request.params.arguments.fileType) : undefined;
        
        if (!filePath) {
          throw new McpError(
            ErrorCode.InvalidParams,
            "File path is required"
          );
        }
        
        const media = await uploadMediaFromPath(filePath, fileName, fileType);
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify(media, null, 2)
          }]
        };
      }
      
      case "get_content_type_schema": {
        const contentType = String(request.params.arguments?.contentType);
        if (!contentType) {
          throw new McpError(
            ErrorCode.InvalidParams,
            "Content type is required"
          );
        }
        const schema = await fetchContentTypeSchema(contentType);
        return {
          content: [{
            type: "text",
            text: JSON.stringify(schema, null, 2)
          }]
        };
      }
      
      case "connect_relation": {
        const { contentType, id, relationField, relatedIds } = request.params.arguments as any;
        if (!contentType || !id || !relationField || !Array.isArray(relatedIds)) {
          throw new McpError(ErrorCode.InvalidParams, "contentType, id, relationField, and relatedIds (array) are required.");
        }
        const result = await connectRelation(String(contentType), String(id), String(relationField), relatedIds);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
      case "disconnect_relation": {
         const { contentType, id, relationField, relatedIds } = request.params.arguments as any;
         if (!contentType || !id || !relationField || !Array.isArray(relatedIds)) {
          throw new McpError(ErrorCode.InvalidParams, "contentType, id, relationField, and relatedIds (array) are required.");
        }
         const result = await disconnectRelation(String(contentType), String(id), String(relationField), relatedIds);
         return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
       }
 
       case "create_content_type": {
         const contentTypeData = request.params.arguments;
         if (!contentTypeData || typeof contentTypeData !== 'object') {
           throw new McpError(ErrorCode.InvalidParams, "Content type data object is required.");
         }
         // We pass the whole arguments object to the function
         const creationResult = await createContentType(contentTypeData);
         return {
           content: [{
             type: "text",
             text: JSON.stringify(creationResult, null, 2)
          }]
        };
      }

      case "update_content_type": {
        const { contentType, attributes } = request.params.arguments as any;
        if (!contentType || !attributes || typeof attributes !== 'object') {
           throw new McpError(ErrorCode.InvalidParams, "contentType (string) and attributes (object) are required.");
         }
         const updateResult = await updateContentType(String(contentType), attributes);
         return {
           content: [{
            type: "text",
            text: JSON.stringify(updateResult, null, 2)
          }]
        };
      }

      case "delete_content_type": {
        const contentTypeUid = String(request.params.arguments?.contentType);
        if (!contentTypeUid) {
          throw new McpError(
            ErrorCode.InvalidParams,
            "Content type UID is required"
          );
        }
        const deletionResult = await deleteContentType(contentTypeUid);
        return {
          content: [{
            type: "text",
            text: JSON.stringify(deletionResult, null, 2)
          }]
        };
      }

      case "list_components": {
        const components = await listComponents();
        return {
          content: [{
            type: "text",
            text: JSON.stringify(components, null, 2)
          }]
        };
      }

      case "get_component_schema": {
        const componentUid = String(request.params.arguments?.componentUid);
        if (!componentUid) {
          throw new McpError(
            ErrorCode.InvalidParams,
            "Component UID is required"
          );
        }
        const schema = await getComponentSchema(componentUid);
        return {
          content: [{
            type: "text",
            text: JSON.stringify(schema, null, 2)
          }]
        };
      }

      case "create_component": {
        const { displayName, category, icon, attributes } = request.params.arguments as any;
        if (!displayName || !category || !attributes || typeof attributes !== 'object') {
          throw new McpError(ErrorCode.InvalidParams, "displayName, category, and attributes are required.");
        }
        const componentData = { displayName, category, icon, attributes };
        const creationResult = await createComponent(componentData);
        return {
          content: [{
            type: "text",
            text: JSON.stringify(creationResult, null, 2)
          }]
        };
      }

      case "update_component": {
        const { componentUid, attributesToUpdate } = request.params.arguments as any;
        if (!componentUid || !attributesToUpdate || typeof attributesToUpdate !== 'object') {
          throw new McpError(ErrorCode.InvalidParams, "componentUid (string) and attributesToUpdate (object) are required.");
        }
        const updateResult = await updateComponent(String(componentUid), attributesToUpdate);
        return {
          content: [{
            type: "text",
            text: JSON.stringify(updateResult, null, 2)
          }]
        };
      }

      case "publish_entry": {
        const contentType = String(request.params.arguments?.contentType);
        const id = String(request.params.arguments?.id);
        
        if (!contentType || !id) {
          throw new McpError(
            ErrorCode.InvalidParams,
            "Content type and ID are required"
          );
        }
        
        const result = await publishEntry(contentType, id);
        return {
          content: [{
            type: "text",
            text: JSON.stringify(result, null, 2)
          }]
        };
      }
      
      case "unpublish_entry": {
        const contentType = String(request.params.arguments?.contentType);
        const id = String(request.params.arguments?.id);
        
        if (!contentType || !id) {
          throw new McpError(
            ErrorCode.InvalidParams,
            "Content type and ID are required"
          );
        }
        
        const result = await unpublishEntry(contentType, id);
        return {
          content: [{
            type: "text",
            text: JSON.stringify(result, null, 2)
          }]
        };
      }

      default:
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${request.params.name}`
        );
    }
  } catch (error) {
    console.error(`[Error] Tool execution failed: ${error instanceof Error ? error.message : String(error)}`);
    
    // Handle both McpError and regular errors the same way - return error response
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    return {
      content: [{
        type: "text",
        text: `Error: ${errorMessage}`
      }],
      isError: true
    };
  }
});

/**
 * Start the server using stdio transport.
 */
async function main() {
  console.error("[Setup] Starting Strapi MCP server");
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[Setup] Strapi MCP server running");
}

main().catch((error) => {
  console.error("[Error] Server error:", error);
  process.exit(1);
});

/**
 * Delete a content type from Strapi. Requires admin privileges.
 */
async function deleteContentType(contentTypeUid: string): Promise<any> {
  try {
    console.error(`[API] Deleting content type: ${contentTypeUid}`);
    
    // Validate that this is a proper content type UID
    if (!contentTypeUid || !contentTypeUid.includes('.')) {
      throw new Error(`Invalid content type UID: ${contentTypeUid}. UID should be in the format 'api::name.name'`);
    }
    
    // Make the DELETE request using admin credentials
    const endpoint = `/content-type-builder/content-types/${contentTypeUid}`;
    console.error(`[API] Sending DELETE request to: ${endpoint}`);
    
    const response = await makeAdminApiRequest(endpoint, 'delete');
    console.error(`[API] Content type deletion response:`, response);
    
    // Return the response data or a success message
    return response?.data || { message: `Content type ${contentTypeUid} deleted. Strapi might be restarting.` };
  } catch (error: any) {
    console.error(`[Error] Failed to delete content type ${contentTypeUid}:`, error);
    
    let errorMessage = `Failed to delete content type ${contentTypeUid}`;
    let errorCode = ExtendedErrorCode.InternalError;
    
    if (axios.isAxiosError(error)) {
      errorMessage += `: ${error.response?.status} ${error.response?.statusText}`;
      if (error.response?.status === 404) {
        errorCode = ExtendedErrorCode.ResourceNotFound;
        errorMessage += ` (Content type not found)`;
      } else if (error.response?.status === 400) {
        errorCode = ExtendedErrorCode.InvalidParams;
        errorMessage += ` (Bad Request): ${JSON.stringify(error.response?.data)}`;
      } else if (error.response?.status === 403 || error.response?.status === 401) {
        errorCode = ExtendedErrorCode.AccessDenied;
        errorMessage += ` (Permission Denied - Admin credentials might lack permissions)`;
      }
    } else if (error instanceof Error) {
      errorMessage += `: ${error.message}`;
    } else {
      errorMessage += `: ${String(error)}`;
    }
    
    throw new ExtendedMcpError(errorCode, errorMessage);
  }
}

// Add connection validation flag
let connectionValidated = false;

/**
 * Test connection to Strapi and validate authentication
 */
async function validateStrapiConnection(): Promise<void> {
  if (connectionValidated) return; // Already validated
  
  try {
    console.error("[Setup] Validating connection to Strapi...");
    
    // Try a simple request to test connectivity - use a valid endpoint
    // Try the admin/users/me endpoint to test admin authentication
    // or fall back to a public content endpoint
    let response;
    let authMethod = "";
    
    // First try admin authentication if available
    if (STRAPI_ADMIN_EMAIL && STRAPI_ADMIN_PASSWORD) {
      try {
        // Test admin login
        await loginToStrapiAdmin();
        const adminData = await makeAdminApiRequest('/admin/users/me');
        // makeAdminApiRequest returns data, not full response - if we get data, auth worked
        if (adminData) {
          authMethod = "admin credentials";
          console.error("[Setup] ✓ Admin authentication successful");
          console.error(`[Setup] ✓ Connection to Strapi successful using ${authMethod}`);
          connectionValidated = true;
          return; // Success - exit early
        }
      } catch (adminError) {
        console.error("[Setup] Admin authentication failed, trying API token...");
        // Fall through to API token test
      }
    }
    
    // If admin failed or not available, try API token
    try {
      // Try a simple endpoint that should exist - use upload/files to test API token
      response = await strapiClient.get('/api/upload/files?pagination[limit]=1');
      authMethod = "API token";
      console.error("[Setup] ✓ API token authentication successful");
    } catch (apiError) {
      console.error("[Setup] API token test failed, trying root endpoint...");
      try {
        // Last resort - try to hit the root to see if server is running
        response = await strapiClient.get('/');
        authMethod = "server connection";
        console.error("[Setup] ✓ Server is reachable");
      } catch (rootError) {
        throw new Error("All connection tests failed");
      }
    }
    
    // Check if we got a proper response from strapiClient calls
    if (response && response.status >= 200 && response.status < 300) {
      console.error(`[Setup] ✓ Connection to Strapi successful using ${authMethod}`);
      connectionValidated = true;
    } else {
      throw new Error(`Unexpected response status: ${response?.status}`);
    }
  } catch (error: any) {
    console.error("[Setup] ✗ Failed to connect to Strapi");
    
    let errorMessage = "Cannot connect to Strapi instance";
    
    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNREFUSED') {
        errorMessage += `: Connection refused. Is Strapi running at ${STRAPI_URL}?`;
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
