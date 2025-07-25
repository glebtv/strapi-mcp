import axios from "axios";
import { strapiClient, validateStrapiConnection, makeAdminApiRequest } from "./client.js";
import { config } from "../config/index.js";
import { ContentType } from "../types/index.js";
import { ExtendedMcpError, ExtendedErrorCode } from "../errors/index.js";

// Cache for discovered content types
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let contentTypesCache: ContentType[] = [];

export async function listContentTypes(): Promise<ContentType[]> {
  return fetchContentTypes();
}

export async function fetchContentTypes(): Promise<ContentType[]> {
  try {
    await validateStrapiConnection();

    console.error("[API] Fetching content types from Strapi");

    // Try content type discovery via known patterns
    console.error(`[API] Trying content type discovery via known patterns...`);

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
          const testResponse = await strapiClient.get(`/api/${plural}?pagination[limit]=1`);
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
        `/${collection.toLowerCase()}`,
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
      console.error(`[API] Failed to infer schema:`, inferError);

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

    console.error(`[Error] ${errorMessage}`);
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
    const { displayName, singularName, pluralName, kind = 'collectionType', draftAndPublish = false, attributes } = contentTypeData;
    
    if (!displayName || !singularName || !pluralName || !attributes) {
      throw new ExtendedMcpError(
        ExtendedErrorCode.InvalidParams,
        "displayName, singularName, pluralName, and attributes are required for content type creation"
      );
    }
    
    // Build the payload for the Content-Type Builder API
    const payload = {
      contentType: {
        displayName,
        singularName,
        pluralName,
        kind,
        draftAndPublish,
        attributes
      }
    };
    
    console.error(`[API] Creating new content type: ${displayName}`);
    console.error(`[API] Attempting to create content type with payload: ${JSON.stringify(payload, null, 2)}`);
    
    // Make sure we're using the correct Content-Type Builder endpoint
    const endpoint = '/content-type-builder/content-types';
    console.error(`[API] Using endpoint: ${endpoint}`);
    
    const response = await makeAdminApiRequest(endpoint, 'post', payload);
    console.error(`[API] Content type creation response:`, response);
    
    // Strapi might restart after schema changes, response might vary
    return response?.data || { message: "Content type creation initiated. Strapi might be restarting." };
  } catch (error: any) {
    console.error(`[Error] Failed to create content type:`, error);
    
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
    console.error(`[API] Updating content type: ${contentTypeUid}`);

    // Admin credentials are required for content type operations
    if (!config.strapi.adminEmail || !config.strapi.adminPassword) {
      throw new ExtendedMcpError(
        ExtendedErrorCode.AccessDenied,
        "Admin credentials are required for content type operations"
      );
    }

    if (!contentTypeUid || !attributesToUpdate || typeof attributesToUpdate !== 'object') {
      throw new ExtendedMcpError(
        ExtendedErrorCode.InvalidParams,
        "Missing required fields: contentTypeUid, attributesToUpdate (object)"
      );
    }

    // 1. Fetch the current schema
    console.error(`[API] Fetching current schema for ${contentTypeUid}`);
    const currentSchemaData = await fetchContentTypeSchema(contentTypeUid);

    // Ensure we have the schema structure
    const currentSchema = currentSchemaData.schema || currentSchemaData;
    if (!currentSchema || !currentSchema.attributes) {
      console.error("[API] Could not retrieve a valid current schema structure.", currentSchemaData);
      throw new ExtendedMcpError(
        ExtendedErrorCode.ResourceNotFound,
        `Could not retrieve a valid schema structure for ${contentTypeUid}`
      );
    }
    console.error(`[API] Current attributes: ${Object.keys(currentSchema.attributes).join(', ')}`);

    // 2. Merge new/updated attributes into the current schema's attributes
    const updatedAttributes = { ...currentSchema.attributes, ...attributesToUpdate };
    console.error(`[API] Attributes after update: ${Object.keys(updatedAttributes).join(', ')}`);

    // 3. Construct the payload for the PUT request
    const payload = {
      contentType: {
        ...currentSchema, // Spread the existing schema details
        attributes: updatedAttributes // Use the merged attributes
      }
    };

    // Remove potentially problematic fields
    delete payload.contentType.uid; // UID is usually in the URL, not body for PUT

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

export async function deleteContentType(contentTypeUid: string): Promise<any> {
  try {
    console.error(`[API] Deleting content type: ${contentTypeUid}`);
    
    // Admin credentials are required for content type operations
    if (!config.strapi.adminEmail || !config.strapi.adminPassword) {
      throw new ExtendedMcpError(
        ExtendedErrorCode.AccessDenied,
        "Admin credentials are required for content type operations"
      );
    }
    
    // Validate that this is a proper content type UID
    if (!contentTypeUid || !contentTypeUid.includes('.')) {
      throw new ExtendedMcpError(
        ExtendedErrorCode.InvalidParams,
        `Invalid content type UID: ${contentTypeUid}. UID should be in the format 'api::name.name'`
      );
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
