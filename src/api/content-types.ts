import axios from "axios";
import { strapiClient, validateStrapiConnection } from "./client.js";
import { makeAdminApiRequest, hasAdminCredentials } from "../auth/index.js";
import { config } from "../config/index.js";
import { ContentType } from "../types/index.js";
import { ExtendedMcpError, ExtendedErrorCode } from "../errors/index.js";

let contentTypesCache: ContentType[] = [];

function processAndCacheContentTypes(data: any[], source: string): ContentType[] {
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

  const filteredTypes = contentTypes.filter((ct: any) =>
    !ct.uid.startsWith("admin::") &&
    !ct.uid.startsWith("plugin::")
  );

  console.error(`[API] Found ${filteredTypes.length} content types via ${source}`);
  contentTypesCache = filteredTypes;
  return filteredTypes;
}

export async function fetchContentTypes(): Promise<ContentType[]> {
  try {
    await validateStrapiConnection();
    
    console.error("[API] Fetching content types from Strapi");

    console.error(`[DEBUG] Checking admin creds: EMAIL=${Boolean(config.strapi.admin.email)}, PASSWORD=${Boolean(config.strapi.admin.password)}`);
    if (hasAdminCredentials()) {
      console.error("[API] Attempting to fetch content types using admin credentials");
      try {
        console.error("[API] Trying admin endpoint: /content-type-builder/content-types");
        const adminResponse = await makeAdminApiRequest('/content-type-builder/content-types');

        console.error("[API] Admin response structure:", Object.keys(adminResponse || {}));
        
        let adminData = null;
        if (adminResponse && adminResponse.data && Array.isArray(adminResponse.data)) {
          adminData = adminResponse.data;
        } else if (adminResponse && Array.isArray(adminResponse)) {
          adminData = adminResponse;
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
      }
    } else {
      console.error("[API] Admin credentials not provided, skipping admin API attempt.");
    }

    if (hasAdminCredentials()) {
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

    console.error("[API] Attempting to fetch content types using API token (strapiClient)");
    try {
      const response = await strapiClient.get('/content-manager/collection-types');

      if (response.data && Array.isArray(response.data)) {
        return processAndCacheContentTypes(response.data, "Content Manager API (/content-manager/collection-types)");
      }
    } catch (apiError) {
      console.error(`[API] Failed to fetch from content manager API:`, apiError);
      if (axios.isAxiosError(apiError)) {
        console.error(`[API] API Error Status: ${apiError.response?.status}`);
        console.error(`[API] API Error Data:`, apiError.response?.data);
      }
    }
    
    console.error(`[API] Trying content type discovery via known patterns...`);
    
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
    
    let errorMessage = "Unable to fetch content types from Strapi. This could be due to:\n";
    errorMessage += "1. Strapi server not running or unreachable\n";
    errorMessage += "2. Invalid API token or insufficient permissions\n";
    errorMessage += "3. Admin credentials not working\n";
    errorMessage += "4. Database connectivity issues\n";
    errorMessage += "5. Strapi instance configuration problems\n\n";
    errorMessage += "Please check:\n";
    errorMessage += `- Strapi is running at ${config.strapi.url}\n`;
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
    console.error(`[API] Fetching schema for content type: ${contentType}`);

    if (hasAdminCredentials()) {
      console.error("[API] Attempting to fetch schema using admin credentials");
      try {
        const endpoint = `/content-type-builder/content-types/${contentType}`;
        console.error(`[API] Trying admin endpoint: ${endpoint}`);
        const adminResponse = await makeAdminApiRequest(endpoint);

        if (adminResponse && adminResponse.data) {
          console.error("[API] Successfully fetched schema via Admin API");
          return adminResponse.data;
        } else {
          console.error("[API] Admin API response for schema did not contain expected data.", adminResponse);
        }
      } catch (adminError) {
        console.error(`[API] Failed to fetch schema using admin credentials:`, adminError);
        if (!(axios.isAxiosError(adminError) && (adminError.response?.status === 401 || adminError.response?.status === 403 || adminError.response?.status === 404))) {
          throw adminError;
        }
      }
    } else {
      console.error("[API] Admin credentials not provided, skipping admin API attempt for schema.");
    }

    console.error("[API] Attempting to infer schema from public API");

    const collection = contentType.split(".")[1];
    
    try {
      const possiblePaths = [
        `/api/${collection}`,
        `/api/${collection.toLowerCase()}`,
        `/api/v1/${collection}`,
        `/${collection}`,
        `/${collection.toLowerCase()}`
      ];
      
      let response;
      let success = false;
      
      for (const path of possiblePaths) {
        try {
          console.error(`[API] Trying path for schema inference: ${path}`);
          response = await strapiClient.get(`${path}?pagination[limit]=1&pagination[page]=1`);
          console.error(`[API] Successfully fetched sample data from: ${path}`);
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
      if (response.data.data && Array.isArray(response.data.data) && response.data.data.length > 0) {
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
        if (key === 'id') return;
        
        let type: string = typeof value;
        
        if (type === 'object') {
          if (value === null) {
            type = 'string';
          } else if (Array.isArray(value)) {
            type = 'relation';
          } else if (value instanceof Date) {
            type = 'datetime';
          } else {
            type = 'json';
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
        attributes
      };
      
    } catch (inferError) {
      console.error(`[API] Failed to infer schema:`, inferError);
      
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

    console.error(`[Error] ${errorMessage}`);
    throw new ExtendedMcpError(errorCode, errorMessage);
  }
}

export async function createContentType(contentTypeData: any): Promise<any> {
  try {
    const { displayName, singularName, pluralName, kind = 'collectionType', attributes, draftAndPublish = true, description = "" } = contentTypeData;

    if (!displayName || !singularName || !pluralName || !attributes) {
      throw new Error("Missing required fields: displayName, singularName, pluralName, attributes");
    }

    const singularApiId = singularName.toLowerCase().replace(/\s+/g, '-');
    const pluralApiId = pluralName.toLowerCase().replace(/\s+/g, '-');
    const collectionName = pluralName.toLowerCase().replace(/\s+/g, '_');
    
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
    
    const endpoint = '/content-type-builder/content-types';
    console.error(`[API] Using endpoint: ${endpoint}`);
    
    try {
      const response = await makeAdminApiRequest(endpoint, 'post', payload);
      console.error(`[API] Raw response from makeAdminApiRequest (createContentType):`, response);
    
      console.error(`[API] Content type creation response:`, response);
    
      return response?.data || { message: "Content type creation initiated. Strapi might be restarting." };
    } catch (apiError) {
      console.error(`[API] CRITICAL ERROR in makeAdminApiRequest call:`, apiError);
      
      if (axios.isAxiosError(apiError) && apiError.response) {
        console.error(`[API] Status Code: ${apiError.response.status}`);
        console.error(`[API] Status Text: ${apiError.response.statusText}`);
        console.error(`[API] Response Headers:`, apiError.response.headers);
        console.error(`[API] DETAILED ERROR PAYLOAD:`, JSON.stringify(apiError.response.data, null, 2));
        
        if (apiError.response.status === 400) {
          const errorData = apiError.response.data;
          console.error(`[API] 400 BAD REQUEST - Payload validation error`);
          
          if (errorData.error && errorData.message) {
            console.error(`[API] Error Type: ${errorData.error}`);
            console.error(`[API] Error Message: ${errorData.message}`);
          }
          
          if (errorData.data && errorData.data.errors) {
            console.error(`[API] Validation Errors:`, JSON.stringify(errorData.data.errors, null, 2));
          }
        }
      }
      throw apiError;
    }
  } catch (error: any) {
    console.error(`[Error RAW] createContentType caught error:`, error);
    if (axios.isAxiosError(error) && error.response) {
      console.error(`[Error DETAIL] Strapi error response data (createContentType): ${JSON.stringify(error.response.data)}`);
      console.error(`[Error DETAIL] Strapi error response status (createContentType): ${error.response.status}`);
      console.error(`[Error DETAIL] Strapi error response headers (createContentType): ${JSON.stringify(error.response.headers)}`);
    }
    console.error(`[Error] Failed to create content type:`, error);

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

export async function updateContentType(contentTypeUid: string, attributesToUpdate: Record<string, any>): Promise<any> {
  try {
    console.error(`[API] Updating content type: ${contentTypeUid}`);

    if (!contentTypeUid || !attributesToUpdate || typeof attributesToUpdate !== 'object') {
      throw new Error("Missing required fields: contentTypeUid, attributesToUpdate (object)");
    }

    console.error(`[API] Fetching current schema for ${contentTypeUid}`);
    const currentSchemaData = await fetchContentTypeSchema(contentTypeUid);

    let currentSchema = currentSchemaData.schema || currentSchemaData;
    if (!currentSchema || !currentSchema.attributes) {
      console.error("[API] Could not retrieve a valid current schema structure.", currentSchemaData);
      throw new Error(`Could not retrieve a valid schema structure for ${contentTypeUid}`);
    }
    console.error(`[API] Current attributes: ${Object.keys(currentSchema.attributes).join(', ')}`);

    const updatedAttributes = { ...currentSchema.attributes, ...attributesToUpdate };
    console.error(`[API] Attributes after update: ${Object.keys(updatedAttributes).join(', ')}`);

    const payload = {
      contentType: {
        ...currentSchema,
        attributes: updatedAttributes
      }
    };

    delete payload.contentType.uid;

    console.error(`[API] Update Payload for PUT /content-type-builder/content-types/${contentTypeUid}: ${JSON.stringify(payload, null, 2)}`);

    const endpoint = `/content-type-builder/content-types/${contentTypeUid}`;
    const response = await makeAdminApiRequest(endpoint, 'put', payload);

    console.error(`[API] Content type update response:`, response);

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

export async function deleteContentType(contentTypeUid: string): Promise<any> {
  try {
    console.error(`[API] Deleting content type: ${contentTypeUid}`);
    
    if (!contentTypeUid || !contentTypeUid.includes('.')) {
      throw new Error(`Invalid content type UID: ${contentTypeUid}. UID should be in the format 'api::name.name'`);
    }
    
    const endpoint = `/content-type-builder/content-types/${contentTypeUid}`;
    console.error(`[API] Sending DELETE request to: ${endpoint}`);
    
    const response = await makeAdminApiRequest(endpoint, 'delete');
    console.error(`[API] Content type deletion response:`, response);
    
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