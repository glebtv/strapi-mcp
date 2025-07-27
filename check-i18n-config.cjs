const axios = require('axios');
const fs = require('fs');
const path = require('path');

async function checkI18nConfig() {
  console.log('Checking i18n configuration...\n');
  
  // Check plugin config
  console.log('1. Checking config/plugins.js:');
  const pluginsPath = path.join(__dirname, 'strapi-test/config/plugins.js');
  if (fs.existsSync(pluginsPath)) {
    const content = fs.readFileSync(pluginsPath, 'utf8');
    console.log(content);
  } else {
    console.log('No plugins.js file found');
  }
  
  // Check if there's an i18n config
  console.log('\n2. Checking for i18n specific config:');
  const i18nConfigPath = path.join(__dirname, 'strapi-test/config/i18n.js');
  if (fs.existsSync(i18nConfigPath)) {
    const content = fs.readFileSync(i18nConfigPath, 'utf8');
    console.log(content);
  } else {
    console.log('No i18n.js config file');
  }
  
  // Check the content type schema
  console.log('\n3. Checking article content type schema:');
  const schemaPath = path.join(__dirname, 'strapi-test/src/api/article/content-types/article/schema.json');
  if (fs.existsSync(schemaPath)) {
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
    console.log(JSON.stringify(schema, null, 2));
  } else {
    console.log('Article schema not found');
  }
  
  // Check API configuration
  const baseUrl = 'http://localhost:1337';
  const testTokens = require('./test-tokens.json');
  const token = testTokens.fullAccessToken;
  
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
  
  console.log('\n4. Checking i18n plugin status via API:');
  try {
    const res = await axios.get(`${baseUrl}/api/i18n/locales`, { headers });
    console.log('i18n is enabled. Locales:', res.data.map(l => l.code).join(', '));
  } catch (e) {
    console.log('i18n plugin might not be enabled:', e.response?.status);
  }
  
  console.log('\n5. Testing locale parameter behavior:');
  
  // Get the latest article
  const articles = await axios.get(`${baseUrl}/api/articles`, { headers });
  if (articles.data.data.length > 0) {
    const article = articles.data.data[0];
    const docId = article.documentId;
    console.log(`Testing with article: ${article.title} (docId: ${docId})`);
    
    // Test different parameter formats
    const tests = [
      { desc: 'Standard locale param', url: `${baseUrl}/api/articles/${docId}?locale=en` },
      { desc: 'Locale in path', url: `${baseUrl}/api/articles/${docId}/en` },
      { desc: 'With _locale param', url: `${baseUrl}/api/articles/${docId}?_locale=en` },
      { desc: 'With plugins[i18n][locale]', url: `${baseUrl}/api/articles/${docId}?plugins[i18n][locale]=en` },
    ];
    
    for (const test of tests) {
      try {
        const res = await axios.get(test.url, { headers });
        console.log(`- ${test.desc}: Returns "${res.data.data.title}"`);
      } catch (e) {
        console.log(`- ${test.desc}: Error ${e.response?.status}`);
      }
    }
  }
  
  console.log('\n6. Check database entries:');
  // In a real scenario, we'd query the database directly
  // For now, let's check what the content-manager returns
  try {
    const loginRes = await axios.post(`${baseUrl}/admin/login`, {
      email: testTokens.adminEmail,
      password: testTokens.adminPassword
    });
    
    const adminJWT = loginRes.data.data.token;
    const adminHeaders = {
      'Authorization': `Bearer ${adminJWT}`,
      'Content-Type': 'application/json'
    };
    
    // Get collection type config
    const configRes = await axios.get(
      `${baseUrl}/content-manager/content-types/api::article.article/configuration`,
      { headers: adminHeaders }
    );
    
    console.log('Content type i18n config:', JSON.stringify(configRes.data.data.contentType.pluginOptions?.i18n, null, 2));
    
  } catch (e) {
    console.log('Could not check admin API:', e.response?.status);
  }
}

checkI18nConfig();