#!/usr/bin/env node

// Using fetch instead of axios for better compatibility

async function waitForStrapi(url, maxAttempts = null) {
  // Use different timeouts for CI and local
  if (!maxAttempts) {
    maxAttempts = process.env.CI ? 180 : 60; // 3 minutes for CI, 1 minute for local
  }
  console.log(`⏳ Waiting for Strapi to be ready (max ${maxAttempts} seconds)...`);
  
  // Check if we have the PID to monitor process
  const strapiPid = process.env.STRAPI_PID;
  
  for (let i = 1; i <= maxAttempts; i++) {
    // First check if Strapi process is still running
    if (strapiPid) {
      try {
        // Check if process exists (kill -0 doesn't actually kill)
        process.kill(parseInt(strapiPid), 0);
      } catch (error) {
        console.error('\n❌ Strapi process crashed!');
        
        // Try to read the logs
        const fs = await import('fs');
        const path = await import('path');
        const logPath = path.join(process.cwd(), 'strapi-test/strapi_output.log');
        
        if (fs.existsSync(logPath)) {
          console.error('\n=== Last 50 lines of Strapi logs ===');
          const logs = fs.readFileSync(logPath, 'utf8');
          const lines = logs.split('\n');
          const lastLines = lines.slice(-50).join('\n');
          console.error(lastLines);
          console.error('=== End of logs ===\n');
        }
        
        return false;
      }
    }
    
    try {
      // Try multiple endpoints since _health might not be available in development
      const endpoints = [
        { url: `${url}/_health`, name: 'health' },
        { url: `${url}/admin`, name: 'admin' },
        { url: `${url}/api`, name: 'api' }
      ];
      
      for (const endpoint of endpoints) {
        try {
          const response = await fetch(endpoint.url);
          if (response.status === 200 || response.status === 204 || response.status === 301 || response.status === 302) {
            console.log(`✅ Strapi is ready! (${endpoint.name} endpoint responded)`);
            return true;
          }
        } catch (e) {
          // Try next endpoint
        }
      }
    } catch (error) {
      // Network errors mean Strapi isn't ready yet
      // Continue waiting
    }
    
    if (i < maxAttempts) {
      process.stdout.write(`Waiting... (${i}/${maxAttempts})\r`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.error('❌ Strapi did not become ready in time');
  
  // Show logs on timeout too
  const fs = await import('fs');
  const path = await import('path');
  const logPath = path.join(process.cwd(), 'strapi-test/strapi_output.log');
  
  if (fs.existsSync(logPath)) {
    console.error('\n=== Last 50 lines of Strapi logs ===');
    const logs = fs.readFileSync(logPath, 'utf8');
    const lines = logs.split('\n');
    const lastLines = lines.slice(-50).join('\n');
    console.error(lastLines);
    console.error('=== End of logs ===\n');
  }
  
  return false;
}

async function createAdminIfNeeded(url, email, password) {
  try {
    // Try to login first
    const loginResponse = await fetch(`${url}/admin/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: email,
        password: password
      })
    });
    
    if (loginResponse.ok) {
      const data = await loginResponse.json();
      console.log('✅ Admin user already exists and can login');
      return data.data.token;
    } else {
      throw new Error('Login failed');
    }
  } catch (error) {
    // If login fails, try to create admin
    try {
      console.log('📝 Creating admin user...');
      const registerResponse = await fetch(`${url}/admin/register-admin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          firstname: 'Admin',
          lastname: 'User',
          email: email,
          password: password
        })
      });
      
      if (registerResponse.ok) {
        const data = await registerResponse.json();
        console.log('✅ Admin user created successfully');
        return data.data.token;
      } else {
        const errorData = await registerResponse.json();
        const errorMessage = errorData?.error?.message || registerResponse.statusText;
        console.error('❌ Failed to create admin:', errorMessage);
        throw new Error(errorMessage);
      }
    } catch (registerError) {
      console.error('❌ Failed to create admin:', registerError.message);
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
    const tokenResponse = await fetch(`${url}/admin/api-tokens`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify(fullAccessPayload)
    });
    
    if (tokenResponse.ok) {
      const data = await tokenResponse.json();
      const fullAccessToken = data.data.accessKey;
      tokens.push({
        name: 'CI/CD Full Access',
        token: fullAccessToken,
        envVar: 'CI_CD_FULL_ACCESS_TOKEN'
      });
      
      console.log('✅ Created token: CI/CD Full Access');
      console.log(`🔑 Access Key: ${fullAccessToken}`);
    } else {
      const errorData = await tokenResponse.json();
      if (errorData?.error?.message?.includes('already exists') || errorData?.error?.message?.includes('already taken')) {
        console.log('⚠️  Token "CI/CD Full Access" already exists, fetching existing token...');
        // Get existing token
        const tokensResponse = await fetch(`${url}/admin/api-tokens`, {
          headers: adminHeaders
        });
        const tokensData = await tokensResponse.json();
        const existingToken = tokensData.data.find(t => t.name === 'CI/CD Full Access');
        if (existingToken) {
          console.log('✅ Found existing token');
          tokens.push({
            name: 'CI/CD Full Access',
            token: existingToken.accessKey,
            envVar: 'CI_CD_FULL_ACCESS_TOKEN'
          });
        }
      } else {
        throw new Error(errorData?.error?.message || tokenResponse.statusText);
      }
    }
  } catch (error) {
    throw error;
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
    const tokenResponse = await fetch(`${url}/admin/api-tokens`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify(readOnlyPayload)
    });
    
    if (tokenResponse.ok) {
      const data = await tokenResponse.json();
      const readOnlyToken = data.data.accessKey;
      tokens.push({
        name: 'Testing Read Only',
        token: readOnlyToken,
        envVar: 'TESTING_READ_ONLY_TOKEN'
      });
      
      console.log('✅ Created token: Testing Read Only');
      console.log(`🔑 Access Key: ${readOnlyToken}`);
    } else {
      const errorData = await tokenResponse.json();
      if (errorData?.error?.message?.includes('already exists') || errorData?.error?.message?.includes('already taken')) {
        console.log('⚠️  Token "Testing Read Only" already exists, fetching existing token...');
        // Get existing token
        const tokensResponse = await fetch(`${url}/admin/api-tokens`, {
          headers: adminHeaders
        });
        const tokensData = await tokensResponse.json();
        const existingToken = tokensData.data.find(t => t.name === 'Testing Read Only');
        if (existingToken) {
          console.log('✅ Found existing token');
          tokens.push({
            name: 'Testing Read Only',
            token: existingToken.accessKey,
            envVar: 'TESTING_READ_ONLY_TOKEN'
          });
        }
      } else {
        throw new Error(errorData?.error?.message || tokenResponse.statusText);
      }
    }
  } catch (error) {
    throw error;
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
    const localesResponse = await fetch(`${url}/i18n/locales`, {
      headers: adminHeaders
    });
    
    if (localesResponse.ok) {
      const localesData = await localesResponse.json();
      const existingLocales = localesData.map(locale => locale.code);
      console.log('📋 Existing locales:', existingLocales.join(', '));
      
      // Add Russian locale if not exists
      if (!existingLocales.includes('ru')) {
        console.log('🔤 Creating Russian locale...');
        const ruResponse = await fetch(`${url}/i18n/locales`, {
          method: 'POST',
          headers: adminHeaders,
          body: JSON.stringify({
            code: 'ru',
            name: 'Russian',
            isDefault: false
          })
        });
        
        if (ruResponse.ok) {
          console.log('✅ Russian locale created');
        } else {
          const errorData = await ruResponse.json();
          console.error('❌ Failed to create Russian locale:', errorData?.error?.message || ruResponse.statusText);
        }
      }
      
      // Add Chinese locale if not exists
      if (!existingLocales.includes('zh')) {
        console.log('🔤 Creating Chinese locale...');
        const zhResponse = await fetch(`${url}/i18n/locales`, {
          method: 'POST',
          headers: adminHeaders,
          body: JSON.stringify({
            code: 'zh',
            name: 'Chinese',
            isDefault: false
          })
        });
        
        if (zhResponse.ok) {
          console.log('✅ Chinese locale created');
        } else {
          const errorData = await zhResponse.json();
          console.error('❌ Failed to create Chinese locale:', errorData?.error?.message || zhResponse.statusText);
        }
      }
    } else {
      console.error('❌ Failed to fetch locales:', localesResponse.statusText);
    }
    
    console.log('✅ i18n locales setup complete');
  } catch (error) {
    console.error('⚠️  Failed to setup i18n locales:', error.message);
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