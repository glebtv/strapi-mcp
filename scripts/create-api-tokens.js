#!/usr/bin/env node

import axios from 'axios';

async function createApiTokens() {
  const STRAPI_URL = 'http://localhost:1337';
  const ADMIN_EMAIL = 'admin@ci.local';
  const ADMIN_PASSWORD = 'Admin123456';

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

    // Create Full Access Token
    console.log('📋 Creating CI/CD Full Access token...');
    
    const fullAccessPayload = {
      name: 'CI/CD Full Access',
      description: 'Full access token for CI/CD pipelines',
      type: 'custom',
      permissions: [
        // Project permissions
        'api::project.project.find',
        'api::project.project.findOne',
        'api::project.project.create',
        'api::project.project.update',
        'api::project.project.delete',
        // Technology permissions
        'api::technology.technology.find',
        'api::technology.technology.findOne',
        'api::technology.technology.create',
        'api::technology.technology.update',
        'api::technology.technology.delete',
        // Upload permissions
        'plugin::upload.content-api.find',
        'plugin::upload.content-api.findOne',
        'plugin::upload.content-api.upload',
        'plugin::upload.content-api.destroy',
        // i18n permissions
        'plugin::i18n.locales.listLocales'
      ],
      lifespan: null,
      expiresAt: null
    };

    try {
      const tokenResponse = await axios.post(`${STRAPI_URL}/admin/api-tokens`, fullAccessPayload, {
        headers: adminHeaders
      });
      
      console.log('✅ Created token: CI/CD Full Access');
      console.log(`🔑 Access Key: ${tokenResponse.data.data.accessKey}`);
      console.log(`📝 Export: export CI_CD_FULL_ACCESS_TOKEN="${tokenResponse.data.data.accessKey}"`);
    } catch (error) {
      if (error.response?.data?.error?.message?.includes('already exists')) {
        console.log('⚠️  Token "CI/CD Full Access" already exists');
      } else {
        throw error;
      }
    }

    // Create Read Only Token
    console.log('📋 Creating Testing Read Only token...');
    
    const readOnlyPayload = {
      name: 'Testing Read Only',
      description: 'Read-only token for automated testing',
      type: 'read-only',
      lifespan: null,
      expiresAt: null
    };

    try {
      const tokenResponse = await axios.post(`${STRAPI_URL}/admin/api-tokens`, readOnlyPayload, {
        headers: adminHeaders
      });
      
      console.log('✅ Created token: Testing Read Only');
      console.log(`🔑 Access Key: ${tokenResponse.data.data.accessKey}`);
      console.log(`📝 Export: export TESTING_READ_ONLY_TOKEN="${tokenResponse.data.data.accessKey}"`);
    } catch (error) {
      if (error.response?.data?.error?.message?.includes('already exists')) {
        console.log('⚠️  Token "Testing Read Only" already exists');
      } else {
        throw error;
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    process.exit(1);
  }
}

// Run the script
createApiTokens();