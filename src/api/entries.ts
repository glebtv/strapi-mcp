import axios from "axios";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { strapiClient, validateStrapiConnection } from "./client.js";
import { QueryParams } from "../types/index.js";
import { ExtendedMcpError, ExtendedErrorCode } from "../errors/index.js";
import { ensureSlugField } from "../utils/slug.js";

export async function fetchEntries(pluralApiId: string, queryParams?: QueryParams): Promise<any> {
  await validateStrapiConnection();

  console.error(`[API] Fetching entries for ${pluralApiId} using API Token`);
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

    const apiPath = `/api/${pluralApiId}`;

    console.error(`[API] Trying path: ${apiPath}`);
    const response = await strapiClient.get(apiPath, { params });

    if (response.data && response.data.error) {
      console.error(`[API] Path ${apiPath} returned an error:`, response.data.error);
      throw new Error(response.data.error.message);
    }

    console.error(`[API] Successfully fetched data from: ${apiPath} using API token`);

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
      console.warn(`[API] Unexpected response format from ${apiPath}:`, response.data);
      fetchedData = response.data ? [response.data] : [];
      fetchedMeta = {};
    }

    fetchedData = fetchedData.filter((item: any) => !item?.error);

    console.error(`[API] Returning data fetched for ${pluralApiId}`);
    return { data: fetchedData, meta: fetchedMeta };
  } catch (error: any) {
    console.error(`[API] Error during fetch for ${pluralApiId}:`, error);

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
    console.error(`[API] Fetching entry ${documentId} for ${pluralApiId}`);

    const params: Record<string, any> = {};
    if (queryParams?.populate) {
      params.populate = queryParams.populate;
    }
    if (queryParams?.fields) {
      params.fields = queryParams.fields;
    }

    console.error(`[API] Fetching entry ${documentId} for ${pluralApiId} using API token`);
    const response = await strapiClient.get(`/api/${pluralApiId}/${documentId}`, { params });

    return response.data.data;
  } catch (error: any) {
    console.error(`[Error] Failed to fetch entry ${documentId} for ${pluralApiId}:`, error);

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
  data: any
): Promise<any> {
  try {
    console.error(`[API] Creating new entry for ${pluralApiId}`);

    // Ensure slug field is present if required
    data = ensureSlugField(contentType, data);

    console.error(`[API] Creating entry for ${pluralApiId} using API token`);
    const response = await strapiClient.post(`/api/${pluralApiId}`, {
      data: data,
    });

    if (response.data && response.data.data) {
      console.error(`[API] Successfully created entry via API token.`);
      return response.data.data;
    } else if (response.data && response.data.error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to create entry for ${pluralApiId}: ${response.status} - ${JSON.stringify(response.data)}`
      );
    }
  } catch (error) {
    console.error(`[Error] Failed to create entry for ${pluralApiId}:`, error);
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
  data: any
): Promise<any> {
  const apiPath = `/api/${pluralApiId}/${documentId}`;

  console.error(`[API] Updating entry ${documentId} for ${pluralApiId} using API token`);
  try {
    const response = await strapiClient.put(apiPath, { data });

    if (response.data && response.data.data) {
      console.error(`[API] Successfully updated entry via API token.`);
      return response.data.data;
    } else if (response.data && response.data.error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to update entry ${documentId} for ${pluralApiId}: ${response.status} - ${JSON.stringify(response.data)}`
      );
    }
  } catch (error: any) {
    console.error(`[API] Failed to update entry using API token:`, error);
    if (axios.isAxiosError(error) && error.response) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to update entry ${documentId} for ${pluralApiId}: ${error.response.status} - ${JSON.stringify(error.response.data)}`
      );
    }
    throw error;
  }
}

export async function deleteEntry(pluralApiId: string, documentId: string): Promise<any> {
  const apiPath = `/api/${pluralApiId}/${documentId}`;

  console.error(`[API] Deleting entry ${documentId} for ${pluralApiId} using API token`);
  try {
    const response = await strapiClient.delete(apiPath);

    if (response.status === 200 || response.status === 204) {
      console.error(`[API] Successfully deleted entry via API token.`);
      return { success: true };
    } else if (response.data && response.data.error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to delete entry ${documentId} for ${pluralApiId}: ${response.status} - ${JSON.stringify(response.data)}`
      );
    }
  } catch (error: any) {
    console.error(`[API] Failed to delete entry using API token:`, error);
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
  // In Strapi 5, publish is done by setting publishedAt field
  const apiPath = `/api/${pluralApiId}/${documentId}`;
  const publishedAt = new Date().toISOString();

  console.error(`[API] Publishing entry ${documentId} for ${pluralApiId} using API token`);
  try {
    const response = await strapiClient.put(apiPath, {
      data: {
        publishedAt,
      },
    });

    if (response.data && response.data.data) {
      console.error(`[API] Successfully published entry via API token.`);
      return response.data.data;
    } else if (response.data && response.data.error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to publish entry ${documentId} for ${pluralApiId}: ${response.status} - ${JSON.stringify(response.data)}`
      );
    }
  } catch (error: any) {
    console.error(`[API] Failed to publish entry using API token:`, error);
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
  // In Strapi 5, unpublish is done by setting publishedAt to null
  const apiPath = `/api/${pluralApiId}/${documentId}`;

  console.error(`[API] Unpublishing entry ${documentId} for ${pluralApiId} using API token`);
  try {
    const response = await strapiClient.put(apiPath, {
      data: {
        publishedAt: null,
      },
    });

    if (response.data && response.data.data) {
      console.error(`[API] Successfully unpublished entry via API token.`);
      return response.data.data;
    } else if (response.data && response.data.error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to unpublish entry ${documentId} for ${pluralApiId}: ${response.status} - ${JSON.stringify(response.data)}`
      );
    }
  } catch (error: any) {
    console.error(`[API] Failed to unpublish entry using API token:`, error);
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

  console.error(`[API] Connecting relations for ${documentId} in ${pluralApiId}`);
  try {
    const response = await strapiClient.put(apiPath, {
      data: {
        [relationField]: relatedIds,
      },
    });

    if (response.data && response.data.data) {
      console.error(`[API] Successfully connected relations via API token.`);
      return response.data.data;
    }
  } catch (error: any) {
    console.error(`[API] Failed to connect relations:`, error);
    if (axios.isAxiosError(error) && error.response) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to connect relations: ${error.response.status} - ${JSON.stringify(error.response.data)}`
      );
    }
    throw error;
  }
}

export async function disconnectRelation(
  pluralApiId: string,
  documentId: string,
  relationField: string,
  relatedIds: string[]
): Promise<any> {
  // In Strapi, disconnecting is done by updating the relation field
  // We need to fetch current relations and remove the specified ones
  const entry = await fetchEntry(pluralApiId, documentId, { populate: [relationField] });
  const currentRelations = entry[relationField] || [];
  const currentIds = currentRelations.map((rel: any) => rel.documentId || rel.id);
  const newIds = currentIds.filter((id: string) => !relatedIds.includes(id));

  return connectRelation(pluralApiId, documentId, relationField, newIds);
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
