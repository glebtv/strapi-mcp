import { ExtendedMcpError, ExtendedErrorCode } from "../errors/index.js";
import { makeAdminApiRequest, validateStrapiConnection } from "./client.js";
import { config } from "../config/index.js";
import { logger } from "../utils/index.js";
import axios from "axios";
import { setTimeout } from "timers/promises";

/**
 * List all components
 */
export async function listComponents(): Promise<any[]> {
  try {
    logger.debug(`[API] Listing all components`);

    // Ensure we're connected and authenticated first
    await validateStrapiConnection();

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
      logger.debug(`[API] No components found or unexpected response format`);
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
      attributes: component.attributes || component.schema?.attributes,
    }));
  } catch (error) {
    logger.error(`[Error] Failed to list components:`, error);
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
    logger.debug(`[API] Fetching schema for component: ${componentUid}`);

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

    // The response contains the component data with schema inside
    // Return the full component data which includes uid, category, apiId and schema
    return componentResponse.data;
  } catch (error) {
    logger.error(`[Error] Failed to fetch component schema for ${componentUid}:`, error);
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
    logger.debug(`[API] Creating new component`);

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

    logger.debug(`[API] Component creation payload:`, payload);

    // The admin API endpoint for creating components
    const adminEndpoint = `/content-type-builder/components`;

    // Make the POST request to create the component
    const response = await makeAdminApiRequest(adminEndpoint, "post", payload);

    logger.debug(`[API] Component creation response:`, response);

    // Strapi will restart after schema changes in development mode
    // Wait for Strapi to come back online if in dev mode
    if (config.strapi.devMode) {
      logger.info(`[API] Strapi is in dev mode, waiting for restart after component creation...`);

      // Wait a bit for Strapi to start shutting down
      await setTimeout(2000);

      // Now wait for Strapi to come back online
      const maxAttempts = 30; // 30 seconds max wait
      let attempts = 0;
      let strapiIsBack = false;

      while (attempts < maxAttempts && !strapiIsBack) {
        try {
          // Try to hit the health endpoint
          const healthResponse = await axios.get(`${config.strapi.url}/_health`, {
            timeout: 1000,
          });
          if (healthResponse.status === 204) {
            strapiIsBack = true;
            logger.info(`[API] Strapi is back online after ${attempts + 1} attempts`);
          }
        } catch {
          // Strapi is still down
          attempts++;
          await setTimeout(1000);
        }
      }

      if (!strapiIsBack) {
        logger.warn(`[API] Warning: Strapi did not come back online within ${maxAttempts} seconds`);
      }
    }

    if (response) {
      return response;
    }

    return { message: "Component creation initiated. Strapi might be restarting." };
  } catch (error) {
    logger.error(`[Error] Failed to create component:`, error);
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
    logger.debug(`[API] Updating component: ${componentUid}`);

    // Admin credentials are required for component operations
    if (!config.strapi.adminEmail || !config.strapi.adminPassword) {
      throw new ExtendedMcpError(
        ExtendedErrorCode.AccessDenied,
        "Admin credentials are required for component operations"
      );
    }

    // 1. Fetch the current component schema
    logger.debug(`[API] Fetching current schema for ${componentUid}`);
    const currentSchemaData = await getComponentSchema(componentUid);

    // The response structure includes the component data at the top level
    const componentData = currentSchemaData.data || currentSchemaData;

    // Log the component data structure to debug
    logger.debug("[API] Current component data structure:", JSON.stringify(componentData, null, 2));

    // Extract the schema from the component data
    const currentSchema = componentData.schema || componentData;
    if (!currentSchema || !currentSchema.attributes) {
      logger.error("[API] Could not retrieve a valid current schema structure.", currentSchemaData);
      throw new Error(`Could not retrieve a valid schema structure for ${componentUid}`);
    }

    // 2. Merge new/updated attributes into the current schema's attributes
    const updatedAttributes = { ...currentSchema.attributes, ...attributesToUpdate };

    // 3. Construct the payload for the PUT request
    // The displayName is directly on the schema object, not in an info sub-object
    const displayName =
      currentSchema.displayName ||
      componentData.displayName ||
      currentSchema.info?.displayName ||
      componentData.info?.displayName ||
      componentUid.split(".").pop();

    const payload = {
      component: {
        category: componentData.category || currentSchema.category || componentUid.split(".")[0],
        displayName: displayName,
        icon:
          currentSchema.icon ||
          componentData.icon ||
          currentSchema.info?.icon ||
          componentData.info?.icon ||
          "brush",
        attributes: updatedAttributes,
      },
    };

    logger.debug(`[API] Component update payload:`, JSON.stringify(payload, null, 2));

    // 4. Make the PUT request to update the component
    const adminEndpoint = `/content-type-builder/components/${componentUid}`;
    const response = await makeAdminApiRequest(adminEndpoint, "put", payload);

    logger.debug(`[API] Component update response:`, response);

    // Strapi will restart after schema changes in development mode
    // Wait for Strapi to come back online if in dev mode
    if (config.strapi.devMode) {
      logger.info(`[API] Strapi is in dev mode, waiting for restart after component update...`);

      // Wait a bit for Strapi to start shutting down
      await setTimeout(2000);

      // Now wait for Strapi to come back online
      const maxAttempts = 30; // 30 seconds max wait
      let attempts = 0;
      let strapiIsBack = false;

      while (attempts < maxAttempts && !strapiIsBack) {
        try {
          // Try to hit the health endpoint
          const healthResponse = await axios.get(`${config.strapi.url}/_health`, {
            timeout: 1000,
          });
          if (healthResponse.status === 204) {
            strapiIsBack = true;
            logger.info(`[API] Strapi is back online after ${attempts + 1} attempts`);
          }
        } catch {
          // Strapi is still down
          attempts++;
          await setTimeout(1000);
        }
      }

      if (!strapiIsBack) {
        logger.warn(`[API] Warning: Strapi did not come back online within ${maxAttempts} seconds`);
      }
    }

    // Response might vary, but should typically include the updated component data
    return (
      response?.data || {
        message: `Component ${componentUid} update initiated. Strapi might be restarting.`,
      }
    );
  } catch (error) {
    logger.error(`[Error] Failed to update component ${componentUid}:`, error);
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
    logger.debug(`[API] Getting components with pagination - page: ${page}, pageSize: ${pageSize}`);

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
      logger.debug(`[API] No components found or unexpected response format`);
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
      attributes: component.attributes || component.schema?.attributes || {},
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
    logger.error(`[Error] Failed to get components with pagination:`, error);
    throw new ExtendedMcpError(
      ExtendedErrorCode.InternalError,
      `Failed to get components: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
