import axios from "axios";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import {
  strapiClient,
  validateStrapiConnection,
  makeAdminApiRequest,
  getAdminJwtToken,
  loginToStrapiAdmin,
} from "./client.js";
import { QueryParams } from "../types/index.js";
import { ExtendedMcpError, ExtendedErrorCode } from "../errors/index.js";
import { ensureSlugField } from "../utils/slug.js";
import { logger } from "../utils/index.js";
import { config } from "../config/index.js";

export async function fetchEntries(pluralApiId: string, queryParams?: QueryParams): Promise<any> {
  await validateStrapiConnection();

  logger.debug(`[API] Fetching entries for ${pluralApiId}`);

  // Try admin API first if credentials are available
  if (config.strapi.adminEmail && config.strapi.adminPassword) {
    // Ensure we have admin token
    if (!getAdminJwtToken()) {
      logger.debug(`[API] Admin credentials available but no token, triggering login...`);
      await loginToStrapiAdmin();
    }

    if (getAdminJwtToken()) {
      try {
        logger.debug(`[API] Fetching entries for ${pluralApiId} using admin credentials`);

        const params: Record<string, any> = {};
        if (queryParams?.filters) params.filters = queryParams.filters;
        if (queryParams?.pagination) params.pagination = queryParams.pagination;
        if (queryParams?.sort) params.sort = queryParams.sort;
        if (queryParams?.populate) params.populate = queryParams.populate;
        if (queryParams?.fields) params.fields = queryParams.fields;
        if (queryParams?.status && queryParams.status !== "all") {
          params.status = queryParams.status;
        }
        if (queryParams?.locale) {
          params.locale = queryParams.locale;
        }

        // Extract content type from pluralApiId
        const contentType = pluralApiId.includes("::")
          ? pluralApiId
          : `api::${pluralApiId.replace(/s$/, "")}.${pluralApiId.replace(/s$/, "")}`;

        const contentManagerEndpoint = `/content-manager/collection-types/${contentType}`;
        const adminResponse = await makeAdminApiRequest(
          contentManagerEndpoint,
          "get",
          undefined,
          params
        );

        if (adminResponse && adminResponse.results) {
          logger.debug(`[API] Successfully fetched entries via Content Manager API.`);

          // Content Manager API returns results and pagination
          const fetchedData = adminResponse.results || [];
          const fetchedMeta = adminResponse.pagination
            ? {
                pagination: {
                  page: adminResponse.pagination.page,
                  pageSize: adminResponse.pagination.pageSize,
                  pageCount: adminResponse.pagination.pageCount,
                  total: adminResponse.pagination.total,
                },
              }
            : {};

          return { data: fetchedData, meta: fetchedMeta };
        }
      } catch (adminError: any) {
        logger.debug(
          `[API] Admin API fetch failed, falling back to API token:`,
          adminError.message
        );
        // Fall through to API token method
      }
    }
  }

  try {
    const params: Record<string, any> = {};
    if (queryParams?.filters) params.filters = queryParams.filters;
    if (queryParams?.pagination) params.pagination = queryParams.pagination;
    if (queryParams?.sort) params.sort = queryParams.sort;
    if (queryParams?.populate) params.populate = queryParams.populate;
    if (queryParams?.fields) params.fields = queryParams.fields;

    // Handle status parameter for Draft & Publish
    if (queryParams?.status && queryParams.status !== "all") {
      params.status = queryParams.status; // 'published' or 'draft'
    }

    // Handle locale parameter for i18n
    if (queryParams?.locale) {
      params.locale = queryParams.locale; // 'en', 'ru', 'zh', 'all', etc.
    }

    const apiPath = `/api/${pluralApiId}`;

    logger.debug(`[API] Trying path: ${apiPath}`);
    const response = await strapiClient.get(apiPath, { params });

    if (response.data && response.data.error) {
      logger.debug(`[API] Path ${apiPath} returned an error:`, response.data.error);
      throw new Error(response.data.error.message);
    }

    logger.debug(`[API] Successfully fetched data from: ${apiPath} using API token`);

    let fetchedData: any[] = [];
    let fetchedMeta: any = {};

    if (response.data.data) {
      fetchedData = Array.isArray(response.data.data) ? response.data.data : [response.data.data];
      fetchedMeta = response.data.meta || {};
    } else if (Array.isArray(response.data)) {
      fetchedData = response.data;
      fetchedMeta = {
        pagination: {
          page: 1,
          pageSize: fetchedData.length,
          pageCount: 1,
          total: fetchedData.length,
        },
      };
    } else {
      logger.warn(`[API] Unexpected response format from ${apiPath}:`, response.data);
      fetchedData = response.data ? [response.data] : [];
      fetchedMeta = {};
    }

    fetchedData = fetchedData.filter((item: any) => !item?.error);

    logger.debug(`[API] Returning data fetched for ${pluralApiId}`);
    return { data: fetchedData, meta: fetchedMeta };
  } catch (error: any) {
    logger.debug(`[API] Error during fetch for ${pluralApiId}:`, error);

    let errorMessage = `Failed to fetch entries for ${pluralApiId}`;
    let errorCode = ExtendedErrorCode.InternalError;

    if (axios.isAxiosError(error)) {
      if (error.response) {
        errorMessage += `: ${error.response.status} ${error.response.statusText}`;
        if (error.response.status === 404) {
          errorCode = ExtendedErrorCode.ResourceNotFound;
          errorMessage += ` (Collection not found)`;
        } else if (error.response.status === 403 || error.response.status === 401) {
          errorCode = ExtendedErrorCode.AccessDenied;
          errorMessage += ` (Permission denied - check API token permissions)`;
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

export async function fetchEntry(
  pluralApiId: string,
  documentId: string,
  queryParams?: QueryParams
): Promise<any> {
  try {
    logger.debug(`[API] Fetching entry ${documentId} for ${pluralApiId}`);

    const params: Record<string, any> = {};
    if (queryParams?.populate) {
      params.populate = queryParams.populate;
    }
    if (queryParams?.fields) {
      params.fields = queryParams.fields;
    }
    if (queryParams?.locale) {
      params.locale = queryParams.locale; // For i18n: 'en', 'ru', 'zh', etc.
    }
    if (queryParams?.status) {
      params.status = queryParams.status; // For Draft & Publish: 'published', 'draft'
    }

    // Try admin API first if credentials are available
    if (config.strapi.adminEmail && config.strapi.adminPassword) {
      // Ensure we have admin token
      if (!getAdminJwtToken()) {
        logger.debug(`[API] Admin credentials available but no token, triggering login...`);
        await loginToStrapiAdmin();
      }

      if (getAdminJwtToken()) {
        try {
          logger.debug(
            `[API] Fetching entry ${documentId} for ${pluralApiId} using admin credentials`
          );
          const adminResponse = await makeAdminApiRequest(
            `/api/${pluralApiId}/${documentId}`,
            "get",
            undefined,
            params
          );

          if (adminResponse && adminResponse.data) {
            logger.debug(`[API] Successfully fetched entry via admin API.`);
            return adminResponse.data;
          } else if (adminResponse) {
            logger.debug(
              `[API] Admin API returned response without data field, returning full response`
            );
            return adminResponse;
          }
        } catch (adminError: any) {
          logger.debug(
            `[API] Admin API fetch failed, falling back to API token:`,
            adminError.message
          );
          // Fall through to API token method
        }
      }
    }

    logger.debug(`[API] Fetching entry ${documentId} for ${pluralApiId} using API token`);
    const response = await strapiClient.get(`/api/${pluralApiId}/${documentId}`, { params });

    if (!response.data.data && response.data.error) {
      logger.error(`[API] Response contains error:`, response.data.error);
      throw new Error(response.data.error.message || "Unknown error from Strapi");
    }

    return response.data.data;
  } catch (error: any) {
    logger.error(`[Error] Failed to fetch entry ${documentId} for ${pluralApiId}:`, error);

    let errorMessage = `Failed to fetch entry ${documentId} for ${pluralApiId}`;
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

export async function createEntry(
  contentType: string,
  pluralApiId: string,
  data: any,
  locale?: string,
  status?: string
): Promise<any> {
  try {
    logger.debug(`[API] Creating new entry for ${pluralApiId}`);
    logger.debug(`[API] Admin token available: ${getAdminJwtToken() ? "Yes" : "No"}`);
    logger.debug(`[API] Admin credentials: ${config.strapi.adminEmail ? "Set" : "Not set"}`);

    // Ensure slug field is present if required
    data = ensureSlugField(contentType, data);

    const params: Record<string, any> = {};
    if (locale) {
      params.locale = locale;
    }
    if (status) {
      params.status = status;
    }

    // Try Content Manager API if admin credentials are available
    if (config.strapi.adminEmail && config.strapi.adminPassword) {
      // Ensure we have admin token
      if (!getAdminJwtToken()) {
        logger.debug(`[API] Admin credentials available but no token, triggering login...`);
        await loginToStrapiAdmin();
      }

      if (getAdminJwtToken()) {
        try {
          logger.debug(`[API] Creating entry for ${contentType} using Content Manager API`);

          // Content Manager API has a different endpoint structure
          const contentManagerEndpoint = `/content-manager/collection-types/${contentType}`;

          // Content Manager API expects the data directly, not wrapped in a 'data' object
          const adminResponse = await makeAdminApiRequest(
            contentManagerEndpoint,
            "post",
            data, // Direct data, not wrapped
            params
          );

          if (adminResponse && (adminResponse.data || adminResponse.documentId)) {
            logger.debug(`[API] Successfully created entry via Content Manager API.`);
            // Return the response in the expected format
            return adminResponse.data || adminResponse;
          }
        } catch (adminError: any) {
          logger.debug(
            `[API] Content Manager API create failed, falling back to REST API:`,
            adminError.message
          );
          // Fall through to API token method
        }
      }
    }

    logger.debug(`[API] Creating entry for ${pluralApiId} using API token`);
    const response = await strapiClient.post(
      `/api/${pluralApiId}`,
      {
        data: data,
      },
      { params }
    );

    if (response.data && response.data.data) {
      logger.debug(`[API] Successfully created entry via API token.`);
      return response.data.data;
    } else if (response.data && response.data.error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to create entry for ${pluralApiId}: ${response.status} - ${JSON.stringify(response.data)}`
      );
    }
  } catch (error) {
    logger.error(`[Error] Failed to create entry for ${pluralApiId}:`, error);
    if (error instanceof McpError) {
      throw error; // Re-throw McpError as-is
    }
    if (axios.isAxiosError(error) && error.response) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to create entry for ${pluralApiId}: ${error.response.status} - ${JSON.stringify(error.response.data)}`
      );
    }
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to create entry for ${pluralApiId}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function updateEntry(
  pluralApiId: string,
  documentId: string,
  data: any,
  locale?: string
): Promise<any> {
  // Extract content type from pluralApiId (e.g., "docs" -> "api::doc.doc")
  const contentType = pluralApiId.includes("::")
    ? pluralApiId
    : `api::${pluralApiId.replace(/s$/, "")}.${pluralApiId.replace(/s$/, "")}`;

  const params: Record<string, any> = {};
  if (locale) {
    params.locale = locale;
  }

  // Try Content Manager API if admin credentials are available
  if (config.strapi.adminEmail && config.strapi.adminPassword) {
    // Ensure we have admin token
    if (!getAdminJwtToken()) {
      logger.debug(`[API] Admin credentials available but no token, triggering login...`);
      await loginToStrapiAdmin();
    }

    if (getAdminJwtToken()) {
      try {
        logger.debug(
          `[API] Updating entry ${documentId} for ${contentType} using Content Manager API`
        );

        const contentManagerEndpoint = `/content-manager/collection-types/${contentType}/${documentId}`;
        const adminResponse = await makeAdminApiRequest(
          contentManagerEndpoint,
          "put",
          data, // Direct data, not wrapped
          params
        );

        if (adminResponse && (adminResponse.data || adminResponse.documentId)) {
          logger.debug(`[API] Successfully updated entry via Content Manager API.`);
          return adminResponse.data || adminResponse;
        }
      } catch (adminError: any) {
        logger.debug(
          `[API] Content Manager API update failed, falling back to REST API:`,
          adminError.message
        );
        // Fall through to API token method
      }
    }
  }

  const apiPath = `/api/${pluralApiId}/${documentId}`;
  logger.debug(`[API] Updating entry ${documentId} for ${pluralApiId} using API token`);
  try {
    const response = await strapiClient.put(apiPath, { data }, { params });

    if (response.data && response.data.data) {
      logger.debug(`[API] Successfully updated entry via API token.`);
      return response.data.data;
    } else if (response.data && response.data.error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to update entry ${documentId} for ${pluralApiId}: ${response.status} - ${JSON.stringify(response.data)}`
      );
    }
  } catch (error: any) {
    logger.debug(`[API] Failed to update entry using API token:`, error);
    if (axios.isAxiosError(error) && error.response) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to update entry ${documentId} for ${pluralApiId}: ${error.response.status} - ${JSON.stringify(error.response.data)}`
      );
    }
    throw error;
  }
}

export async function deleteEntry(
  pluralApiId: string,
  documentId: string,
  locale?: string
): Promise<any> {
  // Extract content type from pluralApiId
  const contentType = pluralApiId.includes("::")
    ? pluralApiId
    : `api::${pluralApiId.replace(/s$/, "")}.${pluralApiId.replace(/s$/, "")}`;

  const params: Record<string, any> = {};
  if (locale) {
    params.locale = locale;
  }

  // Try Content Manager API if admin credentials are available
  if (config.strapi.adminEmail && config.strapi.adminPassword) {
    // Ensure we have admin token
    if (!getAdminJwtToken()) {
      logger.debug(`[API] Admin credentials available but no token, triggering login...`);
      await loginToStrapiAdmin();
    }

    if (getAdminJwtToken()) {
      try {
        logger.debug(
          `[API] Deleting entry ${documentId} for ${contentType} using Content Manager API`
        );

        const contentManagerEndpoint = `/content-manager/collection-types/${contentType}/${documentId}`;
        await makeAdminApiRequest(contentManagerEndpoint, "delete", undefined, params);

        logger.debug(`[API] Successfully deleted entry via Content Manager API.`);
        return { success: true };
      } catch (adminError: any) {
        logger.debug(
          `[API] Content Manager API delete failed, falling back to REST API:`,
          adminError.message
        );
        // Fall through to API token method
      }
    }
  }

  const apiPath = `/api/${pluralApiId}/${documentId}`;
  logger.debug(`[API] Deleting entry ${documentId} for ${pluralApiId} using API token`);
  try {
    const response = await strapiClient.delete(apiPath, { params });

    if (response.status === 200 || response.status === 204) {
      logger.debug(`[API] Successfully deleted entry via API token.`);
      return { success: true };
    } else if (response.data && response.data.error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to delete entry ${documentId} for ${pluralApiId}: ${response.status} - ${JSON.stringify(response.data)}`
      );
    }
  } catch (error: any) {
    logger.debug(`[API] Failed to delete entry using API token:`, error);
    if (axios.isAxiosError(error) && error.response) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to delete entry ${documentId} for ${pluralApiId}: ${error.response.status} - ${JSON.stringify(error.response.data)}`
      );
    }
    throw error;
  }
}

export async function publishEntry(pluralApiId: string, documentId: string): Promise<any> {
  // Extract content type from pluralApiId
  const contentType = pluralApiId.includes("::")
    ? pluralApiId
    : `api::${pluralApiId.replace(/s$/, "")}.${pluralApiId.replace(/s$/, "")}`;

  // Try Content Manager API if admin credentials are available
  if (config.strapi.adminEmail && config.strapi.adminPassword) {
    // Ensure we have admin token
    if (!getAdminJwtToken()) {
      logger.debug(`[API] Admin credentials available but no token, triggering login...`);
      await loginToStrapiAdmin();
    }

    if (getAdminJwtToken()) {
      try {
        logger.debug(
          `[API] Publishing entry ${documentId} for ${contentType} using Content Manager API`
        );

        const contentManagerEndpoint = `/content-manager/collection-types/${contentType}/${documentId}/actions/publish`;
        const adminResponse = await makeAdminApiRequest(contentManagerEndpoint, "post");

        logger.debug(`[API] Successfully published entry via Content Manager API.`);
        return adminResponse || { success: true };
      } catch (adminError: any) {
        logger.debug(
          `[API] Content Manager API publish failed, falling back to REST API:`,
          adminError.message
        );
        // Fall through to API token method
      }
    }
  }

  // In Strapi 5, publish can be done two ways:
  // 1. By setting publishedAt field (what we're using)
  // 2. By updating with status: "published" parameter
  const apiPath = `/api/${pluralApiId}/${documentId}`;
  const publishedAt = new Date().toISOString();

  logger.debug(`[API] Publishing entry ${documentId} for ${pluralApiId} using API token`);
  try {
    const response = await strapiClient.put(apiPath, {
      data: {
        publishedAt,
      },
    });

    if (response.data && response.data.data) {
      logger.debug(`[API] Successfully published entry via API token.`);
      return response.data.data;
    } else if (response.data && response.data.error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to publish entry ${documentId} for ${pluralApiId}: ${response.status} - ${JSON.stringify(response.data)}`
      );
    }
  } catch (error: any) {
    logger.debug(`[API] Failed to publish entry using API token:`, error);
    if (axios.isAxiosError(error) && error.response) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to publish entry ${documentId} for ${pluralApiId}: ${error.response.status} - ${JSON.stringify(error.response.data)}`
      );
    }
    throw error;
  }
}

export async function unpublishEntry(pluralApiId: string, documentId: string): Promise<any> {
  // Extract content type from pluralApiId
  const contentType = pluralApiId.includes("::")
    ? pluralApiId
    : `api::${pluralApiId.replace(/s$/, "")}.${pluralApiId.replace(/s$/, "")}`;

  // Try Content Manager API if admin credentials are available
  if (config.strapi.adminEmail && config.strapi.adminPassword) {
    // Ensure we have admin token
    if (!getAdminJwtToken()) {
      logger.debug(`[API] Admin credentials available but no token, triggering login...`);
      await loginToStrapiAdmin();
    }

    if (getAdminJwtToken()) {
      try {
        logger.debug(
          `[API] Unpublishing entry ${documentId} for ${contentType} using Content Manager API`
        );

        const contentManagerEndpoint = `/content-manager/collection-types/${contentType}/${documentId}/actions/unpublish`;
        const adminResponse = await makeAdminApiRequest(contentManagerEndpoint, "post");

        logger.debug(`[API] Successfully unpublished entry via Content Manager API.`);
        return adminResponse || { success: true };
      } catch (adminError: any) {
        logger.debug(
          `[API] Content Manager API unpublish failed, falling back to REST API:`,
          adminError.message
        );
        // Fall through to API token method
      }
    }
  }

  // In Strapi 5, unpublish is done by updating the entry with status: "draft"
  const apiPath = `/api/${pluralApiId}/${documentId}`;

  logger.debug(`[API] Unpublishing entry ${documentId} for ${pluralApiId} using API token`);
  try {
    // First, we need to fetch the current entry data to preserve existing fields
    const currentEntry = await strapiClient.get(apiPath);
    const currentData = currentEntry.data.data;

    // Remove metadata fields that shouldn't be sent in the update
    const dataToUpdate = { ...currentData };
    delete dataToUpdate.id;
    delete dataToUpdate.documentId;
    delete dataToUpdate.createdAt;
    delete dataToUpdate.updatedAt;
    delete dataToUpdate.publishedAt;
    delete dataToUpdate.locale;

    // Update with status: "draft" to unpublish
    const response = await strapiClient.put(
      apiPath,
      {
        data: dataToUpdate,
      },
      {
        params: {
          status: "draft",
        },
      }
    );

    if (response.data && response.data.data) {
      logger.debug(`[API] Successfully unpublished entry via API token.`);
      return response.data.data;
    } else if (response.data && response.data.error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to unpublish entry ${documentId} for ${pluralApiId}: ${response.status} - ${JSON.stringify(response.data)}`
      );
    }
  } catch (error: any) {
    logger.debug(`[API] Failed to unpublish entry using API token:`, error);
    if (axios.isAxiosError(error) && error.response) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to unpublish entry ${documentId} for ${pluralApiId}: ${error.response.status} - ${JSON.stringify(error.response.data)}`
      );
    }
    throw error;
  }
}

export async function connectRelation(
  pluralApiId: string,
  documentId: string,
  relationField: string,
  relatedIds: string[]
): Promise<any> {
  const apiPath = `/api/${pluralApiId}/${documentId}`;

  logger.debug(`[API] Connecting relations for ${documentId} in ${pluralApiId}`);

  // Validate that we have valid IDs
  if (!relatedIds || relatedIds.length === 0) {
    throw new McpError(ErrorCode.InvalidParams, "At least one related ID is required to connect");
  }

  try {
    // Use Strapi's connect parameter as per API docs
    const response = await strapiClient.put(apiPath, {
      data: {
        [relationField]: {
          connect: relatedIds,
        },
      },
    });

    if (response.data && response.data.data) {
      logger.debug(`[API] Successfully connected relations via API token.`);
      return response.data.data;
    }
  } catch (error: any) {
    logger.debug(`[API] Failed to connect relations:`, error);

    let errorMessage = `Failed to connect relation '${relationField}': `;

    if (axios.isAxiosError(error) && error.response) {
      if (error.response.status === 400) {
        errorMessage += `Bad request - this could mean: (1) The relation field '${relationField}' doesn't exist on ${pluralApiId}, (2) One or more of the related IDs don't exist, or (3) The relation field type doesn't support this operation. Please verify the field exists and the IDs are valid.`;
      } else if (error.response.status === 404) {
        errorMessage += `Entry ${documentId} not found in ${pluralApiId}. Make sure the entry exists before trying to connect relations.`;
      } else {
        errorMessage += `${error.response.status} - ${JSON.stringify(error.response.data)}`;
      }
    } else if (error instanceof Error) {
      errorMessage += error.message;
    } else {
      errorMessage += String(error);
    }

    throw new McpError(ErrorCode.InternalError, errorMessage);
  }
}

export async function disconnectRelation(
  pluralApiId: string,
  documentId: string,
  relationField: string,
  relatedIds: string[]
): Promise<any> {
  const apiPath = `/api/${pluralApiId}/${documentId}`;

  logger.debug(`[API] Disconnecting relations for ${documentId} in ${pluralApiId}`);

  // Validate that we have valid IDs
  if (!relatedIds || relatedIds.length === 0) {
    throw new McpError(
      ErrorCode.InvalidParams,
      "At least one related ID is required to disconnect"
    );
  }

  try {
    // Use Strapi's disconnect parameter as per API docs
    const response = await strapiClient.put(apiPath, {
      data: {
        [relationField]: {
          disconnect: relatedIds,
        },
      },
    });

    if (response.data && response.data.data) {
      logger.debug(`[API] Successfully disconnected relations via API token.`);
      return response.data.data;
    }
  } catch (error: any) {
    logger.debug(`[API] Failed to disconnect relations:`, error);

    let errorMessage = `Failed to disconnect relation '${relationField}': `;

    if (axios.isAxiosError(error) && error.response) {
      if (error.response.status === 400) {
        errorMessage += `Bad request - this could mean: (1) The relation field '${relationField}' doesn't exist on ${pluralApiId}, (2) One or more of the related IDs don't exist, or (3) The relation field type doesn't support this operation. Please verify the field exists and the IDs are valid.`;
      } else if (error.response.status === 404) {
        errorMessage += `Entry ${documentId} not found in ${pluralApiId}. Make sure the entry exists before trying to disconnect relations.`;
      } else {
        errorMessage += `${error.response.status} - ${JSON.stringify(error.response.data)}`;
      }
    } else if (error instanceof Error) {
      errorMessage += error.message;
    } else {
      errorMessage += String(error);
    }

    throw new McpError(ErrorCode.InternalError, errorMessage);
  }
}

export async function setRelation(
  pluralApiId: string,
  documentId: string,
  relationField: string,
  relatedIds: string[]
): Promise<any> {
  // Setting relations is the same as connecting in Strapi
  return connectRelation(pluralApiId, documentId, relationField, relatedIds);
}
