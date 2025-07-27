import { ExtendedMcpError, ExtendedErrorCode } from "../errors/index.js";
import { makeAdminApiRequest } from "./client.js";
import { config } from "../config/index.js";

/**
 * List all components
 */
export async function listComponents(): Promise<any[]> {
  try {
    console.error(`[API] Listing all components`);

    // Admin credentials are required for component operations
    if (!config.strapi.adminEmail || !config.strapi.adminPassword) {
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
      displayName: component.info?.displayName || component.uid.split(".").pop(),
      description: component.info?.description || `${component.uid} component`,
      icon: component.info?.icon,
    }));
  } catch (error) {
    console.error(`[Error] Failed to list components:`, error);
    throw new ExtendedMcpError(
      ExtendedErrorCode.InternalError,
      `Failed to list components: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Get component schema
 */
export async function getComponentSchema(componentUid: string): Promise<any> {
  try {
    console.error(`[API] Fetching schema for component: ${componentUid}`);

    // Admin credentials are required for component operations
    if (!config.strapi.adminEmail || !config.strapi.adminPassword) {
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
    throw new ExtendedMcpError(
      ExtendedErrorCode.InternalError,
      `Failed to fetch component schema for ${componentUid}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Create a new component
 */
export async function createComponent(componentData: any): Promise<any> {
  try {
    console.error(`[API] Creating new component`);

    // Admin credentials are required for component operations
    if (!config.strapi.adminEmail || !config.strapi.adminPassword) {
      throw new ExtendedMcpError(
        ExtendedErrorCode.AccessDenied,
        "Admin credentials are required for component operations"
      );
    }

    const { displayName, category, icon, attributes } = componentData;

    if (!displayName || !category || !attributes) {
      throw new Error("Missing required fields: displayName, category, attributes");
    }

    // Construct the payload for the API
    const payload = {
      component: {
        category: category,
        icon: icon || "brush",
        displayName: displayName,
        attributes: attributes,
      },
    };

    console.error(`[API] Component creation payload:`, payload);

    // The admin API endpoint for creating components
    const adminEndpoint = `/content-type-builder/components`;

    // Make the POST request to create the component
    const response = await makeAdminApiRequest(adminEndpoint, "post", payload);

    console.error(`[API] Component creation response:`, response);

    // Strapi might restart after schema changes
    return (
      response?.data || { message: "Component creation initiated. Strapi might be restarting." }
    );
  } catch (error) {
    console.error(`[Error] Failed to create component:`, error);
    throw new ExtendedMcpError(
      ExtendedErrorCode.InternalError,
      `Failed to create component: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Update an existing component
 */
export async function updateComponent(
  componentUid: string,
  attributesToUpdate: Record<string, any>
): Promise<any> {
  try {
    console.error(`[API] Updating component: ${componentUid}`);

    // Admin credentials are required for component operations
    if (!config.strapi.adminEmail || !config.strapi.adminPassword) {
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
      console.error(
        "[API] Could not retrieve a valid current schema structure.",
        currentSchemaData
      );
      throw new Error(`Could not retrieve a valid schema structure for ${componentUid}`);
    }

    // 2. Merge new/updated attributes into the current schema's attributes
    const updatedAttributes = { ...currentSchema.attributes, ...attributesToUpdate };

    // 3. Construct the payload for the PUT request
    const payload = {
      component: {
        ...currentSchema,
        attributes: updatedAttributes,
      },
    };

    // Remove potentially problematic fields
    delete payload.component.uid;

    console.error(`[API] Component update payload:`, payload);

    // 4. Make the PUT request to update the component
    const adminEndpoint = `/content-type-builder/components/${componentUid}`;
    const response = await makeAdminApiRequest(adminEndpoint, "put", payload);

    console.error(`[API] Component update response:`, response);

    // Response might vary, but should typically include the updated component data
    return (
      response?.data || {
        message: `Component ${componentUid} update initiated. Strapi might be restarting.`,
      }
    );
  } catch (error) {
    console.error(`[Error] Failed to update component ${componentUid}:`, error);
    throw new ExtendedMcpError(
      ExtendedErrorCode.InternalError,
      `Failed to update component ${componentUid}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Get all components from Strapi with pagination support
 */
export async function strapiGetComponents(page: number = 1, pageSize: number = 25): Promise<any> {
  try {
    console.error(
      `[API] Getting components with pagination - page: ${page}, pageSize: ${pageSize}`
    );

    // Admin credentials are required for component operations
    if (!config.strapi.adminEmail || !config.strapi.adminPassword) {
      throw new ExtendedMcpError(
        ExtendedErrorCode.AccessDenied,
        "Admin credentials are required for component operations"
      );
    }

    // The admin API endpoint for components
    const adminEndpoint = `/content-type-builder/components`;

    // Make the GET request to fetch components with pagination
    const componentsResponse = await makeAdminApiRequest(adminEndpoint, "get", undefined, {
      page,
      pageSize,
    });

    if (!componentsResponse || !componentsResponse.data) {
      console.error(`[API] No components found or unexpected response format`);
      return {
        data: [],
        meta: {
          pagination: {
            page,
            pageSize,
            total: 0,
            pageCount: 0,
          },
        },
      };
    }

    // Process the components data
    const components = Array.isArray(componentsResponse.data)
      ? componentsResponse.data
      : [componentsResponse.data];

    // Format component info
    const formattedComponents = components.map((component: any) => ({
      uid: component.uid,
      category: component.category,
      displayName: component.info?.displayName || component.uid.split(".").pop(),
      description: component.info?.description || `${component.uid} component`,
      icon: component.info?.icon,
      attributes: component.attributes,
    }));

    // Create pagination metadata
    const total = componentsResponse.meta?.pagination?.total || components.length;
    const pageCount = Math.ceil(total / pageSize);

    return {
      data: formattedComponents,
      meta: {
        pagination: {
          page,
          pageSize,
          total,
          pageCount,
        },
      },
    };
  } catch (error) {
    console.error(`[Error] Failed to get components with pagination:`, error);
    throw new ExtendedMcpError(
      ExtendedErrorCode.InternalError,
      `Failed to get components: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
