const axios = require('axios');

async function testI18n() {
  const baseUrl = 'http://localhost:1337';
  const token = '69d41e37ebcd086fedac699f82ea44b8eca6a07c7aa14e73ee460ef3480626b361ebadf69983e76c1744463081737d5221c0ef6717d0411889937f2c9a02a1abf01d4f944e4d8d732a87c4d93e5dbb517e760b8df096af53566eb897488e10f036c4fbb5a5a493bb493c42f9d573b22e00c9bd86806441d30c1abe750ba271c1';
  
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  try {
    console.log('1. Creating a test article in English...');
    const createRes = await axios.post(`${baseUrl}/api/articles`, {
      data: {
        title: 'Test Article',
        content: 'This is a test article in English',
        slug: 'test-article'
      }
    }, { headers });
    
    const documentId = createRes.data.data.documentId;
    console.log(`Created article with documentId: ${documentId}`);
    console.log('Response:', JSON.stringify(createRes.data.data, null, 2));

    console.log('\n2. Creating Russian version...');
    const ruRes = await axios.put(`${baseUrl}/api/articles/${documentId}?locale=ru`, {
      data: {
        title: 'Тестовая статья',
        content: 'Это тестовая статья на русском языке',
        slug: 'test-article-ru'
      }
    }, { headers });
    console.log('Russian response:', JSON.stringify(ruRes.data.data, null, 2));

    console.log('\n3. Fetching English version...');
    const enFetch = await axios.get(`${baseUrl}/api/articles/${documentId}?locale=en`, { headers });
    console.log('English fetch:', JSON.stringify(enFetch.data.data, null, 2));

    console.log('\n4. Fetching Russian version...');
    const ruFetch = await axios.get(`${baseUrl}/api/articles/${documentId}?locale=ru`, { headers });
    console.log('Russian fetch:', JSON.stringify(ruFetch.data.data, null, 2));

    console.log('\n5. Fetching with populate=locale...');
    const populateFetch = await axios.get(`${baseUrl}/api/articles/${documentId}?populate=locale`, { headers });
    console.log('Populate locale fetch:', JSON.stringify(populateFetch.data.data, null, 2));

    console.log('\n6. Fetching all articles with locale filter...');
    const allRu = await axios.get(`${baseUrl}/api/articles?locale=ru`, { headers });
    console.log('All Russian articles:', JSON.stringify(allRu.data.data, null, 2));

  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

testI18n();
