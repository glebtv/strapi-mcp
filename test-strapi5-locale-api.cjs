const axios = require('axios');

async function testStrapi5LocaleAPI() {
  const baseUrl = 'http://localhost:1337';
  const testTokens = require('./test-tokens.json');
  const token = testTokens.fullAccessToken;
  
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  const documentId = 'z5ag6iku3zetgcibauk8n2kv'; // From previous test

  try {
    console.log('Testing Strapi 5 i18n API patterns...\n');
    
    // Test 1: Using locale in query param
    console.log('1. Standard locale query param (?locale=en):');
    try {
      const res1 = await axios.get(`${baseUrl}/api/articles/${documentId}?locale=en`, { headers });
      console.log(`Result: ${res1.data.data.title} (ID: ${res1.data.data.id})`);
    } catch (e) {
      console.log('Error:', e.response?.data?.error || e.message);
    }
    
    // Test 2: Using filters
    console.log('\n2. Using filters[locale][$eq]=en:');
    try {
      const res2 = await axios.get(`${baseUrl}/api/articles?filters[documentId][$eq]=${documentId}&filters[locale][$eq]=en`, { headers });
      console.log('Results:', res2.data.data.length, 'items');
      res2.data.data.forEach(item => console.log(`- ${item.title} (ID: ${item.id})`));
    } catch (e) {
      console.log('Error:', e.response?.data?.error || e.message);
    }
    
    // Test 3: Check if locale is a field we need to populate
    console.log('\n3. Populate locale field:');
    try {
      const res3 = await axios.get(`${baseUrl}/api/articles/${documentId}?populate=locale`, { headers });
      console.log('Result:', JSON.stringify(res3.data.data, null, 2));
    } catch (e) {
      console.log('Error:', e.response?.data?.error || e.message);
    }
    
    // Test 4: Try populate=* to see all fields
    console.log('\n4. Populate all fields:');
    try {
      const res4 = await axios.get(`${baseUrl}/api/articles/${documentId}?populate=*`, { headers });
      console.log('Result:', JSON.stringify(res4.data.data, null, 2));
    } catch (e) {
      console.log('Error:', e.response?.data?.error || e.message);
    }
    
    // Test 5: List all entries with their IDs
    console.log('\n5. List all article entries:');
    try {
      const res5 = await axios.get(`${baseUrl}/api/articles?pagination[limit]=10`, { headers });
      console.log('All articles:');
      res5.data.data.forEach(item => {
        console.log(`- ID: ${item.id}, DocumentID: ${item.documentId}, Title: ${item.title}`);
      });
    } catch (e) {
      console.log('Error:', e.response?.data?.error || e.message);
    }
    
    // Test 6: Try direct ID access
    console.log('\n6. Try accessing by numeric ID:');
    for (const id of [2, 3, 4]) {
      try {
        const res = await axios.get(`${baseUrl}/api/articles/${id}`, { headers });
        console.log(`ID ${id}: ${res.data.data.title}`);
      } catch (e) {
        console.log(`ID ${id}: Not found`);
      }
    }
    
    // Test 7: Check i18n plugin info
    console.log('\n7. Check i18n locales:');
    try {
      const res7 = await axios.get(`${baseUrl}/api/i18n/locales`, { headers });
      console.log('Available locales:', res7.data.map(l => `${l.code} (${l.name})`).join(', '));
    } catch (e) {
      console.log('Error:', e.response?.data?.error || e.message);
    }
    
    // Test 8: Try the content manager API (internal)
    console.log('\n8. Try content-manager API (may require different auth):');
    try {
      const res8 = await axios.get(`${baseUrl}/api/content-manager/collection-types/api::article.article/${documentId}`, { headers });
      console.log('Result:', JSON.stringify(res8.data, null, 2));
    } catch (e) {
      console.log('Error:', e.response?.status, e.response?.data?.error?.message || e.message);
    }

  } catch (error) {
    console.error('General Error:', error.message);
  }
}

testStrapi5LocaleAPI();