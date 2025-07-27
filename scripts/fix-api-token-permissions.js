#!/usr/bin/env node

// Script to fix API token permissions in Strapi 5
// This assigns full permissions to the CI/CD Full Access token

import axios from 'axios';

async function fixTokenPermissions() {
  const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1337';
  const ADMIN_EMAIL = process.env.STRAPI_ADMIN_EMAIL || 'admin@ci.local';
  const ADMIN_PASSWORD = process.env.STRAPI_ADMIN_PASSWORD || 'admin123456';

  try {
    // Login as admin
    console.log('🔑 Logging in as admin...');
    const loginResponse = await axios.post(`${STRAPI_URL}/admin/login`, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    });

    const adminToken = loginResponse.data.data.token;
    const adminHeaders = {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    };

    // Get all API tokens
    console.log('📋 Fetching API tokens...');
    const tokensResponse = await axios.get(`${STRAPI_URL}/admin/api-tokens`, {
      headers: adminHeaders
    });

    const tokens = tokensResponse.data.data;
    const fullAccessToken = tokens.find(t => t.name === 'CI/CD Full Access');

    if (!fullAccessToken) {
      console.error('❌ CI/CD Full Access token not found!');
      return;
    }

    console.log(`✅ Found CI/CD Full Access token (ID: ${fullAccessToken.id})`);

    // Get all permissions
    console.log('📋 Fetching available permissions...');
    const permissionsResponse = await axios.get(`${STRAPI_URL}/admin/users/permissions`, {
      headers: adminHeaders
    });

    // Strapi 5 permissions structure
    const permissions = [];
    
    // Add permissions for all content types
    const contentTypes = ['project', 'technology'];
    const actions = ['find', 'findOne', 'create', 'update', 'delete'];

    for (const contentType of contentTypes) {
      for (const action of actions) {
        permissions.push({
          action: `api::${contentType}.${contentType}.${action}`
        });
      }
    }

    // Add upload permissions
    permissions.push(
      { action: 'plugin::upload.content-api.find' },
      { action: 'plugin::upload.content-api.findOne' },
      { action: 'plugin::upload.content-api.upload' },
      { action: 'plugin::upload.content-api.destroy' }
    );

    // Add i18n permissions if needed
    permissions.push(
      { action: 'plugin::i18n.locales.listLocales' }
    );

    // Update token with permissions
    console.log('🔧 Updating token permissions...');
    const updateResponse = await axios.put(
      `${STRAPI_URL}/admin/api-tokens/${fullAccessToken.id}`,
      {
        name: fullAccessToken.name,
        description: fullAccessToken.description,
        type: 'custom',
        permissions: permissions
      },
      { headers: adminHeaders }
    );

    console.log('✅ Token permissions updated successfully!');
    console.log(`📋 Assigned ${permissions.length} permissions to the token`);

  } catch (error) {
    console.error('❌ Error fixing token permissions:', error.response?.data || error.message);
    process.exit(1);
  }
}

// Run the script
fixTokenPermissions();