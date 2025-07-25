#!/usr/bin/env node

const API_TOKEN = process.env.STRAPI_API_TOKEN;
const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1337';

if (!API_TOKEN) {
  console.error('❌ STRAPI_API_TOKEN environment variable is required');
  process.exit(1);
}

async function debugContentTypes() {
  console.log('🔍 Debugging Strapi Content Types...\n');

  try {
    // Check content-type-builder API
    console.log('📋 Fetching content types from content-type-builder...');
    const ctbResponse = await fetch(`${STRAPI_URL}/api/content-type-builder/content-types`, {
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`
      }
    });

    if (!ctbResponse.ok) {
      console.error(`❌ Content-type-builder API failed: ${ctbResponse.status} ${ctbResponse.statusText}`);
      const text = await ctbResponse.text();
      console.error('Response:', text);
    } else {
      const contentTypes = await ctbResponse.json();
      console.log(`✅ Found ${contentTypes.data.length} content types`);
      
      // Filter for our custom content types
      const customTypes = contentTypes.data.filter(ct => ct.uid.startsWith('api::'));
      console.log(`\n📦 Custom API content types (${customTypes.length}):`);
      customTypes.forEach(ct => {
        console.log(`  - ${ct.uid} (${ct.schema.displayName})`);
        console.log(`    Collection: ${ct.schema.collectionName}`);
        console.log(`    Draft & Publish: ${ct.schema.options?.draftAndPublish || false}`);
      });
    }

    // Try to access the projects endpoint directly
    console.log('\n🧪 Testing /api/projects endpoint...');
    const projectsResponse = await fetch(`${STRAPI_URL}/api/projects`, {
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`
      }
    });

    console.log(`Response status: ${projectsResponse.status} ${projectsResponse.statusText}`);
    
    if (projectsResponse.ok) {
      const data = await projectsResponse.json();
      console.log('✅ Projects endpoint accessible');
      console.log(`Found ${data.data?.length || 0} projects`);
    } else {
      console.log('❌ Projects endpoint returned error');
      const text = await projectsResponse.text();
      console.log('Response body:', text);
    }

    // Check available routes
    console.log('\n🛣️  Checking available API routes...');
    const routesResponse = await fetch(`${STRAPI_URL}/api`, {
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`
      }
    });

    if (routesResponse.ok) {
      const text = await routesResponse.text();
      console.log('API root response:', text.substring(0, 200) + '...');
    }

    // Check Strapi admin API for content types
    console.log('\n🔧 Checking admin API for content types...');
    const adminTypesResponse = await fetch(`${STRAPI_URL}/admin/content-manager/content-types`, {
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`
      }
    });

    if (adminTypesResponse.ok) {
      const adminTypes = await adminTypesResponse.json();
      console.log('✅ Admin API content types accessible');
      const apiTypes = adminTypes.data?.filter(t => t.uid.startsWith('api::')) || [];
      console.log(`Found ${apiTypes.length} API content types in admin`);
      apiTypes.forEach(t => {
        console.log(`  - ${t.uid}`);
      });
    } else {
      console.log(`❌ Admin API failed: ${adminTypesResponse.status}`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }
}

debugContentTypes();