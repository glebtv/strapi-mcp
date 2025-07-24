import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { makeAdminApiRequest, hasAdminCredentials } from "../auth/index.js";
import { config } from "../config/index.js";
import { ExtendedMcpError, ExtendedErrorCode } from "../errors/index.js";
import axios from "axios";

export async function listComponents(): Promise<any[]> {
  try {
    console.error(`[API] Listing all components`);
    
    if (!hasAdminCredentials()) {
      throw new ExtendedMcpError(
        ExtendedErrorCode.AccessDenied,
        "Admin credentials are required for component operations"
      );
    }
    
    const adminEndpoint = `/content-type-builder/components`;
    
    const componentsResponse = await makeAdminApiRequest(adminEndpoint);
    
    if (!componentsResponse || !componentsResponse.data) {
      console.error(`[API] No components found or unexpected response format`);
      return [];
    }
    
    const components = Array.isArray(componentsResponse.data) 
      ? componentsResponse.data 
      : [componentsResponse.data];
    
    return components.map((component: any) => ({
      uid: component.uid,
      category: component.category,
      displayName: component.info?.displayName || component.uid.split('.').pop(),
      description: component.info?.description || `${component.uid} component`,
      icon: component.info?.icon
    }));
  } catch (error) {
    console.error(`[Error] Failed to list components:`, error);
    if (axios.isAxiosError(error) && error.response) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to list components: ${error.response.status} - ${JSON.stringify(error.response.data)}`
      );
    }
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to list components: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function getComponentSchema(componentUid: string): Promise<any> {
  try {
    console.error(`[API] Fetching schema for component: ${componentUid}`);
    
    if (!hasAdminCredentials()) {
      throw new ExtendedMcpError(
        ExtendedErrorCode.AccessDenied,
        "Admin credentials are required for component operations"
      );
    }
    
    const adminEndpoint = `/content-type-builder/components/${componentUid}`;
    
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
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to fetch component schema for ${componentUid}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function createComponent(componentData: any): Promise<any> {
  try {
    console.error(`[API] Creating new component`);
    
    if (!hasAdminCredentials()) {
      throw new ExtendedMcpError(
        ExtendedErrorCode.AccessDenied,
        "Admin credentials are required for component operations"
      );
    }
    
    const { displayName, category, icon, attributes } = componentData;
    
    if (!displayName || !category || !attributes) {
      throw new Error("Missing required fields: displayName, category, attributes");
    }
    
    const apiName = displayName.toLowerCase().replace(/\s+/g, '-');
    
    const payload = {
      component: {
        category: category,
        icon: icon || 'brush',
        displayName: displayName,
        attributes: attributes
      }
    };
    
    console.error(`[API] Component creation payload:`, payload);
    
    const adminEndpoint = `/content-type-builder/components`;
    
    const response = await makeAdminApiRequest(adminEndpoint, 'post', payload);
    
    console.error(`[API] Component creation response:`, response);
    
    return response?.data || { message: "Component creation initiated. Strapi might be restarting." };
  } catch (error) {
    console.error(`[Error] Failed to create component:`, error);
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to create component: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function updateComponent(componentUid: string, attributesToUpdate: Record<string, any>): Promise<any> {
  try {
    console.error(`[API] Updating component: ${componentUid}`);
    
    if (!hasAdminCredentials()) {
      throw new ExtendedMcpError(
        ExtendedErrorCode.AccessDenied,
        "Admin credentials are required for component operations"
      );
    }
    
    console.error(`[API] Fetching current schema for ${componentUid}`);
    const currentSchemaData = await getComponentSchema(componentUid);
    
    let currentSchema = currentSchemaData.schema || currentSchemaData;
    if (!currentSchema || !currentSchema.attributes) {
      console.error("[API] Could not retrieve a valid current schema structure.", currentSchemaData);
      throw new Error(`Could not retrieve a valid schema structure for ${componentUid}`);
    }
    
    const updatedAttributes = { ...currentSchema.attributes, ...attributesToUpdate };
    
    const payload = {
      component: {
        ...currentSchema,
        attributes: updatedAttributes
      }
    };
    
    delete payload.component.uid;
    
    console.error(`[API] Component update payload:`, payload);
    
    const adminEndpoint = `/content-type-builder/components/${componentUid}`;
    const response = await makeAdminApiRequest(adminEndpoint, 'put', payload);
    
    console.error(`[API] Component update response:`, response);
    
    return response?.data || { message: `Component ${componentUid} update initiated. Strapi might be restarting.` };
  } catch (error) {
    console.error(`[Error] Failed to update component ${componentUid}:`, error);
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to update component ${componentUid}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}