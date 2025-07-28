import { config, validateConfig } from "../config/index.js";
import { makeAdminApiRequest } from "./client.js";
import { ExtendedMcpError, ExtendedErrorCode } from "../errors/index.js";
import { logger } from "../utils/index.js";
import axios from "axios";

export interface Permission {
  action: string;
  subject?: string;
  properties?: {
    fields?: string[];
    locales?: string[];
  };
  conditions?: any[];
}

export interface RolePermissions {
  roleId: number;
  roleName: string;
  permissions: Permission[];
}

/**
 * Get all roles in the system
 */
export async function getRoles(): Promise<any[]> {
  validateConfig();

  if (!config.strapi.adminEmail || !config.strapi.adminPassword) {
    throw new ExtendedMcpError(
      ExtendedErrorCode.AccessDenied,
      "Admin credentials are required for permission management"
    );
  }

  try {
    // Use the correct endpoint for roles
    const endpoint = "/users-permissions/roles";
    logger.debug(`[API] Getting roles from ${endpoint}...`);
    const response = await makeAdminApiRequest(endpoint);
    logger.debug(`[API] Got roles response:`, JSON.stringify(response, null, 2));

    // Handle different response structures
    if (response && typeof response === "object") {
      if (Array.isArray(response.roles)) {
        return response.roles;
      } else if (Array.isArray(response)) {
        return response;
      } else if (response.data && Array.isArray(response.data)) {
        return response.data;
      }
    }

    logger.debug("[API] Unexpected roles response structure:", response);
    return [];
  } catch (error: any) {
    logger.error("[Error] Failed to get roles:", error.message);
    if (error.response) {
      logger.error("[Error] Response status:", error.response.status);
      logger.error("[Error] Response data:", error.response.data);
    }
    throw new ExtendedMcpError(
      ExtendedErrorCode.InternalError,
      `Failed to get roles: ${error.message}`
    );
  }
}

/**
 * Get permissions for a specific role
 */
export async function getRolePermissions(roleId: number): Promise<any> {
  validateConfig();

  if (!config.strapi.adminEmail || !config.strapi.adminPassword) {
    throw new ExtendedMcpError(
      ExtendedErrorCode.AccessDenied,
      "Admin credentials are required for permission management"
    );
  }

  try {
    // Use the correct endpoint for role details
    const endpoint = `/users-permissions/roles/${roleId}`;
    const response = await makeAdminApiRequest(endpoint);
    logger.debug(`[API] Got role permissions from ${endpoint}:`, response);
    return response.role || response || {};
  } catch (error: any) {
    logger.error("[Error] Failed to get role permissions:", error);
    throw new ExtendedMcpError(
      ExtendedErrorCode.InternalError,
      `Failed to get role permissions: ${error.message}`
    );
  }
}

/**
 * Update permissions for a content type
 */
export async function updateContentTypePermissions(
  contentType: string,
  permissions: {
    public?: {
      find?: boolean;
      findOne?: boolean;
      create?: boolean;
      update?: boolean;
      delete?: boolean;
    };
    authenticated?: {
      find?: boolean;
      findOne?: boolean;
      create?: boolean;
      update?: boolean;
      delete?: boolean;
    };
  }
): Promise<any> {
  validateConfig();

  if (!config.strapi.adminEmail || !config.strapi.adminPassword) {
    throw new ExtendedMcpError(
      ExtendedErrorCode.AccessDenied,
      "Admin credentials are required for permission management"
    );
  }

  try {
    logger.debug(`[API] Updating permissions for content type: ${contentType}`);

    // Get all roles
    const roles = await getRoles();
    const publicRole = roles.find((r) => r.type === "public");
    const authenticatedRole = roles.find((r) => r.type === "authenticated");

    const results: any = {};

    // Update public role permissions
    if (publicRole && permissions.public) {
      logger.debug(`[API] Updating public role permissions for ${contentType}`);
      results.public = await updateRolePermissions(publicRole.id, contentType, permissions.public);
    }

    // Update authenticated role permissions
    if (authenticatedRole && permissions.authenticated) {
      logger.debug(`[API] Updating authenticated role permissions for ${contentType}`);
      results.authenticated = await updateRolePermissions(
        authenticatedRole.id,
        contentType,
        permissions.authenticated
      );
    }

    return results;
  } catch (error: any) {
    logger.error("[Error] Failed to update content type permissions:", error);

    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const errorData = error.response?.data;

      throw new ExtendedMcpError(
        ExtendedErrorCode.InternalError,
        `Failed to update permissions: ${status} - ${JSON.stringify(errorData)}`
      );
    }

    throw new ExtendedMcpError(
      ExtendedErrorCode.InternalError,
      `Failed to update content type permissions: ${error.message}`
    );
  }
}

/**
 * Update permissions for a specific role
 */
async function updateRolePermissions(
  roleId: number,
  contentType: string,
  permissions: {
    find?: boolean;
    findOne?: boolean;
    create?: boolean;
    update?: boolean;
    delete?: boolean;
  }
): Promise<any> {
  try {
    // Get current role permissions
    const roleData = await getRolePermissions(roleId);

    // Extract the API name from content type (e.g., "api::doc.doc" -> "doc")
    const apiName = contentType.split("::")[1]?.split(".")[0];
    if (!apiName) {
      throw new Error(`Invalid content type format: ${contentType}`);
    }

    // Build the permissions object with the correct Strapi 5 structure
    const updatedPermissions = roleData.permissions ? { ...roleData.permissions } : {};

    // For content types, we need to use the format: api::singular.singular
    // But the key in permissions is api::singular (without the second part)
    const permissionKey = `api::${apiName}`;

    // Initialize the content type permissions structure if it doesn't exist
    if (!updatedPermissions[permissionKey]) {
      updatedPermissions[permissionKey] = {
        controllers: {},
      };
    }

    if (!updatedPermissions[permissionKey].controllers) {
      updatedPermissions[permissionKey].controllers = {};
    }

    if (!updatedPermissions[permissionKey].controllers[apiName]) {
      updatedPermissions[permissionKey].controllers[apiName] = {};
    }

    // Update the specific actions
    const actions = updatedPermissions[permissionKey].controllers[apiName];

    if (permissions.find !== undefined) {
      actions.find = {
        enabled: permissions.find,
        policy: "",
      };
    }
    if (permissions.findOne !== undefined) {
      actions.findOne = {
        enabled: permissions.findOne,
        policy: "",
      };
    }
    if (permissions.create !== undefined) {
      actions.create = {
        enabled: permissions.create,
        policy: "",
      };
    }
    if (permissions.update !== undefined) {
      actions.update = {
        enabled: permissions.update,
        policy: "",
      };
    }
    if (permissions.delete !== undefined) {
      actions.delete = {
        enabled: permissions.delete,
        policy: "",
      };
    }

    // Update the role with new permissions using the correct Strapi 5 endpoint
    const endpoint = `/users-permissions/roles/${roleId}`;
    const payload = {
      name: roleData.name,
      description: roleData.description,
      permissions: updatedPermissions,
      users: roleData.users || [],
    };

    logger.debug(
      `[API] Updating role ${roleId} with permissions:`,
      JSON.stringify(permissions, null, 2)
    );
    logger.debug(`[API] Full payload:`, JSON.stringify(payload, null, 2));

    const response = await makeAdminApiRequest(endpoint, "put", payload);
    logger.debug(`[API] Successfully updated role via ${endpoint}`);
    return response;
  } catch (error: any) {
    logger.error(`[Error] Failed to update role ${roleId} permissions:`, error);
    throw error;
  }
}
