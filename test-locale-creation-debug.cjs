const axios = require('axios');

async function debugLocaleCreation() {
  const baseUrl = 'http://localhost:1337';
  const testTokens = require('./test-tokens.json');
  const token = testTokens.fullAccessToken;
  
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  try {
    // Create a fresh article in English
    console.log('1. Creating new English article...');
    const createRes = await axios.post(`${baseUrl}/api/articles`, {
      data: {
        title: 'Debug Article EN',
        content: 'English content',
        slug: 'debug-article-en'
      }
    }, { headers });
    
    const documentId = createRes.data.data.documentId;
    const enId = createRes.data.data.id;
    console.log(`Created EN: documentId=${documentId}, id=${enId}`);
    console.log('Full response:', JSON.stringify(createRes.data.data, null, 2));
    
    // List all articles after English creation
    console.log('\n2. List all articles after EN creation:');
    const list1 = await axios.get(`${baseUrl}/api/articles`, { headers });
    console.log('Total articles:', list1.data.data.length);
    list1.data.data.forEach(a => {
      console.log(`- ID: ${a.id}, DocID: ${a.documentId}, Title: ${a.title}`);
    });
    
    // Try different methods to create Russian version
    console.log('\n3. Creating Russian version with PUT to documentId + locale...');
    try {
      const ruRes = await axios.put(`${baseUrl}/api/articles/${documentId}?locale=ru`, {
        data: {
          title: 'Debug Article RU',
          content: 'Russian content',
          slug: 'debug-article-ru'
        }
      }, { headers });
      console.log(`Created RU: id=${ruRes.data.data.id}`);
      console.log('Full response:', JSON.stringify(ruRes.data.data, null, 2));
    } catch (e) {
      console.log('PUT with locale failed:', e.response?.data || e.message);
    }
    
    // List all articles after Russian creation
    console.log('\n4. List all articles after RU creation:');
    const list2 = await axios.get(`${baseUrl}/api/articles`, { headers });
    console.log('Total articles:', list2.data.data.length);
    list2.data.data.forEach(a => {
      console.log(`- ID: ${a.id}, DocID: ${a.documentId}, Title: ${a.title}`);
    });
    
    // Try POST with locale parameter
    console.log('\n5. Try POST with locale=zh...');
    try {
      const zhRes = await axios.post(`${baseUrl}/api/articles?locale=zh`, {
        data: {
          title: 'Debug Article ZH',
          content: 'Chinese content',
          slug: 'debug-article-zh',
          // Try including the documentId
          documentId: documentId
        }
      }, { headers });
      console.log(`Created ZH: id=${zhRes.data.data.id}`);
      console.log('Full response:', JSON.stringify(zhRes.data.data, null, 2));
    } catch (e) {
      console.log('POST with locale failed:', e.response?.data || e.message);
    }
    
    // Final list
    console.log('\n6. Final list of all articles:');
    const list3 = await axios.get(`${baseUrl}/api/articles?pagination[limit]=100`, { headers });
    console.log('Total articles:', list3.data.data.length);
    list3.data.data.forEach(a => {
      console.log(`- ID: ${a.id}, DocID: ${a.documentId}, Title: ${a.title}`);
    });
    
    // Check if we can access by ID
    console.log('\n7. Try to access each by numeric ID:');
    for (const id of [enId, enId + 1, enId + 2]) {
      try {
        // First try the REST API with ID
        const resById = await axios.get(`${baseUrl}/api/articles/${id}`, { headers });
        console.log(`REST API ID ${id}: Found - ${resById.data.data.title}`);
      } catch (e) {
        // Then try with filters
        try {
          const resByFilter = await axios.get(`${baseUrl}/api/articles?filters[id][$eq]=${id}`, { headers });
          if (resByFilter.data.data.length > 0) {
            console.log(`Filter ID ${id}: Found - ${resByFilter.data.data[0].title}`);
          } else {
            console.log(`ID ${id}: Not found`);
          }
        } catch (e2) {
          console.log(`ID ${id}: Error - ${e2.response?.status}`);
        }
      }
    }
    
    // Try Strapi's internal content-manager API
    console.log('\n8. Check via content-manager API endpoints:');
    try {
      const adminToken = testTokens.adminToken || token;
      const adminHeaders = { ...headers, 'Authorization': `Bearer ${adminToken}` };
      
      // First login to admin if needed
      const loginRes = await axios.post(`${baseUrl}/admin/login`, {
        email: testTokens.adminEmail,
        password: testTokens.adminPassword
      });
      
      const adminJWT = loginRes.data.data.token;
      const cmHeaders = {
        'Authorization': `Bearer ${adminJWT}`,
        'Content-Type': 'application/json'
      };
      
      // Try content-manager endpoints
      const cmRes = await axios.get(
        `${baseUrl}/content-manager/collection-types/api::article.article?page=1&pageSize=10&sort=id:DESC`, 
        { headers: cmHeaders }
      );
      
      console.log('Content Manager results:', cmRes.data.results.length, 'items');
      cmRes.data.results.forEach(item => {
        console.log(`- ID: ${item.id}, Title: ${item.title}, Locale: ${item.locale}`);
      });
    } catch (e) {
      console.log('Content manager access failed:', e.response?.status, e.message);
    }
    
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

debugLocaleCreation();