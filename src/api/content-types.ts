import axios from "axios";
import { strapiClient, validateStrapiConnection } from "./client.js";
import { config } from "../config/index.js";
import { ContentType } from "../types/index.js";
import { ExtendedMcpError, ExtendedErrorCode } from "../errors/index.js";

let contentTypesCache: ContentType[] = [];

function processAndCacheContentTypes(data: any[], source: string): ContentType[] {
  console.error(`[API] Successfully fetched collection types from ${source}`);
  const contentTypes = data.map((item: any) => {
    const uid = item.uid;
    const apiID = uid.split('.').pop() || '';
    // Get pluralName from the API response
    const pluralApiId = item.info?.pluralName || item.pluralName || apiID;
    return {
      uid: uid,
      apiID: apiID,
      pluralApiId: pluralApiId,
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

    // Try content type discovery via known patterns
    console.error(`[API] Trying content type discovery via known patterns...`);
    
    const commonTypes = ['article', 'page', 'post', 'user', 'category', 'project', 'technology'];
    const discoveredTypes = [];
    
    for (const type of commonTypes) {
      // Try common plural forms
      const pluralVariants = [
        `${type}s`,      // articles, pages
        `${type}es`,     // technologies
        `${type}ies`,    // categories (category -> categories)
        type             // user -> user (same)
      ];
      
      for (const plural of pluralVariants) {
        try {
          const testResponse = await strapiClient.get(`/api/${plural}?pagination[limit]=1`);
          if (testResponse && testResponse.status === 200) {
            console.error(`[API] Discovered content type: api::${type}.${type} with plural: ${plural}`);
            discoveredTypes.push({
              uid: `api::${type}.${type}`,
              apiID: type,
              pluralApiId: plural, // Use the actual endpoint that worked
              info: {
                displayName: type.charAt(0).toUpperCase() + type.slice(1),
                description: `${type} content type (discovered)`,
              },
              attributes: {}
            });
            break; // Found it, move to next type
          }
        } catch (e) {
          // Continue trying other variants
        }
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
    errorMessage += "3. Database connectivity issues\n";
    errorMessage += "4. Strapi instance configuration problems\n\n";
    errorMessage += "Please check:\n";
    errorMessage += `- Strapi is running at ${config.strapi.url}\n`;
    errorMessage += "- Your API token has proper permissions\n";
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

// Note: The following functions require admin permissions and are not available with API tokens only
export async function createContentType(contentTypeData: any): Promise<any> {
  throw new ExtendedMcpError(
    ExtendedErrorCode.AccessDenied,
    "Creating content types requires admin credentials. This operation is not available with API tokens only."
  );
}

export async function updateContentType(contentTypeUid: string, attributesToUpdate: Record<string, any>): Promise<any> {
  throw new ExtendedMcpError(
    ExtendedErrorCode.AccessDenied,
    "Updating content types requires admin credentials. This operation is not available with API tokens only."
  );
}

export async function deleteContentType(contentTypeUid: string): Promise<any> {
  throw new ExtendedMcpError(
    ExtendedErrorCode.AccessDenied,
    "Deleting content types requires admin credentials. This operation is not available with API tokens only."
  );
}