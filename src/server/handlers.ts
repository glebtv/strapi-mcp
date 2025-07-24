import { 
  ListResourcesRequestSchema, 
  ReadResourceRequestSchema, 
  ListToolsRequestSchema, 
  CallToolRequestSchema,
  McpError,
  ErrorCode,
  ReadResourceRequest,
  CallToolRequest
} from "@modelcontextprotocol/sdk/types.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { config } from "../config/index.js";
import { QueryParams } from "../types/index.js";
import * as contentTypes from "../api/content-types.js";
import * as entries from "../api/entries.js";
import * as media from "../api/media.js";
import * as components from "../api/components.js";
import { strapiClient } from "../api/client.js";
import axios from "axios";
import qs from "qs";

// Helper function for making REST requests
async function makeRestRequest(
  endpoint: string,
  method: string = 'GET',
  params?: Record<string, any>,
  body?: Record<string, any>
): Promise<any> {
  let url = `/${endpoint}`;
  
  // Parse query parameters if provided
  if (params) {
    const queryString = qs.stringify(params, {
      encodeValuesOnly: true
    });
    if (queryString) {
      url = `${url}?${queryString}`;
    }
  }

  const requestOptions: any = {
    method,
    url,
  };

  if (body && (method === 'POST' || method === 'PUT')) {
    requestOptions.data = body;
  }

  try {
    const response = await strapiClient.request(requestOptions);
    return response.data;
  } catch (error) {
    await handleStrapiError(error, `REST request to ${endpoint}`);
    throw error;
  }
}

// Error handler
async function handleStrapiError(error: any, context: string): Promise<void> {
  if (axios.isAxiosError(error) && error.response) {
    const errorMessage = `${context} failed with status ${error.response.status}: ${JSON.stringify(error.response.data)}`;
    throw new McpError(ErrorCode.InternalError, errorMessage);
  }
}

export function setupHandlers(server: Server) {
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    try {
      const contentTypesList = await contentTypes.fetchContentTypes();
      
      const contentTypeResources = contentTypesList.map(ct => ({
        uri: `strapi://content-type/${ct.uid}`,
        mimeType: "application/json",
        name: ct.info.displayName,
        description: `Strapi content type: ${ct.info.displayName}`
      }));
      
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

  server.setRequestHandler(ReadResourceRequestSchema, async (request: ReadResourceRequest) => {
    try {
      const uri = request.params.uri;
      
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
      
      let queryParams: QueryParams = {};
      if (queryString) {
        try {
          const parsedParams = new URLSearchParams(queryString);
          
          const filtersParam = parsedParams.get('filters');
          if (filtersParam) {
            queryParams.filters = JSON.parse(filtersParam);
          }
          
          const pageParam = parsedParams.get('page');
          const pageSizeParam = parsedParams.get('pageSize');
          if (pageParam || pageSizeParam) {
            queryParams.pagination = {};
            if (pageParam) queryParams.pagination.page = parseInt(pageParam, 10);
            if (pageSizeParam) queryParams.pagination.pageSize = parseInt(pageSizeParam, 10);
          }
          
          const sortParam = parsedParams.get('sort');
          if (sortParam) {
            queryParams.sort = sortParam.split(',');
          }
          
          const populateParam = parsedParams.get('populate');
          if (populateParam) {
            try {
              queryParams.populate = JSON.parse(populateParam);
            } catch {
              queryParams.populate = populateParam.split(',');
            }
          }
          
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
      
      if (entryId) {
        const entry = await entries.fetchEntry(contentTypeUid, entryId, queryParams);
        
        return {
          contents: [{
            uri: request.params.uri,
            mimeType: "application/json",
            text: JSON.stringify(entry, null, 2)
          }]
        };
      }
      
      const entriesList = await entries.fetchEntries(contentTypeUid, queryParams);
      
      return {
        contents: [{
          uri: request.params.uri,
          mimeType: "application/json",
          text: JSON.stringify(entriesList, null, 2)
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
          name: "strapi_rest",
          description: "Execute REST API requests against Strapi endpoints. Supports all CRUD operations with advanced query options.\n\n" +
            "1. Reading components:\n" +
            "params: { populate: ['SEO'] } // Populate a component\n" +
            "params: { populate: { SEO: { fields: ['Title', 'seoDescription'] } } } // With field selection\n\n" +
            "2. Updating components:\n" +
            "body: {\n" +
            "  data: {\n" +
            "    // For single components:\n" +
            "    componentName: {\n" +
            "      Title: 'value',\n" +
            "      seoDescription: 'value'\n" +
            "    },\n" +
            "    // For repeatable components:\n" +
            "    componentName: [\n" +
            "      { field: 'value' }\n" +
            "    ]\n" +
            "  }\n" +
            "}\n\n" +
            "3. Other parameters:\n" +
            "- fields: Select specific fields\n" +
            "- filters: Filter results\n" +
            "- sort: Sort results\n" +
            "- pagination: Page through results",
          inputSchema: {
            type: "object",
            properties: {
              endpoint: {
                type: "string",
                description: "The API endpoint (e.g., 'api/articles')"
              },
              method: {
                type: "string",
                description: "HTTP method to use",
                enum: ["GET", "POST", "PUT", "DELETE"],
                default: "GET"
              },
              params: {
                type: "object",
                description: "Optional query parameters for GET requests. For components, use populate: ['componentName'] or populate: { componentName: { fields: ['field1'] } }"
              },
              body: {
                type: "object",
                description: "Request body for POST/PUT requests. For components, use: { data: { componentName: { field: 'value' } } } for single components or { data: { componentName: [{ field: 'value' }] } } for repeatable components"
              }
            },
            required: ["endpoint"]
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
          name: "strapi_get_components",
          description: "Get all components from Strapi with pagination support. Returns both component data and pagination metadata (page, pageSize, total, pageCount).",
          inputSchema: {
            type: "object",
            properties: {
              page: {
                type: "number",
                description: "Page number (starts at 1)",
                default: 1
              },
              pageSize: {
                type: "number",
                description: "Number of items per page",
                default: 25
              }
            }
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
              componentData: {
                type: "object",
                description: "The data for the new component"
              }
            },
            required: ["componentData"]
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

  server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
    try {
      switch (request.params.name) {
        case "list_content_types": {
          const contentTypesList = await contentTypes.fetchContentTypes();
          
          return {
            content: [{
              type: "text",
              text: JSON.stringify(contentTypesList.map(ct => ({
                uid: ct.uid,
                displayName: ct.info.displayName,
                description: ct.info.description
              })), null, 2)
            }]
          };
        }
        
        case "strapi_rest": {
          const { endpoint, method = "GET", params, body } = request.params.arguments as any;
          
          if (!endpoint) {
            throw new McpError(
              ErrorCode.InvalidParams,
              "Endpoint is required"
            );
          }
          
          const result = await makeRestRequest(endpoint, method, params, body);
          
          return {
            content: [{
              type: "text",
              text: JSON.stringify(result, null, 2)
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
          
          const entriesList = await entries.fetchEntries(String(contentType), queryParams);
          
          return {
            content: [{
              type: "text",
              text: JSON.stringify(entriesList, null, 2)
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
          
          const entry = await entries.fetchEntry(String(contentType), String(id), queryParams);
          
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
          
          const entry = await entries.createEntry(contentType, data);
          
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
          
          const entry = await entries.updateEntry(contentType, id, data);

          if (entry) {
            return {
              content: [{
                type: "text",
                text: JSON.stringify(entry, null, 2)
              }]
            };
          } else {
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
          
          await entries.deleteEntry(contentType, id);
          
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
          
          const truncatedFileData = fileData.length > 100 ? `${fileData.substring(0, 100)}... [${fileData.length} chars total]` : fileData;
          console.error(`[API] Received base64 upload request: fileName=${fileName}, fileType=${fileType}, data=${truncatedFileData}`);
          
          const mediaResult = await media.uploadMedia(fileData, fileName, fileType);
          
          return {
            content: [{
              type: "text",
              text: JSON.stringify(mediaResult, null, 2)
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
          
          const mediaResult = await media.uploadMediaFromPath(filePath, fileName, fileType);
          
          return {
            content: [{
              type: "text",
              text: JSON.stringify(mediaResult, null, 2)
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
          const schema = await contentTypes.fetchContentTypeSchema(contentType);
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
          const result = await entries.connectRelation(String(contentType), String(id), String(relationField), relatedIds);
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }
        
        case "disconnect_relation": {
          const { contentType, id, relationField, relatedIds } = request.params.arguments as any;
          if (!contentType || !id || !relationField || !Array.isArray(relatedIds)) {
            throw new McpError(ErrorCode.InvalidParams, "contentType, id, relationField, and relatedIds (array) are required.");
          }
          const result = await entries.disconnectRelation(String(contentType), String(id), String(relationField), relatedIds);
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }

        case "create_content_type": {
          const contentTypeData = request.params.arguments;
          if (!contentTypeData || typeof contentTypeData !== 'object') {
            throw new McpError(ErrorCode.InvalidParams, "Content type data object is required.");
          }
          const creationResult = await contentTypes.createContentType(contentTypeData);
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
          const updateResult = await contentTypes.updateContentType(String(contentType), attributes);
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
          const deletionResult = await contentTypes.deleteContentType(contentTypeUid);
          return {
            content: [{
              type: "text",
              text: JSON.stringify(deletionResult, null, 2)
            }]
          };
        }

        case "strapi_get_components": {
          const page = Number(request.params.arguments?.page) || 1;
          const pageSize = Number(request.params.arguments?.pageSize) || 25;
          
          const componentsList = await components.listComponents();
          
          // Add pagination
          const total = componentsList.length;
          const pageCount = Math.ceil(total / pageSize);
          const startIndex = (page - 1) * pageSize;
          const endIndex = startIndex + pageSize;
          const paginatedData = componentsList.slice(startIndex, endIndex);
          
          const response = {
            data: paginatedData,
            pagination: {
              page,
              pageSize,
              total,
              pageCount
            }
          };
          
          return {
            content: [{
              type: "text",
              text: JSON.stringify(response, null, 2)
            }]
          };
        }

        case "list_components": {
          const componentsList = await components.listComponents();
          return {
            content: [{
              type: "text",
              text: JSON.stringify(componentsList, null, 2)
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
          const schema = await components.getComponentSchema(componentUid);
          return {
            content: [{
              type: "text",
              text: JSON.stringify(schema, null, 2)
            }]
          };
        }

        case "create_component": {
          const componentData = request.params.arguments;
          if (!componentData || typeof componentData !== 'object') {
            throw new McpError(ErrorCode.InvalidParams, "Component data object is required.");
          }
          const creationResult = await components.createComponent(componentData);
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
          const updateResult = await components.updateComponent(String(componentUid), attributesToUpdate);
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
          
          const result = await entries.publishEntry(contentType, id);
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
          
          const result = await entries.unpublishEntry(contentType, id);
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
      
      if (error instanceof McpError) {
        throw error;
      }
      
      return {
        content: [{
          type: "text",
          text: `Error: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  });
}