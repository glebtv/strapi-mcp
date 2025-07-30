#!/usr/bin/env node

/**
 * Simple script to configure public permissions for test content types
 * This allows REST API access without authentication
 * Uses Strapi's REST API instead of direct database access
 */

// Use native fetch (available in Node.js 18+)

const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1337';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || process.env.STRAPI_ADMIN_EMAIL || 'admin@ci.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || process.env.STRAPI_ADMIN_PASSWORD || 'Admin123456';

console.log('🔓 Configuring public permissions for test content types...');
console.log(`📡 Strapi URL: ${STRAPI_URL}`);

async function authenticateAdmin() {
  try {
    const response = await fetch(`${STRAPI_URL}/admin/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
      }),
    });

    if (!response.ok) {
      throw new Error(`Authentication failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.data.token;
  } catch (error) {
    console.error('❌ Failed to authenticate:', error.message);
    throw error;
  }
}

async function configurePermissions(token) {
  try {
    // First, get the public role from Users & Permissions plugin
    const rolesResponse = await fetch(`${STRAPI_URL}/admin/users-permissions/roles`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!rolesResponse.ok) {
      throw new Error(`Failed to fetch roles: ${rolesResponse.status}`);
    }

    const rolesData = await rolesResponse.json();
    console.log('Roles response:', JSON.stringify(rolesData, null, 2));
    
    // Handle different response structures
    const roles = Array.isArray(rolesData) ? rolesData : (rolesData.data || rolesData.roles || []);
    const publicRole = roles.find(role => role.type === 'public' || role.code === 'strapi-public');

    if (!publicRole) {
      console.error('Available roles:', roles.map(r => ({ id: r.id, type: r.type, code: r.code, name: r.name })));
      throw new Error('Public role not found');
    }

    console.log(`✅ Found public role with ID: ${publicRole.id}`);

    // Define permissions to grant
    const permissions = {
      'api::project.project': ['find', 'findOne', 'create', 'update', 'delete'],
      'api::technology.technology': ['find', 'findOne', 'create', 'update', 'delete'],
      'plugin::upload': ['find', 'findOne', 'upload', 'destroy'],
    };

    // Get current permissions for the public role
    const roleDetailsResponse = await fetch(`${STRAPI_URL}/admin/users-permissions/roles/${publicRole.id}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!roleDetailsResponse.ok) {
      throw new Error(`Failed to fetch role details: ${roleDetailsResponse.status}`);
    }

    const roleDetails = await roleDetailsResponse.json();
    
    // Update permissions
    const updatedPermissions = { ...roleDetails.data.permissions };

    // Grant permissions
    for (const [controller, actions] of Object.entries(permissions)) {
      if (!updatedPermissions[controller]) {
        updatedPermissions[controller] = { controllers: {} };
      }
      
      const controllerName = controller.split('.').pop();
      if (!updatedPermissions[controller].controllers[controllerName]) {
        updatedPermissions[controller].controllers[controllerName] = {};
      }

      for (const action of actions) {
        updatedPermissions[controller].controllers[controllerName][action] = {
          enabled: true,
          policy: ''
        };
        console.log(`✅ Granting permission: ${controller}.${action}`);
      }
    }

    // Update the role with new permissions
    const updateResponse = await fetch(`${STRAPI_URL}/admin/users-permissions/roles/${publicRole.id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...roleDetails.data,
        permissions: updatedPermissions,
      }),
    });

    if (!updateResponse.ok) {
      const errorData = await updateResponse.text();
      throw new Error(`Failed to update role: ${updateResponse.status} - ${errorData}`);
    }

    console.log('\n✅ Public permissions configured successfully!');
  } catch (error) {
    console.error('❌ Error configuring permissions:', error);
    throw error;
  }
}

// Main execution
(async () => {
  try {
    console.log('🔐 Authenticating as admin...');
    const token = await authenticateAdmin();
    console.log('✅ Authentication successful');

    await configurePermissions(token);
    process.exit(0);
  } catch (error) {
    console.error('❌ Script failed:', error.message);
    process.exit(1);
  }
})();