import axios from "axios";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { strapiClient, validateStrapiConnection } from "./client.js";
import { makeAdminApiRequest, hasAdminCredentials } from "../auth/index.js";
import { config } from "../config/index.js";
import { QueryParams } from "../types/index.js";
import { ExtendedMcpError, ExtendedErrorCode } from "../errors/index.js";

export async function fetchEntries(contentType: string, queryParams?: QueryParams): Promise<any> {
  await validateStrapiConnection();
  
  let response;
  let success = false;
  let fetchedData: any[] = [];
  let fetchedMeta: any = {};
  let lastError: any = null;
  const collection = contentType.split(".")[1];

  if (hasAdminCredentials()) {
    console.error(`[API] Attempt 1: Fetching entries for ${contentType} using makeAdminApiRequest (Admin Credentials)`);
    try {
      const adminEndpoint = `/content-manager/collection-types/${contentType}`;
      const adminParams: Record<string, any> = {};
      
      if (queryParams?.filters) adminParams.filters = queryParams.filters;
      if (queryParams?.pagination) adminParams.pagination = queryParams.pagination;
      if (queryParams?.sort) adminParams.sort = queryParams.sort;
      if (queryParams?.populate) adminParams.populate = queryParams.populate;
      if (queryParams?.fields) adminParams.fields = queryParams.fields;

      const adminResponse = await makeAdminApiRequest(adminEndpoint, 'get', undefined, adminParams);

      if (adminResponse && adminResponse.results && Array.isArray(adminResponse.results)) {
        console.error(`[API] Successfully fetched data via admin credentials for ${contentType}`);
        fetchedData = adminResponse.results;
        fetchedMeta = adminResponse.pagination || {};

        fetchedData = fetchedData.filter((item: any) => !item?.error);

        console.error(`[API] Returning data fetched via admin credentials for ${contentType}`);
        return { data: fetchedData, meta: fetchedMeta };
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

  console.error(`[API] Attempt 2: Fetching entries for ${contentType} using strapiClient (API Token)`);
  try {
    const params: Record<string, any> = {};
    if (queryParams?.filters) params.filters = queryParams.filters;
    if (queryParams?.pagination) params.pagination = queryParams.pagination;
    if (queryParams?.sort) params.sort = queryParams.sort;
    if (queryParams?.populate) params.populate = queryParams.populate;
    if (queryParams?.fields) params.fields = queryParams.fields;

    const possiblePaths = [
      `/api/${collection}`,
      `/api/${collection.toLowerCase()}`,
    ];

    for (const path of possiblePaths) {
      try {
        console.error(`[API] Trying path with strapiClient: ${path}`);
        response = await strapiClient.get(path, { params });

        if (response.data && response.data.error) {
          console.error(`[API] Path ${path} returned an error:`, response.data.error);
          continue;
        }

        console.error(`[API] Successfully fetched data from: ${path} using strapiClient`);
        success = true;

        if (response.data.data) {
          fetchedData = Array.isArray(response.data.data) ? response.data.data : [response.data.data];
          fetchedMeta = response.data.meta || {};
        } else if (Array.isArray(response.data)) {
          fetchedData = response.data;
          fetchedMeta = { pagination: { page: 1, pageSize: fetchedData.length, pageCount: 1, total: fetchedData.length } };
        } else {
          console.warn(`[API] Unexpected response format from ${path} using strapiClient:`, response.data);
          fetchedData = response.data ? [response.data] : [];
          fetchedMeta = {};
        }

        fetchedData = fetchedData.filter((item: any) => !item?.error);

        break;
      } catch (err: any) {
        lastError = err;
        if (axios.isAxiosError(err) && (err.response?.status === 404 || err.response?.status === 403 || err.response?.status === 401)) {
          console.error(`[API] Path ${path} failed with ${err.response?.status}, trying next path...`);
          continue;
        }
        console.error(`[API] Unexpected error on path ${path} with strapiClient:`, err);
        throw err;
      }
    }

    if (success && fetchedData.length > 0) {
      console.error(`[API] Returning data fetched via strapiClient for ${contentType}`);
      return { data: fetchedData, meta: fetchedMeta };
    } else if (success && fetchedData.length === 0) {
      console.error(`[API] Content type ${contentType} exists but has no entries (empty collection)`);
      return { data: [], meta: fetchedMeta };
    } else {
      console.error(`[API] strapiClient failed to fetch entries for ${contentType}.`);
    }

  } catch (error) {
    console.error(`[API] Error during strapiClient fetch for ${contentType}:`, error);
  }

  console.error(`[API] All attempts failed to fetch entries for ${contentType}`);
  
  // If we got a specific error (403, 401, etc), throw it
  if (lastError && axios.isAxiosError(lastError) && lastError.response) {
    const status = lastError.response.status;
    if (status === 403 || status === 401) {
      throw new ExtendedMcpError(
        ExtendedErrorCode.AccessDenied,
        `Access denied to ${contentType}: ${status} ${lastError.response.statusText}`
      );
    }
  }
  
  // Otherwise, assume the content type exists but is empty or not accessible
  console.error(`[API] Could not fetch ${contentType} - returning empty result`);
  return { data: [], meta: { pagination: { page: 1, pageSize: 25, pageCount: 0, total: 0 } } };
}

export async function fetchEntry(contentType: string, id: string, queryParams?: QueryParams): Promise<any> {
  try {
    console.error(`[API] Fetching entry ${id} for content type: ${contentType}`);
    
    const collection = contentType.split(".")[1];
    
    if (hasAdminCredentials()) {
      console.error(`[API] Attempt 1: Fetching entry ${id} for ${contentType} using admin credentials`);
      try {
        const adminEndpoint = `/content-manager/collection-types/${contentType}/${id}`;
        
        const adminParams: Record<string, any> = {};
        if (queryParams?.populate) adminParams.populate = queryParams.populate;
        if (queryParams?.fields) adminParams.fields = queryParams.fields;
        
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
    
    const params: Record<string, any> = {};
    if (queryParams?.populate) {
      params.populate = queryParams.populate;
    }
    if (queryParams?.fields) {
      params.fields = queryParams.fields;
    }

    console.error(`[API] Attempt 2: Fetching entry ${id} for ${contentType} using API token`);
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

export async function createEntry(contentType: string, data: any): Promise<any> {
  try {
    console.error(`[API] Creating new entry for content type: ${contentType}`);
    
    const collection = contentType.split(".")[1];
    
    if (hasAdminCredentials()) {
      console.error(`[API] Attempt 1: Creating entry for ${contentType} using makeAdminApiRequest`);
      try {
        const adminEndpoint = `/content-manager/collection-types/${contentType}`;
        console.error(`[API] Trying admin create endpoint: ${adminEndpoint}`);
        
        const adminResponse = await makeAdminApiRequest(adminEndpoint, 'post', data);

        if (adminResponse) {
          console.error(`[API] Successfully created entry via makeAdminApiRequest.`);
          return adminResponse.data || adminResponse;
        } else {
          console.warn(`[API] Admin create completed but returned no data.`);
          return { message: "Create via admin succeeded, no data returned." };
        }
      } catch (adminError) {
        console.error(`[API] Failed to create entry using admin credentials:`, adminError);
        console.error(`[API] Admin credentials failed, attempting to use API token as fallback.`);
      }
    } else {
      console.error("[API] Admin credentials not provided, falling back to API token.");
    }
    
    console.error(`[API] Attempt 2: Creating entry for ${contentType} using strapiClient`);
    try {
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

export async function updateEntry(contentType: string, id: string, data: any): Promise<any> {
  const collection = contentType.split(".")[1];
  const apiPath = `/api/${collection}/${id}`;
  let responseData: any = null;

  if (hasAdminCredentials()) {
    console.error(`[API] Attempt 1: Updating entry ${id} for ${contentType} using makeAdminApiRequest`);
    try {
      const adminEndpoint = `/content-manager/collection-types/${contentType}/${id}`;
      console.error(`[API] Trying admin update endpoint: ${adminEndpoint}`);
      
      const adminResponse = await makeAdminApiRequest(adminEndpoint, 'put', data);

      if (adminResponse) {
        console.error(`[API] Successfully updated entry ${id} via makeAdminApiRequest.`);
        return adminResponse.data || adminResponse; 
      } else {
        console.warn(`[API] Admin update for ${id} completed but returned no data.`);
        return { id: id, message: "Update via admin succeeded, no data returned." }; 
      }
    } catch (adminError) {
      console.error(`[API] Failed to update entry ${id} using admin credentials:`, adminError);
      console.error(`[API] Admin credentials failed, attempting to use API token as fallback.`);
    }
  } else {
    console.error("[API] Admin credentials not provided, falling back to API token.");
  }

  console.error(`[API] Attempt 2: Updating entry ${id} for ${contentType} using strapiClient`);
  try {
    const response = await strapiClient.put(apiPath, { data: data });
    
    if (response.data && response.data.data) {
      console.error(`[API] Successfully updated entry ${id} via strapiClient.`);
      return response.data.data;
    } else {
      console.warn(`[API] Update via strapiClient for ${id} completed, but no updated data returned.`);
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

export async function deleteEntry(contentType: string, id: string): Promise<void> {
  try {
    console.error(`[API] Deleting entry ${id} for content type: ${contentType}`);
    
    const collection = contentType.split(".")[1];
    
    await strapiClient.delete(`/api/${collection}/${id}`);
  } catch (error) {
    console.error(`[Error] Failed to delete entry ${id} for ${contentType}:`, error);
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to delete entry ${id} for ${contentType}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function connectRelation(contentType: string, id: string, relationField: string, relatedIds: number[] | string[]): Promise<any> {
  try {
    console.error(`[API] Connecting relations for ${contentType} ${id}, field ${relationField}`);
    const updateData = {
      data: {
        [relationField]: {
          connect: relatedIds.map(rid => ({ id: Number(rid) }))
        }
      }
    };
    return await updateEntry(contentType, id, updateData.data); 
  } catch (error) {
    if (error instanceof McpError) throw error;
    console.error(`[Error] Failed to connect relation ${relationField} for ${contentType} ${id}:`, error);
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to connect relation: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function disconnectRelation(contentType: string, id: string, relationField: string, relatedIds: number[] | string[]): Promise<any> {
  try {
    console.error(`[API] Disconnecting relations for ${contentType} ${id}, field ${relationField}`);
    const updateData = {
      data: {
        [relationField]: {
          disconnect: relatedIds.map(rid => ({ id: Number(rid) }))
        }
      }
    };
    return await updateEntry(contentType, id, updateData.data); 

  } catch (error) {
    if (error instanceof McpError) throw error;
    console.error(`[Error] Failed to disconnect relation ${relationField} for ${contentType} ${id}:`, error);
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to disconnect relation: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function publishEntry(contentType: string, id: string): Promise<any> {
  try {
    console.error(`[API] Publishing entry ${id} for content type: ${contentType}`);
    
    if (hasAdminCredentials()) {
      console.error(`[API] Attempt 1: Publishing entry ${id} for ${contentType} using admin credentials`);
      try {
        const adminEndpoint = `/content-manager/collection-types/${contentType}/${id}/actions/publish`;
        
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
    
    const collection = contentType.split(".")[1];
    console.error(`[API] Attempt 2: Publishing entry ${id} for ${contentType} using API token`);
    
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

export async function unpublishEntry(contentType: string, id: string): Promise<any> {
  try {
    console.error(`[API] Unpublishing entry ${id} for content type: ${contentType}`);
    
    if (hasAdminCredentials()) {
      console.error(`[API] Attempt 1: Unpublishing entry ${id} for ${contentType} using admin credentials`);
      try {
        const adminEndpoint = `/content-manager/collection-types/${contentType}/${id}/actions/unpublish`;
        
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
    
    const collection = contentType.split(".")[1];
    console.error(`[API] Attempt 2: Unpublishing entry ${id} for ${contentType} using API token`);
    
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