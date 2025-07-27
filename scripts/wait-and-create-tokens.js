#!/usr/bin/env node

import axios from 'axios';

async function waitForStrapi(url, maxAttempts = 60) {
  console.log('⏳ Waiting for Strapi to be ready...');
  
  for (let i = 1; i <= maxAttempts; i++) {
    try {
      const response = await axios.get(`${url}/_health`);
      if (response.status === 200 || response.status === 204) {
        console.log('✅ Strapi is ready!');
        return true;
      }
    } catch (error) {
      if (error.response && error.response.status !== 404) {
        console.log('✅ Strapi is responding!');
        return true;
      }
    }
    
    if (i < maxAttempts) {
      process.stdout.write(`Waiting... (${i}/${maxAttempts})\r`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.error('❌ Strapi did not become ready in time');
  return false;
}

async function createAdminIfNeeded(url, email, password) {
  try {
    // Try to login first
    const loginResponse = await axios.post(`${url}/admin/login`, {
      email: email,
      password: password
    });
    console.log('✅ Admin user already exists and can login');
    return loginResponse.data.data.token;
  } catch (error) {
    // If login fails, try to create admin
    try {
      console.log('📝 Creating admin user...');
      const registerResponse = await axios.post(`${url}/admin/register-admin`, {
        firstname: 'Admin',
        lastname: 'User',
        email: email,
        password: password
      });
      console.log('✅ Admin user created successfully');
      return registerResponse.data.data.token;
    } catch (registerError) {
      if (registerError.response?.data?.error?.message) {
        console.error('❌ Failed to create admin:', registerError.response.data.error.message);
      } else {
        console.error('❌ Failed to create admin:', registerError.message);
      }
      throw registerError;
    }
  }
}

async function createTokensWithPermissions(url, adminToken) {
  const adminHeaders = {
    'Authorization': `Bearer ${adminToken}`,
    'Content-Type': 'application/json'
  };

  const tokens = [];

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
    const tokenResponse = await axios.post(`${url}/admin/api-tokens`, fullAccessPayload, {
      headers: adminHeaders
    });
    
    const fullAccessToken = tokenResponse.data.data.accessKey;
    tokens.push({
      name: 'CI/CD Full Access',
      token: fullAccessToken,
      envVar: 'CI_CD_FULL_ACCESS_TOKEN'
    });
    
    console.log('✅ Created token: CI/CD Full Access');
    console.log(`🔑 Access Key: ${fullAccessToken}`);
  } catch (error) {
    if (error.response?.data?.error?.message?.includes('already exists')) {
      console.log('⚠️  Token "CI/CD Full Access" already exists');
      // Get existing token
      const tokensResponse = await axios.get(`${url}/admin/api-tokens`, {
        headers: adminHeaders
      });
      const existingToken = tokensResponse.data.data.find(t => t.name === 'CI/CD Full Access');
      if (existingToken) {
        console.log('⚠️  Using existing token ID:', existingToken.id);
      }
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
    const tokenResponse = await axios.post(`${url}/admin/api-tokens`, readOnlyPayload, {
      headers: adminHeaders
    });
    
    const readOnlyToken = tokenResponse.data.data.accessKey;
    tokens.push({
      name: 'Testing Read Only',
      token: readOnlyToken,
      envVar: 'TESTING_READ_ONLY_TOKEN'
    });
    
    console.log('✅ Created token: Testing Read Only');
    console.log(`🔑 Access Key: ${readOnlyToken}`);
  } catch (error) {
    if (error.response?.data?.error?.message?.includes('already exists')) {
      console.log('⚠️  Token "Testing Read Only" already exists');
    } else {
      throw error;
    }
  }

  return tokens;
}

async function createI18nLocales(url, adminToken) {
  console.log('\n🌍 Setting up i18n locales...');
  
  const adminHeaders = {
    'Authorization': `Bearer ${adminToken}`,
    'Content-Type': 'application/json'
  };

  // Check current locales
  try {
    const localesResponse = await axios.get(`${url}/i18n/locales`, {
      headers: adminHeaders
    });
    
    const existingLocales = localesResponse.data.map(locale => locale.code);
    console.log('📋 Existing locales:', existingLocales.join(', '));
    
    // Add Russian locale if not exists
    if (!existingLocales.includes('ru')) {
      console.log('🔤 Creating Russian locale...');
      await axios.post(`${url}/i18n/locales`, {
        code: 'ru',
        name: 'Russian',
        isDefault: false
      }, {
        headers: adminHeaders
      });
      console.log('✅ Russian locale created');
    }
    
    // Add Chinese locale if not exists
    if (!existingLocales.includes('zh')) {
      console.log('🔤 Creating Chinese locale...');
      await axios.post(`${url}/i18n/locales`, {
        code: 'zh',
        name: 'Chinese',
        isDefault: false
      }, {
        headers: adminHeaders
      });
      console.log('✅ Chinese locale created');
    }
    
    console.log('✅ i18n locales setup complete');
  } catch (error) {
    console.error('⚠️  Failed to setup i18n locales:', error.response?.data?.error?.message || error.message);
    // Non-fatal error, continue
  }
}

async function main() {
  const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1337';
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@ci.local';
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin123456';

  try {
    // Wait for Strapi to be ready
    const isReady = await waitForStrapi(STRAPI_URL);
    if (!isReady) {
      process.exit(1);
    }

    // Create admin if needed and get token
    const adminToken = await createAdminIfNeeded(STRAPI_URL, ADMIN_EMAIL, ADMIN_PASSWORD);

    // Create API tokens with permissions
    const tokens = await createTokensWithPermissions(STRAPI_URL, adminToken);

    // Setup i18n locales
    await createI18nLocales(STRAPI_URL, adminToken);

    // Output tokens for CI
    console.log('\n📝 Token Summary:');
    tokens.forEach(({ name, token, envVar }) => {
      console.log(`export ${envVar}="${token}"`);
    });

    // Save to test-tokens.json if we have tokens
    if (tokens.length > 0) {
      const fs = await import('fs');
      const tokenData = {
        fullAccessToken: tokens.find(t => t.envVar === 'CI_CD_FULL_ACCESS_TOKEN')?.token || '',
        readOnlyToken: tokens.find(t => t.envVar === 'TESTING_READ_ONLY_TOKEN')?.token || '',
        strapiUrl: STRAPI_URL,
        adminEmail: ADMIN_EMAIL,
        adminPassword: ADMIN_PASSWORD
      };
      
      fs.writeFileSync('test-tokens.json', JSON.stringify(tokenData, null, 2));
      console.log('\n✅ Tokens saved to test-tokens.json');
    }

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  }
}

// Run the script
main();