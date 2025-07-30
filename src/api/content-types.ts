import axios from "axios";
import { setTimeout as setTimeoutAsync } from "timers/promises";
import {
  strapiClient,
  validateStrapiConnection,
  makeAdminApiRequest,
  getAdminJwtToken,
  clearAdminJwtToken,
} from "./client.js";
import { config, validateConfig } from "../config/index.js";
import { ContentType } from "../types/index.js";
import { ExtendedMcpError, ExtendedErrorCode } from "../errors/index.js";
import { logger } from "../utils/index.js";

// Cache for discovered content types
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let contentTypesCache: ContentType[] = [];

/**
 * Wait for Strapi to restart using the admin panel status endpoint
 * @param maxAttempts Maximum number of attempts (default: 60 = 60 seconds)
 * @returns Promise that resolves when Strapi is ready
 */
async function waitForStrapiRestartWithStatus(maxAttempts = 60): Promise<void> {
  logger.info("[API] Waiting for Strapi to apply schema changes...");

  // In test environments, Strapi might not actually restart
  // First check if we're in a test environment
  const isTestEnvironment = process.env.NODE_ENV === "test" || process.env.VITEST === "true";

  if (isTestEnvironment) {
    logger.info("[API] Test environment detected, using simplified restart wait");
    // Wait a bit for any async operations to complete
    await setTimeoutAsync(3000);

    // Clear admin JWT token in case it's invalid
    clearAdminJwtToken();

    // Verify content type exists by trying to access it
    let verified = false;
    for (let i = 0; i < 10; i++) {
      try {
        const healthCheck = await axios.get(`${config.strapi.url}/_health`, {
          timeout: 2000,
          validateStatus: () => true,
        });
        if (healthCheck.status === 204) {
          verified = true;
          break;
        }
      } catch {
        logger.debug(`[API] Health check attempt ${i + 1} failed, retrying...`);
      }
      await setTimeoutAsync(1000);
    }

    if (!verified) {
      logger.warn("[API] Could not verify Strapi is ready after schema changes");
    }

    return;
  }

  let attempts = 0;
  let isRestarting = true;

  while (isRestarting && attempts < maxAttempts) {
    attempts++;

    try {
      // Check the update-schema-status endpoint
      const response = await makeAdminApiRequest(
        "/content-type-builder/update-schema-status",
        "get"
      );

      logger.debug(`[API] Schema update status (attempt ${attempts}/${maxAttempts}):`, response);

      // The endpoint returns { data: { isUpdating: boolean } }
      if (response?.data?.isUpdating === false) {
        logger.info("[API] Strapi has finished applying schema changes");
        isRestarting = false;
      } else {
        logger.debug(
          `[API] Strapi is still applying changes (isUpdating: ${response?.data?.isUpdating})`
        );
      }
    } catch (error: any) {
      // During restart, the server might be temporarily unavailable
      if (error.code === "ECONNREFUSED" || error.code === "ECONNRESET") {
        logger.debug(`[API] Strapi is restarting (connection refused)`);
      } else {
        logger.debug(`[API] Status check error: ${error.message}`);
        // In test mode, this endpoint might not exist
        if (error.response?.status === 404 && isTestEnvironment) {
          logger.info("[API] Status endpoint not found in test mode, proceeding");
          isRestarting = false;
        }
      }
    }

    if (isRestarting) {
      await setTimeoutAsync(1000);
    }
  }

  if (isRestarting) {
    logger.warn("[API] Timeout waiting for Strapi to apply schema changes");
    throw new ExtendedMcpError(
      ExtendedErrorCode.InternalError,
      "Timeout waiting for Strapi to apply schema changes. Please check Strapi logs."
    );
  }

  // Wait an additional 2 seconds for full stabilization
  logger.info("[API] Waiting for final stabilization...");
  await setTimeoutAsync(2000);
  logger.info("[API] Schema changes applied successfully");

  // Clear admin JWT token after restart as it's likely invalid
  logger.info("[API] Clearing admin JWT token after Strapi restart");
  clearAdminJwtToken();
}

/**
 * Wait for Strapi to restart and become ready after schema changes
 * @param maxAttempts Maximum number of attempts (default: 30 = 30 seconds)
 * @returns Promise that resolves when Strapi is ready
 */
async function waitForStrapiRestart(maxAttempts = 30): Promise<void> {
  logger.info("[API] Checking if Strapi needs to restart after schema changes...");

  // First, quickly check if Strapi is still responding
  await setTimeoutAsync(50);

  try {
    const quickCheck = await axios.get(`${config.strapi.url}/_health`, {
      timeout: 1000,
      validateStatus: () => true,
    });

    if (quickCheck.status === 204) {
      logger.info("[API] Strapi is still responding, no restart needed");
      // Wait a short time for any internal updates to complete
      await setTimeoutAsync(500);
      return;
    }
  } catch {
    // If we get connection refused, Strapi is restarting
    logger.info("[API] Strapi appears to be restarting, waiting for it to come back...");
  }

  // Wait a bit more before starting regular checks
  await setTimeoutAsync(2000);

  let attempts = 0;
  let strapiReady = false;

  while (!strapiReady && attempts < maxAttempts) {
    attempts++;

    try {
      // Check the health endpoint
      const healthResponse = await axios.get(`${config.strapi.url}/_health`, {
        timeout: 5000,
        validateStatus: () => true,
      });

      if (healthResponse.status === 204) {
        logger.debug(`[API] Health check successful (attempt ${attempts}/${maxAttempts})`);
        strapiReady = true;
      } else {
        logger.debug(`[API] Health check returned status ${healthResponse.status}, waiting...`);
      }
    } catch (error: any) {
      if (error.code === "ECONNREFUSED" || error.code === "ECONNRESET") {
        logger.debug(`[API] Strapi is still restarting (attempt ${attempts}/${maxAttempts})`);
      } else {
        logger.debug(`[API] Health check error: ${error.message}`);
      }
    }

    if (!strapiReady) {
      await setTimeoutAsync(1000);
    }
  }

  if (!strapiReady) {
    logger.warn("[API] Strapi did not become ready within the timeout period");
    throw new ExtendedMcpError(
      ExtendedErrorCode.InternalError,
      "Strapi did not become ready after restart. Please check Strapi logs."
    );
  }

  // Wait an additional 2 seconds for Strapi to fully stabilize
  logger.info("[API] Strapi is ready, waiting for stabilization...");
  await setTimeoutAsync(2000);
  logger.info("[API] Strapi restart complete");
}

export async function listContentTypes(): Promise<ContentType[]> {
  // Ensure config is loaded
  validateConfig();

  // First try to get content types via admin API if available
  if (config.strapi.adminEmail && config.strapi.adminPassword) {
    try {
      logger.debug("[API] Attempting to fetch content types via admin API");
      logger.debug(`[API] Admin credentials available: ${!!config.strapi.adminEmail}`);
      const adminEndpoint = `/content-type-builder/content-types`;
      const response = await makeAdminApiRequest(adminEndpoint);

      logger.debug(`[API] Admin API response:`, JSON.stringify(response, null, 2));

      if (response && response.data) {
        const contentTypes = Array.isArray(response.data) ? response.data : [response.data];

        logger.debug(`[API] Found ${contentTypes.length} content types via admin API`);

        // Filter and format content types
        const formatted = contentTypes
          .filter((ct: any) => ct.uid && ct.uid.startsWith("api::"))
          .map((ct: any) => {
            const [, apiId] = ct.uid.split("::");
            const [singular] = apiId.split(".");

            return {
              uid: ct.uid,
              apiID: singular,
              pluralApiId: ct.info?.pluralName || `${singular}s`,
              displayName: ct.info?.displayName || singular,
              isLocalized: ct.pluginOptions?.i18n?.localized || false,
              info: {
                displayName: ct.info?.displayName || singular,
                description: ct.info?.description || `${singular} content type`,
                singularName: ct.info?.singularName || singular,
                pluralName: ct.info?.pluralName || `${singular}s`,
              },
              attributes: ct.attributes || {},
            };
          });

        logger.debug(`[API] Returning ${formatted.length} formatted content types`);
        return formatted;
      }
    } catch (error) {
      logger.debug(
        "[API] Failed to fetch content types via admin API, falling back to discovery:",
        error
      );
      // Don't fall back to discovery since we only use admin credentials
      logger.debug("[API] Admin API failed, returning empty array");
      return [];
    }
  } else {
    logger.debug("[API] No admin credentials available, using discovery method");
  }

  // No fallback needed since we only use admin credentials
  logger.debug("[API] No admin credentials available for content type discovery");
  return [];
}

export async function fetchContentTypes(): Promise<ContentType[]> {
  try {
    await validateStrapiConnection();

    logger.debug("[API] Fetching content types from Strapi");

    // Try content type discovery via known patterns
    logger.debug(`[API] Trying content type discovery via known patterns...`);

    const commonTypes = ["article", "page", "post", "user", "category", "project", "technology"];
    const discoveredTypes = [];

    for (const type of commonTypes) {
      // Try common plural forms
      const pluralVariants = [
        `${type}s`, // articles, pages
        `${type}es`, // technologies
        `${type}ies`, // categories (category -> categories)
        type, // user -> user (same)
      ];

      for (const plural of pluralVariants) {
        try {
          // Use admin JWT token for discovery
          let testResponse;
          logger.debug(`[API] Trying ${plural} with admin auth`);
          try {
            // Admin API might need different approach, so also try regular strapiClient
            const adminJwtToken = getAdminJwtToken();
            if (!adminJwtToken) {
              // Need to login first
              await validateStrapiConnection();
            }
            testResponse = await strapiClient.get(`/api/${plural}?pagination[limit]=1`);
          } catch {
            // If doesn't work, continue
            continue;
          }

          if (testResponse && testResponse.status === 200) {
            console.error(
              `[API] Discovered content type: api::${type}.${type} with plural: ${plural}`
            );
            discoveredTypes.push({
              uid: `api::${type}.${type}`,
              apiID: type,
              pluralApiId: plural, // Use the actual endpoint that worked
              info: {
                displayName: type.charAt(0).toUpperCase() + type.slice(1),
                description: `${type} content type (discovered)`,
              },
              attributes: {},
            });
            break; // Found it, move to next type
          }
        } catch {
          // Continue trying other variants
        }
      }
    }

    if (discoveredTypes.length > 0) {
      logger.debug(`[API] Found ${discoveredTypes.length} content types via discovery`);
      contentTypesCache = discoveredTypes;
      return discoveredTypes;
    }

    let errorMessage = "Unable to fetch content types from Strapi. This could be due to:\n";
    errorMessage += "1. Strapi server not running or unreachable\n";
    errorMessage += "2. Invalid API token or insufficient permissions\n";
    errorMessage += "3. Database connectivity issues\n";
    errorMessage += "4. Strapi instance configuration problems\n\n";
    errorMessage += "Please check:\n";
    errorMessage += `- Strapi is running at ${config.strapi.url}\n`;
    errorMessage += "- Your API token has proper permissions\n";
    errorMessage += "- Database is accessible and running\n";
    errorMessage += "- Try creating a test content type in your Strapi admin panel";

    throw new ExtendedMcpError(ExtendedErrorCode.InternalError, errorMessage);
  } catch (error: any) {
    logger.error("[Error] Failed to fetch content types:", error);

    let errorMessage = "Failed to fetch content types";
    let errorCode = ExtendedErrorCode.InternalError;

    if (axios.isAxiosError(error)) {
      if (error.response) {
        errorMessage = `Failed to fetch content types: ${error.response.status} - ${JSON.stringify(error.response.data)}`;
        if (error.response.status === 403) {
          errorCode = ExtendedErrorCode.AccessDenied;
        } else if (error.response.status === 401) {
          errorCode = ExtendedErrorCode.AccessDenied;
        }
      } else {
        errorMessage += `: ${error.message}`;
      }
    } else if (error instanceof Error) {
      errorMessage += `: ${error.message}`;
    } else {
      errorMessage += `: ${String(error)}`;
    }

    throw new ExtendedMcpError(errorCode, errorMessage);
  }
}

export async function fetchContentTypeSchema(contentType: string): Promise<any> {
  try {
    logger.debug(`[API] Fetching schema for content type: ${contentType}`);

    // Try admin API first if credentials are available
    if (config.strapi.adminEmail && config.strapi.adminPassword) {
      try {
        logger.debug(`[API] Attempting to fetch schema via admin API for ${contentType}`);
        const endpoint = `/content-type-builder/content-types/${contentType}`;
        const response = await makeAdminApiRequest(endpoint);

        if (response?.data) {
          logger.debug(`[API] Successfully fetched schema via admin API`);
          logger.debug(
            `[API] Admin API schema response structure:`,
            JSON.stringify(response.data, null, 2)
          );

          // The admin API returns data.schema with the actual schema
          const schemaData = response.data;

          // Return the full schema structure, preserving the nested format
          return {
            uid: schemaData.uid || contentType,
            apiID: schemaData.apiID || contentType.split("::")[1]?.split(".")[0],
            schema: schemaData.schema || schemaData,
            info: schemaData.schema?.info || schemaData.info || {},
            attributes: schemaData.schema?.attributes || schemaData.attributes || {},
            pluginOptions: schemaData.schema?.pluginOptions || schemaData.pluginOptions || {},
            isLocalized: schemaData.schema?.pluginOptions?.i18n?.localized || false,
            displayName: schemaData.schema?.info?.displayName || schemaData.info?.displayName,
          };
        }
      } catch (adminError) {
        logger.debug(
          `[API] Failed to fetch schema via admin API, falling back to inference:`,
          adminError
        );
      }
    }

    logger.debug("[API] Attempting to infer schema from public API");

    const collection = contentType.split(".")[1];

    try {
      const possiblePaths = [
        `/api/${collection}`,
        `/api/${collection.toLowerCase()}`,
        `/api/v1/${collection}`,
        `/${collection}`,
        `/${collection.toLowerCase()}`,
      ];

      let response;
      let success = false;

      for (const path of possiblePaths) {
        try {
          logger.debug(`[API] Trying path for schema inference: ${path}`);
          response = await strapiClient.get(`${path}?pagination[limit]=1&pagination[page]=1`);
          logger.debug(`[API] Successfully fetched sample data from: ${path}`);
          success = true;
          break;
        } catch (err: any) {
          if (axios.isAxiosError(err) && err.response?.status === 404) {
            continue;
          }
          throw err;
        }
      }

      if (!success || !response) {
        throw new Error(`Could not find any valid API path for ${collection}`);
      }

      let sampleEntry;
      if (
        response.data.data &&
        Array.isArray(response.data.data) &&
        response.data.data.length > 0
      ) {
        sampleEntry = response.data.data[0];
      } else if (Array.isArray(response.data) && response.data.length > 0) {
        sampleEntry = response.data[0];
      } else if (response.data) {
        sampleEntry = response.data;
      }

      if (!sampleEntry) {
        throw new Error(`No sample entries available to infer schema for ${contentType}`);
      }

      const attributes: Record<string, any> = {};

      Object.entries(sampleEntry.attributes || sampleEntry).forEach(([key, value]) => {
        if (key === "id") return;

        let type: string = typeof value;

        if (type === "object") {
          if (value === null) {
            type = "string";
          } else if (Array.isArray(value)) {
            type = "relation";
          } else if (value instanceof Date) {
            type = "datetime";
          } else {
            type = "json";
          }
        }

        attributes[key] = { type };
      });

      return {
        uid: contentType,
        apiID: collection,
        info: {
          displayName: collection.charAt(0).toUpperCase() + collection.slice(1),
          description: `Inferred schema for ${collection}`,
        },
        attributes,
      };
    } catch (inferError) {
      logger.debug(`[API] Failed to infer schema:`, inferError);

      return {
        uid: contentType,
        apiID: collection,
        info: {
          displayName: collection.charAt(0).toUpperCase() + collection.slice(1),
          description: `${collection} content type`,
        },
        attributes: {},
      };
    }
  } catch (error: any) {
    let errorMessage = `Failed to fetch schema for ${contentType}`;
    let errorCode = ExtendedErrorCode.InternalError;

    if (axios.isAxiosError(error)) {
      if (error.response) {
        errorMessage = `Failed to fetch schema for ${contentType}: ${error.response.status} - ${JSON.stringify(error.response.data)}`;
        if (error.response.status === 404) {
          errorCode = ExtendedErrorCode.ResourceNotFound;
        } else if (error.response.status === 403) {
          errorCode = ExtendedErrorCode.AccessDenied;
        } else if (error.response.status === 401) {
          errorCode = ExtendedErrorCode.AccessDenied;
        } else if (error.response.status === 400) {
          errorCode = ExtendedErrorCode.InvalidRequest;
        }
      } else {
        errorMessage += `: ${error.message}`;
      }
    } else if (error instanceof Error) {
      errorMessage += `: ${error.message}`;
    } else {
      errorMessage += `: ${String(error)}`;
    }

    logger.error(`[Error] ${errorMessage}`);
    throw new ExtendedMcpError(errorCode, errorMessage);
  }
}

// Note: The following functions require admin permissions and are not available with API tokens only
export async function createContentType(contentTypeData: any): Promise<any> {
  try {
    // Admin credentials are required for content type operations
    if (!config.strapi.adminEmail || !config.strapi.adminPassword) {
      throw new ExtendedMcpError(
        ExtendedErrorCode.AccessDenied,
        "Admin credentials are required for content type operations"
      );
    }

    // Extract the fields from the contentTypeData
    const {
      displayName,
      singularName,
      pluralName,
      kind = "collectionType",
      draftAndPublish = true,
      attributes,
      pluginOptions,
    } = contentTypeData;

    if (!displayName || !singularName || !pluralName || !attributes) {
      throw new ExtendedMcpError(
        ExtendedErrorCode.InvalidParams,
        "displayName, singularName, pluralName, and attributes are required for content type creation"
      );
    }

    // Transform attributes to the admin panel format
    const transformedAttributes = Object.entries(attributes).map(
      ([name, config]: [string, any]) => ({
        action: "create",
        name,
        properties: {
          ...config,
          pluginOptions: config.pluginOptions || {},
        },
      })
    );

    // Build the payload using the admin panel API format
    const payload = {
      data: {
        components: [],
        contentTypes: [
          {
            action: "create",
            uid: `api::${singularName}.${singularName}`,
            status: "NEW",
            modelType: "contentType",
            attributes: transformedAttributes,
            kind,
            modelName: displayName.replace(/\s+/g, ""),
            globalId: displayName.replace(/\s+/g, ""),
            pluginOptions: pluginOptions || {},
            draftAndPublish,
            displayName,
            singularName,
            pluralName,
          },
        ],
      },
    };

    logger.debug(`[API] Creating new content type: ${displayName}`);
    logger.debug(
      `[API] Attempting to create content type with payload: ${JSON.stringify(payload, null, 2)}`
    );

    // Use the admin panel endpoint for updating schema
    const endpoint = "/content-type-builder/update-schema";
    logger.debug(`[API] Using endpoint: ${endpoint}`);

    const response = await makeAdminApiRequest(endpoint, "post", payload);
    logger.debug(`[API] Content type creation response:`, response);

    // Wait for Strapi to restart using the status endpoint
    await waitForStrapiRestartWithStatus();

    // Return success response
    return (
      response?.data || {
        message: "Content type created successfully. Strapi might be restarting to apply changes.",
        uid: `api::${singularName}.${singularName}`,
      }
    );
  } catch (error: any) {
    logger.error(`[Error] Failed to create content type:`, error);

    let errorMessage = `Failed to create content type`;
    let errorCode = ExtendedErrorCode.InternalError;

    if (axios.isAxiosError(error)) {
      errorMessage += `: ${error.response?.status} ${error.response?.statusText}`;
      const responseData = JSON.stringify(error.response?.data);
      if (error.response?.status === 400) {
        errorCode = ExtendedErrorCode.InvalidParams;
        errorMessage += ` (Bad Request - Check payload/attributes): ${responseData}`;
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

export async function updateContentType(
  contentTypeUid: string,
  attributesToUpdate: Record<string, any>
): Promise<any> {
  try {
    logger.debug(`[API] Updating content type: ${contentTypeUid}`);

    // Admin credentials are required for content type operations
    if (!config.strapi.adminEmail || !config.strapi.adminPassword) {
      throw new ExtendedMcpError(
        ExtendedErrorCode.AccessDenied,
        "Admin credentials are required for content type operations"
      );
    }

    if (!contentTypeUid || !attributesToUpdate || typeof attributesToUpdate !== "object") {
      throw new ExtendedMcpError(
        ExtendedErrorCode.InvalidParams,
        "Missing required fields: contentTypeUid, attributesToUpdate (object)"
      );
    }

    // 1. Fetch the current schema
    logger.debug(`[API] Fetching current schema for ${contentTypeUid}`);
    const currentSchemaData = await fetchContentTypeSchema(contentTypeUid);

    // Ensure we have the schema structure
    const currentSchema = currentSchemaData.schema || currentSchemaData;
    if (!currentSchema || !currentSchema.attributes) {
      logger.error("[API] Could not retrieve a valid current schema structure.", currentSchemaData);
      throw new ExtendedMcpError(
        ExtendedErrorCode.ResourceNotFound,
        `Could not retrieve a valid schema structure for ${contentTypeUid}`
      );
    }
    logger.debug(`[API] Current attributes: ${Object.keys(currentSchema.attributes).join(", ")}`);

    // 2. Merge new/updated attributes into the current schema's attributes
    const updatedAttributes = { ...currentSchema.attributes, ...attributesToUpdate };
    logger.debug(`[API] Attributes after update: ${Object.keys(updatedAttributes).join(", ")}`);

    // 3. Construct the payload for the PUT request
    const payload = {
      contentType: {
        ...currentSchema, // Spread the existing schema details
        attributes: updatedAttributes, // Use the merged attributes
      },
    };

    // Remove potentially problematic fields
    delete payload.contentType.uid; // UID is usually in the URL, not body for PUT

    logger.debug(
      `[API] Update Payload for PUT /content-type-builder/content-types/${contentTypeUid}: ${JSON.stringify(payload, null, 2)}`
    );

    // 4. Make the PUT request using admin credentials
    const endpoint = `/content-type-builder/content-types/${contentTypeUid}`;
    const response = await makeAdminApiRequest(endpoint, "put", payload);

    logger.debug(`[API] Content type update response:`, response);

    // Wait for Strapi to restart after updating content type
    await waitForStrapiRestart();

    // Return success response
    return (
      response?.data || {
        message: `Content type ${contentTypeUid} updated successfully`,
        uid: contentTypeUid,
      }
    );
  } catch (error: any) {
    logger.error(`[Error] Failed to update content type ${contentTypeUid}:`, error);

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

export async function deleteContentType(contentTypeUid: string): Promise<any> {
  try {
    logger.debug(`[API] Deleting content type: ${contentTypeUid}`);

    // Admin credentials are required for content type operations
    if (!config.strapi.adminEmail || !config.strapi.adminPassword) {
      throw new ExtendedMcpError(
        ExtendedErrorCode.AccessDenied,
        "Admin credentials are required for content type operations"
      );
    }

    // Validate that this is a proper content type UID
    if (!contentTypeUid || !contentTypeUid.includes(".")) {
      throw new ExtendedMcpError(
        ExtendedErrorCode.InvalidParams,
        `Invalid content type UID: ${contentTypeUid}. UID should be in the format 'api::name.name'`
      );
    }

    // Make the DELETE request using admin credentials
    const endpoint = `/content-type-builder/content-types/${contentTypeUid}`;
    logger.debug(`[API] Sending DELETE request to: ${endpoint}`);

    const response = await makeAdminApiRequest(endpoint, "delete");
    logger.debug(`[API] Content type deletion response:`, response);

    // Wait for Strapi to restart after deleting content type
    await waitForStrapiRestart();

    // Return success response
    return (
      response?.data || {
        message: `Content type ${contentTypeUid} deleted successfully`,
      }
    );
  } catch (error: any) {
    logger.error(`[Error] Failed to delete content type ${contentTypeUid}:`, error);

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
