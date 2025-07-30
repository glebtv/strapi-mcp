import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  McpError,
  ErrorCode,
} from "@modelcontextprotocol/sdk/types.js";
import type { CallToolRequest, ReadResourceRequest } from "@modelcontextprotocol/sdk/types.js";
import * as contentTypes from "../api/content-types.js";
import * as entries from "../api/entries.js";
import * as media from "../api/media.js";
import * as components from "../api/components.js";
import * as permissions from "../api/permissions.js";
import * as users from "../api/users.js";
import { QueryParams } from "../types/index.js";
import { ExtendedMcpError, ExtendedErrorCode } from "../errors/index.js";
import { strapiClient, makeAdminApiRequest, getAdminJwtToken } from "../api/client.js";
import { logger } from "../utils/index.js";
import axios from "axios";
import qs from "qs";

// Check if we're in a test environment
const isTest = process.env.NODE_ENV === "test";

async function makeRestRequest(
  endpoint: string,
  method: string = "GET",
  params?: any,
  body?: any
): Promise<any> {
  try {
    // Check if we have admin credentials and if this is a content API endpoint
    if (endpoint.startsWith("/api/") && getAdminJwtToken()) {
      // Extract content type info from the endpoint
      const apiMatch = endpoint.match(/^\/api\/([^/]+)(?:\/(.+))?$/);
      if (apiMatch) {
        const pluralName = apiMatch[1];
        const documentId = apiMatch[2];

        // Convert plural name to content type format (e.g., "docs" -> "api::doc.doc")
        const singularName = pluralName.replace(/s$/, "");
        const contentType = `api::${singularName}.${singularName}`;

        // Convert to Content Manager API endpoint
        let contentManagerEndpoint = `/content-manager/collection-types/${contentType}`;
        if (documentId) {
          contentManagerEndpoint += `/${documentId}`;
        }

        logger.debug(
          `[REST] Converting REST API to Content Manager API: ${endpoint} -> ${contentManagerEndpoint}`
        );

        // For Content Manager API, body structure is different
        let adminBody = body;
        if (body && body.data && (method === "POST" || method === "PUT")) {
          // Content Manager API expects data directly, not wrapped
          adminBody = body.data;
        }

        try {
          const adminResponse = await makeAdminApiRequest(
            contentManagerEndpoint,
            method.toLowerCase(),
            adminBody,
            params
          );

          // Wrap response in REST API format for consistency
          return {
            data: adminResponse.data || adminResponse,
            meta: adminResponse.meta || {},
          };
        } catch (adminError: any) {
          logger.debug(
            `[REST] Content Manager API failed, falling back to REST API:`,
            adminError.message
          );
          // Fall through to regular REST API
        }
      }
    }

    const config: any = {
      method,
      url: endpoint,
    };

    if (params && Object.keys(params).length > 0) {
      // Use qs to serialize parameters as recommended by Strapi
      const queryString = qs.stringify(params, { encodeValuesOnly: true, arrayFormat: "brackets" });
      config.params = params;
      config.paramsSerializer = (params: any) => qs.stringify(params, { encodeValuesOnly: true, arrayFormat: "brackets" });
      if (!isTest) {
        console.error("[REST] Request params:", JSON.stringify(params, null, 2));
        console.error("[REST] Query string:", queryString);
      }
    }

    if (body && (method === "POST" || method === "PUT" || method === "PATCH")) {
      config.data = body;
    }

    const response = await strapiClient.request(config);
    return response.data;
  } catch (error: any) {
    // Check if this is an expected error in tests
    const isExpectedTestError =
      isTest &&
      axios.isAxiosError(error) &&
      error.response &&
      ([400, 401, 403, 404].includes(error.response.status) ||
        endpoint.includes("invalid") ||
        endpoint.includes("non-existent") ||
        endpoint.includes("api/users"));

    if (!isExpectedTestError) {
      console.error(`[REST] Error making ${method} request to ${endpoint}:`, error);
    }

    let errorMessage = `REST API request failed`;
    let errorCode = ExtendedErrorCode.InternalError;

    if (axios.isAxiosError(error)) {
      if (error.response) {
        errorMessage = `${method} ${endpoint}: ${error.response.status} - ${JSON.stringify(error.response.data)}`;
        if (error.response.status === 403) {
          errorCode = ExtendedErrorCode.AccessDenied;
        } else if (error.response.status === 401) {
          errorCode = ExtendedErrorCode.AccessDenied;
        } else if (error.response.status === 404) {
          errorCode = ExtendedErrorCode.ResourceNotFound;
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

    throw new ExtendedMcpError(errorCode, errorMessage);
  }
}
export function setupHandlers(server: Server) {
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    try {
      const contentTypesList = await contentTypes.fetchContentTypes();

      const contentTypeResources = contentTypesList.map((ct) => ({
        uri: `strapi://content-type/${ct.pluralApiId || ct.apiID}`,
        name: `${ct.info.displayName} Content Type`,
        description: ct.info.description || `Schema and structure for ${ct.info.displayName}`,
        mimeType: "application/json",
      }));

      return {
        resources: contentTypeResources,
      };
    } catch (error: any) {
      logger.error("[Error] Failed to list resources:", error);
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to list resources: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  });
  server.setRequestHandler(ReadResourceRequestSchema, async (request: ReadResourceRequest) => {
    try {
      const uri = request.params.uri;

      const contentTypeMatch = uri.match(
        /^strapi:\/\/content-type\/([^/?]+)(?:\/([^/?]+))?(?:\?(.+))?$/
      );
      if (!contentTypeMatch) {
        throw new McpError(ErrorCode.InvalidRequest, `Invalid resource URI: ${uri}`);
      }

      const [, pluralApiId] = contentTypeMatch;

      // Find the content type by pluralApiId
      const contentTypesList = await contentTypes.fetchContentTypes();
      const contentType = contentTypesList.find(
        (ct) => ct.pluralApiId === pluralApiId || ct.apiID === pluralApiId
      );

      if (!contentType) {
        throw new McpError(
          ErrorCode.InvalidRequest,
          `Content type with plural API ID '${pluralApiId}' not found`
        );
      }

      const schema = await contentTypes.fetchContentTypeSchema(contentType.uid);

      return {
        contents: [
          {
            uri,
            mimeType: "application/json",
            text: JSON.stringify(schema, null, 2),
          },
        ],
      };
    } catch (error: any) {
      logger.error("[Error] Failed to read resource:", error);
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
            properties: {},
          },
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
            required: ["contentType"],
          },
        },
        {
          name: "strapi_rest",
          description:
            "Execute REST API requests against Strapi endpoints. Supports all CRUD operations with advanced query options.\n\n1. Reading components:\nparams: { populate: ['SEO'] } // Populate a component\nparams: { populate: { SEO: { fields: ['Title', 'seoDescription'] } } } // With field selection\n\n2. Updating components:\nbody: {\n  data: {\n    // For single components:\n    componentName: {\n      Title: 'value',\n      seoDescription: 'value'\n    },\n    // For repeatable components:\n    componentName: [\n      { field: 'value' }\n    ]\n  }\n}\n\n3. Locale parameter for i18n:\n- params: { locale: 'en' } // Fetch English locale\n- params: { locale: 'ru' } // Fetch Russian locale\n- params: { locale: 'all' } // Fetch all locales\n- For updates: PUT /api/articles/id?locale=ru\n\n4. Other parameters:\n- fields: Select specific fields\n- filters: Filter results\n- sort: Sort results\n- pagination: Page through results",
          inputSchema: {
            type: "object",
            properties: {
              endpoint: {
                type: "string",
                description: "The API endpoint (e.g., 'api/articles')",
              },
              method: {
                type: "string",
                description: "HTTP method to use",
                enum: ["GET", "POST", "PUT", "DELETE"],
                default: "GET",
              },
              params: {
                type: "object",
                description:
                  "Optional query parameters for GET requests. For components, use populate: ['componentName'] or populate: { componentName: { fields: ['field1'] } }. For Draft & Publish, use status: 'published' (default), 'draft', or 'all'. For i18n, use locale: 'en', 'ru', 'zh', 'all', etc.",
              },
              body: {
                type: "object",
                description:
                  "Request body for POST/PUT requests. For components, use: { data: { componentName: { field: 'value' } } } for single components or { data: { componentName: [{ field: 'value' }] } } for repeatable components",
              },
            },
            required: ["endpoint"],
          },
        },
        {
          name: "get_entries",
          description:
            "Get entries for a specific content type with optional filtering, pagination, sorting, and population of relations",
          inputSchema: {
            type: "object",
            properties: {
              pluralApiId: {
                type: "string",
                description:
                  "The plural API ID (e.g., 'articles', 'restaurants', 'users'). This is the plural form used in the API endpoint.",
              },
              options: {
                type: "string",
                description:
                  'JSON string with query options including filters, pagination, sort, populate, fields, status, and locale. Status can be \'published\' (default), \'draft\', or \'all\'. Locale can be \'en\', \'ru\', \'zh\', \'all\', etc. Example: \'{"filters":{"title":{"$contains":"hello"}},"pagination":{"page":1,"pageSize":10},"sort":["title:asc"],"populate":["author","categories"],"fields":["title","content"],"status":"draft","locale":"ru"}\'',
              },
            },
            required: ["pluralApiId"],
          },
        },
        {
          name: "get_entry",
          description: "Get a specific entry by documentId",
          inputSchema: {
            type: "object",
            properties: {
              pluralApiId: {
                type: "string",
                description:
                  "The plural API ID (e.g., 'articles', 'restaurants', 'users'). This is the plural form used in the API endpoint.",
              },
              documentId: {
                type: "string",
                description: "The documentId of the entry",
              },
              options: {
                type: "string",
                description:
                  'JSON string with query options including populate, fields, and locale. For i18n, use locale: \'en\', \'ru\', \'zh\', etc. Example: \'{"populate":["author","categories"],"fields":["title","content"],"locale":"ru"}\'',
              },
            },
            required: ["pluralApiId", "documentId"],
          },
        },
        {
          name: "create_entry",
          description:
            "Create a new entry for a content type. For i18n content types, you can specify the locale to create an entry in a specific language.",
          inputSchema: {
            type: "object",
            properties: {
              contentType: {
                type: "string",
                description:
                  "The content type UID (e.g., 'api::article.article'). Used for slug generation if needed.",
              },
              pluralApiId: {
                type: "string",
                description:
                  "The plural API ID (e.g., 'articles', 'restaurants', 'users'). This is the plural form used in the API endpoint.",
              },
              data: {
                type: "object",
                description: "The data for the new entry",
              },
              locale: {
                type: "string",
                description:
                  "Optional: Locale for i18n content types (e.g., 'en', 'ru', 'zh'). If not specified, uses the default locale.",
              },
              status: {
                type: "string",
                description:
                  "Optional: Status for draft & publish content types. Use 'published' to publish immediately, 'draft' to save as draft.",
              },
            },
            required: ["contentType", "pluralApiId", "data"],
          },
        },
        {
          name: "update_entry",
          description:
            "Update an existing entry. For i18n content types, you can specify the locale to update a specific language version.",
          inputSchema: {
            type: "object",
            properties: {
              pluralApiId: {
                type: "string",
                description:
                  "The plural API ID (e.g., 'articles', 'restaurants', 'users'). This is the plural form used in the API endpoint.",
              },
              documentId: {
                type: "string",
                description: "The documentId of the entry to update",
              },
              data: {
                type: "object",
                description: "The updated data for the entry",
              },
              locale: {
                type: "string",
                description:
                  "Optional: Locale for i18n content types (e.g., 'en', 'ru', 'zh'). If not specified, updates the default locale.",
              },
            },
            required: ["pluralApiId", "documentId", "data"],
          },
        },
        {
          name: "delete_entry",
          description:
            "Deletes a specific entry. For i18n content types, you can specify the locale to delete a specific language version.",
          inputSchema: {
            type: "object",
            properties: {
              pluralApiId: {
                type: "string",
                description:
                  "The plural API ID (e.g., 'articles', 'restaurants', 'users'). This is the plural form used in the API endpoint.",
              },
              documentId: {
                type: "string",
                description: "The documentId of the entry.",
              },
              locale: {
                type: "string",
                description:
                  "Optional: Locale for i18n content types (e.g., 'en', 'ru', 'zh'). If not specified, deletes all locales.",
              },
            },
            required: ["pluralApiId", "documentId"],
          },
        },
        {
          name: "upload_media",
          description:
            "Upload a media file to the Strapi Media Library. Maximum size: ~750KB file (1MB base64). For larger files, use upload_media_from_path.",
          inputSchema: {
            type: "object",
            properties: {
              fileData: {
                type: "string",
                description:
                  "Base64 encoded string of the file data. Large files cause context window overflow.",
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
            required: ["fileData", "fileName", "fileType"],
          },
        },
        {
          name: "upload_media_from_path",
          description:
            "Upload a media file from a local file path. Avoids context window overflow issues. Maximum size: 10MB.",
          inputSchema: {
            type: "object",
            properties: {
              filePath: {
                type: "string",
                description: "Local file system path to the file to upload.",
              },
              fileName: {
                type: "string",
                description:
                  "Optional: Override the file name. If not provided, uses the original filename.",
              },
              fileType: {
                type: "string",
                description:
                  "Optional: Override the MIME type. If not provided, auto-detects from file extension.",
              },
            },
            required: ["filePath"],
          },
        },
        {
          name: "connect_relation",
          description: "Connects related entries to a relation field.",
          inputSchema: {
            type: "object",
            properties: {
              pluralApiId: {
                type: "string",
                description:
                  "The plural API ID (e.g., 'articles', 'restaurants', 'users'). This is the plural form used in the API endpoint.",
              },
              documentId: {
                type: "string",
                description: "Main entry documentId.",
              },
              relationField: {
                type: "string",
                description: "Relation field name.",
              },
              relatedIds: {
                type: "array",
                items: { type: "string" },
                description: "Array of entry documentIds to connect.",
              },
            },
            required: ["pluralApiId", "documentId", "relationField", "relatedIds"],
          },
        },
        {
          name: "disconnect_relation",
          description: "Disconnects related entries from a relation field.",
          inputSchema: {
            type: "object",
            properties: {
              pluralApiId: {
                type: "string",
                description:
                  "The plural API ID (e.g., 'articles', 'restaurants', 'users'). This is the plural form used in the API endpoint.",
              },
              documentId: {
                type: "string",
                description: "Main entry documentId.",
              },
              relationField: {
                type: "string",
                description: "Relation field name.",
              },
              relatedIds: {
                type: "array",
                items: { type: "string" },
                description: "Array of entry documentIds to disconnect.",
              },
            },
            required: ["pluralApiId", "documentId", "relationField", "relatedIds"],
          },
        },
        {
          name: "set_relation",
          description:
            "Sets related entries for a relation field, replacing all existing relations.",
          inputSchema: {
            type: "object",
            properties: {
              pluralApiId: {
                type: "string",
                description:
                  "The plural API ID (e.g., 'articles', 'restaurants', 'users'). This is the plural form used in the API endpoint.",
              },
              documentId: {
                type: "string",
                description: "Main entry documentId.",
              },
              relationField: {
                type: "string",
                description: "Relation field name.",
              },
              relatedIds: {
                type: "array",
                items: { type: "string" },
                description: "Array of entry documentIds to set.",
              },
            },
            required: ["pluralApiId", "documentId", "relationField", "relatedIds"],
          },
        },
        {
          name: "create_content_type",
          description:
            "Creates a new content type (Admin privileges required). For i18n-enabled content types, include pluginOptions.i18n.localized: true.",
          inputSchema: {
            type: "object",
            properties: {
              displayName: { type: "string", description: "Display name for content type." },
              singularName: { type: "string", description: "Singular name for API ID." },
              pluralName: { type: "string", description: "Plural name for API ID." },
              kind: {
                type: "string",
                enum: ["collectionType", "singleType"],
                default: "collectionType",
                description: "Kind of content type.",
              },
              description: { type: "string", description: "Optional description." },
              draftAndPublish: {
                type: "boolean",
                default: true,
                description: "Enable draft/publish?",
              },
              attributes: {
                type: "object",
                description:
                  'Fields for the content type. E.g., { "title": { "type": "string", "pluginOptions": { "i18n": { "localized": true } } } } for localized fields',
                additionalProperties: {
                  type: "object",
                  properties: {
                    type: {
                      type: "string",
                      description: "Field type (string, text, number, etc.)",
                    },
                    required: { type: "boolean", description: "Is this field required?" },
                    pluginOptions: {
                      type: "object",
                      description:
                        "Plugin options, e.g., { i18n: { localized: true } } for localized fields",
                    },
                  },
                  required: ["type"],
                },
              },
              pluginOptions: {
                type: "object",
                description:
                  "Plugin options for the content type. For i18n: { i18n: { localized: true } }",
              },
            },
            required: ["displayName", "singularName", "pluralName", "attributes"],
          },
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
                description:
                  'Attributes to add/update. E.g., { "new_field": { "type": "boolean" } }',
                additionalProperties: {
                  type: "object",
                  properties: {
                    type: { type: "string", description: "Field type (string, boolean, etc.)" },
                  },
                  required: ["type"],
                },
              },
            },
            required: ["contentType", "attributes"],
          },
        },
        {
          name: "delete_content_type",
          description: "Deletes a content type (Admin privileges required).",
          inputSchema: {
            type: "object",
            properties: {
              contentType: {
                type: "string",
                description: "UID of content type to delete (e.g., 'api::test.test').",
              },
            },
            required: ["contentType"],
          },
        },
        {
          name: "strapi_get_components",
          description:
            "Get all components from Strapi with pagination support. Returns both component data and pagination metadata (page, pageSize, total, pageCount).",
          inputSchema: {
            type: "object",
            properties: {
              page: {
                type: "number",
                description: "Page number (starts at 1)",
                default: 1,
              },
              pageSize: {
                type: "number",
                description: "Number of items per page",
                default: 25,
              },
            },
          },
        },
        {
          name: "list_components",
          description: "List all available components in Strapi",
          inputSchema: {
            type: "object",
            properties: {},
          },
        },
        {
          name: "get_component_schema",
          description: "Get the schema for a specific component",
          inputSchema: {
            type: "object",
            properties: {
              componentUid: {
                type: "string",
                description: "The API ID of the component",
              },
            },
            required: ["componentUid"],
          },
        },
        {
          name: "create_component",
          description: "Create a new component",
          inputSchema: {
            type: "object",
            properties: {
              displayName: {
                type: "string",
                description: "Display name for the component",
              },
              category: {
                type: "string",
                description: "Category name for the component (e.g., 'basic', 'layout', 'content')",
              },
              icon: {
                type: "string",
                description: "Icon name for the component (default: 'brush')",
              },
              attributes: {
                type: "object",
                description:
                  'Component attributes definition. E.g., { "title": { "type": "string" }, "content": { "type": "text" } }',
                additionalProperties: {
                  type: "object",
                  properties: {
                    type: {
                      type: "string",
                      description: "Field type (string, text, number, etc.)",
                    },
                    required: { type: "boolean", description: "Is this field required?" },
                  },
                  required: ["type"],
                },
              },
            },
            required: ["displayName", "category", "attributes"],
          },
        },
        {
          name: "update_component",
          description: "Update an existing component",
          inputSchema: {
            type: "object",
            properties: {
              componentUid: {
                type: "string",
                description: "The API ID of the component to update",
              },
              attributesToUpdate: {
                type: "object",
                description: "The attributes to update for the component",
              },
            },
            required: ["componentUid", "attributesToUpdate"],
          },
        },
        {
          name: "publish_entry",
          description: "Publishes a specific entry.",
          inputSchema: {
            type: "object",
            properties: {
              pluralApiId: {
                type: "string",
                description:
                  "The plural API ID (e.g., 'articles', 'restaurants', 'users'). This is the plural form used in the API endpoint.",
              },
              documentId: {
                type: "string",
                description: "Entry documentId.",
              },
            },
            required: ["pluralApiId", "documentId"],
          },
        },
        {
          name: "unpublish_entry",
          description: "Unpublishes a specific entry.",
          inputSchema: {
            type: "object",
            properties: {
              pluralApiId: {
                type: "string",
                description:
                  "The plural API ID (e.g., 'articles', 'restaurants', 'users'). This is the plural form used in the API endpoint.",
              },
              documentId: {
                type: "string",
                description: "Entry documentId.",
              },
            },
            required: ["pluralApiId", "documentId"],
          },
        },
        {
          name: "update_content_type_permissions",
          description:
            "Update permissions for a content type. Allows setting read/write permissions for public, authenticated, and admin roles (Admin privileges required).",
          inputSchema: {
            type: "object",
            properties: {
              contentType: {
                type: "string",
                description: "The content type UID (e.g., 'api::article.article')",
              },
              permissions: {
                type: "object",
                description: "Permissions to set for public, authenticated, and admin roles",
                properties: {
                  public: {
                    type: "object",
                    description: "Permissions for public (unauthenticated) users",
                    properties: {
                      find: { type: "boolean", description: "Allow listing entries" },
                      findOne: { type: "boolean", description: "Allow viewing single entries" },
                      create: { type: "boolean", description: "Allow creating entries" },
                      update: { type: "boolean", description: "Allow updating entries" },
                      delete: { type: "boolean", description: "Allow deleting entries" },
                    },
                  },
                  authenticated: {
                    type: "object",
                    description: "Permissions for authenticated users",
                    properties: {
                      find: { type: "boolean", description: "Allow listing entries" },
                      findOne: { type: "boolean", description: "Allow viewing single entries" },
                      create: { type: "boolean", description: "Allow creating entries" },
                      update: { type: "boolean", description: "Allow updating entries" },
                      delete: { type: "boolean", description: "Allow deleting entries" },
                    },
                  },
                  admin: {
                    type: "object",
                    description: "Permissions for admin roles (excluding super admin)",
                    properties: {
                      find: { type: "boolean", description: "Allow listing entries" },
                      findOne: { type: "boolean", description: "Allow viewing single entries" },
                      create: { type: "boolean", description: "Allow creating entries" },
                      update: { type: "boolean", description: "Allow updating entries" },
                      delete: { type: "boolean", description: "Allow deleting entries" },
                      publish: { type: "boolean", description: "Allow publishing entries" },
                    },
                  },
                },
              },
            },
            required: ["contentType", "permissions"],
          },
        },
        {
          name: "register_first_admin",
          description:
            "Register the first admin user for a fresh Strapi installation. This tool can only be used during initial setup when no admin users exist.",
          inputSchema: {
            type: "object",
            properties: {
              email: {
                type: "string",
                description: "Email address for the admin user",
              },
              password: {
                type: "string",
                description:
                  "Password for the admin user (must meet Strapi's password requirements)",
              },
              firstname: {
                type: "string",
                description: "First name of the admin user (optional, defaults to 'Admin')",
              },
              lastname: {
                type: "string",
                description: "Last name of the admin user (optional, defaults to 'User')",
              },
            },
            required: ["email", "password"],
          },
        },
      ],
    };
  });
  server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
    try {
      switch (request.params.name) {
        case "list_content_types": {
          const contentTypesList = await contentTypes.listContentTypes();

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  contentTypesList.map((ct) => ({
                    uid: ct.uid,
                    displayName: ct.info.displayName,
                    description: ct.info.description,
                  })),
                  null,
                  2
                ),
              },
            ],
          };
        }

        case "strapi_rest": {
          const { endpoint, method = "GET", params, body } = request.params.arguments as any;

          if (!endpoint) {
            throw new McpError(ErrorCode.InvalidParams, "Endpoint is required");
          }

          const result = await makeRestRequest(endpoint, method, params, body);

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case "get_entries": {
          const { pluralApiId, options } = request.params.arguments as any;
          if (!pluralApiId) {
            throw new McpError(ErrorCode.InvalidParams, "pluralApiId is required");
          }

          let queryParams: QueryParams = {};
          if (options) {
            try {
              queryParams = JSON.parse(options);
            } catch (parseError) {
              logger.error("[Error] Failed to parse query options:", parseError);
              throw new McpError(
                ErrorCode.InvalidParams,
                `Invalid query options: ${parseError instanceof Error ? parseError.message : String(parseError)}`
              );
            }
          }

          const entriesList = await entries.fetchEntries(String(pluralApiId), queryParams);

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(entriesList, null, 2),
              },
            ],
          };
        }

        case "get_entry": {
          const { pluralApiId, documentId, options } = request.params.arguments as any;

          if (!pluralApiId || !documentId) {
            throw new McpError(ErrorCode.InvalidParams, "pluralApiId and documentId are required");
          }

          let queryParams: QueryParams = {};
          if (options) {
            try {
              queryParams = JSON.parse(options);
            } catch (parseError) {
              logger.error("[Error] Failed to parse query options:", parseError);
              throw new McpError(
                ErrorCode.InvalidParams,
                `Invalid query options: ${parseError instanceof Error ? parseError.message : String(parseError)}`
              );
            }
          }

          const entry = await entries.fetchEntry(
            String(pluralApiId),
            String(documentId),
            queryParams
          );

          if (!entry) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              `Entry with documentId '${documentId}' not found in '${pluralApiId}'`
            );
          }

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(entry, null, 2),
              },
            ],
          };
        }

        case "create_entry": {
          const contentType = String(request.params.arguments?.contentType);
          const pluralApiId = String(request.params.arguments?.pluralApiId);
          const data = request.params.arguments?.data;
          const locale = request.params.arguments?.locale as string | undefined;
          const status = request.params.arguments?.status as string | undefined;

          if (!contentType || !pluralApiId || !data) {
            throw new McpError(
              ErrorCode.InvalidParams,
              "contentType, pluralApiId, and data are required"
            );
          }

          const entry = await entries.createEntry(contentType, pluralApiId, data, locale, status);

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(entry, null, 2),
              },
            ],
          };
        }

        case "update_entry": {
          const pluralApiId = String(request.params.arguments?.pluralApiId);
          const documentId = String(request.params.arguments?.documentId);
          const data = request.params.arguments?.data;
          const locale = request.params.arguments?.locale as string | undefined;

          if (!pluralApiId || !documentId || !data) {
            throw new McpError(
              ErrorCode.InvalidParams,
              "pluralApiId, documentId, and data are required"
            );
          }

          const entry = await entries.updateEntry(pluralApiId, documentId, data, locale);

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(entry, null, 2),
              },
            ],
          };
        }

        case "delete_entry": {
          const pluralApiId = String(request.params.arguments?.pluralApiId);
          const documentId = String(request.params.arguments?.documentId);
          const locale = request.params.arguments?.locale as string | undefined;

          if (!pluralApiId || !documentId) {
            throw new McpError(ErrorCode.InvalidParams, "pluralApiId and documentId are required");
          }

          const result = await entries.deleteEntry(pluralApiId, documentId, locale);

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case "get_content_type_schema": {
          const contentType = String(request.params.arguments?.contentType);

          if (!contentType) {
            throw new McpError(ErrorCode.InvalidParams, "Content type is required");
          }

          const schema = await contentTypes.fetchContentTypeSchema(contentType);

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(schema, null, 2),
              },
            ],
          };
        }

        case "upload_media": {
          const { fileData, fileName, fileType } = request.params.arguments as any;

          if (!fileData || !fileName || !fileType) {
            throw new McpError(
              ErrorCode.InvalidParams,
              "fileData, fileName, and fileType are required"
            );
          }

          const result = await media.uploadMedia(fileData, fileName, fileType);

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case "upload_media_from_path": {
          const { filePath, fileName, fileType } = request.params.arguments as any;

          if (!filePath) {
            throw new McpError(ErrorCode.InvalidParams, "filePath is required");
          }

          const result = await media.uploadMediaFromPath(filePath, fileName, fileType);

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case "connect_relation": {
          const pluralApiId = String(request.params.arguments?.pluralApiId);
          const documentId = String(request.params.arguments?.documentId);
          const relationField = String(request.params.arguments?.relationField);
          const relatedIds = request.params.arguments?.relatedIds as string[];

          if (!pluralApiId || !documentId || !relationField || !relatedIds) {
            throw new McpError(
              ErrorCode.InvalidParams,
              "pluralApiId, documentId, relationField, and relatedIds are required"
            );
          }

          const result = await entries.connectRelation(
            pluralApiId,
            documentId,
            relationField,
            relatedIds
          );

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case "disconnect_relation": {
          const pluralApiId = String(request.params.arguments?.pluralApiId);
          const documentId = String(request.params.arguments?.documentId);
          const relationField = String(request.params.arguments?.relationField);
          const relatedIds = request.params.arguments?.relatedIds as string[];

          if (!pluralApiId || !documentId || !relationField || !relatedIds) {
            throw new McpError(
              ErrorCode.InvalidParams,
              "pluralApiId, documentId, relationField, and relatedIds are required"
            );
          }

          const result = await entries.disconnectRelation(
            pluralApiId,
            documentId,
            relationField,
            relatedIds
          );

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case "set_relation": {
          const pluralApiId = String(request.params.arguments?.pluralApiId);
          const documentId = String(request.params.arguments?.documentId);
          const relationField = String(request.params.arguments?.relationField);
          const relatedIds = request.params.arguments?.relatedIds as string[];

          if (!pluralApiId || !documentId || !relationField || !relatedIds) {
            throw new McpError(
              ErrorCode.InvalidParams,
              "pluralApiId, documentId, relationField, and relatedIds are required"
            );
          }

          const result = await entries.setRelation(
            pluralApiId,
            documentId,
            relationField,
            relatedIds
          );

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case "publish_entry": {
          const pluralApiId = String(request.params.arguments?.pluralApiId);
          const documentId = String(request.params.arguments?.documentId);

          if (!pluralApiId || !documentId) {
            throw new McpError(ErrorCode.InvalidParams, "pluralApiId and documentId are required");
          }

          const result = await entries.publishEntry(pluralApiId, documentId);

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case "unpublish_entry": {
          const pluralApiId = String(request.params.arguments?.pluralApiId);
          const documentId = String(request.params.arguments?.documentId);

          if (!pluralApiId || !documentId) {
            throw new McpError(ErrorCode.InvalidParams, "pluralApiId and documentId are required");
          }

          const result = await entries.unpublishEntry(pluralApiId, documentId);

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case "create_content_type": {
          const contentTypeData = request.params.arguments;

          if (!contentTypeData) {
            throw new McpError(ErrorCode.InvalidParams, "Content type data is required");
          }

          const result = await contentTypes.createContentType(contentTypeData);

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case "update_content_type": {
          const contentType = String(request.params.arguments?.contentType);
          const attributes = request.params.arguments?.attributes;

          if (!contentType || !attributes) {
            throw new McpError(ErrorCode.InvalidParams, "Content type and attributes are required");
          }

          const result = await contentTypes.updateContentType(contentType, attributes);

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case "delete_content_type": {
          const contentType = String(request.params.arguments?.contentType);

          if (!contentType) {
            throw new McpError(ErrorCode.InvalidParams, "Content type is required");
          }

          const result = await contentTypes.deleteContentType(contentType);

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case "strapi_get_components": {
          const page = Number(request.params.arguments?.page) || 1;
          const pageSize = Number(request.params.arguments?.pageSize) || 25;
          const result = await components.strapiGetComponents(page, pageSize);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case "list_components": {
          const componentsList = await components.listComponents();

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(componentsList, null, 2),
              },
            ],
          };
        }

        case "get_component_schema": {
          const componentUid = String(request.params.arguments?.componentUid);

          if (!componentUid) {
            throw new McpError(ErrorCode.InvalidParams, "Component UID is required");
          }

          const schema = await components.getComponentSchema(componentUid);

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(schema, null, 2),
              },
            ],
          };
        }

        case "create_component": {
          const { displayName, category, icon, attributes } = request.params.arguments as any;
          if (!displayName || !category || !attributes || typeof attributes !== "object") {
            throw new McpError(
              ErrorCode.InvalidParams,
              "Missing required fields: displayName, category, and attributes are required."
            );
          }
          const componentData = { displayName, category, icon, attributes };
          const result = await components.createComponent(componentData);

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case "update_component": {
          const componentUid = String(request.params.arguments?.componentUid);
          const attributesToUpdate = request.params.arguments?.attributesToUpdate;

          if (!componentUid || !attributesToUpdate) {
            throw new McpError(
              ErrorCode.InvalidParams,
              "Component UID and attributes to update are required"
            );
          }

          const result = await components.updateComponent(componentUid, attributesToUpdate);

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case "update_content_type_permissions": {
          const contentType = String(request.params.arguments?.contentType);
          const permissionsConfig = request.params.arguments?.permissions;

          if (!contentType || !permissionsConfig) {
            throw new McpError(ErrorCode.InvalidParams, "contentType and permissions are required");
          }

          const result = await permissions.updateContentTypePermissions(
            contentType,
            permissionsConfig
          );

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case "register_first_admin": {
          const { email, password, firstname, lastname } = request.params.arguments as any;

          if (!email || !password) {
            throw new McpError(ErrorCode.InvalidParams, "email and password are required");
          }

          const result = await users.registerFirstAdmin({ email, password, firstname, lastname });

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        default:
          throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
      }
    } catch (error: any) {
      // Check if this is an expected error in tests
      const isExpectedTestError =
        isTest &&
        // Expected errors from error-handling tests
        ((request.params.name === "create_entry" && error.message?.includes("ValidationError")) ||
          (request.params.name === "update_entry" &&
            error.message?.includes("non-existent-document-id")) ||
          (request.params.name === "publish_entry" &&
            error.message?.includes("non-existent-document-id")) ||
          (request.params.name === "get_entries" &&
            request.params.arguments?.pluralApiId === "invalid") ||
          (request.params.name === "get_component_schema" &&
            error.message?.includes("non.existent.component")) ||
          (request.params.name === "create_component" &&
            error.message?.includes("Missing required fields")) ||
          (request.params.name === "list_components" &&
            error.message?.includes("Admin credentials are required")) ||
          (request.params.name === "strapi_rest" && error.message?.includes("403")));

      if (!isExpectedTestError) {
        logger.error(`[Error] Tool execution failed for ${request.params.name}:`, error);
      }

      // Re-throw McpError instances as they should be handled by the MCP SDK
      if (error instanceof McpError || error instanceof ExtendedMcpError) {
        throw error;
      }

      // Convert other errors to McpError
      let errorCode = ErrorCode.InternalError;
      let errorMessage = `Tool execution failed`;

      if (axios.isAxiosError(error)) {
        if (error.response) {
          errorMessage = `${error.response.status} - ${JSON.stringify(error.response.data)}`;
          if (error.response.status === 404) {
            errorCode = ErrorCode.InvalidRequest;
          }
        } else {
          errorMessage = error.message;
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      } else {
        errorMessage = String(error);
      }

      throw new McpError(errorCode, errorMessage);
    }
  });
}
